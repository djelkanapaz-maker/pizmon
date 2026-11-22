-- Special-moment suggestions = ALL the songs of the matching library playlists, in playlist order
-- (was: the first 20). Closing song draws on the chuppah playlists.
do $$
declare
  co constant uuid := '00000000-0000-4000-8000-000000000001';
  r record;
begin
  delete from public.moment_tracks mt using public.wedding_moments m
   where mt.moment_id = m.id and m.company_id = co and m.slug in ('chuppah-entrance', 'breaking-the-glass', 'closing-song');

  for r in
    select * from (values
      ('chuppah-entrance',   'כניסה לחופה ישראלית', 'he'),
      ('chuppah-entrance',   'כניסה לחופה לועזית',  'intl'),
      ('breaking-the-glass', 'שבירת כוס ישראלית',   'he'),
      ('breaking-the-glass', 'שבירת כוס לועזית',    'intl'),
      ('closing-song',       'כניסה לחופה ישראלית', 'he'),
      ('closing-song',       'כניסה לחופה לועזית',  'intl')
    ) v(slug, playlist, coll)
  loop
    insert into public.moment_tracks (moment_id, track_id, collection, sort_order)
    select m.id, x.track_id, r.coll, x.rk + case when r.coll = 'intl' then 10000 else 0 end
      from public.wedding_moments m,
           (select pt.track_id, row_number() over (order by pt.position) as rk
              from public.playlist_tracks pt
              join public.playlists p on p.id = pt.playlist_id
              join public.music_tracks t on t.id = pt.track_id and t.status = 'published'
             where p.company_id = co and p.event_id is null and p.title = r.playlist) x
     where m.company_id = co and m.slug = r.slug
    on conflict (moment_id, track_id) do nothing;
  end loop;
end $$;
