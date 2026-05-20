-- ==========================================
-- MUSEFLOW DATABASE MIGRATION SCRIPT (SUPABASE)
-- Run this in your Supabase SQL Editor.
-- ==========================================

-- --- 1. PROFILES TABLE (Linked to auth.users) ---
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  avatar_url text,
  settings jsonb default '{"theme": "dark", "normalize_volume": true, "audio_quality": "high"}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- RLS Policies for Profiles
create policy "Allow public read access to profiles" on public.profiles
  for select using (true);

create policy "Allow users to update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- Trigger to automatically create profile on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if it already exists
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- --- 2. FAVORITES TABLE ---
create table if not exists public.favorites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  track_id text not null, -- YouTube Video ID
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Prevent duplicate favorites per song for same user
  unique(user_id, track_id)
);

-- Indexes for lightning fast lookups
create index if not exists favorites_user_id_idx on public.favorites(user_id);
create index if not exists favorites_track_id_idx on public.favorites(track_id);

-- Enable RLS
alter table public.favorites enable row level security;

-- RLS Policies for Favorites
create policy "Users can select their own favorites" on public.favorites
  for select using (auth.uid() = user_id);

create policy "Users can insert their own favorites" on public.favorites
  for insert with check (auth.uid() = user_id);

create policy "Users can delete their own favorites" on public.favorites
  for delete using (auth.uid() = user_id);


-- --- 3. PLAYLISTS TABLE ---
create table if not exists public.playlists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  cover_url text,
  is_public boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists playlists_user_id_idx on public.playlists(user_id);

-- Enable RLS
alter table public.playlists enable row level security;

-- RLS Policies for Playlists
create policy "Users can view public playlists or their own" on public.playlists
  for select using (is_public = true or auth.uid() = user_id);

create policy "Users can create their own playlists" on public.playlists
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own playlists" on public.playlists
  for update using (auth.uid() = user_id);

create policy "Users can delete their own playlists" on public.playlists
  for delete using (auth.uid() = user_id);


-- --- 4. PLAYLIST TRACKS LINK TABLE ---
create table if not exists public.playlist_tracks (
  id uuid default gen_random_uuid() primary key,
  playlist_id uuid references public.playlists(id) on delete cascade not null,
  track_id text not null, -- YouTube Video ID
  position integer default 0 not null,
  added_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists playlist_tracks_playlist_id_idx on public.playlist_tracks(playlist_id);

-- Enable RLS
alter table public.playlist_tracks enable row level security;

-- RLS Policies for Playlist Tracks (Linked via parent playlists table user check)
create policy "Users can select tracks from visible playlists" on public.playlist_tracks
  for select using (
    exists (
      select 1 from public.playlists
      where id = playlist_id and (is_public = true or auth.uid() = user_id)
    )
  );

create policy "Users can insert tracks to their own playlists" on public.playlist_tracks
  for insert with check (
    exists (
      select 1 from public.playlists
      where id = playlist_id and auth.uid() = user_id
    )
  );

create policy "Users can update track positions in their own playlists" on public.playlist_tracks
  for update using (
    exists (
      select 1 from public.playlists
      where id = playlist_id and auth.uid() = user_id
    )
  );

create policy "Users can delete tracks from their own playlists" on public.playlist_tracks
  for delete using (
    exists (
      select 1 from public.playlists
      where id = playlist_id and auth.uid() = user_id
    )
  );


-- --- 5. PLAYBACK HISTORY TABLE ---
create table if not exists public.playback_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  track_id text not null, -- YouTube Video ID
  duration_played_seconds integer default 0 not null,
  played_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists playback_history_user_id_idx on public.playback_history(user_id);

-- Enable RLS
alter table public.playback_history enable row level security;

-- RLS Policies for History
create policy "Users can view their own history" on public.playback_history
  for select using (auth.uid() = user_id);

create policy "Users can log their own history" on public.playback_history
  for insert with check (auth.uid() = user_id);

create policy "Users can delete their own history logs" on public.playback_history
  for delete using (auth.uid() = user_id);
