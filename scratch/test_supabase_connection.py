import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from sqlmodel import create_engine, select, Session
from app.db.models import User, Playlist, Favorite, PlaylistTrack, PlaybackHistory

def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not set in environment.")
        sys.exit(1)
        
    print("Testing connection string (censored password)...")
    censored_url = db_url
    if ":" in db_url and "@" in db_url:
        parts = db_url.split("@")
        user_pass = parts[0].split(":")
        if len(user_pass) > 2:
            censored_url = f"{user_pass[0]}:{user_pass[1]}:****@{parts[1]}"
    print("Connecting to:", censored_url)
    
    engine = create_engine(db_url)
    
    # 1. Test profiles
    try:
        with Session(engine) as session:
            results = session.exec(select(User).limit(1)).all()
            print("✅ Successfully queried profiles table! Rows fetched:", len(results))
    except Exception as e:
        print("❌ Failed to query profiles table:", e)
        
    # 2. Test playlists
    try:
        with Session(engine) as session:
            results = session.exec(select(Playlist).limit(1)).all()
            print("✅ Successfully queried playlists table! Rows fetched:", len(results))
    except Exception as e:
        print("❌ Failed to query playlists table:", e)

    # 3. Test favorites
    try:
        with Session(engine) as session:
            results = session.exec(select(Favorite).limit(1)).all()
            print("✅ Successfully queried favorites table! Rows fetched:", len(results))
    except Exception as e:
        print("❌ Failed to query favorites table:", e)

    # 4. Test playlist_tracks
    try:
        with Session(engine) as session:
            results = session.exec(select(PlaylistTrack).limit(1)).all()
            print("✅ Successfully queried playlist_tracks table! Rows fetched:", len(results))
    except Exception as e:
        print("❌ Failed to query playlist_tracks table:", e)

    # 5. Test playback_history
    try:
        with Session(engine) as session:
            results = session.exec(select(PlaybackHistory).limit(1)).all()
            print("✅ Successfully queried playback_history table! Rows fetched:", len(results))
    except Exception as e:
        print("❌ Failed to query playback_history table:", e)

if __name__ == "__main__":
    main()
