import httpx
import re
from typing import List, Dict, Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select

from app.core.config import settings
from app.db.session import get_db, get_redis
from app.db.models import Favorite, PlaybackHistory
from app.routers.auth import get_current_user
from app.services.ytmusic import YTMusicClient
from app.services.gemini import GeminiAIService

router = APIRouter(prefix="/tracks", tags=["Tracks & Playback"])


def _user_id(user: Dict[str, Any]) -> UUID:
    """Extract the authenticated user UUID from the Supabase JWT payload."""
    return UUID(user["sub"])

@router.get("/search")
def search(query: str, type: Optional[str] = None):
    """
    Search YouTube Music tracks, albums, artists, or playlists.
    Type can be: 'songs', 'albums', 'artists', 'playlists'.
    """
    try:
        return YTMusicClient.search_all(query, filter_type=type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@router.get("/trending")
def trending():
    """Fetch global trending music charts from YouTube Music."""
    try:
        return YTMusicClient.get_trending()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch charts: {str(e)}")

@router.get("/artist/{artist_id}")
def artist_details(artist_id: str):
    """Fetch detailed profile and top tracks of an artist."""
    try:
        return YTMusicClient.get_artist_details(artist_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Artist fetch failed: {str(e)}")

@router.get("/album/{album_id}")
def album_details(album_id: str):
    """Fetch album information and its track list."""
    try:
        return YTMusicClient.get_album_details(album_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Album fetch failed: {str(e)}")

@router.get("/related/{track_id}")
def related_tracks(track_id: str, limit: int = 15):
    """Get algorithmically recommended related tracks."""
    try:
        return YTMusicClient.get_related_tracks(track_id, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendations failed: {str(e)}")

@router.get("/stream/{track_id}")
async def get_stream_url(track_id: str):
    """
    Resolves the stream URL for a track. Points to the local proxy service
    which bypasses CORS and IP-binding restrictions.
    """
    proxy_url = f"{settings.STREAM_SERVICE_URL}/play?videoId={track_id}"
    return {"url": proxy_url, "cached": False}

@router.get("/play/{track_id}")
async def play_redirect(track_id: str):
    """Convenience redirect endpoint directly feeding the media player."""
    return RedirectResponse(url=f"{settings.STREAM_SERVICE_URL}/play?videoId={track_id}")

def plain_lyrics_to_lrc(raw_lyrics: str, duration_seconds: int) -> str:
    # Split lyrics into lines
    lines = [line.strip() for line in raw_lyrics.split("\n")]
    # Filter out empty lines
    lines = [line for line in lines if line]
    
    if not lines:
        return "[00:00.00] No lyrics text available"
        
    num_lines = len(lines)
    
    # Start lyrics after short intro (e.g. 8% of duration)
    intro_delay = min(15.0, max(4.0, duration_seconds * 0.08))
    # Finish lyrics slightly before the end
    outro_delay = min(10.0, max(3.0, duration_seconds * 0.05))
    
    usable_duration = duration_seconds - intro_delay - outro_delay
    if usable_duration <= 0:
        usable_duration = duration_seconds
        intro_delay = 0.0
        
    # Character-weighted pacing to match singing speed to word length
    # Strip spaces to count clean character lengths
    char_counts = [len(line.replace(" ", "")) for line in lines]
    total_chars = sum(char_counts)
    if total_chars == 0:
        total_chars = 1
        char_counts = [1] * num_lines
        
    lrc_lines = []
    current_time_seconds = intro_delay
    
    for idx, line in enumerate(lines):
        minutes = int(current_time_seconds // 60)
        seconds = int(current_time_seconds % 60)
        hundredths = int((current_time_seconds % 1) * 100)
        
        timestamp = f"[{minutes:02d}:{seconds:02d}.{hundredths:02d}]"
        lrc_lines.append(f"{timestamp} {line}")
        
        # Calculate proportionate duration based on text density
        line_proportion = char_counts[idx] / total_chars
        line_duration = line_proportion * usable_duration
        
        # Ensure a sensible minimum line display duration (e.g. 1.6s) to ensure readability
        line_duration = max(1.6, line_duration)
        current_time_seconds += line_duration
        
    return "\n".join(lrc_lines)

def clean_name(name: str) -> str:
    """
    Cleans track/artist names to improve search matches on LRCLIB.
    Removes things like '(Official Video)', '[Official Audio]', 'feat. Drake', etc.
    """
    if not name:
        return ""
    # Remove text in parentheses/brackets like (Official Video), [Official Audio], (feat. Drake), etc.
    name = re.sub(r'[\(\[][^\]\)]*(?:official|video|audio|lyric|remaster|edit|feat|ft|with|prod)[^\]\)]*[\)\]]', '', name, flags=re.IGNORECASE)
    # Remove standalone phrases like "feat.", "ft.", "official video", etc.
    name = re.sub(r'\b(?:official\s+(?:video|audio|lyrics?)|feat\.?|ft\.?)\b.*$', '', name, flags=re.IGNORECASE)
    # Remove trailing/leading spaces and dashes
    name = name.strip(" - \t\n\r")
    return name

_LYRICS_CACHE = {}

@router.get("/lyrics/{track_id}")
async def get_lyrics(
    track_id: str,
    title: Optional[str] = None,
    artist: Optional[str] = None,
    duration: Optional[str] = None,
    redis_client = Depends(get_redis)
):
    """
    Retrieves synced scrolling lyrics (.lrc format).
    Priority:
      1. LRCLIB.net Search — real timestamped synced lyrics (fuzzy duration matching)
      2. LRCLIB.net Get (Strict) — real timestamped synced lyrics
      3. LRCLIB.net Get/Search Plain — mathematically time-distributed
      4. YouTube Music plain lyrics — mathematically time-distributed
      5. Ambient placeholder
    """
    import json
    
    # 1. Check local memory cache
    if track_id in _LYRICS_CACHE:
        print(f"[Lyrics] Local memory cache hit for track: {track_id}")
        return _LYRICS_CACHE[track_id]

    # 2. Check Redis cache
    redis_key = f"lyrics:{track_id}"
    try:
        cached_val = redis_client.get(redis_key)
        if cached_val:
            parsed = json.loads(cached_val)
            _LYRICS_CACHE[track_id] = parsed
            print(f"[Lyrics] Redis cache hit for track: {track_id}")
            return parsed
    except Exception as e:
        print(f"[Lyrics] Redis lookup failed for track {track_id}: {e}")

    print(f"[Lyrics] Cache miss. Fetching lyrics for track: {track_id}")

    resolved_title = "Unknown Track"
    resolved_artist = "Unknown Artist"
    duration_seconds = 180

    # Try resolving from query parameters first
    has_params = False
    if title and artist:
        resolved_title = title
        resolved_artist = artist
        has_params = True
        if duration:
            try:
                if ":" in str(duration):
                    parts = str(duration).split(":")
                    if len(parts) == 2:
                        duration_seconds = int(parts[0]) * 60 + int(parts[1])
                    elif len(parts) == 3:
                        duration_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                else:
                    duration_seconds = int(float(duration))
            except Exception:
                pass
        print(f"[Lyrics] Dynamic query params resolved -> Title: '{resolved_title}', Artist: '{resolved_artist}', Duration: {duration_seconds}s")

    if not has_params:
        # Fetch track metadata from YTMusic
        try:
            details = YTMusicClient.get_track_details(track_id)
            resolved_title = details.get("title", "Unknown Track")

            artists_data = details.get("artists", details.get("author"))
            if isinstance(artists_data, list):
                # Safe parsing for mixed lists/dicts
                artist_names = []
                for a in artists_data:
                    if isinstance(a, dict):
                        artist_names.append(a.get("name", ""))
                    elif isinstance(a, str):
                        artist_names.append(a)
                resolved_artist = ", ".join([a for a in artist_names if a])
            elif isinstance(artists_data, str):
                resolved_artist = artists_data

            if "duration_seconds" in details:
                duration_seconds = details["duration_seconds"]
            else:
                length_str = details.get("length", "")
                if length_str:
                    parts = length_str.split(":")
                    if len(parts) == 2:
                        duration_seconds = int(parts[0]) * 60 + int(parts[1])
                    elif len(parts) == 3:
                        duration_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        except Exception as e:
            print(f"[Lyrics] Failed to fetch track metadata for {track_id}: {e}")

    cleaned_title = clean_name(resolved_title)
    cleaned_artist = clean_name(resolved_artist)
    print(f"[Lyrics] Cleaned query details -> Title: '{cleaned_title}', Artist: '{cleaned_artist}', Duration: {duration_seconds}s")

    # Helper to cache and return the result
    def cache_and_return(res_dict):
        _LYRICS_CACHE[track_id] = res_dict
        try:
            redis_client.setex(redis_key, 86400 * 7, json.dumps(res_dict)) # Cache for 7 days
        except Exception as e:
            print(f"[Lyrics] Failed to save in Redis for {track_id}: {e}")
        return res_dict

    # 2. Try LRCLIB Search with fuzzy matching
    try:
        print(f"[Lyrics] Querying LRCLIB Search API...")
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://lrclib.net/api/search",
                params={
                    "track_name": cleaned_title,
                    "artist_name": cleaned_artist
                },
                headers={"User-Agent": "MuseFlow/1.0 (https://github.com/museflow)"}
            )

        if resp.status_code == 200:
            results = resp.json()
            if results:
                print(f"[Lyrics] LRCLIB Search returned {len(results)} candidate results")
                
                # Filter candidates that have valid syncedLyrics
                synced_candidates = []
                for r in results:
                    synced = r.get("syncedLyrics", "")
                    if synced and "[" in synced:
                        r_dur = r.get("duration", 0)
                        diff = abs(r_dur - duration_seconds) if r_dur else 999
                        synced_candidates.append((diff, r))
                
                if synced_candidates:
                    # Sort by absolute duration difference ascending
                    synced_candidates.sort(key=lambda x: x[0])
                    best_diff, best_match = synced_candidates[0]
                    
                    # Accept match if duration is within 25 seconds
                    if best_diff <= 25:
                        print(f"[Lyrics] Found best synced lyrics match: '{best_match.get('trackName')}' by '{best_match.get('artistName')}' (Duration: {best_match.get('duration')}s, Diff: {best_diff:.1f}s) [Match]")
                        return cache_and_return({
                            "track_id": track_id,
                            "synced": True,
                            "source": "LRCLIB Search (Timestamped)",
                            "lyrics": best_match.get("syncedLyrics")
                        })
                    else:
                        print(f"[Lyrics] Closest synced match duration delta too large ({best_diff:.1f}s > 25s), skipping search result")
            else:
                print(f"[Lyrics] LRCLIB Search returned 0 results for clean query")
    except Exception as e:
        print(f"[Lyrics] LRCLIB Search failed: {e}")

    # 3. Fallback: Try LRCLIB Get (strict direct lookup as secondary safety)
    try:
        print(f"[Lyrics] Falling back to strict LRCLIB Get API...")
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(
                "https://lrclib.net/api/get",
                params={
                    "artist_name": resolved_artist,
                    "track_name": resolved_title,
                    "duration": duration_seconds
                },
                headers={"User-Agent": "MuseFlow/1.0 (https://github.com/museflow)"}
            )

        if resp.status_code == 200:
            data = resp.json()
            synced = data.get("syncedLyrics", "")
            if synced and "[" in synced:
                print(f"[Lyrics] Strict LRCLIB Get returned real synced lyrics [Match]")
                return cache_and_return({
                    "track_id": track_id,
                    "synced": True,
                    "source": "LRCLIB Get (Timestamped)",
                    "lyrics": synced
                })
            
            plain = data.get("plainLyrics", "")
            if plain:
                print(f"[Lyrics] Strict LRCLIB Get returned plain lyrics, pacing dynamically...")
                return cache_and_return({
                    "track_id": track_id,
                    "synced": True,
                    "source": "LRCLIB Get (Weighted Synced)",
                    "lyrics": plain_lyrics_to_lrc(plain, duration_seconds)
                })
    except Exception as e:
        print(f"[Lyrics] Strict LRCLIB Get failed: {e}")

    # 4. Fallback: YouTube Music plain lyrics
    try:
        yt_client = YTMusicClient.get_client()
        watch_playlist = yt_client.get_watch_playlist(videoId=track_id)
        lyrics_browse_id = watch_playlist.get("lyrics")
        if lyrics_browse_id:
            lyrics_data = yt_client.get_lyrics(lyrics_browse_id)
            yt_plain = lyrics_data.get("lyrics", "")
            if yt_plain:
                print(f"[Lyrics] Using YouTube Music plain lyrics fallback, pacing dynamically...")
                return cache_and_return({
                    "track_id": track_id,
                    "synced": True,
                    "source": "YouTube Music (Weighted Synced)",
                    "lyrics": plain_lyrics_to_lrc(yt_plain, duration_seconds)
                })
    except Exception as e:
        print(f"[Lyrics] YouTube Music lyrics fallback failed: {e}")

    # 5. Ambient placeholder — no lyrics found anywhere
    print(f"[Lyrics] No lyrics found for '{resolved_title}', using ambient placeholder")
    lrc_fallback = [
        "[00:00.00] ♫ Music is playing ♫",
        f"[00:08.00] {resolved_title}",
        f"[00:16.00] — {resolved_artist}",
        "[00:28.00] (Lyrics not available for this track)",
        "[00:44.00] ♫ Enjoy the music ♫",
        f"[01:10.00] ♫ {resolved_title} ♫",
        "[01:50.00] (Music Playing)",
        "[02:30.00] ♫ ♫ ♫",
    ]
    return cache_and_return({
        "track_id": track_id,
        "synced": True,
        "source": "MuseFlow Ambient",
        "lyrics": "\n".join(lrc_fallback)
    })




# --- FAVORITES MANAGEMENT ---
@router.post("/favorites/{track_id}", status_code=status.HTTP_201_CREATED)
def add_favorite(
    track_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _user_id(current_user)
    statement = select(Favorite).where(
        Favorite.user_id == uid,
        Favorite.track_id == track_id,
    )
    existing = db.exec(statement).first()
    if existing:
        return {"status": "already_liked", "message": "Song already in favorites"}

    favorite = Favorite(user_id=uid, track_id=track_id)
    db.add(favorite)
    db.commit()
    return {"status": "liked", "message": "Song added to favorites"}

@router.delete("/favorites/{track_id}")
def remove_favorite(
    track_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _user_id(current_user)
    statement = select(Favorite).where(
        Favorite.user_id == uid,
        Favorite.track_id == track_id,
    )
    favorite = db.exec(statement).first()
    if not favorite:
        raise HTTPException(status_code=404, detail="Song not found in favorites")

    db.delete(favorite)
    db.commit()
    return {"status": "unliked", "message": "Song removed from favorites"}

@router.get("/favorites")
def get_favorites(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    statement = select(Favorite).where(Favorite.user_id == _user_id(current_user)).order_by(Favorite.created_at.desc())
    favs = db.exec(statement).all()
    
    # Hydrate metadata dynamically
    hydrated_favorites = []
    for f in favs:
        try:
            details = YTMusicClient.get_track_details(f.track_id)
            # Safe thumbnail extraction
            thumbnail_url = None
            thumb_obj = details.get("thumbnail")
            if isinstance(thumb_obj, dict):
                thumb_list = thumb_obj.get("thumbnails")
                if isinstance(thumb_list, list) and len(thumb_list) > 0:
                    thumbnail_url = thumb_list[0].get("url")
            
            if not thumbnail_url:
                thumb_list = details.get("thumbnails")
                if isinstance(thumb_list, list) and len(thumb_list) > 0:
                    thumbnail_url = thumb_list[0].get("url")
            
            if not thumbnail_url:
                thumbnail_url = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300"

            hydrated_favorites.append({
                "favorite_id": f.id,
                "track_id": f.track_id,
                "liked_at": f.created_at,
                "title": details.get("title"),
                "artists": details.get("artists", details.get("author")),
                "album": details.get("album"),
                "thumbnail": thumbnail_url
            })
        except Exception:
            # Fallback if specific metadata lookup fails
            hydrated_favorites.append({
                "favorite_id": f.id,
                "track_id": f.track_id,
                "liked_at": f.created_at,
                "title": "Unknown Song",
                "artists": "Unknown Artist"
            })
    return hydrated_favorites

# --- PLAYBACK HISTORY ---
@router.post("/history/{track_id}")
def log_history(
    track_id: str,
    duration: int = 0,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    history_item = PlaybackHistory(
        user_id=_user_id(current_user),
        track_id=track_id,
        duration_played_seconds=duration,
    )
    db.add(history_item)
    db.commit()
    return {"status": "logged"}

@router.get("/history")
def get_history(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    statement = select(PlaybackHistory).where(
        PlaybackHistory.user_id == _user_id(current_user)
    ).order_by(PlaybackHistory.played_at.desc()).limit(20)
    history = db.exec(statement).all()
    
    # We do deduplication by song for recently played dashboard
    seen = set()
    hydrated_history = []
    
    for h in history:
        if h.track_id in seen:
            continue
        seen.add(h.track_id)
        try:
            details = YTMusicClient.get_track_details(h.track_id)
            # Safe thumbnail extraction
            thumbnail_url = None
            thumb_obj = details.get("thumbnail")
            if isinstance(thumb_obj, dict):
                thumb_list = thumb_obj.get("thumbnails")
                if isinstance(thumb_list, list) and len(thumb_list) > 0:
                    thumbnail_url = thumb_list[0].get("url")
            
            if not thumbnail_url:
                thumb_list = details.get("thumbnails")
                if isinstance(thumb_list, list) and len(thumb_list) > 0:
                    thumbnail_url = thumb_list[0].get("url")
            
            if not thumbnail_url:
                thumbnail_url = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300"

            hydrated_history.append({
                "history_id": h.id,
                "track_id": h.track_id,
                "played_at": h.played_at,
                "title": details.get("title"),
                "artists": details.get("artists", details.get("author")),
                "album": details.get("album"),
                "thumbnail": thumbnail_url
            })
        except Exception:
            hydrated_history.append({
                "history_id": h.id,
                "track_id": h.track_id,
                "played_at": h.played_at,
                "title": "Unknown Track"
            })
    return hydrated_history

# --- AI PLAYLIST GENERATOR ---
@router.post("/ai/generate")
def generate_ai_playlist(prompt: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Accepts natural language playlist ideas (e.g. 'coding tunes'), calls Gemini to decode
    queries, performs YouTube searches, and returns hydrated tracks with active mood metrics.
    """
    ai_response = GeminiAIService.generate_playlist_queries(prompt)
    queries = ai_response.get("search_queries", [prompt])
    
    generated_tracks = []
    seen_track_ids = set()

    for query in queries:
        try:
            search_results = YTMusicClient.search_all(query, filter_type="songs")
            # Pull the top 3 matches for each query to mix up the playlist
            for track in search_results[:3]:
                track_id = track.get("videoId")
                if track_id and track_id not in seen_track_ids:
                    seen_track_ids.add(track_id)
                    
                    thumbnail_list = track.get("thumbnails", [{}])
                    thumbnail_url = thumbnail_list[0].get("url") if thumbnail_list else None
                    
                    generated_tracks.append({
                        "track_id": track_id,
                        "title": track.get("title"),
                        "artists": track.get("artists"),
                        "album": track.get("album"),
                        "thumbnail": thumbnail_url,
                        "duration": track.get("duration")
                    })
        except Exception as e:
            print(f"[AI Router] Failed search query '{query}': {e}")
            continue

    return {
        "prompt": prompt,
        "mood_profile": ai_response.get("mood_profile"),
        "track_count": len(generated_tracks),
        "tracks": generated_tracks
    }
