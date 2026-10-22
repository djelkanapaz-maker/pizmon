-- When the event starts (the couple fills it in with the other wedding details).
alter table public.wedding_events add column if not exists start_time time;
grant update (start_time) on public.wedding_events to authenticated;
