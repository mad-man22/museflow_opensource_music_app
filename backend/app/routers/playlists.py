from typing import List, Dict, Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db.session import get_db
from app.db.models import Playlist, PlaylistCreate, PlaylistRead, PlaylistTrack
from app.routers.auth import get_current_user
from app.services.ytmusic import YTMusicClient

router = APIRouter(prefix="/playlists", tags=["Playlists"])


def _user_id(user: Dict[str, Any]) -> UUID:
    """Extract the authenticated user's UUID from the Supabase JWT payload."""
    return UUID(user["sub"])


@router.post("", response_model=PlaylistRead, status_code=status.HTTP_201_CREATED)
def create_playlist(
    playlist_in: PlaylistCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = Playlist(
        title=playlist_in.title,
        description=playlist_in.description,
        is_public=playlist_in.is_public,
        cover_url=playlist_in.cover_url or "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop",
        user_id=_user_id(current_user),
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return playlist


@router.get("", response_model=List[PlaylistRead])
def get_playlists(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    statement = select(Playlist).where(Playlist.user_id == _user_id(current_user))
    return db.exec(statement).all()


@router.get("/{playlist_id}")
def get_playlist(
    playlist_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = db.get(Playlist, playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    uid = _user_id(current_user)
    if not playlist.is_public and playlist.user_id != uid:
        raise HTTPException(status_code=403, detail="Not authorized to view this private playlist")

    statement = (
        select(PlaylistTrack)
        .where(PlaylistTrack.playlist_id == playlist.id)
        .order_by(PlaylistTrack.position)
    )
    track_links = db.exec(statement).all()

    hydrated_tracks = []
    for link in track_links:
        try:
            details = YTMusicClient.get_track_details(link.track_id)

            # Thumbnail: support multiple shapes returned by YTMusicClient
            thumbnail_url = None
            if isinstance(details.get("thumbnails"), list) and details.get("thumbnails"):
                thumbnail_url = details["thumbnails"][0].get("url")
            else:
                thumb = details.get("thumbnail")
                if isinstance(thumb, dict):
                    # Some shapes embed thumbnails under a `thumbnails` key
                    tlist = thumb.get("thumbnails") or thumb.get("thumbnails", [])
                    if isinstance(tlist, list) and tlist:
                        thumbnail_url = tlist[0].get("url")
                    else:
                        thumbnail_url = thumb.get("url")
                elif isinstance(thumb, str):
                    thumbnail_url = thumb

            # Title / artists / album / duration: support alternative keys
            title = details.get("title") or details.get("name") or details.get("videoTitle")
            artists = details.get("artists") or details.get("author") or details.get("channel")
            album = details.get("album") or (details.get("album") and details.get("album").get("name"))
            duration = (
                details.get("duration")
                or details.get("length")
                or details.get("lengthSeconds")
                or details.get("duration_seconds")
            )

            hydrated_tracks.append({
                "link_id": link.id,
                "track_id": link.track_id,
                "position": link.position,
                "title": title,
                "artists": artists,
                "album": album,
                "thumbnail": thumbnail_url,
                "duration": duration,
            })
        except Exception:
            hydrated_tracks.append({
                "link_id": link.id,
                "track_id": link.track_id,
                "position": link.position,
                "title": "Unknown Track",
                "artists": "Unknown Artist",
            })

    playlist_data = playlist.model_dump()
    playlist_data["tracks"] = hydrated_tracks
    return playlist_data


@router.put("/{playlist_id}", response_model=PlaylistRead)
def update_playlist(
    playlist_id: UUID,
    playlist_in: PlaylistCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = db.get(Playlist, playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if playlist.user_id != _user_id(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to edit this playlist")

    playlist.title = playlist_in.title
    playlist.description = playlist_in.description
    playlist.is_public = playlist_in.is_public
    if playlist_in.cover_url:
        playlist.cover_url = playlist_in.cover_url

    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return playlist


@router.delete("/{playlist_id}")
def delete_playlist(
    playlist_id: UUID,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = db.get(Playlist, playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if playlist.user_id != _user_id(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to delete this playlist")

    db.delete(playlist)
    db.commit()
    return {"status": "deleted", "message": "Playlist deleted successfully"}


# --- PLAYLIST TRACK LINKS ---
@router.post("/{playlist_id}/tracks")
def add_track_to_playlist(
    playlist_id: UUID,
    track_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = db.get(Playlist, playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if playlist.user_id != _user_id(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to modify this playlist")

    count_statement = select(PlaylistTrack).where(PlaylistTrack.playlist_id == playlist.id)
    existing_count = len(db.exec(count_statement).all())

    link = PlaylistTrack(
        playlist_id=playlist.id,
        track_id=track_id,
        position=existing_count,
    )
    db.add(link)
    db.commit()
    return {"status": "added", "link_id": link.id, "position": link.position}


@router.delete("/{playlist_id}/tracks/{track_id}")
def remove_track_from_playlist(
    playlist_id: UUID,
    track_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = db.get(Playlist, playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if playlist.user_id != _user_id(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to modify this playlist")

    statement = select(PlaylistTrack).where(
        PlaylistTrack.playlist_id == playlist.id,
        PlaylistTrack.track_id == track_id,
    )
    link = db.exec(statement).first()
    if not link:
        raise HTTPException(status_code=404, detail="Track not found in playlist")

    db.delete(link)
    db.commit()
    return {"status": "removed", "message": "Track removed from playlist"}
