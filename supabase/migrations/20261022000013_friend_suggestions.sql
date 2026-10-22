-- Friends help pick songs: the couple shares a link; anyone with it can see the couple's
-- playlist and suggest songs (no account). Suggestions wait for the couple to add or dismiss
-- them; nothing a friend does changes the playlist itself. DJs never see suggestions.

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.wedding_events (id) on delete cascade,
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{20,64}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index share_links_one_active on public.share_links (event_id) where revoked_at is null;

create table public.friend_suggestions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.wedding_events (id) on delete cascade,
  share_link_id uuid references public.share_links (id) on delete set null,
  friend_name text not null check (length(btrim(friend_name)) between 1 and 60),
  message text check (message is null or length(message) <= 300),
  spotify_track_id text not null check (spotify_track_id ~ '^[A-Za-z0-9]{22}$'),
  title text not null check (length(title) between 1 and 300),
  artists text check (artists is null or length(artists) <= 300),
  artwork_url text check (artwork_url is null or artwork_url ~ '^https://i\.scdn\.co/image/[A-Za-z0-9]+$'),
  status text not null default 'new' check (status in ('new', 'added', 'dismissed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index on public.friend_suggestions (event_id, status, created_at desc);

alter table public.share_links enable row level security;
alter table public.friend_suggestions enable row level security;

-- the couple (and company admins) manage their own link and suggestions; DJs are not included
create policy share_links_couple on public.share_links for all to authenticated
  using (public.is_event_couple(event_id) or public.is_company_admin(public.event_company(event_id)))
  with check (public.is_event_couple(event_id));
create policy friend_suggestions_read on public.friend_suggestions for select to authenticated
  using (public.is_event_couple(event_id) or public.is_company_admin(public.event_company(event_id)));
create policy friend_suggestions_handle on public.friend_suggestions for update to authenticated
  using (public.is_event_couple(event_id)) with check (public.is_event_couple(event_id));

-- What a friend sees through a valid link: first names and the couple's playlist. Nothing else.
create or replace function public.share_view(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'names', jsonb_build_array(e.partner_one_name, e.partner_two_name),
    'brand', c.brand_name,
    'tracks', coalesce((
      select jsonb_agg(jsonb_build_object('title', t.title, 'artist', a.name, 'artwork', t.artwork_url, 'spotify', t.provider_track_id) order by pt.position)
        from public.playlists p
        join public.playlist_tracks pt on pt.playlist_id = p.id
        join public.music_tracks t on t.id = pt.track_id
        left join public.artists a on a.id = t.artist_id
       where p.event_id = e.id and p.kind = 'couple' and p.is_main), '[]'::jsonb),
    'suggested', (select count(*) from public.friend_suggestions f where f.event_id = e.id))
  from public.share_links l
  join public.wedding_events e on e.id = l.event_id
  join public.companies c on c.id = e.company_id
  where l.token = p_token and l.revoked_at is null
$$;

create or replace function public.share_suggest(p_token text, p_name text, p_message text, p_spotify text, p_title text, p_artists text, p_artwork text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_link public.share_links; v_event public.wedding_events; v_name text; r record;
begin
  select * into v_link from public.share_links where token = p_token and revoked_at is null;
  if v_link.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into v_event from public.wedding_events where id = v_link.event_id;
  -- keep a shared link from being flooded
  if (select count(*) from public.friend_suggestions where share_link_id = v_link.id and created_at > now() - interval '1 hour') >= 60
     or (select count(*) from public.friend_suggestions where event_id = v_event.id) >= 1000 then
    raise exception 'limit' using errcode = '54000';
  end if;
  v_name := btrim(coalesce(p_name, ''));
  -- the same friend suggesting the same song twice is one suggestion
  if exists (select 1 from public.friend_suggestions where event_id = v_event.id and spotify_track_id = p_spotify and lower(friend_name) = lower(v_name)) then
    return;
  end if;
  insert into public.friend_suggestions (event_id, share_link_id, friend_name, message, spotify_track_id, title, artists, artwork_url)
  values (v_event.id, v_link.id, v_name, nullif(btrim(coalesce(p_message, '')), ''), p_spotify, btrim(coalesce(p_title, '')), nullif(btrim(coalesce(p_artists, '')), ''), p_artwork);
  for r in select user_id from public.couple_members where event_id = v_event.id loop
    insert into public.notifications (user_id, company_id, event_id, type, title_he, title_en, link)
    values (r.user_id, v_event.company_id, v_event.id, 'friend_suggestion',
      left(v_name || ' הציע/ה שיר: ' || btrim(p_title), 200), left(v_name || ' suggested a song: ' || btrim(p_title), 200), '/wedding/playlists#friends');
  end loop;
end $$;

revoke execute on function public.share_view(text) from public;
revoke execute on function public.share_suggest(text, text, text, text, text, text, text) from public;
grant execute on function public.share_view(text) to anon, authenticated;
grant execute on function public.share_suggest(text, text, text, text, text, text, text) to anon, authenticated;
