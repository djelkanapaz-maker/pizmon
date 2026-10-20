-- WEDDING MUSIC CLUB — workflow RPCs, integrity triggers, activity tracking, notifications

-- ─────────────────────────── profiles for new auth users ───────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, locale)
  values (new.id, new.email,
          nullif(new.raw_user_meta_data ->> 'full_name', ''),
          coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'he'))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────── shared internals ───────────────────────────
create or replace function public.notify_users(p_users uuid[], p_company uuid, p_event uuid,
  p_type text, p_title_he text, p_title_en text, p_link text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, company_id, event_id, type, title_he, title_en, link)
  select distinct u, p_company, p_event, p_type, p_title_he, p_title_en, p_link
  from unnest(p_users) as u
  where u is not null and u is distinct from (select auth.uid());
end $$;

create or replace function public.log_activity(p_event uuid, p_type text, p_entity_type text,
  p_entity_id uuid, p_payload jsonb, p_important boolean default false, p_staff_only boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_events (company_id, event_id, actor_id, type, entity_type, entity_id, payload, is_important, staff_only)
  values (public.event_company(p_event), p_event, (select auth.uid()), p_type, p_entity_type, p_entity_id,
          coalesce(p_payload, '{}'), p_important, p_staff_only);
end $$;

-- absolute NEVER PLAY match for a track (track, its artist, or its genre)
create or replace function public.never_play_conflict(p_event uuid, p_track uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select r.id from public.music_restrictions r
  join public.music_tracks t on t.id = p_track
  where r.event_id = p_event and r.kind = 'never_play' and r.strength = 'absolute'
    and ((r.target_type = 'track' and r.track_id = t.id)
      or (r.target_type = 'artist' and r.artist_id = t.artist_id)
      or (r.target_type = 'genre' and r.genre_id = t.genre_id))
  limit 1
$$;

-- tracks referenced by event data must belong to the event's company
create or replace function public.assert_track_company(p_track uuid, p_company uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_track is not null and not exists (select 1 from public.music_tracks where id = p_track and company_id = p_company) then
    raise exception 'track % is not in this company catalog', p_track using errcode = '23514';
  end if;
end $$;

create or replace function public.check_event_track() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_company uuid := public.event_company(new.event_id);
begin
  if tg_table_name = 'moment_selections' then
    perform public.assert_track_company(new.primary_track_id, v_company);
    perform public.assert_track_company(new.backup_track_id, v_company);
  elsif tg_table_name = 'music_restrictions' then
    perform public.assert_track_company(new.track_id, v_company);
    if new.artist_id is not null and not exists (select 1 from public.artists where id = new.artist_id and company_id = v_company) then
      raise exception 'artist not in company' using errcode = '23514';
    end if;
    if new.genre_id is not null and not exists (select 1 from public.genres where id = new.genre_id and company_id = v_company) then
      raise exception 'genre not in company' using errcode = '23514';
    end if;
  else
    perform public.assert_track_company(new.track_id, v_company);
  end if;
  return new;
end $$;
create trigger check_track before insert or update on public.moment_selections for each row execute function public.check_event_track();
create trigger check_track before insert or update on public.music_restrictions for each row execute function public.check_event_track();
create trigger check_track before insert or update on public.saved_tracks for each row execute function public.check_event_track();
create trigger check_track before insert or update on public.rejected_tracks for each row execute function public.check_event_track();
create trigger check_track before insert or update on public.dj_recommendations for each row execute function public.check_event_track();

create or replace function public.check_playlist_track() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_track_company(new.track_id, (select company_id from public.playlists where id = new.playlist_id));
  return new;
end $$;
create trigger check_track before insert or update on public.playlist_tracks for each row execute function public.check_playlist_track();

-- ─────────────────────────── DJ assignment workflow ───────────────────────────
-- Couple chooses a DJ from their company's eligible roster.
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
  if v_dj.id is null or v_dj.company_id <> v_event.company_id or not v_dj.is_active or not v_dj.accepts_new_couples then
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

-- Couple confirms the DJ the company assigned.
create or replace function public.confirm_assigned_dj(p_event uuid) returns public.dj_assignments
language plpgsql security definer set search_path = '' as $$
declare v_row public.dj_assignments; v_dj_user uuid;
begin
  if not public.is_event_couple(p_event) then
    raise exception 'not_your_event' using errcode = '42501';
  end if;
  update public.dj_assignments set status = 'confirmed', decided_at = now(), decided_by = (select auth.uid())
   where event_id = p_event and status = 'proposed' returning * into v_row;
  if v_row.id is null then
    raise exception 'nothing_to_confirm' using errcode = 'P0002';
  end if;
  select user_id into v_dj_user from public.djs where id = v_row.dj_id;
  perform public.log_activity(p_event, 'dj_confirmed_by_couple', 'dj_assignment', v_row.id, jsonb_build_object('dj_id', v_row.dj_id), true, false);
  perform public.notify_users(array[v_dj_user], public.event_company(p_event), p_event,
    'assignment_confirmed', 'הזוג אישר אותך כדיג''יי', 'The couple confirmed you as their DJ', '/dj/couples/' || p_event);
  return v_row;
end $$;

-- Admin assigns / reassigns a DJ (keeps history). p_confirm skips couple confirmation.
create or replace function public.admin_assign_dj(p_event uuid, p_dj uuid, p_confirm boolean default false, p_note text default null)
returns public.dj_assignments
language plpgsql security definer set search_path = '' as $$
declare v_company uuid := public.event_company(p_event); v_dj public.djs; v_row public.dj_assignments; v_prev uuid;
begin
  if v_company is null or not public.is_company_admin(v_company) then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select * into v_dj from public.djs where id = p_dj;
  if v_dj.id is null or v_dj.company_id <> v_company or not v_dj.is_active then
    raise exception 'dj_not_eligible' using errcode = '42501';
  end if;
  update public.dj_assignments set status = 'ended', decided_at = now(), decided_by = (select auth.uid()),
    note = coalesce(note || ' · ', '') || 'reassigned by company'
   where event_id = p_event and status in ('proposed', 'pending_approval', 'confirmed') and dj_id <> p_dj
   returning dj_id into v_prev;
  select * into v_row from public.dj_assignments where event_id = p_event and status in ('proposed', 'pending_approval', 'confirmed');
  if v_row.id is not null then
    update public.dj_assignments set status = case when p_confirm then 'confirmed'::public.assignment_status else status end,
      decided_at = now(), decided_by = (select auth.uid()), note = coalesce(p_note, note)
     where id = v_row.id returning * into v_row;
  else
    insert into public.dj_assignments (event_id, dj_id, status, source, created_by, decided_at, decided_by, note)
    values (p_event, p_dj, (case when p_confirm then 'confirmed' else 'proposed' end)::public.assignment_status, 'admin', (select auth.uid()),
            case when p_confirm then now() end, case when p_confirm then (select auth.uid()) end, p_note)
    returning * into v_row;
  end if;
  perform public.log_activity(p_event, 'dj_assigned_by_company', 'dj_assignment', v_row.id,
    jsonb_build_object('dj_id', p_dj, 'previous_dj_id', v_prev, 'status', v_row.status), true, false);
  perform public.notify_users(array[v_dj.user_id], v_company, p_event, 'assignment_confirmed',
    'זוג חדש שובץ אליך', 'A couple has been assigned to you', '/dj/couples/' || p_event);
  perform public.notify_users(array(select public.event_couple_user_ids(p_event)), v_company, p_event, 'dj_assigned',
    'הדיג''יי שלכם נבחר', 'Your DJ has been assigned', '/home');
  return v_row;
end $$;

-- Admin approves or declines a couple's pending selection.
create or replace function public.admin_decide_assignment(p_assignment uuid, p_approve boolean, p_note text default null)
returns public.dj_assignments
language plpgsql security definer set search_path = '' as $$
declare v_row public.dj_assignments; v_company uuid; v_dj_user uuid;
begin
  select * into v_row from public.dj_assignments where id = p_assignment;
  v_company := public.event_company(v_row.event_id);
  if v_row.id is null or not public.is_company_admin(v_company) then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if v_row.status <> 'pending_approval' then
    raise exception 'not_pending' using errcode = 'P0002';
  end if;
  update public.dj_assignments set status = case when p_approve then 'confirmed'::public.assignment_status else 'declined' end,
    decided_at = now(), decided_by = (select auth.uid()), note = coalesce(p_note, note)
   where id = p_assignment returning * into v_row;
  select user_id into v_dj_user from public.djs where id = v_row.dj_id;
  perform public.log_activity(v_row.event_id, case when p_approve then 'dj_selection_approved' else 'dj_selection_declined' end,
    'dj_assignment', v_row.id, jsonb_build_object('dj_id', v_row.dj_id, 'note', p_note), true, false);
  perform public.notify_users(array(select public.event_couple_user_ids(v_row.event_id)), v_company, v_row.event_id,
    case when p_approve then 'dj_approved' else 'dj_declined' end,
    case when p_approve then 'בחירת הדיג''יי אושרה' else 'בחירת הדיג''יי לא אושרה — בחרו שוב' end,
    case when p_approve then 'Your DJ selection was approved' else 'Your DJ selection was declined — please choose again' end,
    case when p_approve then '/home' else '/onboarding?step=dj' end);
  if p_approve then
    perform public.notify_users(array[v_dj_user], v_company, v_row.event_id, 'assignment_confirmed',
      'זוג חדש שובץ אליך', 'A new couple has been assigned to you', '/dj/couples/' || v_row.event_id);
  end if;
  return v_row;
end $$;

-- ─────────────────────────── questionnaire submission ───────────────────────────
create or replace function public.submit_questionnaire(p_event uuid) returns public.questionnaire_responses
language plpgsql security definer set search_path = '' as $$
declare v_row public.questionnaire_responses; v_first boolean;
begin
  if not public.is_event_couple(p_event) then
    raise exception 'not_your_event' using errcode = '42501';
  end if;
  select submitted_at is null into v_first from public.questionnaire_responses where event_id = p_event;
  update public.questionnaire_responses set status = 'submitted', submitted_at = coalesce(submitted_at, now()), updated_by = (select auth.uid())
   where event_id = p_event returning * into v_row;
  if v_row.id is null then raise exception 'no_response' using errcode = 'P0002'; end if;
  perform public.log_activity(p_event, case when v_first then 'questionnaire_submitted' else 'questionnaire_resubmitted' end,
    'questionnaire_response', v_row.id, '{}', true, false);
  perform public.notify_users(array(select public.event_dj_user_ids(p_event)), public.event_company(p_event), p_event,
    'questionnaire_submitted', 'הזוג הגיש את השאלון המוזיקלי', 'The couple submitted their music questionnaire', '/dj/couples/' || p_event);
  return v_row;
end $$;

-- start (or fetch) the event's response pinned to the active template's latest published version
create or replace function public.start_questionnaire(p_event uuid) returns public.questionnaire_responses
language plpgsql security definer set search_path = '' as $$
declare v_row public.questionnaire_responses; v_version uuid;
begin
  if not public.can_read_event(p_event) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_row from public.questionnaire_responses where event_id = p_event;
  if v_row.id is not null then return v_row; end if;
  if not public.is_event_couple(p_event) then raise exception 'not_started' using errcode = 'P0002'; end if;
  select v.id into v_version from public.questionnaire_versions v
    join public.questionnaires q on q.id = v.questionnaire_id
   where q.company_id = public.event_company(p_event) and q.is_active and v.published_at is not null
   order by v.version desc limit 1;
  if v_version is null then raise exception 'no_published_questionnaire' using errcode = 'P0002'; end if;
  insert into public.questionnaire_responses (event_id, version_id, updated_by) values (p_event, v_version, (select auth.uid()))
  on conflict (event_id) do nothing;
  select * into v_row from public.questionnaire_responses where event_id = p_event;
  perform public.log_activity(p_event, 'questionnaire_started', 'questionnaire_response', v_row.id, '{}', false, false);
  return v_row;
end $$;

-- published questionnaire versions are immutable: changes must be a new version
create or replace function public.protect_published_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.published_at is not null and (new.definition is distinct from old.definition or new.version <> old.version) then
    raise exception 'published_version_immutable' using errcode = '42501', hint = 'Create a new version instead.';
  end if;
  return new;
end $$;
create trigger protect_published before update on public.questionnaire_versions
  for each row execute function public.protect_published_version();

create or replace function public.track_questionnaire_edits() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_by := (select auth.uid());
  -- edits after submission are surfaced to the DJ (throttled to one entry per hour)
  if old.status = 'submitted' and new.answers is distinct from old.answers and not exists (
    select 1 from public.activity_events where event_id = new.event_id and type = 'questionnaire_edited'
      and created_at > now() - interval '1 hour') then
    perform public.log_activity(new.event_id, 'questionnaire_edited', 'questionnaire_response', new.id,
      jsonb_build_object('changed_keys', (
        select coalesce(jsonb_agg(k), '[]') from (
          select key as k from jsonb_each(new.answers) n
          where n.value is distinct from (old.answers -> n.key)
          union select key from jsonb_each(old.answers) o where not (new.answers ? o.key)) x)), true, false);
    perform public.notify_users(array(select public.event_dj_user_ids(new.event_id)), public.event_company(new.event_id), new.event_id,
      'questionnaire_edited', 'הזוג עדכן את השאלון לאחר ההגשה', 'The couple edited their questionnaire after submitting', '/dj/couples/' || new.event_id);
  end if;
  return new;
end $$;
create trigger track_edits before update on public.questionnaire_responses
  for each row execute function public.track_questionnaire_edits();

-- ─────────────────────────── moment selection history ───────────────────────────
create or replace function public.track_moment_selection() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb := case when tg_op = 'UPDATE' then jsonb_build_object('status', old.status, 'primary_track_id', old.primary_track_id,
                     'backup_track_id', old.backup_track_id, 'custom_song', old.custom_song) end;
  v_after jsonb := jsonb_build_object('status', new.status, 'primary_track_id', new.primary_track_id,
                     'backup_track_id', new.backup_track_id, 'custom_song', new.custom_song, 'moment_id', new.moment_id);
  v_was_confirmed boolean := tg_op = 'UPDATE' and old.status = 'confirmed';
  v_song_changed boolean := tg_op = 'INSERT' or old.primary_track_id is distinct from new.primary_track_id
                            or old.custom_song is distinct from new.custom_song or old.backup_track_id is distinct from new.backup_track_id;
  v_moment text;
begin
  if tg_op = 'UPDATE' and v_before - 'moment_id' = v_after - 'moment_id' then return new; end if;
  select name_he into v_moment from public.wedding_moments where id = new.moment_id;
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status <> 'confirmed') then
    perform public.log_activity(new.event_id, 'moment_confirmed', 'moment_selection', new.id,
      jsonb_build_object('before', v_before, 'after', v_after), true, false);
    perform public.notify_users(array(select public.event_dj_user_ids(new.event_id)), public.event_company(new.event_id), new.event_id,
      'moment_confirmed', 'שיר אושר: ' || v_moment, 'A song was confirmed for a wedding moment', '/dj/couples/' || new.event_id);
  elsif v_was_confirmed and (v_song_changed or new.status <> 'confirmed') then
    perform public.log_activity(new.event_id, 'confirmed_moment_changed', 'moment_selection', new.id,
      jsonb_build_object('before', v_before, 'after', v_after), true, false);
    perform public.notify_users(array(select public.event_dj_user_ids(new.event_id)), public.event_company(new.event_id), new.event_id,
      'confirmed_moment_changed', 'שינוי בשיר שאושר: ' || v_moment, 'A confirmed wedding-moment song changed', '/dj/couples/' || new.event_id);
  else
    perform public.log_activity(new.event_id, 'moment_updated', 'moment_selection', new.id,
      jsonb_build_object('before', v_before, 'after', v_after), false, false);
  end if;
  return new;
end $$;
create trigger track_selection after insert or update on public.moment_selections
  for each row execute function public.track_moment_selection();

-- ─────────────────────────── restrictions ───────────────────────────
create or replace function public.track_restriction() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.music_restrictions := coalesce(new, old); v_absolute_never boolean;
begin
  v_absolute_never := r.kind = 'never_play' and r.strength = 'absolute';
  perform public.log_activity(r.event_id,
    'restriction_' || lower(tg_op), 'music_restriction', r.id,
    jsonb_build_object('kind', r.kind, 'strength', r.strength, 'target_type', r.target_type,
      'track_id', r.track_id, 'artist_id', r.artist_id, 'genre_id', r.genre_id, 'text', r.text_value),
    v_absolute_never or tg_op = 'DELETE', false);
  if v_absolute_never and tg_op = 'INSERT' then
    perform public.notify_users(array(select public.event_dj_user_ids(r.event_id)), public.event_company(r.event_id), r.event_id,
      'never_play_added', 'נוספה הגבלת "לעולם לא"', 'A new absolute NEVER PLAY restriction was added', '/dj/couples/' || r.event_id);
  end if;
  return coalesce(new, old);
end $$;
create trigger track_restriction after insert or update or delete on public.music_restrictions
  for each row execute function public.track_restriction();

-- an absolute NEVER PLAY cannot coexist with a MUST PLAY on the same target
create or replace function public.check_restriction_conflict() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.music_restrictions o where o.event_id = new.event_id and o.id <> new.id
      and o.kind <> new.kind and o.target_type = new.target_type
      and (o.track_id = new.track_id or o.artist_id = new.artist_id or o.genre_id = new.genre_id)) then
    raise exception 'restriction_conflict' using errcode = '23505', hint = 'This item is already in the other list.';
  end if;
  return new;
end $$;
create trigger check_conflict before insert or update on public.music_restrictions
  for each row execute function public.check_restriction_conflict();

-- ─────────────────────────── recommendations ───────────────────────────
create or replace function public.guard_recommendation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.track_id is not null and public.never_play_conflict(new.event_id, new.track_id) is not null then
    raise exception 'violates_never_play' using errcode = '23514',
      hint = 'This track matches an absolute NEVER PLAY restriction for this couple.';
  end if;
  return new;
end $$;
create trigger guard_never_play before insert on public.dj_recommendations
  for each row execute function public.guard_recommendation();

create or replace function public.after_recommendation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.log_activity(new.event_id, 'recommendation_added', 'dj_recommendation', new.id,
    jsonb_build_object('track_id', new.track_id, 'playlist_id', new.playlist_id, 'moment_id', new.moment_id, 'ai', new.is_ai_suggestion), false, false);
  perform public.notify_users(array(select public.event_couple_user_ids(new.event_id)), public.event_company(new.event_id), new.event_id,
    'recommendation', 'המלצה חדשה מהדיג''יי שלכם', 'New recommendation from your DJ', '/wedding/recommendations');
  return new;
end $$;
create trigger after_recommendation after insert on public.dj_recommendations
  for each row execute function public.after_recommendation();

create or replace function public.after_recommendation_response() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_rec public.dj_recommendations;
begin
  select * into v_rec from public.dj_recommendations where id = new.recommendation_id;
  perform public.log_activity(v_rec.event_id, 'recommendation_' || new.status, 'dj_recommendation', v_rec.id,
    jsonb_build_object('comment', new.comment), new.status in ('approved', 'question'), false);
  perform public.notify_users(array(select user_id from public.djs where id = v_rec.dj_id), public.event_company(v_rec.event_id), v_rec.event_id,
    'recommendation_response', 'הזוג הגיב להמלצה שלך', 'The couple responded to your recommendation', '/dj/couples/' || v_rec.event_id);
  return new;
end $$;
create trigger after_rec_response after insert or update on public.recommendation_responses
  for each row execute function public.after_recommendation_response();

-- ─────────────────────────── requests & messages ───────────────────────────
create or replace function public.after_request() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.event_id, case when new.opened_by_staff then 'clarification_requested' else 'request_opened' end,
      'couple_request', new.id, jsonb_build_object('category', new.category, 'title', new.title), true, false);
    if new.opened_by_staff then
      perform public.notify_users(array(select public.event_couple_user_ids(new.event_id)), public.event_company(new.event_id), new.event_id,
        'clarification', 'הדיג''יי שלכם ביקש הבהרה', 'Your DJ asked for a clarification', '/wedding/requests/' || new.id);
    else
      perform public.notify_users(array(select public.event_dj_user_ids(new.event_id)), public.event_company(new.event_id), new.event_id,
        'request', 'בקשה חדשה מהזוג', 'New request from the couple', '/dj/couples/' || new.event_id || '?tab=requests');
    end if;
  elsif new.status is distinct from old.status then
    perform public.log_activity(new.event_id, 'request_status_changed', 'couple_request', new.id,
      jsonb_build_object('from', old.status, 'to', new.status), false, false);
  end if;
  return new;
end $$;
create trigger after_request after insert or update on public.couple_requests
  for each row execute function public.after_request();

create or replace function public.after_request_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_req public.couple_requests; v_is_couple boolean;
begin
  select * into v_req from public.couple_requests where id = new.request_id;
  v_is_couple := public.is_event_couple(v_req.event_id);
  update public.couple_requests set updated_at = now(),
    status = case when v_req.status in ('resolved', 'closed') then v_req.status
                  when v_is_couple then 'in_progress' else 'awaiting_couple' end
   where id = v_req.id;
  if v_is_couple then
    perform public.notify_users(array(select public.event_dj_user_ids(v_req.event_id)), public.event_company(v_req.event_id), v_req.event_id,
      'request_message', 'הודעה חדשה בבקשה: ' || v_req.title, 'New message on a request', '/dj/couples/' || v_req.event_id || '?tab=requests');
  else
    perform public.notify_users(array(select public.event_couple_user_ids(v_req.event_id)), public.event_company(v_req.event_id), v_req.event_id,
      'request_message', 'הדיג''יי ענה: ' || v_req.title, 'Your DJ replied to a request', '/wedding/requests/' || v_req.id);
  end if;
  return new;
end $$;
create trigger after_message after insert on public.request_messages
  for each row execute function public.after_request_message();

-- ─────────────────────────── playlist confirmations ───────────────────────────
create or replace function public.track_playlist_confirm() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pl public.playlists;
begin
  select * into v_pl from public.playlists where id = new.playlist_id;
  if v_pl.kind = 'couple' and new.status = 'confirmed' and (tg_op = 'INSERT' or old.status <> 'confirmed') then
    perform public.log_activity(v_pl.event_id, 'playlist_track_confirmed', 'playlist_track', new.id,
      jsonb_build_object('playlist_id', v_pl.id, 'playlist', v_pl.title, 'track_id', new.track_id), true, false);
  elsif v_pl.kind = 'couple' and tg_op = 'UPDATE' and old.status = 'confirmed' and new.status <> 'confirmed' then
    perform public.log_activity(v_pl.event_id, 'playlist_track_unconfirmed', 'playlist_track', new.id,
      jsonb_build_object('playlist_id', v_pl.id, 'playlist', v_pl.title, 'track_id', new.track_id), true, false);
  end if;
  return new;
end $$;
create trigger track_confirm after insert or update on public.playlist_tracks
  for each row execute function public.track_playlist_confirm();

-- ─────────────────────────── DJ review marker ───────────────────────────
create or replace function public.mark_event_reviewed(p_event uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare v_dj uuid; v_at timestamptz := now();
begin
  select a.dj_id into v_dj from public.dj_assignments a join public.djs d on d.id = a.dj_id
   where a.event_id = p_event and a.status in ('proposed', 'confirmed') and d.user_id = (select auth.uid());
  if v_dj is null then raise exception 'not_assigned' using errcode = '42501'; end if;
  insert into public.dj_event_reviews (dj_id, event_id, last_reviewed_at) values (v_dj, p_event, v_at)
  on conflict (dj_id, event_id) do update set last_reviewed_at = excluded.last_reviewed_at;
  return v_at;
end $$;

-- ─────────────────────────── company analytics (real events only) ───────────────────────────
create or replace function public.company_metrics(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not public.is_company_admin(p_company) then raise exception 'admin_only' using errcode = '42501'; end if;
  select jsonb_build_object(
    'events', (select count(*) from public.wedding_events where company_id = p_company),
    'events_onboarded', (select count(*) from public.wedding_events where company_id = p_company and onboarding_completed_at is not null),
    'questionnaires_started', (select count(*) from public.questionnaire_responses r join public.wedding_events e on e.id = r.event_id where e.company_id = p_company),
    'questionnaires_submitted', (select count(*) from public.questionnaire_responses r join public.wedding_events e on e.id = r.event_id where e.company_id = p_company and r.submitted_at is not null),
    'moments_required', (select count(*) from public.wedding_moments where company_id = p_company and is_active and is_required),
    'moments_confirmed', (select count(*) from public.moment_selections s join public.wedding_events e on e.id = s.event_id where e.company_id = p_company and s.status = 'confirmed'),
    'pending_assignments', (select count(*) from public.dj_assignments a join public.wedding_events e on e.id = a.event_id where e.company_id = p_company and a.status = 'pending_approval'),
    'open_requests', (select count(*) from public.couple_requests r join public.wedding_events e on e.id = r.event_id where e.company_id = p_company and r.status in ('open', 'in_progress')),
    'recommendations', (select count(*) from public.dj_recommendations r join public.wedding_events e on e.id = r.event_id where e.company_id = p_company),
    'recommendations_approved', (select count(*) from public.recommendation_responses x join public.dj_recommendations r on r.id = x.recommendation_id join public.wedding_events e on e.id = r.event_id where e.company_id = p_company and x.status = 'approved'),
    'recommendations_answered', (select count(*) from public.recommendation_responses x join public.dj_recommendations r on r.id = x.recommendation_id join public.wedding_events e on e.id = r.event_id where e.company_id = p_company),
    'median_days_to_submit', (select percentile_cont(0.5) within group (order by extract(epoch from (r.submitted_at - e.created_at)) / 86400)
                               from public.questionnaire_responses r join public.wedding_events e on e.id = r.event_id
                               where e.company_id = p_company and r.submitted_at is not null),
    'dj_workload', (select coalesce(jsonb_agg(jsonb_build_object('dj_id', d.id, 'name', d.display_name,
                       'couples', (select count(*) from public.dj_assignments a where a.dj_id = d.id and a.status = 'confirmed'),
                       'open_requests', (select count(*) from public.couple_requests r join public.dj_assignments a on a.event_id = r.event_id and a.dj_id = d.id and a.status = 'confirmed' where r.status in ('open', 'in_progress'))
                     ) order by d.sort_order), '[]') from public.djs d where d.company_id = p_company and d.is_active),
    'includes_demo_data', (select exists (select 1 from public.wedding_events where company_id = p_company and is_demo))
  ) into v;
  return v;
end $$;

-- ─────────────────────────── execute privileges ───────────────────────────
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
-- internal plumbing: never callable directly by API users
revoke execute on function public.notify_users(uuid[], uuid, uuid, text, text, text, text) from authenticated;
revoke execute on function public.log_activity(uuid, text, text, uuid, jsonb, boolean, boolean) from authenticated;
revoke execute on function public.event_dj_user_ids(uuid) from authenticated;
revoke execute on function public.event_couple_user_ids(uuid) from authenticated;
revoke execute on function public.company_admin_ids(uuid) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.assert_track_company(uuid, uuid) from authenticated;
