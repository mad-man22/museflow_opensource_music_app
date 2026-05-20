from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Relationship, JSON, Column

# --- USER MODELS ---
class UserBase(SQLModel):
    email: str = Field(unique=True, index=True)
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    settings: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

class User(UserBase, table=True):
    __tablename__ = "profiles"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    playlists: List["Playlist"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    favorites: List["Favorite"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    history: List["PlaybackHistory"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class UserCreate(SQLModel):
    email: str
    password: str
    display_name: str

class UserRead(SQLModel):
    id: UUID
    email: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    settings: Dict[str, Any]
    created_at: datetime

# --- PLAYLIST MODELS ---
class PlaylistBase(SQLModel):
    title: str
    description: Optional[str] = None
    is_public: bool = Field(default=False)
    cover_url: Optional[str] = None

class Playlist(PlaylistBase, table=True):
    __tablename__ = "playlists"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="profiles.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    user: User = Relationship(back_populates="playlists")
    tracks: List["PlaylistTrack"] = Relationship(back_populates="playlist", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class PlaylistCreate(PlaylistBase):
    pass

class PlaylistRead(PlaylistBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

# --- PLAYLIST TRACKS LINK SCHEMA ---
class PlaylistTrack(SQLModel, table=True):
    __tablename__ = "playlist_tracks"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    playlist_id: UUID = Field(foreign_key="playlists.id", index=True)
    track_id: str = Field(index=True) # YouTube Video ID
    position: int = Field(default=0)
    added_at: datetime = Field(default_factory=datetime.utcnow)

    playlist: Playlist = Relationship(back_populates="tracks")

class PlaylistTrackCreate(SQLModel):
    track_id: str
    position: Optional[int] = 0

# --- FAVORITES ---
class Favorite(SQLModel, table=True):
    __tablename__ = "favorites"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="profiles.id", index=True)
    track_id: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: User = Relationship(back_populates="favorites")

# --- PLAYBACK HISTORY ---
class PlaybackHistory(SQLModel, table=True):
    __tablename__ = "playback_history"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="profiles.id", index=True)
    track_id: str = Field(index=True)
    duration_played_seconds: int = Field(default=0)
    played_at: datetime = Field(default_factory=datetime.utcnow)

    user: User = Relationship(back_populates="history")
