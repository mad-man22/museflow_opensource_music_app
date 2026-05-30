from typing import List, Dict, Any, Optional
from ytmusicapi import YTMusic

class YTMusicClient:
    _instance: Optional[YTMusic] = None

    _track_details_cache: Dict[str, Any] = {}

    @classmethod
    def get_client(cls) -> YTMusic:
        if cls._instance is None:
            # We initialize without auth headers for dynamic, anonymous public lookups
            cls._instance = YTMusic()
        return cls._instance

    @classmethod
    def search_all(cls, query: str, filter_type: Optional[str] = None) -> List[Dict[str, Any]]:
        client = cls.get_client()
        # filter_type can be 'songs', 'videos', 'albums', 'artists', 'playlists'
        results = client.search(query, filter=filter_type)
        return results

    @classmethod
    def get_track_details(cls, track_id: str) -> Dict[str, Any]:
        if track_id in cls._track_details_cache:
            return cls._track_details_cache[track_id]

        client = cls.get_client()
        # Try get_song (substantially faster, 2s vs 15s, and immune to SSL/EOF playlist retrieval errors)
        try:
            song = client.get_song(videoId=track_id)
            details = song.get("videoDetails", {})
            if details:
                length_sec = int(details.get("lengthSeconds", 0))
                minutes = length_sec // 60
                seconds = length_sec % 60
                length_str = f"{minutes}:{seconds:02d}"
                
                res = {
                    "videoId": details.get("videoId"),
                    "title": details.get("title"),
                    "author": details.get("author"),
                    "artists": [{"name": details.get("author"), "id": details.get("channelId")}],
                    "length": length_str,
                    "thumbnail": details.get("thumbnail"),
                    "album": {"name": details.get("title")}, # Mock album for compatibility
                    "duration_seconds": length_sec
                }
                cls._track_details_cache[track_id] = res
                return res
        except Exception as e:
            print(f"[YTMusicClient] Optimized get_track_details failed, falling back: {e}")
            
        # Fallback to slower watch playlist
        watch_playlist = client.get_watch_playlist(videoId=track_id, limit=1)
        tracks = watch_playlist.get("tracks", [])
        if not tracks:
            raise ValueError(f"Metadata not found for track: {track_id}")
        
        res = tracks[0]
        cls._track_details_cache[track_id] = res
        return res

    @classmethod
    def get_artist_details(cls, artist_id: str) -> Dict[str, Any]:
        client = cls.get_client()
        return client.get_artist(channelId=artist_id)

    @classmethod
    def get_album_details(cls, album_id: str) -> Dict[str, Any]:
        client = cls.get_client()
        return client.get_album(browseId=album_id)

    @classmethod
    def get_playlist_details(cls, playlist_id: str) -> Dict[str, Any]:
        client = cls.get_client()
        return client.get_playlist(playlistId=playlist_id)

    @classmethod
    def get_trending(cls) -> List[Dict[str, Any]]:
        client = cls.get_client()
        # YouTube Music's trending can be pulled via charts or searching popular tags
        try:
            charts = client.get_charts(country="US")
            songs = charts.get("videos", {}).get("items", [])
            if not songs:
                songs = charts.get("songs", {}).get("items", [])
            return songs
        except Exception:
            # Fallback search if charts fail
            return client.search("trending songs", filter="songs")

    @classmethod
    def get_related_tracks(cls, track_id: str, limit: int = 15) -> List[Dict[str, Any]]:
        client = cls.get_client()
        # watch_playlist returns high-fidelity recommendations of related tracks
        playlist = client.get_watch_playlist(videoId=track_id, limit=limit)
        return playlist.get("tracks", [])[1:] # Exclude the track itself
