-- Anonymous visit counter for the public pages (landing, sign-up, get-app), so the admin can see how many people
-- looked at the sign-up page against how many signed up. No personal data: a random id the browser keeps, the page,
-- and the campaign source (ref / utm) when there is one.
create table if not exists public.page_visits (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  page text not null check (page in ('landing', 'signup', 'get_app')),
  event text not null default 'view' check (event in ('view', 'form_start')),
  visitor text not null check (char_length(visitor) between 8 and 64),
  source text check (char_length(source) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists page_visits_company_time_idx on public.page_visits (company_id, created_at);
create index if not exists page_visits_visitor_idx on public.page_visits (visitor, page, event, created_at);
alter table public.page_visits enable row level security;
drop policy if exists page_visits_admin_read on public.page_visits;
create policy page_visits_admin_read on public.page_visits for select using (public.is_company_admin(company_id));

-- the only way in: one row per visitor, page and event every 30 minutes (a reload doesn't count twice)
create or replace function public.track_visit(p_page text, p_event text, p_visitor text, p_source text)
returns void language sql security definer set search_path = public as $$
  insert into public.page_visits (company_id, page, event, visitor, source)
  select c.id, p_page, coalesce(p_event, 'view'), p_visitor, left(nullif(trim(p_source), ''), 120)
  from public.companies c
  where c.slug = 'pizmon'
    and not exists (select 1 from public.page_visits v where v.visitor = p_visitor and v.page = p_page
      and v.event = coalesce(p_event, 'view') and v.created_at > now() - interval '30 minutes');
$$;
revoke all on function public.track_visit(text, text, text, text) from public;
grant execute on function public.track_visit(text, text, text, text) to anon, authenticated;

-- totals per page and event for the last p_days days (RLS: admins of the company only)
create or replace function public.admin_visit_stats(p_company uuid, p_days int)
returns table (page text, event text, visits bigint, visitors bigint, sources jsonb)
language sql stable security invoker set search_path = public as $$
  select v.page, v.event, count(*), count(distinct v.visitor),
    (select coalesce(jsonb_agg(jsonb_build_object('source', s.source, 'visitors', s.n) order by s.n desc), '[]'::jsonb)
       from (select coalesce(x.source, '') as source, count(distinct x.visitor) as n from public.page_visits x
             where x.company_id = p_company and x.page = v.page and x.event = v.event
               and x.created_at > now() - make_interval(days => p_days)
             group by 1 order by 2 desc limit 5) s)
  from public.page_visits v
  where v.company_id = p_company and v.created_at > now() - make_interval(days => p_days)
  group by v.page, v.event;
$$;
grant execute on function public.admin_visit_stats(uuid, int) to authenticated;
