-- Self sign-ups wait for the admin's approval before they can sign in.
-- The login itself is blocked at the auth layer (banned until approved); this flag lets the admin see who is waiting.
alter table public.wedding_events add column if not exists access_pending boolean not null default false;
create index if not exists wedding_events_access_pending_idx on public.wedding_events (company_id) where access_pending;
