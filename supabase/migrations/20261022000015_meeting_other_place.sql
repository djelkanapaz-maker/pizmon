-- A planning meeting can also be somewhere other than the office or Zoom; the couple writes where.
alter table public.dj_meetings drop constraint if exists dj_meetings_mode_check;
alter table public.dj_meetings add constraint dj_meetings_mode_check check (mode in ('office', 'zoom', 'other'));
alter table public.dj_meetings add column if not exists location text
  check (location is null or length(btrim(location)) between 2 and 200);
do $$ begin
  alter table public.dj_meetings add constraint dj_meetings_other_has_location check (mode <> 'other' or location is not null);
exception when duplicate_object then null; end $$;

drop function if exists public.book_dj_meeting(uuid, timestamptz, text);
create or replace function public.book_dj_meeting(p_event uuid, p_start timestamptz, p_mode text, p_location text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_dj uuid; v_id uuid; v_company uuid; v_loc text;
begin
  if not public.is_event_couple(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  v_dj := public.event_meeting_dj(p_event);
  if v_dj is null then raise exception 'no_dj' using errcode = 'P0002'; end if;
  v_loc := case when p_mode = 'other' then nullif(btrim(coalesce(p_location, '')), '') end;
  if p_mode not in ('office', 'zoom', 'other') or (p_mode = 'other' and (v_loc is null or length(v_loc) not between 2 and 200))
     or p_start < now() + interval '2 hours' or extract(minute from p_start) not in (0, 30) then
    raise exception 'invalid' using errcode = '22023';
  end if;
  update public.dj_meetings set status = 'cancelled' where event_id = p_event and status = 'booked';
  insert into public.dj_meetings (event_id, dj_id, starts_at, ends_at, mode, location, created_by)
  values (p_event, v_dj, p_start, p_start + interval '60 minutes', p_mode, v_loc, (select auth.uid()))
  returning id into v_id;
  select company_id into v_company from public.wedding_events where id = p_event;
  perform public.log_activity(p_event, 'meeting_booked', 'dj_meeting', v_id, jsonb_build_object('starts_at', p_start, 'mode', p_mode, 'location', v_loc), true, false);
  perform public.notify_users(array(select public.event_dj_user_ids(p_event)), v_company, p_event,
    'meeting_booked', 'נקבעה פגישת תיאום מוזיקה', 'A music-planning meeting was booked', '/dj/couples/' || p_event);
  return v_id;
exception when exclusion_violation then
  raise exception 'slot_taken' using errcode = '23P01';
end $$;
revoke execute on function public.book_dj_meeting(uuid, timestamptz, text, text) from public, anon;
grant execute on function public.book_dj_meeting(uuid, timestamptz, text, text) to authenticated;
