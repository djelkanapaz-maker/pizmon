-- The web app's sign-up server action proves itself to the admin-users edge function with a shared secret,
-- so the function can rate-limit by the visitor's IP (forwarded by the app) instead of Vercel's.
-- Only its SHA-256 is stored; the secret itself is the SIGNUP_SECRET env var of the web app
-- (or the SIGNUP_SECRET function secret, which the function also accepts).
create table if not exists private.app_secrets (
  name text primary key,
  secret_hash text not null,
  updated_at timestamptz not null default now()
);
revoke all on private.app_secrets from public, anon, authenticated;

create or replace function public.check_app_secret(p_name text, p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.app_secrets
                 where name = p_name and secret_hash = encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex'))
$$;
revoke execute on function public.check_app_secret(text, text) from public, anon, authenticated;
grant execute on function public.check_app_secret(text, text) to service_role;
