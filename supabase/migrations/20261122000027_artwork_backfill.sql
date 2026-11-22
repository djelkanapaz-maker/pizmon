-- One-off backfill of missing Spotify covers (465 catalog songs had none).
-- Each song's cover comes from Spotify's public oEmbed endpoint through pg_net; a pg_cron job
-- ('artwork-backfill', every 5 minutes) saves the answers and asks for the next 25, so Spotify's
-- rate limit is respected, and unschedules itself when nothing is left.
create table if not exists private.artwork_jobs (request_id bigint primary key, track_id uuid not null);

create or replace function private.artwork_step(n int) returns int language plpgsql security definer set search_path = public, private, net as $$
declare left_ int;
begin
  update music_tracks t set artwork_url = 'https://i.scdn.co/image/' || substring(r.content::jsonb ->> 'thumbnail_url' from '/image/([A-Za-z0-9]+)$')
    from private.artwork_jobs j join net._http_response r on r.id = j.request_id
   where t.id = j.track_id and t.artwork_url is null and r.status_code = 200
     and (r.content::jsonb ->> 'thumbnail_url') ~ '/image/[A-Za-z0-9]+$';
  delete from private.artwork_jobs j using music_tracks t where t.id = j.track_id and t.artwork_url is not null;
  delete from private.artwork_jobs j using net._http_response r where r.id = j.request_id and r.status_code in (400, 404);
  with todo as (
    select j.request_id from private.artwork_jobs j left join net._http_response r on r.id = j.request_id
     where r.id is not null and (r.status_code is distinct from 200)
     order by j.request_id limit n),
  re as (select todo.request_id old_id, net.http_get(url := 'https://open.spotify.com/oembed?url=https://open.spotify.com/track/' || t.provider_track_id, timeout_milliseconds := 20000) new_id
           from todo join private.artwork_jobs j on j.request_id = todo.request_id join music_tracks t on t.id = j.track_id)
  update private.artwork_jobs j set request_id = re.new_id from re where j.request_id = re.old_id;
  select count(*) into left_ from private.artwork_jobs;
  return left_;
end $$;
revoke all on function private.artwork_step(int) from public, anon, authenticated;

create or replace function private.artwork_tick() returns void language plpgsql security definer set search_path = public, private, net, cron as $$
begin
  if private.artwork_step(25) = 0 then
    perform cron.unschedule('artwork-backfill');
  end if;
end $$;
revoke all on function private.artwork_tick() from public, anon, authenticated;
