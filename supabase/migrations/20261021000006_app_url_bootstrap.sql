-- 1. Public URL of the deployed app, used in activation links (no dashboard secret needed).
alter table public.companies add column if not exists app_url text
  check (app_url is null or app_url ~ '^https?://[^\s/]+(/[^\s]*)?$');
grant update (app_url) on public.companies to authenticated;  -- still limited to admins by companies_admin_update

-- 2. One-time bootstrap tokens for creating a company's first admin.
--    Lives in a schema PostgREST does not expose; only the service role can consume a token.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.bootstrap_tokens (
  token_hash text primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '1 hour',
  created_at timestamptz not null default now()
);
revoke all on private.bootstrap_tokens from public, anon, authenticated;

create or replace function public.consume_bootstrap_token(p_token text, p_company uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_ok boolean;
begin
  delete from private.bootstrap_tokens
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and company_id = p_company and expires_at > now()
  returning true into v_ok;
  return coalesce(v_ok, false);
end $$;
revoke execute on function public.consume_bootstrap_token(text, uuid) from public, anon, authenticated;
grant execute on function public.consume_bootstrap_token(text, uuid) to service_role;
