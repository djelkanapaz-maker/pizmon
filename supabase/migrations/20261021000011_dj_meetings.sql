-- Music-planning meeting between a couple and their DJ, booked from the DJ's real
-- Google Calendar availability. One active meeting per wedding; a DJ can't be double-booked.

create extension if not exists btree_gist with schema extensions;

-- when a DJ is willing to meet (Israel time): days 0=Sunday … 6=Saturday
alter table public.djs add column if not exists meeting_hours jsonb not null
  default '{"days":[0,1,2,3,4],"start":"10:00","end":"20:00"}'::jsonb;
grant update (meeting_hours) on public.djs to authenticated;  -- still limited by djs RLS (self or admin)

-- Google Calendar connection per DJ; the refresh token is sealed by the app server (AES-GCM).
create table if not exists private.google_connections (
  dj_id uuid primary key references public.djs (id) on delete cascade,
  token_cipher text not null,
  google_email text not null,
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz not null default now()
);
alter table private.google_connections enable row level security;
revoke all on private.google_connections from public, anon, authenticated;

create table if not exists public.dj_meetings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.wedding_events (id) on delete cascade,
  dj_id uuid not null references public.djs (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode text not null check (mode in ('office', 'zoom')),
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  google_event_id text,
  dj_notified_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create unique index if not exists dj_meetings_one_active_per_event on public.dj_meetings (event_id) where status = 'booked';
do $$ begin
  alter table public.dj_meetings add constraint dj_meetings_no_overlap
    exclude using gist (dj_id with =, tstzrange(starts_at, ends_at) with &&) where (status = 'booked');
exception when duplicate_object then null; end $$;
alter table public.dj_meetings enable row level security;
create policy dj_meetings_read on public.dj_meetings for select to authenticated using (public.can_read_event(event_id));
revoke insert, update, delete on public.dj_meetings from authenticated, anon;

-- ───────── helpers ─────────
create or replace function public.event_meeting_dj(p_event uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select a.dj_id from public.dj_assignments a where a.event_id = p_event and a.status = 'confirmed' order by a.created_at desc limit 1
$$;
revoke execute on function public.event_meeting_dj(uuid) from public, anon, authenticated;

-- DJ (or an admin) stores the sealed Google token for a DJ profile
create or replace function public.save_google_connection(p_dj uuid, p_cipher text, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (p_dj in (select public.my_dj_ids()) or public.is_company_admin((select company_id from public.djs where id = p_dj))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(p_cipher) > 4000 or p_email !~ '^[^@\s]{1,128}@[^@\s]{1,255}$' then raise exception 'invalid' using errcode = '22023'; end if;
  insert into private.google_connections (dj_id, token_cipher, google_email, connected_by) values (p_dj, p_cipher, lower(p_email), (select auth.uid()))
  on conflict (dj_id) do update set token_cipher = excluded.token_cipher, google_email = excluded.google_email, connected_by = excluded.connected_by, connected_at = now();
end $$;

create or replace function public.clear_google_connection(p_dj uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (p_dj in (select public.my_dj_ids()) or public.is_company_admin((select company_id from public.djs where id = p_dj))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from private.google_connections where dj_id = p_dj;
end $$;

-- connection status for staff screens (no token)
create or replace function public.google_connection_status(p_dj uuid) returns table (google_email text, connected_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (p_dj in (select public.my_dj_ids()) or public.is_company_admin((select company_id from public.djs where id = p_dj))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select g.google_email, g.connected_at from private.google_connections g where g.dj_id = p_dj;
end $$;

-- everything the server needs to show availability / book for a wedding.
-- The token is sealed with a server-only key, so returning the ciphertext to the couple's session is safe.
create or replace function public.meeting_context(p_event uuid)
returns table (dj_id uuid, dj_name text, meeting_hours jsonb, token_cipher text, dj_email text, wedding_date date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_read_event(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select d.id, d.display_name, d.meeting_hours, g.token_cipher, coalesce(p.email, g.google_email), e.wedding_date
    from public.wedding_events e
    join public.djs d on d.id = public.event_meeting_dj(p_event)
    left join private.google_connections g on g.dj_id = d.id
    left join public.profiles p on p.id = d.user_id
    where e.id = p_event;
end $$;

create or replace function public.book_dj_meeting(p_event uuid, p_start timestamptz, p_mode text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_dj uuid; v_id uuid; v_company uuid;
begin
  if not public.is_event_couple(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  v_dj := public.event_meeting_dj(p_event);
  if v_dj is null then raise exception 'no_dj' using errcode = 'P0002'; end if;
  if p_mode not in ('office', 'zoom') or p_start < now() + interval '2 hours' or extract(minute from p_start) not in (0, 30) then
    raise exception 'invalid' using errcode = '22023';
  end if;
  update public.dj_meetings set status = 'cancelled' where event_id = p_event and status = 'booked';
  insert into public.dj_meetings (event_id, dj_id, starts_at, ends_at, mode, created_by)
  values (p_event, v_dj, p_start, p_start + interval '60 minutes', p_mode, (select auth.uid()))
  returning id into v_id;
  select company_id into v_company from public.wedding_events where id = p_event;
  perform public.log_activity(p_event, 'meeting_booked', 'dj_meeting', v_id, jsonb_build_object('starts_at', p_start, 'mode', p_mode), true, false);
  perform public.notify_users(array(select public.event_dj_user_ids(p_event)), v_company, p_event,
    'meeting_booked', 'נקבעה פגישת תיאום מוזיקה', 'A music-planning meeting was booked', '/dj/couples/' || p_event);
  return v_id;
exception when exclusion_violation then
  raise exception 'slot_taken' using errcode = '23P01';
end $$;

create or replace function public.cancel_dj_meeting(p_meeting uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_event uuid;
begin
  select event_id into v_event from public.dj_meetings where id = p_meeting and status = 'booked';
  if v_event is null or not (public.is_event_couple(v_event) or public.is_event_staff(v_event)) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.dj_meetings set status = 'cancelled' where id = p_meeting;
  perform public.log_activity(v_event, 'meeting_cancelled', 'dj_meeting', p_meeting, '{}', true, false);
end $$;

-- the server records what happened after booking (Google event id, email sent)
create or replace function public.record_meeting_delivery(p_meeting uuid, p_google_event text, p_notified boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_event uuid;
begin
  select event_id into v_event from public.dj_meetings where id = p_meeting;
  if v_event is null or not (public.is_event_couple(v_event) or public.is_event_staff(v_event)) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.dj_meetings set google_event_id = coalesce(left(p_google_event, 1024), google_event_id),
    dj_notified_at = case when p_notified then now() else dj_notified_at end where id = p_meeting;
end $$;

-- 31 days before the wedding (or whenever a later-assigned wedding enters that window): remind the couple once
create or replace function public.queue_meeting_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in
    select e.id, e.company_id from public.wedding_events e
    where e.wedding_date between current_date and current_date + 31
      and public.event_meeting_dj(e.id) is not null
      and not exists (select 1 from public.dj_meetings m where m.event_id = e.id and m.status = 'booked')
      and not exists (select 1 from public.notifications x where x.event_id = e.id and x.type = 'meeting_reminder')
  loop
    perform public.notify_users(array(select cm.user_id from public.couple_members cm where cm.event_id = r.id), r.company_id, r.id,
      'meeting_reminder', 'זה הזמן לקבוע פגישת תיאום מוזיקה עם ה-DJ שלכם',
      'It''s time to book your music-planning meeting with your DJ', '/wedding/meeting');
    n := n + 1;
  end loop;
  return n;
end $$;

-- a couple opening the app also triggers their own reminder (no wait for the daily job)
create or replace function public.ensure_my_meeting_reminder(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_company uuid;
begin
  if not public.is_event_couple(p_event) then return; end if;
  select company_id into v_company from public.wedding_events e
   where e.id = p_event and e.wedding_date between current_date and current_date + 31
     and public.event_meeting_dj(e.id) is not null
     and not exists (select 1 from public.dj_meetings m where m.event_id = e.id and m.status = 'booked')
     and not exists (select 1 from public.notifications x where x.event_id = e.id and x.type = 'meeting_reminder');
  if v_company is null then return; end if;
  insert into public.notifications (user_id, company_id, event_id, type, title_he, title_en, link)
  select cm.user_id, v_company, p_event, 'meeting_reminder', 'זה הזמן לקבוע פגישת תיאום מוזיקה עם ה-DJ שלכם',
         'It''s time to book your music-planning meeting with your DJ', '/wedding/meeting'
  from public.couple_members cm where cm.event_id = p_event;
end $$;

revoke execute on function public.save_google_connection(uuid, text, text) from public, anon;
revoke execute on function public.clear_google_connection(uuid) from public, anon;
revoke execute on function public.google_connection_status(uuid) from public, anon;
revoke execute on function public.meeting_context(uuid) from public, anon;
revoke execute on function public.book_dj_meeting(uuid, timestamptz, text) from public, anon;
revoke execute on function public.cancel_dj_meeting(uuid) from public, anon;
revoke execute on function public.record_meeting_delivery(uuid, text, boolean) from public, anon;
revoke execute on function public.queue_meeting_reminders() from public, anon, authenticated;
revoke execute on function public.ensure_my_meeting_reminder(uuid) from public, anon;
grant execute on function public.save_google_connection(uuid, text, text) to authenticated;
grant execute on function public.clear_google_connection(uuid) to authenticated;
grant execute on function public.google_connection_status(uuid) to authenticated;
grant execute on function public.meeting_context(uuid) to authenticated;
grant execute on function public.book_dj_meeting(uuid, timestamptz, text) to authenticated;
grant execute on function public.cancel_dj_meeting(uuid) to authenticated;
grant execute on function public.record_meeting_delivery(uuid, text, boolean) to authenticated;
grant execute on function public.ensure_my_meeting_reminder(uuid) to authenticated;

-- daily job where pg_cron is available (hosted Supabase); 06:00 UTC ≈ 09:00 Israel
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('meeting-reminders', '0 6 * * *', 'select public.queue_meeting_reminders()');
  end if;
exception when others then raise notice 'pg_cron not scheduled: %', sqlerrm;
end $$;
