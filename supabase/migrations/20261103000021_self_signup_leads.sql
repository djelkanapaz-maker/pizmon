-- Free self-signup for couples (paskol.app) and the leads it brings to the company.
-- A self-signed-up wedding has signup_source = 'self' and no DJ assignment. Its phone, whether the
-- couple already booked a DJ (and who), and the couple's consent to be contacted are kept on the event
-- (the couple can see and edit them). The company works the lead in event_leads, which only the
-- company's admins can read: its status and private note never reach the couple.

alter table public.wedding_events
  add column if not exists signup_source text not null default 'admin' check (signup_source in ('admin', 'self')),
  add column if not exists phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  add column if not exists has_dj boolean,
  add column if not exists other_dj_name text check (other_dj_name is null or length(other_dj_name) <= 120),
  add column if not exists contact_consent boolean not null default false,
  add column if not exists call_requested_at timestamptz;

-- couples (and admins) may edit their own contact details
grant update (phone, has_dj, other_dj_name, contact_consent) on public.wedding_events to authenticated;

create table if not exists public.event_leads (
  event_id uuid primary key references public.wedding_events(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'call_requested', 'contacted', 'booked', 'not_relevant')),
  note text check (note is null or length(note) <= 2000),
  source text check (source is null or length(source) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists event_leads_company on public.event_leads (company_id, created_at desc);
alter table public.event_leads enable row level security;
drop policy if exists event_leads_admin_read on public.event_leads;
create policy event_leads_admin_read on public.event_leads for select to authenticated
  using (public.is_company_admin(company_id));
-- rows are written by the admin-users edge function (service role) and the RPCs below
revoke insert, update, delete, truncate, references, trigger on public.event_leads from authenticated;
revoke all on public.event_leads from anon;

/** A self-signed-up couple asks the company to call them back about DJ services (at most once a day). */
create or replace function public.couple_request_call() returns void
language plpgsql security definer set search_path = '' as $$
declare v_event public.wedding_events;
begin
  select e.* into v_event from public.couple_members cm join public.wedding_events e on e.id = cm.event_id
   where cm.user_id = (select auth.uid()) order by cm.created_at limit 1;
  if v_event.id is null or v_event.signup_source <> 'self' then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_event.call_requested_at is not null and v_event.call_requested_at > now() - interval '1 day' then return; end if;
  update public.wedding_events set contact_consent = true, call_requested_at = now() where id = v_event.id;
  insert into public.event_leads (event_id, company_id, status) values (v_event.id, v_event.company_id, 'call_requested')
  on conflict (event_id) do update set
    status = case when public.event_leads.status in ('contacted', 'booked') then public.event_leads.status else 'call_requested' end,
    updated_at = now();
  perform public.notify_users(array(select public.company_admin_ids(v_event.company_id)), v_event.company_id, v_event.id, 'lead_call_requested',
    'זוג ביקש שתחזרו אליו: ' || coalesce(v_event.partner_one_name, '') || coalesce(' & ' || v_event.partner_two_name, ''),
    'A couple asked to be called back: ' || coalesce(v_event.partner_one_name, '') || coalesce(' & ' || v_event.partner_two_name, ''),
    '/admin/leads');
end $$;
revoke execute on function public.couple_request_call() from public, anon;
grant execute on function public.couple_request_call() to authenticated;

/** Admin: lead status and private note. */
create or replace function public.admin_update_lead(p_event uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_company uuid;
begin
  select company_id into v_company from public.wedding_events where id = p_event;
  if v_company is null or not public.is_company_admin(v_company) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('new', 'call_requested', 'contacted', 'booked', 'not_relevant') then
    raise exception 'invalid' using errcode = '22023';
  end if;
  insert into public.event_leads (event_id, company_id, status, note) values (p_event, v_company, coalesce(p_status, 'new'), left(p_note, 2000))
  on conflict (event_id) do update set status = coalesce(p_status, public.event_leads.status), note = left(p_note, 2000), updated_at = now();
end $$;
revoke execute on function public.admin_update_lead(uuid, text, text) from public, anon;
grant execute on function public.admin_update_lead(uuid, text, text) to authenticated;
