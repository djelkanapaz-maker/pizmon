-- Special-moment suggestions come from the library playlists, split into Hebrew / international:
--   chuppah entrance  ← first 20 of "כניסה לחופה ישראלית" / "כניסה לחופה לועזית"
--   breaking the glass ← first 20 of "שבירת כוס ישראלית" / "שבירת כוס לועזית"
--   closing song       ← the next 20 of the two chuppah playlists (ideas beyond the chuppah picks)
do $$
declare
  co constant uuid := '00000000-0000-4000-8000-000000000001';
  r record;
begin
  update public.wedding_moments set has_language_collections = true
   where company_id = co and slug in ('chuppah-entrance', 'breaking-the-glass', 'closing-song');

  for r in
    select * from (values
      ('chuppah-entrance',   'כניסה לחופה ישראלית', 'he',   1, 20),
      ('chuppah-entrance',   'כניסה לחופה לועזית',  'intl', 1, 20),
      ('breaking-the-glass', 'שבירת כוס ישראלית',   'he',   1, 20),
      ('breaking-the-glass', 'שבירת כוס לועזית',    'intl', 1, 20),
      ('closing-song',       'כניסה לחופה ישראלית', 'he',  21, 40),
      ('closing-song',       'כניסה לחופה לועזית',  'intl', 21, 40)
    ) v(slug, playlist, coll, from_rank, to_rank)
  loop
    delete from public.moment_tracks mt using public.wedding_moments m
     where mt.moment_id = m.id and m.company_id = co and m.slug = r.slug
       and (mt.collection is null or mt.collection = r.coll);

    insert into public.moment_tracks (moment_id, track_id, collection, sort_order)
    select m.id, x.track_id, r.coll, x.rk + case when r.coll = 'intl' then 100 else 0 end
      from public.wedding_moments m,
           (select pt.track_id, row_number() over (order by pt.position) as rk
              from public.playlist_tracks pt
              join public.playlists p on p.id = pt.playlist_id
              join public.music_tracks t on t.id = pt.track_id and t.status = 'published'
             where p.company_id = co and p.event_id is null and p.title = r.playlist) x
     where m.company_id = co and m.slug = r.slug and x.rk between r.from_rank and r.to_rank
    on conflict (moment_id, track_id) do nothing;
  end loop;
end $$;
