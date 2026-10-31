-- A couple imports songs from their own Spotify playlist into their main playlist ("הפלייליסט שלנו").
-- The web app reads the playlist (title + artists per Spotify track id) and passes up to 200 songs here.
-- Each song reuses an existing catalog row (same Spotify id, or same title + artist), otherwise joins
-- the catalog as this wedding's song (added_by_event, same 500-per-wedding cap as single adds).
-- Songs already in the playlist are skipped, and so are songs on the couple's absolute "never" list.
-- Every added song is logged like a single add, so the DJ sees each one in the review.

create or replace function public.couple_import_spotify_tracks(p_playlist uuid, p_tracks jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_event uuid; v_company uuid; v_uid uuid := (select auth.uid());
  v_item jsonb; v_sp text; v_title text; v_artists text; v_art text;
  v_artist uuid; v_track uuid; v_pos int;
  v_added int := 0; v_already int := 0; v_blocked int := 0; v_skipped int := 0;
begin
  select cm.event_id, e.company_id into v_event, v_company
    from public.couple_members cm join public.wedding_events e on e.id = cm.event_id
   where cm.user_id = v_uid order by cm.created_at limit 1;
  if v_event is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.playlists where id = p_playlist and event_id = v_event and kind = 'couple' and is_main) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_tracks) <> 'array' or jsonb_array_length(p_tracks) > 200 then
    raise exception 'invalid' using errcode = '22023';
  end if;
  select coalesce(max(position), -1) into v_pos from public.playlist_tracks where playlist_id = p_playlist;

  for v_item in select * from jsonb_array_elements(p_tracks) loop
    v_sp := v_item->>'id';
    v_title := left(btrim(coalesce(v_item->>'title', '')), 300);
    v_artists := left(coalesce(nullif(btrim(v_item->>'artists'), ''), 'Unknown'), 300);
    v_art := v_item->>'artworkUrl';
    if v_sp is null or v_sp !~ '^[A-Za-z0-9]{22}$' or length(v_title) = 0 then v_skipped := v_skipped + 1; continue; end if;
    if v_art is not null and v_art !~ '^https://i\.scdn\.co/image/[A-Za-z0-9]+$' then v_art := null; end if;

    v_track := null;
    select id into v_track from public.music_tracks where company_id = v_company and provider = 'spotify' and provider_track_id = v_sp;
    if v_track is null then
      select t.id into v_track from public.music_tracks t join public.artists a on a.id = t.artist_id
       where t.company_id = v_company and lower(a.name) = lower(v_artists) and lower(btrim(t.title)) = lower(v_title)
         and (t.added_by_event is null or t.added_by_event = v_event)
       order by t.added_by_event nulls first, t.created_at limit 1;
    end if;
    if v_track is null then
      if (select count(*) from public.music_tracks where added_by_event = v_event) >= 500 then v_skipped := v_skipped + 1; continue; end if;
      insert into public.artists (company_id, name) values (v_company, v_artists) on conflict (company_id, name) do nothing;
      select id into v_artist from public.artists where company_id = v_company and name = v_artists;
      insert into public.music_tracks (company_id, title, artist_id, provider, provider_track_id, external_url, artwork_url, rights_status, status, added_by_event)
      values (v_company, v_title, v_artist, 'spotify', v_sp, 'https://open.spotify.com/track/' || v_sp, v_art, 'metadata_only', 'published', v_event)
      on conflict (company_id, provider, provider_track_id) do nothing
      returning id into v_track;
      if v_track is null then
        select id into v_track from public.music_tracks where company_id = v_company and provider = 'spotify' and provider_track_id = v_sp;
      end if;
    end if;

    if exists (select 1 from public.playlist_tracks where playlist_id = p_playlist and track_id = v_track) then
      v_already := v_already + 1; continue;
    end if;
    if public.never_play_conflict(v_event, v_track) is not null then v_blocked := v_blocked + 1; continue; end if;
    v_pos := v_pos + 1;
    insert into public.playlist_tracks (playlist_id, track_id, position, added_by) values (p_playlist, v_track, v_pos, v_uid)
    on conflict (playlist_id, track_id) do nothing;
    v_added := v_added + 1;
  end loop;

  return jsonb_build_object('added', v_added, 'already', v_already, 'blocked', v_blocked, 'skipped', v_skipped);
end $$;
revoke execute on function public.couple_import_spotify_tracks(uuid, jsonb) from public, anon;
grant execute on function public.couple_import_spotify_tracks(uuid, jsonb) to authenticated;
