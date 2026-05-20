import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from sqlmodel import create_engine, select, Session
from app.db.models import User, Playlist, Favorite, PlaylistTrack, PlaybackHistory

def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set.")
        return

    print("Connecting to database...")
    engine = create_engine(db_url)
    
    with Session(engine) as session:
        # 1. Fetch user profiles
        users = session.exec(select(User)).all()
        print(f"Users found: {len(users)}")
        for u in users:
            print(f"  User ID: {u.id}, Email: {getattr(u, 'email', 'N/A')}, Display Name: {getattr(u, 'display_name', 'N/A')}")
            
        if not users:
            print("No users found. Cannot proceed with inserting test playlist.")
            return
            
        target_user = users[0]
        
        # 2. Try inserting a test playlist
        print(f"Inserting test playlist for User ID {target_user.id}...")
        test_pl = Playlist(
            title="Test Playlist SQLModel",
            description="Testing Supabase Pooler writes",
            is_public=False,
            cover_url="https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17",
            user_id=target_user.id
        )
        try:
            session.add(test_pl)
            session.commit()
            session.refresh(test_pl)
            print(f"✅ Success! Created Playlist ID: {test_pl.id}")
            
            # Delete it right after to keep clean
            session.delete(test_pl)
            session.commit()
            print("✅ Cleaned up test playlist.")
        except Exception as e:
            print("❌ Failed to create playlist:")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    main()
