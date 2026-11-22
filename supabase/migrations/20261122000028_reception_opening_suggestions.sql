-- "Opening the dance floor" suggestions = the whole "Top Dancefloor Hits" library playlist, in its order.
do $$
declare co constant uuid := '00000000-0000-4000-8000-000000000001';
begin
  delete from public.moment_tracks mt using public.wedding_moments m
   where mt.moment_id = m.id and m.company_id = co and m.slug = 'reception-opening';
  insert into public.moment_tracks (moment_id, track_id, collection, sort_order)
  select m.id, x.track_id, null, x.rk
    from public.wedding_moments m,
         (select pt.track_id, row_number() over (order by pt.position) rk
            from public.playlist_tracks pt join public.playlists p on p.id = pt.playlist_id
            join public.music_tracks t on t.id = pt.track_id and t.status = 'published'
           where p.company_id = co and p.event_id is null and p.title = 'Top Dancefloor Hits') x
   where m.company_id = co and m.slug = 'reception-opening'
  on conflict (moment_id, track_id) do nothing;
end $$;
