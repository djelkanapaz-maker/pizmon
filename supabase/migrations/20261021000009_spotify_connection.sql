-- A company can connect one Spotify account (its own) so admins can sync whole playlists.
-- The refresh token is stored encrypted by the app server (AES-GCM with a server-only key);
-- the database never sees it in clear, and only company admins can read the ciphertext.
create table if not exists private.spotify_connections (
  company_id uuid primary key references public.companies (id) on delete cascade,
  token_cipher text not null,
  spotify_user_id text not null,
  display_name text,
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz not null default now()
);
revoke all on private.spotify_connections from public, anon, authenticated;

create or replace function public.admin_spotify_connection(p_company uuid)
returns table (token_cipher text, spotify_user_id text, display_name text, connected_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_company_admin(p_company) then raise exception 'admin_only' using errcode = '42501'; end if;
  return query select c.token_cipher, c.spotify_user_id, c.display_name, c.connected_at from private.spotify_connections c where c.company_id = p_company;
end $$;

create or replace function public.admin_save_spotify_connection(p_company uuid, p_cipher text, p_user text, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_company_admin(p_company) then raise exception 'admin_only' using errcode = '42501'; end if;
  if length(p_cipher) > 4000 or p_user !~ '^[A-Za-z0-9._-]{1,128}$' then raise exception 'invalid' using errcode = '22023'; end if;
  insert into private.spotify_connections (company_id, token_cipher, spotify_user_id, display_name, connected_by)
  values (p_company, p_cipher, p_user, left(p_name, 120), (select auth.uid()))
  on conflict (company_id) do update set token_cipher = excluded.token_cipher, spotify_user_id = excluded.spotify_user_id,
    display_name = excluded.display_name, connected_by = excluded.connected_by, connected_at = now();
end $$;

create or replace function public.admin_clear_spotify_connection(p_company uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_company_admin(p_company) then raise exception 'admin_only' using errcode = '42501'; end if;
  delete from private.spotify_connections where company_id = p_company;
end $$;

revoke execute on function public.admin_spotify_connection(uuid) from public, anon;
revoke execute on function public.admin_save_spotify_connection(uuid, text, text, text) from public, anon;
revoke execute on function public.admin_clear_spotify_connection(uuid) from public, anon;
grant execute on function public.admin_spotify_connection(uuid) to authenticated;
grant execute on function public.admin_save_spotify_connection(uuid, text, text, text) to authenticated;
grant execute on function public.admin_clear_spotify_connection(uuid) to authenticated;
