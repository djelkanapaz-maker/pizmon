-- Richer DJ profiles: artist logo, social/listening links, and live performers (e.g. live guitar on DJ sets)
alter table public.djs
  add column if not exists logo_url text,
  add column if not exists links jsonb not null default '{}'::jsonb,
  add column if not exists kind text not null default 'dj';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'djs_kind_check') then
    alter table public.djs add constraint djs_kind_check check (kind in ('dj', 'live'));
  end if;
end $$;

-- only DJs (not live add-on performers) can be selected by couples
create or replace function public.select_dj(p_event uuid, p_dj uuid) returns public.dj_assignments
language plpgsql security definer set search_path = '' as $$
declare
  v_event public.wedding_events;
  v_company public.companies;
  v_dj public.djs;
  v_current public.dj_assignments;
  v_row public.dj_assignments;
  v_status public.assignment_status;
begin
  if not public.is_event_couple(p_event) then
    raise exception 'not_your_event' using errcode = '42501';
  end if;
  select * into v_event from public.wedding_events where id = p_event;
  select * into v_company from public.companies where id = v_event.company_id;
  if v_company.assignment_policy <> 'couple_selects' then
    raise exception 'selection_not_allowed' using errcode = '42501', hint = 'This company assigns DJs; confirm the assigned DJ instead.';
  end if;
  select * into v_dj from public.djs where id = p_dj;
  if v_dj.id is null or v_dj.company_id <> v_event.company_id or not v_dj.is_active or not v_dj.accepts_new_couples or v_dj.kind <> 'dj' then
    raise exception 'dj_not_eligible' using errcode = '42501';
  end if;

  select * into v_current from public.dj_assignments
   where event_id = p_event and status in ('proposed', 'pending_approval', 'confirmed') for update;
  if v_current.id is not null then
    if v_current.dj_id = p_dj then return v_current; end if;
    if v_current.status = 'confirmed' then
      raise exception 'assignment_locked' using errcode = '42501', hint = 'A confirmed DJ can only be changed by the company.';
    end if;
    update public.dj_assignments set status = 'ended', decided_at = now(), decided_by = (select auth.uid()),
      note = coalesce(note || ' · ', '') || 'superseded by couple selection' where id = v_current.id;
  end if;

  v_status := case when v_company.couple_selection_requires_approval then 'pending_approval' else 'confirmed' end;
  insert into public.dj_assignments (event_id, dj_id, status, source, created_by, decided_at, decided_by)
  values (p_event, p_dj, v_status, 'couple', (select auth.uid()),
          case when v_status = 'confirmed' then now() end,
          case when v_status = 'confirmed' then (select auth.uid()) end)
  returning * into v_row;

  perform public.log_activity(p_event, 'dj_selected', 'dj_assignment', v_row.id,
    jsonb_build_object('dj_id', p_dj, 'status', v_status, 'previous_dj_id', v_current.dj_id), true, false);
  if v_status = 'pending_approval' then
    perform public.notify_users(array(select public.company_admin_ids(v_event.company_id)), v_event.company_id, p_event,
      'assignment_pending', 'זוג בחר דיג''יי וממתין לאישור', 'A couple picked a DJ and is waiting for approval', '/admin/couples/' || p_event);
  else
    perform public.notify_users(array[v_dj.user_id], v_event.company_id, p_event,
      'assignment_confirmed', 'זוג חדש שובץ אליך', 'A new couple has been assigned to you', '/dj/couples/' || p_event);
  end if;
  return v_row;
end $$;

-- column privileges: DJs may edit their own logo/links; kind stays admin-only (admins write via djs_admin_write)
grant update (logo_url, links, kind) on public.djs to authenticated;
revoke execute on function public.select_dj(uuid, uuid) from public, anon;
grant execute on function public.select_dj(uuid, uuid) to authenticated;

-- Hardening (Supabase advisor): trigger functions fire regardless of EXECUTE privilege,
-- so API users never need to call them directly.
do $$
declare f text;
begin
  foreach f in array array['after_recommendation()', 'after_recommendation_response()', 'after_request()', 'after_request_message()',
    'check_event_track()', 'check_playlist_track()', 'check_restriction_conflict()', 'guard_recommendation()', 'track_moment_selection()',
    'track_playlist_confirm()', 'track_questionnaire_edits()', 'track_restriction()', 'touch_updated_at()', 'protect_published_version()']
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
