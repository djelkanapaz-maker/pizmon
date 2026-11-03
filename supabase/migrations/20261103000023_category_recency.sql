-- Category shelves show the newest songs first: the order songs were added to the source Spotify playlists.
-- playlist_tracks.source_added_at is Spotify's "added at" for that song (when the Web API gives it).
-- track_tags.added_rank is the sort key of an auto category row (higher = newer):
--   the Spotify date, or, when there is none (embed fallback), the playlist position counted back from the sync time
--   (Spotify appends new songs at the end, so a later position is a newer song).

alter table public.playlist_tracks add column if not exists source_added_at timestamptz;
alter table public.track_tags add column if not exists added_rank double precision;
create index if not exists track_tags_recency on public.track_tags (tag_id, added_rank desc nulls last);

/** The rebuild itself, without the admin check (used by the RPC below and by this migration). */
create or replace function public.rebuild_category_tracks(p_company uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.track_tags tt using public.tags g
   where tt.tag_id = g.id and g.company_id = p_company and tt.auto;
  insert into public.track_tags (track_id, tag_id, auto, added_rank)
  select src.track_id, src.tag_id, true, max(src.rank)
    from (
      select pt.track_id, cs.tag_id,
             coalesce(extract(epoch from pt.source_added_at),
                      extract(epoch from pt.created_at) - (max(pt.position) over (partition by pt.playlist_id) - pt.position)) as rank
        from public.category_sources cs
        join public.tags g on g.id = cs.tag_id and g.company_id = p_company and g.kind = 'category'
        join public.playlist_tracks pt on pt.playlist_id = cs.playlist_id
        join public.music_tracks mt on mt.id = pt.track_id and mt.company_id = p_company
        left join public.artists a on a.id = mt.artist_id
       where cs.language = 'all'
          or (cs.language = 'he') = public.track_is_hebrew(mt.title, a.name)
    ) src
   group by src.track_id, src.tag_id
  on conflict (track_id, tag_id) do update set added_rank = excluded.added_rank;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.rebuild_category_tracks(uuid) from public, anon, authenticated;

/** Rebuilds every playlist-fed category of a company (admins). Returns the number of auto rows. */
create or replace function public.refresh_category_tracks(p_company uuid) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_company_admin(p_company) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return public.rebuild_category_tracks(p_company);
end $$;
revoke execute on function public.refresh_category_tracks(uuid) from public, anon;
grant execute on function public.refresh_category_tracks(uuid) to authenticated, service_role;

-- give the existing category rows their order now
select public.rebuild_category_tracks(c.id) from public.companies c
 where exists (select 1 from public.tags g join public.category_sources cs on cs.tag_id = g.id where g.company_id = c.id);
