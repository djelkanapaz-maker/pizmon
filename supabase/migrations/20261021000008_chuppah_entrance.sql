-- One "chuppah entrance" moment replaces the separate groom / bride entrances.
-- The couple chooses one song for both of them, or two songs (groom, bride).

alter table public.wedding_moments add column if not exists allows_split boolean not null default false;
alter table public.moment_selections
  add column if not exists split boolean not null default false,
  add column if not exists second_track_id uuid references public.music_tracks (id) on delete set null,
  add column if not exists second_custom_song text check (second_custom_song is null or length(second_custom_song) <= 500);

-- the catalog guard and change history cover the second song too
create or replace function public.check_event_track() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_company uuid := public.event_company(new.event_id);
begin
  if tg_table_name = 'moment_selections' then
    perform public.assert_track_company(new.primary_track_id, v_company);
    perform public.assert_track_company(new.backup_track_id, v_company);
    perform public.assert_track_company(new.second_track_id, v_company);
  elsif tg_table_name = 'music_restrictions' then
    perform public.assert_track_company(new.track_id, v_company);
    if new.artist_id is not null and not exists (select 1 from public.artists where id = new.artist_id and company_id = v_company) then
      raise exception 'artist not in company' using errcode = '23514';
    end if;
    if new.genre_id is not null and not exists (select 1 from public.genres where id = new.genre_id and company_id = v_company) then
      raise exception 'genre not in company' using errcode = '23514';
    end if;
  else
    perform public.assert_track_company(new.track_id, v_company);
  end if;
  return new;
end $$;

create or replace function public.track_moment_selection() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb := case when tg_op = 'UPDATE' then jsonb_build_object('status', old.status, 'primary_track_id', old.primary_track_id,
                     'backup_track_id', old.backup_track_id, 'custom_song', old.custom_song, 'split', old.split,
                     'second_track_id', old.second_track_id, 'second_custom_song', old.second_custom_song) end;
  v_after jsonb := jsonb_build_object('status', new.status, 'primary_track_id', new.primary_track_id,
                     'backup_track_id', new.backup_track_id, 'custom_song', new.custom_song, 'split', new.split,
                     'second_track_id', new.second_track_id, 'second_custom_song', new.second_custom_song, 'moment_id', new.moment_id);
  v_was_confirmed boolean := tg_op = 'UPDATE' and old.status = 'confirmed';
  v_song_changed boolean := tg_op = 'INSERT' or old.primary_track_id is distinct from new.primary_track_id
                            or old.custom_song is distinct from new.custom_song or old.backup_track_id is distinct from new.backup_track_id
                            or old.split is distinct from new.split or old.second_track_id is distinct from new.second_track_id
                            or old.second_custom_song is distinct from new.second_custom_song;
  v_moment text;
begin
  if tg_op = 'UPDATE' and v_before - 'moment_id' = v_after - 'moment_id' then return new; end if;
  select name_he into v_moment from public.wedding_moments where id = new.moment_id;
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status <> 'confirmed') then
    perform public.log_activity(new.event_id, 'moment_confirmed', 'moment_selection', new.id,
      jsonb_build_object('before', v_before, 'after', v_after), true, false);
    perform public.notify_users(array(select public.event_dj_user_ids(new.event_id)), public.event_company(new.event_id), new.event_id,
      'moment_confirmed', 'שיר אושר: ' || v_moment, 'A song was confirmed for a wedding moment', '/dj/couples/' || new.event_id);
  elsif v_was_confirmed and (v_song_changed or new.status <> 'confirmed') then
    perform public.log_activity(new.event_id, 'confirmed_moment_changed', 'moment_selection', new.id,
      jsonb_build_object('before', v_before, 'after', v_after), true, false);
    perform public.notify_users(array(select public.event_dj_user_ids(new.event_id)), public.event_company(new.event_id), new.event_id,
      'confirmed_moment_changed', 'שינוי בשיר שאושר: ' || v_moment, 'A confirmed wedding-moment song changed', '/dj/couples/' || new.event_id);
  else
    perform public.log_activity(new.event_id, 'moment_updated', 'moment_selection', new.id,
      jsonb_build_object('before', v_before, 'after', v_after), false, false);
  end if;
  return new;
end $$;
revoke execute on function public.check_event_track() from public, anon, authenticated;
revoke execute on function public.track_moment_selection() from public, anon, authenticated;

-- data: create the merged moment for companies that still have the two entrances
insert into public.wedding_moments (company_id, slug, name_he, name_en, description_he, description_en, sort_order, is_required, allows_split)
select g.company_id, 'chuppah-entrance', 'שיר כניסה לחופה', 'Chuppah entrance song',
       'שיר אחד לשניכם, או שיר לחתן ושיר לכלה.', 'One song for both of you, or one for the groom and one for the bride.',
       g.sort_order, true, true
from public.wedding_moments g
where g.slug = 'groom-entrance'
on conflict (company_id, slug) do update set allows_split = true, is_active = true;

insert into public.moment_tracks (moment_id, track_id, collection, sort_order)
select c.id, mt.track_id, mt.collection, min(mt.sort_order)
from public.moment_tracks mt
join public.wedding_moments o on o.id = mt.moment_id and o.slug in ('groom-entrance', 'bride-entrance')
join public.wedding_moments c on c.company_id = o.company_id and c.slug = 'chuppah-entrance'
group by c.id, mt.track_id, mt.collection
on conflict do nothing;

-- carry over what couples already chose (groom's song → first, bride's → second)
insert into public.moment_selections (event_id, moment_id, status, split, primary_track_id, custom_song, second_track_id, second_custom_song, notes, updated_by)
select coalesce(g.event_id, b.event_id), c.id,
       case when coalesce(g.primary_track_id::text, g.custom_song, b.primary_track_id::text, b.custom_song) is null then 'browsing'::public.selection_status
            else 'awaiting_confirmation'::public.selection_status end,
       b.event_id is not null and (b.primary_track_id is not null or b.custom_song is not null),
       g.primary_track_id, g.custom_song, b.primary_track_id, b.custom_song,
       nullif(concat_ws(E'\n', g.notes, b.notes), ''), coalesce(g.updated_by, b.updated_by)
from (select s.* from public.moment_selections s join public.wedding_moments m on m.id = s.moment_id and m.slug = 'groom-entrance') g
full join (select s.*, m.company_id from public.moment_selections s join public.wedding_moments m on m.id = s.moment_id and m.slug = 'bride-entrance') b
  on b.event_id = g.event_id
join public.wedding_events e on e.id = coalesce(g.event_id, b.event_id)
join public.wedding_moments c on c.company_id = e.company_id and c.slug = 'chuppah-entrance'
on conflict (event_id, moment_id) do nothing;

update public.wedding_moments set is_active = false where slug in ('groom-entrance', 'bride-entrance');
