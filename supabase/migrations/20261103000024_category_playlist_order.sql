-- Category songs follow the order of their source playlists (as arranged on Spotify), not the date added.
-- added_rank (higher first): the first source playlist of a category (by when it was linked) comes first,
-- and inside each playlist its own order, top to bottom.
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
             -(dense_rank() over (partition by cs.tag_id order by cs.created_at, cs.playlist_id) * 1000000.0 + pt.position) as rank
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

select public.rebuild_category_tracks(c.id) from public.companies c
 where exists (select 1 from public.tags g join public.category_sources cs on cs.tag_id = g.id where g.company_id = c.id);
