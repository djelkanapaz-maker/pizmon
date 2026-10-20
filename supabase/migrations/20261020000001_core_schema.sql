-- WEDDING MUSIC CLUB — core schema
-- Every private row is scoped to a company; couple-owned rows hang off wedding_events.

-- ─────────────────────────── enums ───────────────────────────
create type public.member_role as enum ('admin', 'dj', 'couple');
create type public.assignment_policy as enum ('company_assigned', 'couple_selects');
create type public.assignment_status as enum ('proposed', 'pending_approval', 'confirmed', 'declined', 'ended');
create type public.assignment_source as enum ('admin', 'couple');
create type public.publication_status as enum ('draft', 'published', 'archived');
create type public.rights_status as enum ('metadata_only', 'preview_licensed', 'full_licensed', 'company_owned');
create type public.selection_status as enum ('not_started', 'browsing', 'shortlisted', 'awaiting_confirmation', 'confirmed', 'change_requested');
create type public.restriction_kind as enum ('must_play', 'never_play');
create type public.restriction_strength as enum ('preference', 'absolute');
create type public.restriction_target as enum ('track', 'artist', 'genre', 'text');
create type public.playlist_kind as enum ('editorial', 'dj', 'couple');
create type public.playlist_track_status as enum ('tentative', 'confirmed', 'backup');
create type public.response_status as enum ('in_progress', 'submitted');
create type public.recommendation_status as enum ('pending', 'approved', 'rejected', 'saved', 'question');
create type public.request_status as enum ('open', 'in_progress', 'awaiting_couple', 'resolved', 'closed');
create type public.content_kind as enum ('mix', 'training_set', 'genre_set', 'editorial', 'new_music', 'behind_the_scenes', 'release', 'seasonal', 'wedding_collection', 'video');
create type public.content_visibility as enum ('company', 'event');
create type public.radio_mode as enum ('off', 'demo', 'live');

-- ─────────────────────────── companies & people ───────────────────────────
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  brand_name text not null default 'WEDDING MUSIC CLUB',
  brand_tagline_he text,
  brand_tagline_en text,
  assignment_policy public.assignment_policy not null default 'couple_selects',
  -- couple picks require admin approval before they are confirmed
  couple_selection_requires_approval boolean not null default true,
  default_locale text not null default 'he' check (default_locale in ('he', 'en')),
  contact_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  locale text not null default 'he' check (locale in ('he', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index on public.company_members (user_id);

create table public.djs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid unique references auth.users (id) on delete set null,
  display_name text not null,
  slug text not null,
  bio_he text,
  bio_en text,
  specialties text[] not null default '{}',
  photo_url text,
  is_active boolean not null default true,
  accepts_new_couples boolean not null default true,
  sort_order int not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, slug)
);
create index on public.djs (company_id);

-- A couple workspace. Partners log in as couple_members of the event.
create table public.wedding_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  partner_one_name text not null,
  partner_two_name text,
  wedding_date date,
  venue_name text,
  venue_city text,
  guest_count int check (guest_count is null or guest_count between 1 and 5000),
  languages text[] not null default '{he}',
  cultural_notes text,
  onboarding_step text not null default 'welcome' check (onboarding_step in ('welcome', 'dj', 'details', 'done')),
  onboarding_completed_at timestamptz,
  invite_email text,
  created_by uuid references auth.users (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.wedding_events (company_id, wedding_date);

create table public.couple_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.wedding_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index on public.couple_members (user_id);

create table public.dj_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.wedding_events (id) on delete cascade,
  dj_id uuid not null references public.djs (id) on delete restrict,
  status public.assignment_status not null,
  source public.assignment_source not null,
  created_by uuid references auth.users (id) on delete set null,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- at most one live assignment per event; history rows are 'declined' / 'ended'
create unique index dj_assignments_one_active on public.dj_assignments (event_id)
  where status in ('proposed', 'pending_approval', 'confirmed');
create index on public.dj_assignments (dj_id, status);

-- Explicit company authorization for staff to view an event they are not assigned to.
create table public.event_access_grants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.wedding_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- Per-DJ "last reviewed" marker → "changes since your last review".
create table public.dj_event_reviews (
  dj_id uuid not null references public.djs (id) on delete cascade,
  event_id uuid not null references public.wedding_events (id) on delete cascade,
  last_reviewed_at timestamptz not null default now(),
  primary key (dj_id, event_id)
);

-- ─────────────────────────── catalog ───────────────────────────
create table public.genres (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  slug text not null,
  name_he text not null,
  name_en text not null,
  sort_order int not null default 0,
  unique (company_id, slug)
);

-- kind: 'category' (discover shelves, editable), 'mood'
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('category', 'mood')),
  slug text not null,
  name_he text not null,
  name_en text not null,
  sort_order int not null default 0,
  unique (company_id, kind, slug)
);

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  name_alt text,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null,
  artist_id uuid not null references public.artists (id) on delete restrict,
  album text,
  genre_id uuid references public.genres (id) on delete set null,
  energy smallint check (energy between 1 and 5),
  language text check (language in ('he', 'en', 'ar', 'fr', 'es', 'instrumental', 'other')),
  decade smallint check (decade is null or decade between 1900 and 2100),
  artwork_url text,
  provider text check (provider in ('spotify', 'apple_music', 'youtube', 'soundcloud', 'company')),
  provider_track_id text,
  preview_url text,
  playback_url text,
  external_url text,
  rights_status public.rights_status not null default 'metadata_only',
  rights_notes text,
  status public.publication_status not null default 'draft',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- a playable URL must be backed by a matching rights declaration
  constraint preview_requires_rights check (preview_url is null or rights_status in ('preview_licensed', 'full_licensed', 'company_owned')),
  constraint playback_requires_rights check (playback_url is null or rights_status in ('full_licensed', 'company_owned'))
);
create index on public.music_tracks (company_id, status);
create index on public.music_tracks (artist_id);
create index on public.music_tracks (genre_id);
create index music_tracks_title_search on public.music_tracks using gin (to_tsvector('simple', title));

create table public.track_tags (
  track_id uuid not null references public.music_tracks (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (track_id, tag_id)
);
create index on public.track_tags (tag_id);

-- ─────────────────────────── wedding moments ───────────────────────────
create table public.wedding_moments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  slug text not null,
  name_he text not null,
  name_en text not null,
  description_he text,
  description_en text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  is_required boolean not null default true,
  -- Hebrew/Israeli vs international collections (e.g. breaking the glass)
  has_language_collections boolean not null default false,
  unique (company_id, slug)
);

create table public.moment_tracks (
  moment_id uuid not null references public.wedding_moments (id) on delete cascade,
  track_id uuid not null references public.music_tracks (id) on delete cascade,
  collection text check (collection in ('he', 'intl')),
  sort_order int not null default 0,
  primary key (moment_id, track_id)
);

create table public.moment_selections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.wedding_events (id) on delete cascade,
  moment_id uuid not null references public.wedding_moments (id) on delete cascade,
  status public.selection_status not null default 'browsing',
  primary_track_id uuid references public.music_tracks (id) on delete set null,
  backup_track_id uuid references public.music_tracks (id) on delete set null,
  custom_song text,           -- a song not (yet) in the catalog, typed by the couple
  shortlist uuid[] not null default '{}',
  notes text,
  confirmed_at timestamptz,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, moment_id),
  constraint confirmed_needs_song check (status <> 'confirmed' or primary_track_id is not null or custom_song is not null)
);

-- ─────────────────────────── questionnaire ───────────────────────────
create table public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.questionnaire_versions (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.questionnaires (id) on delete cascade,
  version int not null,
  definition jsonb not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (questionnaire_id, version)
);

create table public.questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.wedding_events (id) on delete cascade,
  version_id uuid not null references public.questionnaire_versions (id) on delete restrict,
  answers jsonb not null default '{}',
  completed_sections text[] not null default '{}',
  status public.response_status not null default 'in_progress',
  submitted_at timestamptz,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────── restrictions ───────────────────────────
create table public.music_restrictions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.wedding_events (id) on delete cascade,
  kind public.restriction_kind not null,
  strength public.restriction_strength not null default 'absolute',
  target_type public.restriction_target not null,
  track_id uuid references public.music_tracks (id) on delete cascade,
  artist_id uuid references public.artists (id) on delete cascade,
  genre_id uuid references public.genres (id) on delete cascade,
  text_value text,
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint target_matches check (
    (target_type = 'track' and track_id is not null) or
    (target_type = 'artist' and artist_id is not null) or
    (target_type = 'genre' and genre_id is not null) or
    (target_type = 'text' and coalesce(length(trim(text_value)), 0) > 0)
  )
);
create index on public.music_restrictions (event_id, kind);
create unique index restriction_unique_track on public.music_restrictions (event_id, kind, track_id) where track_id is not null;
create unique index restriction_unique_artist on public.music_restrictions (event_id, kind, artist_id) where artist_id is not null;
create unique index restriction_unique_genre on public.music_restrictions (event_id, kind, genre_id) where genre_id is not null;

-- ─────────────────────────── favourites / playlists ───────────────────────────
create table public.saved_tracks (
  event_id uuid not null references public.wedding_events (id) on delete cascade,
  track_id uuid not null references public.music_tracks (id) on delete cascade,
  saved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, track_id)
);

create table public.rejected_tracks (
  event_id uuid not null references public.wedding_events (id) on delete cascade,
  track_id uuid not null references public.music_tracks (id) on delete cascade,
  rejected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, track_id)
);

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind public.playlist_kind not null,
  event_id uuid references public.wedding_events (id) on delete cascade,
  dj_id uuid references public.djs (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  description text,
  purpose text,
  status public.publication_status not null default 'published',
  shared_with_dj boolean not null default true,
  is_featured boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint playlist_owner check (
    (kind = 'couple' and event_id is not null) or
    (kind = 'dj' and dj_id is not null and event_id is null) or
    (kind = 'editorial' and event_id is null)
  )
);
create index on public.playlists (company_id, kind);
create index on public.playlists (event_id);

create table public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  track_id uuid not null references public.music_tracks (id) on delete cascade,
  position int not null default 0,
  status public.playlist_track_status not null default 'tentative',
  note text,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (playlist_id, track_id)
);
create index on public.playlist_tracks (playlist_id, position);

-- ─────────────────────────── DJ ↔ couple collaboration ───────────────────────────
create table public.dj_recommendations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.wedding_events (id) on delete cascade,
  dj_id uuid references public.djs (id) on delete set null,
  track_id uuid references public.music_tracks (id) on delete cascade,
  playlist_id uuid references public.playlists (id) on delete cascade,
  moment_id uuid references public.wedding_moments (id) on delete set null,
  message text,
  is_ai_suggestion boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint rec_has_subject check (track_id is not null or playlist_id is not null or coalesce(length(trim(message)), 0) > 0)
);
create index on public.dj_recommendations (event_id, created_at desc);

create table public.recommendation_responses (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null unique references public.dj_recommendations (id) on delete cascade,
  status public.recommendation_status not null,
  comment text,
  responded_by uuid references auth.users (id) on delete set null,
  responded_at timestamptz not null default now()
);

create table public.couple_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.wedding_events (id) on delete cascade,
  category text not null check (category in ('choose_song', 'israeli_balance', 'review_selections', 'change_confirmed', 'family_request', 'clarification', 'other')),
  title text not null check (length(trim(title)) between 1 and 160),
  description text,
  moment_id uuid references public.wedding_moments (id) on delete set null,
  status public.request_status not null default 'open',
  -- true when the DJ opened it ("request for clarification")
  opened_by_staff boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.couple_requests (event_id, status);

create table public.request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.couple_requests (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.request_messages (request_id, created_at);

-- Staff-only. Never readable by couples (see RLS).
create table public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.wedding_events (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (length(trim(body)) between 1 and 8000),
  created_at timestamptz not null default now()
);
create index on public.internal_notes (event_id, created_at desc);

-- ─────────────────────────── activity & notifications ───────────────────────────
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  event_id uuid references public.wedding_events (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  type text not null,
  entity_type text,
  entity_id uuid,
  is_important boolean not null default false,
  -- staff_only rows are hidden from couples (e.g. assignment approvals)
  staff_only boolean not null default false,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.activity_events (event_id, created_at desc);
create index on public.activity_events (company_id, type, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  event_id uuid references public.wedding_events (id) on delete cascade,
  type text not null,
  title_he text not null,
  title_en text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, read_at, created_at desc);

-- ─────────────────────────── content & radio ───────────────────────────
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind public.content_kind not null,
  title text not null,
  description text,
  creator_dj_id uuid references public.djs (id) on delete set null,
  artwork_url text,
  media_url text,         -- authorized, company-hosted audio/video
  external_url text,      -- e.g. SoundCloud / YouTube page
  duration_seconds int check (duration_seconds is null or duration_seconds > 0),
  genre_tags text[] not null default '{}',
  status public.publication_status not null default 'draft',
  visibility public.content_visibility not null default 'company',
  visible_event_id uuid references public.wedding_events (id) on delete cascade,
  is_featured boolean not null default false,
  is_demo boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_visibility_target check (visibility <> 'event' or visible_event_id is not null)
);
create index on public.content_items (company_id, status, kind);

create table public.radio_stations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  mode public.radio_mode not null default 'off',
  stream_url text,        -- live stream (mode = live) or demo loop (mode = demo)
  metadata_url text,      -- optional JSON now-playing endpoint
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stream_when_on check (mode = 'off' or stream_url is not null)
);

create table public.radio_schedule_items (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.radio_stations (id) on delete cascade,
  title text not null,
  description text,
  host_dj_id uuid references public.djs (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint schedule_order check (ends_at > starts_at)
);
create index on public.radio_schedule_items (station_id, starts_at);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  bucket text not null,
  path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  kind text not null check (kind in ('image', 'audio', 'video')),
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

-- ─────────────────────────── updated_at ───────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['companies','profiles','djs','wedding_events','dj_assignments','music_tracks',
    'moment_selections','questionnaire_responses','music_restrictions','playlists','playlist_tracks',
    'couple_requests','content_items','radio_stations']
  loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;
