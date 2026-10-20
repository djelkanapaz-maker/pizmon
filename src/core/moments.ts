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
};

export const EMPTY_SELECTION: SelectionState = {
  status: 'not_started', primary_track_id: null, backup_track_id: null, custom_song: null, shortlist: [],
};

const hasSong = (s: SelectionState) => !!s.primary_track_id || !!s.custom_song?.trim();

/** Derive the status a selection should have after an edit (never silently "confirmed"). */
export function deriveStatus(prev: SelectionState, next: Omit<SelectionState, 'status'>): SelectionStatus {
  const songChanged =
    prev.primary_track_id !== next.primary_track_id ||
    (prev.custom_song ?? '') !== (next.custom_song ?? '') ||
    prev.backup_track_id !== next.backup_track_id;
  if (prev.status === 'confirmed' && songChanged) return hasSong({ ...next, status: 'browsing' }) ? 'change_requested' : 'browsing';
  if (prev.status === 'confirmed') return 'confirmed';
  if (hasSong({ ...next, status: 'browsing' })) return 'awaiting_confirmation';
  if (next.shortlist.length > 0) return 'shortlisted';
  return 'browsing';
}

export function canConfirm(s: SelectionState) {
  return hasSong(s) && s.status !== 'confirmed';
}

/** Statuses the DJ treats as "still open". */
export const isUnresolved = (s: SelectionStatus) => s !== 'confirmed';
