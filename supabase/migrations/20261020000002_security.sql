-- WEDDING MUSIC CLUB — authorization helpers, RLS, column privileges
-- Rule of thumb: couples see only their own event; DJs see only events they are
-- assigned to (proposed/confirmed) or explicitly granted; admins see their company.

-- ─────────────────────────── helper functions ───────────────────────────
create or replace function public.member_role_in(p_company uuid) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select role from public.company_members
  where company_id = p_company and user_id = (select auth.uid())
$$;

create or replace function public.is_company_member(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.company_members
    where company_id = p_company and user_id = (select auth.uid()))
$$;

create or replace function public.is_company_admin(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.company_members
    where company_id = p_company and user_id = (select auth.uid()) and role = 'admin')
$$;

create or replace function public.is_company_staff(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.company_members
    where company_id = p_company and user_id = (select auth.uid()) and role in ('admin', 'dj'))
$$;

create or replace function public.my_dj_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select id from public.djs where user_id = (select auth.uid())
$$;

create or replace function public.event_company(p_event uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select company_id from public.wedding_events where id = p_event
$$;

create or replace function public.is_event_couple(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.couple_members
    where event_id = p_event and user_id = (select auth.uid()))
$$;

-- assigned DJ (proposed or confirmed), explicit grant, or company admin
create or replace function public.is_event_staff(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    exists (select 1 from public.wedding_events e
            join public.company_members m on m.company_id = e.company_id
            where e.id = p_event and m.user_id = (select auth.uid()) and m.role = 'admin')
    or exists (select 1 from public.dj_assignments a
            join public.djs d on d.id = a.dj_id
            where a.event_id = p_event and d.user_id = (select auth.uid())
              and a.status in ('proposed', 'confirmed'))
    or exists (select 1 from public.event_access_grants g
            join public.wedding_events e on e.id = g.event_id
            join public.company_members m on m.company_id = e.company_id and m.user_id = g.user_id
            where g.event_id = p_event and g.user_id = (select auth.uid()) and m.role in ('admin', 'dj'))
$$;

create or replace function public.can_read_event(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_event_couple(p_event) or public.is_event_staff(p_event)
$$;

-- users to notify
create or replace function public.event_dj_user_ids(p_event uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select d.user_id from public.dj_assignments a join public.djs d on d.id = a.dj_id
  where a.event_id = p_event and a.status in ('proposed', 'confirmed') and d.user_id is not null
$$;

create or replace function public.event_couple_user_ids(p_event uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select user_id from public.couple_members where event_id = p_event
$$;

create or replace function public.company_admin_ids(p_company uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select user_id from public.company_members where company_id = p_company and role = 'admin'
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- ─────────────────────────── enable RLS everywhere ───────────────────────────
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on public.%I from anon', t.tablename);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ─────────────────────────── companies / people ───────────────────────────
create policy companies_read on public.companies for select to authenticated
  using (public.is_company_member(id));
create policy companies_admin_update on public.companies for update to authenticated
  using (public.is_company_admin(id)) with check (public.is_company_admin(id));
revoke insert, delete on public.companies from authenticated;
revoke update on public.companies from authenticated;
grant update (brand_name, brand_tagline_he, brand_tagline_en, assignment_policy,
  couple_selection_requires_approval, default_locale, contact_email) on public.companies to authenticated;

create policy profiles_self on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_admin_read on public.profiles for select to authenticated
  using (exists (select 1 from public.company_members m
                 where m.user_id = profiles.id and public.is_company_admin(m.company_id)));
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, locale) on public.profiles to authenticated;

create policy members_self on public.company_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_company_admin(company_id));
-- membership rows are created by the admin-users edge function (service role)
revoke insert, update, delete on public.company_members from authenticated;

create policy djs_read on public.djs for select to authenticated
  using (public.is_company_member(company_id));
create policy djs_admin_write on public.djs for all to authenticated
  using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));
create policy djs_self_update on public.djs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- a DJ editing their own profile must not be able to re-home or re-link it
revoke update on public.djs from authenticated;
grant update (display_name, bio_he, bio_en, specialties, photo_url, accepts_new_couples,
  is_active, sort_order, slug) on public.djs to authenticated;

-- ─────────────────────────── events ───────────────────────────
create policy events_read on public.wedding_events for select to authenticated
  using (public.can_read_event(id));
create policy events_admin_insert on public.wedding_events for insert to authenticated
  with check (public.is_company_admin(company_id));
create policy events_update on public.wedding_events for update to authenticated
  using (public.is_event_couple(id) or public.is_company_admin(company_id))
  with check (public.is_event_couple(id) or public.is_company_admin(company_id));
create policy events_admin_delete on public.wedding_events for delete to authenticated
  using (public.is_company_admin(company_id));
revoke update on public.wedding_events from authenticated;
grant update (partner_one_name, partner_two_name, wedding_date, venue_name, venue_city,
  guest_count, languages, cultural_notes, onboarding_step, onboarding_completed_at)
  on public.wedding_events to authenticated;

create policy couple_members_read on public.couple_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_event_staff(event_id));
revoke insert, update, delete on public.couple_members from authenticated;

create policy assignments_read on public.dj_assignments for select to authenticated
  using (public.can_read_event(event_id)
         or dj_id in (select public.my_dj_ids())
         or public.is_company_admin(public.event_company(event_id)));
-- all writes go through security-definer RPCs below
revoke insert, update, delete on public.dj_assignments from authenticated;

create policy grants_read on public.event_access_grants for select to authenticated
  using (user_id = (select auth.uid()) or public.is_company_admin(public.event_company(event_id)));
create policy grants_admin_write on public.event_access_grants for all to authenticated
  using (public.is_company_admin(public.event_company(event_id)))
  with check (public.is_company_admin(public.event_company(event_id)));

create policy reviews_own on public.dj_event_reviews for all to authenticated
  using (dj_id in (select public.my_dj_ids()))
  with check (dj_id in (select public.my_dj_ids()) and public.is_event_staff(event_id));

-- ─────────────────────────── catalog (company-wide reference data) ───────────────────────────
do $$
declare t text;
begin
  foreach t in array array['genres', 'tags', 'artists', 'wedding_moments', 'questionnaires', 'radio_stations', 'media_assets']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_company_member(company_id))', t || '_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id))', t || '_admin_write', t);
  end loop;
end $$;

create policy tracks_read on public.music_tracks for select to authenticated
  using ((status = 'published' and public.is_company_member(company_id)) or public.is_company_admin(company_id));
create policy tracks_admin_write on public.music_tracks for all to authenticated
  using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));

create policy track_tags_read on public.track_tags for select to authenticated
  using (exists (select 1 from public.music_tracks t where t.id = track_id and public.is_company_member(t.company_id)));
create policy track_tags_admin on public.track_tags for all to authenticated
  using (exists (select 1 from public.music_tracks t where t.id = track_id and public.is_company_admin(t.company_id)))
  with check (exists (select 1 from public.music_tracks t join public.tags g on g.id = tag_id
                      where t.id = track_id and g.company_id = t.company_id and public.is_company_admin(t.company_id)));

create policy moment_tracks_read on public.moment_tracks for select to authenticated
  using (exists (select 1 from public.wedding_moments m where m.id = moment_id and public.is_company_member(m.company_id)));
create policy moment_tracks_admin on public.moment_tracks for all to authenticated
  using (exists (select 1 from public.wedding_moments m where m.id = moment_id and public.is_company_admin(m.company_id)))
  with check (exists (select 1 from public.wedding_moments m join public.music_tracks t on t.id = track_id
                      where m.id = moment_id and t.company_id = m.company_id and public.is_company_admin(m.company_id)));

create policy qversions_read on public.questionnaire_versions for select to authenticated
  using (exists (select 1 from public.questionnaires q where q.id = questionnaire_id and public.is_company_member(q.company_id)));
create policy qversions_admin on public.questionnaire_versions for all to authenticated
  using (exists (select 1 from public.questionnaires q where q.id = questionnaire_id and public.is_company_admin(q.company_id)))
  with check (exists (select 1 from public.questionnaires q where q.id = questionnaire_id and public.is_company_admin(q.company_id)));

create policy schedule_read on public.radio_schedule_items for select to authenticated
  using (exists (select 1 from public.radio_stations s where s.id = station_id and public.is_company_member(s.company_id)));
create policy schedule_admin on public.radio_schedule_items for all to authenticated
  using (exists (select 1 from public.radio_stations s where s.id = station_id and public.is_company_admin(s.company_id)))
  with check (exists (select 1 from public.radio_stations s where s.id = station_id and public.is_company_admin(s.company_id)));

create policy content_read on public.content_items for select to authenticated
  using (public.is_company_admin(company_id)
         or (status = 'published' and public.is_company_member(company_id)
             and (visibility = 'company' or public.can_read_event(visible_event_id))));
create policy content_admin on public.content_items for all to authenticated
  using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));

-- ─────────────────────────── couple-owned event data ───────────────────────────
-- Read: couple + assigned staff. Write: couple (and admins, for support).
do $$
declare t text;
begin
  foreach t in array array['moment_selections', 'questionnaire_responses', 'music_restrictions', 'saved_tracks', 'rejected_tracks']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (public.can_read_event(event_id))', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_event_couple(event_id) or public.is_company_admin(public.event_company(event_id)))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_event_couple(event_id) or public.is_company_admin(public.event_company(event_id))) with check (public.is_event_couple(event_id) or public.is_company_admin(public.event_company(event_id)))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_event_couple(event_id) or public.is_company_admin(public.event_company(event_id)))', t || '_delete', t);
  end loop;
end $$;
-- submission state and pinned template version are changed only by RPC
revoke update on public.questionnaire_responses from authenticated;
grant update (answers, completed_sections) on public.questionnaire_responses to authenticated;

-- playlists
create policy playlists_read on public.playlists for select to authenticated using (
  case kind
    when 'couple' then public.is_event_couple(event_id)
                       or public.is_company_admin(company_id)
                       or (shared_with_dj and public.is_event_staff(event_id))
    else (status = 'published' and public.is_company_member(company_id)) or public.is_company_staff(company_id)
  end);
create policy playlists_write on public.playlists for all to authenticated using (
  case kind
    when 'couple' then public.is_event_couple(event_id)
    when 'dj' then dj_id in (select public.my_dj_ids()) or public.is_company_admin(company_id)
    else public.is_company_admin(company_id)
  end) with check (
  company_id = coalesce(public.event_company(event_id), company_id) and
  case kind
    when 'couple' then public.is_event_couple(event_id)
    when 'dj' then (dj_id in (select public.my_dj_ids()) and public.is_company_staff(company_id)) or public.is_company_admin(company_id)
    else public.is_company_admin(company_id)
  end);

create or replace function public.can_write_playlist(p_playlist uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.playlists p where p.id = p_playlist and case p.kind
    when 'couple' then public.is_event_couple(p.event_id)
    when 'dj' then p.dj_id in (select public.my_dj_ids()) or public.is_company_admin(p.company_id)
    else public.is_company_admin(p.company_id) end)
$$;
create policy playlist_tracks_read on public.playlist_tracks for select to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id));  -- inherits playlists RLS
create policy playlist_tracks_write on public.playlist_tracks for all to authenticated
  using (public.can_write_playlist(playlist_id)) with check (public.can_write_playlist(playlist_id));

-- DJ recommendations
create policy recs_read on public.dj_recommendations for select to authenticated
  using (public.can_read_event(event_id));
create policy recs_insert on public.dj_recommendations for insert to authenticated
  with check (public.is_event_staff(event_id) and created_by = (select auth.uid())
              and (dj_id is null or dj_id in (select public.my_dj_ids())
                   or public.is_company_admin(public.event_company(event_id))));
create policy recs_delete on public.dj_recommendations for delete to authenticated
  using (created_by = (select auth.uid()));
revoke update on public.dj_recommendations from authenticated;

create policy rec_responses_read on public.recommendation_responses for select to authenticated
  using (exists (select 1 from public.dj_recommendations r where r.id = recommendation_id and public.can_read_event(r.event_id)));
create policy rec_responses_write on public.recommendation_responses for all to authenticated
  using (exists (select 1 from public.dj_recommendations r where r.id = recommendation_id and public.is_event_couple(r.event_id)))
  with check (responded_by = (select auth.uid()) and exists (select 1 from public.dj_recommendations r where r.id = recommendation_id and public.is_event_couple(r.event_id)));

-- structured requests
create policy requests_read on public.couple_requests for select to authenticated
  using (public.can_read_event(event_id));
create policy requests_insert on public.couple_requests for insert to authenticated
  with check (created_by = (select auth.uid()) and (
    (public.is_event_couple(event_id) and not opened_by_staff) or
    (public.is_event_staff(event_id) and opened_by_staff)));
create policy requests_update on public.couple_requests for update to authenticated
  using (public.can_read_event(event_id)) with check (public.can_read_event(event_id));
revoke update on public.couple_requests from authenticated;
grant update (status, resolved_at) on public.couple_requests to authenticated;
revoke delete on public.couple_requests from authenticated;

create policy request_messages_read on public.request_messages for select to authenticated
  using (exists (select 1 from public.couple_requests r where r.id = request_id and public.can_read_event(r.event_id)));
create policy request_messages_insert on public.request_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (select 1 from public.couple_requests r where r.id = request_id and public.can_read_event(r.event_id)));
revoke update, delete on public.request_messages from authenticated;

-- internal notes: staff only, never couples
create policy notes_staff_read on public.internal_notes for select to authenticated
  using (public.is_event_staff(event_id));
create policy notes_staff_insert on public.internal_notes for insert to authenticated
  with check (public.is_event_staff(event_id) and author_id = (select auth.uid()));
create policy notes_author_delete on public.internal_notes for delete to authenticated
  using (author_id = (select auth.uid()));
revoke update on public.internal_notes from authenticated;

-- activity: written by triggers only
create policy activity_read on public.activity_events for select to authenticated
  using ((event_id is not null and public.is_event_staff(event_id))
         or public.is_company_admin(company_id)
         or (event_id is not null and not staff_only and public.is_event_couple(event_id)));
revoke insert, update, delete on public.activity_events from authenticated;

-- notifications: own only; only read_at may change
create policy notifications_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, delete on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
