-- Categories fed by Spotify-linked playlists.
-- A category (tags.kind = 'category') can list one or more source playlists, each with a language
-- filter. refresh_category_tracks() rebuilds the "auto" track_tags rows from those sources; tags an
-- admin set by hand on a track (auto = false) are never touched. Hidden categories aren't shown to couples.

alter table public.tags add column if not exists is_hidden boolean not null default false;
alter table public.track_tags add column if not exists auto boolean not null default false;

create table if not exists public.category_sources (
  tag_id uuid not null references public.tags (id) on delete cascade,
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  language text not null default 'all' check (language in ('all', 'he', 'intl')),
  created_at timestamptz not null default now(),
  primary key (tag_id, playlist_id)
);
create index if not exists category_sources_playlist on public.category_sources (playlist_id);
alter table public.category_sources enable row level security;

drop policy if exists category_sources_admin on public.category_sources;
create policy category_sources_admin on public.category_sources for all to authenticated
  using (exists (select 1 from public.tags g where g.id = tag_id and public.is_company_admin(g.company_id)))
  with check (exists (select 1 from public.tags g join public.playlists p on p.id = playlist_id
                      where g.id = tag_id and g.kind = 'category' and p.company_id = g.company_id and public.is_company_admin(g.company_id)));

/** Hebrew script in the title or the artist name → an Israeli / Hebrew song. */
create or replace function public.track_is_hebrew(p_title text, p_artist text) returns boolean
language sql immutable as $$ select coalesce(p_title, '') ~ '[א-ת]' or coalesce(p_artist, '') ~ '[א-ת]' $$;

/** Rebuilds every playlist-fed category of a company. Returns the number of auto rows. */
create or replace function public.refresh_category_tracks(p_company uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.is_company_admin(p_company) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.track_tags tt using public.tags g
   where tt.tag_id = g.id and g.company_id = p_company and tt.auto;
  insert into public.track_tags (track_id, tag_id, auto)
  select distinct pt.track_id, cs.tag_id, true
    from public.category_sources cs
    join public.tags g on g.id = cs.tag_id and g.company_id = p_company and g.kind = 'category'
    join public.playlist_tracks pt on pt.playlist_id = cs.playlist_id
    join public.music_tracks mt on mt.id = pt.track_id and mt.company_id = p_company
    left join public.artists a on a.id = mt.artist_id
   where cs.language = 'all'
      or (cs.language = 'he') = public.track_is_hebrew(mt.title, a.name)
  on conflict (track_id, tag_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.refresh_category_tracks(uuid) from public, anon;
grant execute on function public.refresh_category_tracks(uuid) to authenticated, service_role;
