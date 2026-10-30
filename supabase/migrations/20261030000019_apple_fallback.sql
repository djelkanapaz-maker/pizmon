-- Apple Music search as a fallback while Spotify is rate-limiting.
-- Couples can add a song found in Apple's catalog (metadata only, provider = 'apple_music').
-- Once Spotify answers again, an admin session links each such song to its Spotify track:
-- the row either becomes a Spotify row, or is merged into the Spotify row already in the catalog.

/** Moves every reference from one catalog song to another and deletes the first. Internal. */
create or replace function public.merge_track_into(p_dup uuid, p_keep uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_dup = p_keep then return; end if;
  delete from public.playlist_tracks a where a.track_id = p_dup
     and exists (select 1 from public.playlist_tracks b where b.playlist_id = a.playlist_id and b.track_id = p_keep);
  update public.playlist_tracks set track_id = p_keep where track_id = p_dup;
  insert into public.track_tags (track_id, tag_id, auto) select p_keep, tag_id, auto from public.track_tags where track_id = p_dup on conflict do nothing;
  insert into public.moment_tracks (moment_id, track_id) select moment_id, p_keep from public.moment_tracks where track_id = p_dup on conflict do nothing;
  insert into public.saved_tracks (event_id, track_id) select event_id, p_keep from public.saved_tracks where track_id = p_dup on conflict do nothing;
  insert into public.rejected_tracks (event_id, track_id) select event_id, p_keep from public.rejected_tracks where track_id = p_dup on conflict do nothing;
  update public.moment_selections set primary_track_id = p_keep where primary_track_id = p_dup;
  update public.moment_selections set backup_track_id = p_keep where backup_track_id = p_dup;
  update public.moment_selections set second_track_id = p_keep where second_track_id = p_dup;
  update public.music_restrictions set track_id = p_keep where track_id = p_dup;
  update public.dj_recommendations set track_id = p_keep where track_id = p_dup;
  -- the kept song is a company song if the merged one was
  update public.music_tracks k set added_by_event = null
   where k.id = p_keep and exists (select 1 from public.music_tracks d where d.id = p_dup and d.added_by_event is null);
  delete from public.music_tracks where id = p_dup;
end $$;
revoke execute on function public.merge_track_into(uuid, uuid) from public, anon, authenticated;

/** Same title + artist → one catalog song (the oldest company row wins). */
create or replace function public.merge_duplicate_tracks(p_company uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  if not (public.is_company_admin(p_company) or (select auth.uid()) is null) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  for r in
    select id as dup, keep from (
      select t.id, first_value(t.id) over w as keep, row_number() over w as rn
        from public.music_tracks t where t.company_id = p_company
      window w as (partition by lower(btrim(t.title)), t.artist_id order by t.added_by_event nulls first, (t.provider = 'spotify') desc, t.created_at, t.id)
    ) x where rn > 1
  loop
    perform public.merge_track_into(r.dup, r.keep); n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.merge_duplicate_tracks(uuid) from public, anon;
grant execute on function public.merge_duplicate_tracks(uuid) to authenticated;

/** A couple adds a song from Apple's catalog (validated metadata only). */
create or replace function public.couple_add_apple_track(p_apple text, p_title text, p_artists text, p_artwork text, p_url text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_event uuid; v_company uuid; v_artist uuid; v_track uuid; v_artists text;
begin
  select cm.event_id, e.company_id into v_event, v_company
    from public.couple_members cm join public.wedding_events e on e.id = cm.event_id
   where cm.user_id = (select auth.uid()) order by cm.created_at limit 1;
  if v_event is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_apple !~ '^[0-9]{1,15}$' or length(btrim(coalesce(p_title, ''))) not between 1 and 300
     or (p_artwork is not null and p_artwork !~ '^https://is[0-9]+-ssl\.mzstatic\.com/image/thumb/[A-Za-z0-9/._-]+$' or length(p_artwork) > 500)
     or (p_url is not null and p_url !~ '^https://music\.apple\.com/[a-z]{2}/[^[:space:]<>"]+$' or length(p_url) > 500) then
    raise exception 'invalid' using errcode = '22023';
  end if;

  select id into v_track from public.music_tracks where company_id = v_company and provider = 'apple_music' and provider_track_id = p_apple;
  if v_track is not null then return v_track; end if;

  v_artists := left(coalesce(nullif(btrim(p_artists), ''), 'Unknown'), 300);
  -- already in the catalog under the same title + artist (e.g. from Spotify): use it
  select t.id into v_track from public.music_tracks t join public.artists a on a.id = t.artist_id
   where t.company_id = v_company and lower(a.name) = lower(v_artists) and lower(btrim(t.title)) = lower(btrim(p_title))
     and (t.added_by_event is null or t.added_by_event = v_event)
   order by t.added_by_event nulls first, t.created_at limit 1;
  if v_track is not null then return v_track; end if;

  if (select count(*) from public.music_tracks where added_by_event = v_event) >= 500 then
    raise exception 'limit' using errcode = '54000';
  end if;
  insert into public.artists (company_id, name) values (v_company, v_artists) on conflict (company_id, name) do nothing;
  select id into v_artist from public.artists where company_id = v_company and name = v_artists;
  insert into public.music_tracks (company_id, title, artist_id, provider, provider_track_id, external_url, artwork_url, rights_status, status, added_by_event)
  values (v_company, left(btrim(p_title), 300), v_artist, 'apple_music', p_apple, p_url, p_artwork, 'metadata_only', 'published', v_event)
  on conflict (company_id, provider, provider_track_id) do nothing
  returning id into v_track;
  if v_track is null then
    select id into v_track from public.music_tracks where company_id = v_company and provider = 'apple_music' and provider_track_id = p_apple;
  end if;
  return v_track;
end $$;
revoke execute on function public.couple_add_apple_track(text, text, text, text, text) from public, anon;
grant execute on function public.couple_add_apple_track(text, text, text, text, text) to authenticated;

/** Admin: an Apple-sourced song was found on Spotify. Becomes that Spotify song (merged if it's already in the catalog). */
create or replace function public.admin_link_spotify(p_track uuid, p_spotify text, p_artwork text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_existing uuid;
begin
  select company_id into v_company from public.music_tracks where id = p_track and provider = 'apple_music';
  if v_company is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.is_company_admin(v_company) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_spotify !~ '^[A-Za-z0-9]{22}$' or (p_artwork is not null and p_artwork !~ '^https://i\.scdn\.co/image/[A-Za-z0-9]+$') then
    raise exception 'invalid' using errcode = '22023';
  end if;
  select id into v_existing from public.music_tracks where company_id = v_company and provider = 'spotify' and provider_track_id = p_spotify;
  if v_existing is not null then
    perform public.merge_track_into(p_track, v_existing);
    return v_existing;
  end if;
  update public.music_tracks set provider = 'spotify', provider_track_id = p_spotify,
         external_url = 'https://open.spotify.com/track/' || p_spotify, artwork_url = coalesce(p_artwork, artwork_url)
   where id = p_track;
  return p_track;
end $$;
revoke execute on function public.admin_link_spotify(uuid, text, text) from public, anon;
grant execute on function public.admin_link_spotify(uuid, text, text) to authenticated;
