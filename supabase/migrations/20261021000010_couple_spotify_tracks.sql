-- Couples can add any song from Spotify's catalog to their playlist. The song joins the
-- company catalog (metadata only) and remembers which wedding added it, so it doesn't
-- clutter other couples' search until the company adopts it (e.g. by syncing a playlist).
alter table public.music_tracks add column if not exists added_by_event uuid references public.wedding_events (id) on delete set null;

create or replace function public.couple_add_spotify_track(p_spotify text, p_title text, p_artists text, p_artwork text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_event uuid; v_company uuid; v_artist uuid; v_track uuid; v_artists text;
begin
  select cm.event_id, e.company_id into v_event, v_company
    from public.couple_members cm join public.wedding_events e on e.id = cm.event_id
   where cm.user_id = (select auth.uid()) order by cm.created_at limit 1;
  if v_event is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_spotify !~ '^[A-Za-z0-9]{22}$' or length(btrim(coalesce(p_title, ''))) not between 1 and 300
     or (p_artwork is not null and p_artwork !~ '^https://i\.scdn\.co/image/[A-Za-z0-9]+$') then
    raise exception 'invalid' using errcode = '22023';
  end if;

  select id into v_track from public.music_tracks where company_id = v_company and provider = 'spotify' and provider_track_id = p_spotify;
  if v_track is not null then return v_track; end if;

  if (select count(*) from public.music_tracks where added_by_event = v_event) >= 500 then
    raise exception 'limit' using errcode = '54000';
  end if;
  v_artists := left(coalesce(nullif(btrim(p_artists), ''), 'Unknown'), 300);
  insert into public.artists (company_id, name) values (v_company, v_artists) on conflict (company_id, name) do nothing;
  select id into v_artist from public.artists where company_id = v_company and name = v_artists;
  insert into public.music_tracks (company_id, title, artist_id, provider, provider_track_id, external_url, artwork_url, rights_status, status, added_by_event)
  values (v_company, left(btrim(p_title), 300), v_artist, 'spotify', p_spotify, 'https://open.spotify.com/track/' || p_spotify, p_artwork, 'metadata_only', 'published', v_event)
  on conflict (company_id, provider, provider_track_id) do nothing
  returning id into v_track;
  if v_track is null then
    select id into v_track from public.music_tracks where company_id = v_company and provider = 'spotify' and provider_track_id = p_spotify;
  end if;
  return v_track;
end $$;
revoke execute on function public.couple_add_spotify_track(text, text, text, text) from public, anon;
grant execute on function public.couple_add_spotify_track(text, text, text, text) to authenticated;
