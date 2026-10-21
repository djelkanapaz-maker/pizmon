-- Native push notifications: every in-app notification is also pushed to the user's phones.
-- Devices register their push token; a trigger hands each new notification to the
-- `send-push` edge function (via pg_net) once it is configured in private.app_settings.

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  token text not null check (length(token) between 20 and 4096),
  locale text not null default 'he' check (locale in ('he', 'en')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (token)
);
create index if not exists push_devices_user on public.push_devices (user_id);
alter table public.push_devices enable row level security;
create policy push_devices_own on public.push_devices for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.push_devices from authenticated, anon;

create or replace function public.register_push_device(p_platform text, p_token text, p_locale text default 'he') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_platform not in ('ios', 'android') or length(p_token) not between 20 and 4096 then raise exception 'invalid' using errcode = '22023'; end if;
  insert into public.push_devices (user_id, platform, token, locale)
  values ((select auth.uid()), p_platform, p_token, case when p_locale = 'en' then 'en' else 'he' end)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, locale = excluded.locale, last_seen_at = now();
end $$;

create or replace function public.unregister_push_device(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_devices where token = p_token and user_id = (select auth.uid());
end $$;

revoke execute on function public.register_push_device(text, text, text) from public, anon;
revoke execute on function public.unregister_push_device(text) from public, anon;
grant execute on function public.register_push_device(text, text, text) to authenticated;
grant execute on function public.unregister_push_device(text) to authenticated;

-- server-side settings (not exposed through the API)
create table if not exists private.app_settings (key text primary key, value text not null);
alter table private.app_settings enable row level security;
revoke all on private.app_settings from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then create extension if not exists pg_net with schema extensions; end if;
end $$;

create or replace function public.push_new_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  select value into v_url from private.app_settings where key = 'push_function_url';
  select value into v_secret from private.app_settings where key = 'push_secret';
  if v_url is null or v_secret is null then return new; end if;
  if not exists (select 1 from public.push_devices where user_id = new.user_id) then return new; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object('notification_id', new.id)
  );
  return new;
exception when others then
  return new; -- never block the notification itself
end $$;
revoke execute on function public.push_new_notification() from public, anon, authenticated;
drop trigger if exists push_after_insert on public.notifications;
create trigger push_after_insert after insert on public.notifications for each row execute function public.push_new_notification();

-- read by the send-push edge function (service role only)
create or replace function public.push_payload(p_notification uuid, p_secret text)
returns table (platform text, token text, title text, link text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_secret is distinct from (select value from private.app_settings where key = 'push_secret') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select d.platform, d.token, case when d.locale = 'en' then n.title_en else n.title_he end, n.link
    from public.notifications n join public.push_devices d on d.user_id = n.user_id
    where n.id = p_notification;
end $$;
revoke execute on function public.push_payload(uuid, text) from public, anon, authenticated;
grant execute on function public.push_payload(uuid, text) to service_role;

create or replace function public.forget_push_token(p_token text, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is distinct from (select value from private.app_settings where key = 'push_secret') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.push_devices where token = p_token;
end $$;
revoke execute on function public.forget_push_token(text, text) from public, anon, authenticated;
grant execute on function public.forget_push_token(text, text) to service_role;

-- In-app account deletion (App Store requirement): the user asks, company admins are notified
-- and remove the account from the admin area (auth users are only deleted by the admin function).
create table if not exists private.account_deletion_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table private.account_deletion_requests enable row level security;
revoke all on private.account_deletion_requests from public, anon, authenticated;

create or replace function public.request_account_deletion() returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_company uuid; v_email text;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into private.account_deletion_requests (user_id) values (v_uid) on conflict do nothing;
  select coalesce(
    (select e.company_id from public.couple_members cm join public.wedding_events e on e.id = cm.event_id where cm.user_id = v_uid limit 1),
    (select company_id from public.company_members where user_id = v_uid limit 1)) into v_company;
  select email into v_email from public.profiles where id = v_uid;
  if v_company is not null then
    perform public.notify_users(array(select user_id from public.company_members where company_id = v_company and role = 'admin'), v_company, null,
      'account_deletion_requested', 'בקשה למחיקת חשבון: ' || coalesce(v_email, ''), 'Account deletion requested: ' || coalesce(v_email, ''), '/admin/couples');
  end if;
end $$;
revoke execute on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;
