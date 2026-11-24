-- The look each user picked for the app: 'light' (ivory, the default) or 'dark' (Noir Violet).
-- NULL = not chosen yet, so the app asks once.
alter table public.profiles add column if not exists skin text check (skin in ('light', 'dark'));
grant update (skin) on public.profiles to authenticated;
