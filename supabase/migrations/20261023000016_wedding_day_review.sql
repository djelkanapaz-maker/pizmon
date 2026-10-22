-- Wedding-day playlist check for the DJ.
-- 1. Songs the couple adds to / removes from their playlists are recorded, so the DJ sees
--    exactly what changed since their last review.
-- 2. On the wedding day the DJ gets a notification (push too) to check those changes and
--    confirm them in the app; changes made later that same day notify the DJ again.

create or replace function public.israel_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Jerusalem')::date $$;

create or replace function public.log_couple_playlist_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pl public.playlists; v_row public.playlist_tracks; v_title text; v_artist text; v_date date;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  select * into v_pl from public.playlists where id = v_row.playlist_id;
  -- only the couple's own playlists; a whole playlist being deleted is not a song change
  if v_pl.id is null or v_pl.kind <> 'couple' or v_pl.event_id is null then return null; end if;
  select t.title, a.name into v_title, v_artist from public.music_tracks t
    left join public.artists a on a.id = t.artist_id where t.id = v_row.track_id;
  perform public.log_activity(v_pl.event_id,
    case when tg_op = 'DELETE' then 'playlist_track_removed' else 'playlist_track_added' end,
    'playlist_track', v_row.id,
    jsonb_build_object('playlist_id', v_pl.id, 'playlist', v_pl.title, 'track_id', v_row.track_id, 'title', v_title, 'artist', v_artist),
    true, false);
  -- on the wedding day itself, tell the DJ right away (at most every 20 minutes)
  select wedding_date into v_date from public.wedding_events where id = v_pl.event_id;
  if v_date = public.israel_today() and not exists (
       select 1 from public.notifications n where n.event_id = v_pl.event_id and n.type = 'wedding_day_change'
         and n.created_at > now() - interval '20 minutes') then
    perform public.notify_users(array(select public.event_dj_user_ids(v_pl.event_id)), v_pl.company_id, v_pl.event_id,
      'wedding_day_change', 'הזוג שינה את הפלייליסט היום. בדקו ואשרו את השינויים',
      'The couple changed their playlist today. Review and confirm the changes', '/dj/couples/' || v_pl.event_id || '#review');
  end if;
  return null;
end $$;
drop trigger if exists couple_playlist_change on public.playlist_tracks;
create trigger couple_playlist_change after insert or delete on public.playlist_tracks
  for each row execute function public.log_couple_playlist_change();

-- the morning of the wedding: every DJ on the event is asked to review and confirm
create or replace function public.queue_wedding_day_reviews() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in
    select e.id, e.company_id, concat_ws(' & ', e.partner_one_name, e.partner_two_name) as names
      from public.wedding_events e
     where e.wedding_date = public.israel_today()
       and exists (select 1 from public.event_dj_user_ids(e.id))
       and not exists (select 1 from public.notifications x where x.event_id = e.id and x.type = 'wedding_day_review'
                         and x.created_at > now() - interval '20 hours')
  loop
    insert into public.notifications (user_id, company_id, event_id, type, title_he, title_en, link)
    select u, r.company_id, r.id, 'wedding_day_review',
           left('היום החתונה של ' || r.names || '. בדקו את הפלייליסט ואשרו את השינויים', 200),
           left('Today is ' || r.names || '''s wedding. Check the playlist and confirm the changes', 200),
           '/dj/couples/' || r.id || '#review'
      from public.event_dj_user_ids(r.id) u;
    n := n + 1;
  end loop;
  return n;
end $$;

-- a DJ opening the app on the day gets theirs without waiting for the morning job
create or replace function public.ensure_my_wedding_day_reviews() returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, company_id, event_id, type, title_he, title_en, link)
  select (select auth.uid()), e.company_id, e.id, 'wedding_day_review',
         left('היום החתונה של ' || concat_ws(' & ', e.partner_one_name, e.partner_two_name) || '. בדקו את הפלייליסט ואשרו את השינויים', 200),
         left('Today is ' || concat_ws(' & ', e.partner_one_name, e.partner_two_name) || '''s wedding. Check the playlist and confirm the changes', 200),
         '/dj/couples/' || e.id || '#review'
    from public.wedding_events e
    join public.dj_assignments a on a.event_id = e.id and a.status in ('proposed', 'confirmed')
    join public.djs d on d.id = a.dj_id and d.user_id = (select auth.uid())
   where e.wedding_date = public.israel_today()
     and not exists (select 1 from public.notifications x where x.event_id = e.id and x.user_id = (select auth.uid())
                       and x.type = 'wedding_day_review' and x.created_at > now() - interval '20 hours');
end $$;

-- confirming is the existing "reviewed" marker; on the wedding day it is also logged for the couple/company
create or replace function public.mark_event_reviewed(p_event uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare v_dj uuid; v_at timestamptz := now();
begin
  select a.dj_id into v_dj from public.dj_assignments a join public.djs d on d.id = a.dj_id
   where a.event_id = p_event and a.status in ('proposed', 'confirmed') and d.user_id = (select auth.uid());
  if v_dj is null then raise exception 'not_assigned' using errcode = '42501'; end if;
  insert into public.dj_event_reviews (dj_id, event_id, last_reviewed_at) values (v_dj, p_event, v_at)
  on conflict (dj_id, event_id) do update set last_reviewed_at = excluded.last_reviewed_at;
  if (select wedding_date from public.wedding_events where id = p_event) = public.israel_today() then
    perform public.log_activity(p_event, 'dj_confirmed_changes', 'event', p_event, '{}', false, false);
  end if;
  return v_at;
end $$;

revoke execute on function public.log_couple_playlist_change() from public, anon, authenticated;
revoke execute on function public.queue_wedding_day_reviews() from public, anon, authenticated;
revoke execute on function public.ensure_my_wedding_day_reviews() from public, anon;
grant execute on function public.ensure_my_wedding_day_reviews() to authenticated;

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('wedding-day-reviews', '0 6 * * *', 'select public.queue_wedding_day_reviews()');
  end if;
exception when others then raise notice 'pg_cron not scheduled: %', sqlerrm;
end $$;
