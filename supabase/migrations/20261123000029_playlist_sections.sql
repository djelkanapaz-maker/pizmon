-- The couple's playlist is split into the stages of the wedding:
--   ceremony  = "שירי חופה"  (chuppah / glass-breaking choices in the special moments, chuppah collections)
--   reception = "קבלת פנים"  (songs added from the reception collections)
--   party     = "המסיבה"     (everything else: the other collections, search, imports). NULL reads as party.
alter table public.playlist_tracks
  add column if not exists section text check (section in ('ceremony', 'reception', 'party')),
  -- set when a special-moment choice put the song here, so replacing that choice takes it out again
  add column if not exists source_moment_id uuid references public.wedding_moments(id) on delete set null;
