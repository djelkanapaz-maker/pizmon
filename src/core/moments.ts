export type SelectionStatus =
  | 'not_started' | 'browsing' | 'shortlisted' | 'awaiting_confirmation' | 'confirmed' | 'change_requested';

export const SELECTION_STATUSES: SelectionStatus[] =
  ['not_started', 'browsing', 'shortlisted', 'awaiting_confirmation', 'confirmed', 'change_requested'];

export type SelectionState = {
  status: SelectionStatus;
  primary_track_id: string | null;
  backup_track_id: string | null;
  custom_song: string | null;
  shortlist: string[];
  /** two songs (e.g. groom + bride) instead of one shared song */
  split?: boolean;
  second_track_id?: string | null;
  second_custom_song?: string | null;
};

export const EMPTY_SELECTION: SelectionState = {
  status: 'not_started', primary_track_id: null, backup_track_id: null, custom_song: null, shortlist: [],
  split: false, second_track_id: null, second_custom_song: null,
};

const firstSong = (s: SelectionState) => !!s.primary_track_id || !!s.custom_song?.trim();
const secondSong = (s: SelectionState) => !!s.second_track_id || !!s.second_custom_song?.trim();
/** Every required slot has a song (both slots when split). */
const hasSong = (s: SelectionState) => firstSong(s) && (!s.split || secondSong(s));
const anySong = (s: SelectionState) => firstSong(s) || (!!s.split && secondSong(s));

/** Derive the status after an edit: writing the song(s) is the choice — no separate approval step. */
export function deriveStatus(_prev: SelectionState, next: Omit<SelectionState, 'status'>): SelectionStatus {
  const n = { ...next, status: 'browsing' as SelectionStatus };
  if (hasSong(n)) return 'confirmed';
  if (anySong(n) || next.shortlist.length > 0) return 'shortlisted';
  return 'browsing';
}

/** Statuses the DJ treats as "still open". */
export const isUnresolved = (s: SelectionStatus) => s !== 'confirmed';

/** Human text for the chosen song(s), e.g. "Groom: X · Bride: Y". */
export function songText(s: SelectionState | null | undefined, label: (id: string | null) => string | null, names: { first: string; second: string }) {
  if (!s) return null;
  const a = label(s.primary_track_id) ?? (s.custom_song?.trim() || null);
  if (!s.split) return a;
  const b = label(s.second_track_id ?? null) ?? (s.second_custom_song?.trim() || null);
  if (!a && !b) return null;
  return `${names.first}: ${a ?? '—'} · ${names.second}: ${b ?? '—'}`;
}
