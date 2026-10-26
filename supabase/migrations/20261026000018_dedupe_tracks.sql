-- One catalog row per song. Spotify gives the same song a different id on every release
-- (album, single, compilation), so playlists brought the same title + artist in more than once.
-- 1. merge_duplicate_tracks() folds such rows into the oldest one, moving every reference.
-- 2. Couples adding a Spotify song reuse an existing title + artist instead of adding a copy.
-- Different versions ("acoustic", "piano version" …) have different titles and stay separate.

create or replace function public.merge_duplicate_tracks(p_company uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not (public.is_company_admin(p_company) or (select auth.uid()) is null) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  create temp table _m on commit drop as
  select id as dup, keep from (
    select t.id, first_value(t.id) over w as keep, row_number() over w as rn
      from public.music_tracks t
     where t.company_id = p_company
    window w as (partition by lower(btrim(t.title)), t.artist_id order by t.added_by_event nulls first, t.created_at, t.id)
  ) x where rn > 1;
  select count(*) into n from _m;
  if n = 0 then return 0; end if;

  -- rows keyed by (something, track): drop the copy where the kept song is already there, move the rest
  delete from public.playlist_tracks a using _m where a.track_id = _m.dup
     and exists (select 1 from public.playlist_tracks b where b.playlist_id = a.playlist_id and b.track_id = _m.keep);
  update public.playlist_tracks a set track_id = _m.keep from _m where a.track_id = _m.dup;
  insert into public.track_tags (track_id, tag_id, auto) select _m.keep, tt.tag_id, tt.auto from public.track_tags tt join _m on tt.track_id = _m.dup on conflict do nothing;
  insert into public.moment_tracks (moment_id, track_id) select mt.moment_id, _m.keep from public.moment_tracks mt join _m on mt.track_id = _m.dup on conflict do nothing;
  insert into public.saved_tracks (event_id, track_id) select s.event_id, _m.keep from public.saved_tracks s join _m on s.track_id = _m.dup on conflict do nothing;
  insert into public.rejected_tracks (event_id, track_id) select r.event_id, _m.keep from public.rejected_tracks r join _m on r.track_id = _m.dup on conflict do nothing;
  -- plain references
  update public.moment_selections s set primary_track_id = _m.keep from _m where s.primary_track_id = _m.dup;
  update public.moment_selections s set backup_track_id = _m.keep from _m where s.backup_track_id = _m.dup;
  update public.moment_selections s set second_track_id = _m.keep from _m where s.second_track_id = _m.dup;
  update public.music_restrictions r set track_id = _m.keep from _m where r.track_id = _m.dup;
  update public.dj_recommendations r set track_id = _m.keep from _m where r.track_id = _m.dup;
  -- the kept song is a company song if any copy was
  update public.music_tracks k set added_by_event = null from _m join public.music_tracks d on d.id = _m.dup
   where k.id = _m.keep and d.added_by_event is null;
  delete from public.music_tracks t using _m where t.id = _m.dup;
  return n;
end $$;
revoke execute on function public.merge_duplicate_tracks(uuid) from public, anon;
grant execute on function public.merge_duplicate_tracks(uuid) to authenticated;

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

  v_artists := left(coalesce(nullif(btrim(p_artists), ''), 'Unknown'), 300);
  -- the same song from another release is already in the catalog: use it
  select t.id into v_track from public.music_tracks t join public.artists a on a.id = t.artist_id
   where t.company_id = v_company and a.name = v_artists and lower(btrim(t.title)) = lower(btrim(p_title))
     and (t.added_by_event is null or t.added_by_event = v_event)
   order by t.added_by_event nulls first, t.created_at limit 1;
  if v_track is not null then return v_track; end if;

  if (select count(*) from public.music_tracks where added_by_event = v_event) >= 500 then
    raise exception 'limit' using errcode = '54000';
  end if;
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
