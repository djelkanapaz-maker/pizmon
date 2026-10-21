-- 1. Editorial playlists can mirror a public Spotify playlist (synced by an admin).
alter table public.playlists
  add column if not exists spotify_playlist_id text check (spotify_playlist_id is null or spotify_playlist_id ~ '^[A-Za-z0-9]{22}$'),
  add column if not exists artwork_url text check (artwork_url is null or artwork_url ~ '^https://'),
  add column if not exists synced_at timestamptz,
  add column if not exists sync_truncated boolean not null default false,
  add column if not exists is_main boolean not null default false;

do $$ begin
  alter table public.playlists add constraint playlists_spotify_unique unique (company_id, spotify_playlist_id);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table public.playlists add constraint spotify_is_editorial check (spotify_playlist_id is null or kind = 'editorial');
exception when duplicate_object then null; end $$;

-- 2. Each couple has one main playlist that every pick converges into.
do $$ begin
  alter table public.playlists add constraint main_is_couple check (not is_main or kind = 'couple');
exception when duplicate_object then null; end $$;
create unique index if not exists playlists_one_main_per_event on public.playlists (event_id) where is_main;

-- 3. Tracks imported from a provider are identified by the provider's id (NULLs stay distinct).
do $$ begin
  alter table public.music_tracks add constraint music_tracks_provider_unique unique (company_id, provider, provider_track_id);
exception when duplicate_object or duplicate_table then null; end $$;
