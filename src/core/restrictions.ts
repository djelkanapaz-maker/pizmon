export type RestrictionKind = 'must_play' | 'never_play';
export type RestrictionStrength = 'preference' | 'absolute';
export type RestrictionTarget = 'track' | 'artist' | 'genre' | 'text';

export type Restriction = {
  id: string;
  kind: RestrictionKind;
  strength: RestrictionStrength;
  target_type: RestrictionTarget;
  track_id: string | null;
  artist_id: string | null;
  genre_id: string | null;
  text_value: string | null;
  reason?: string | null;
};

export type TrackRef = { id: string; artist_id: string; genre_id: string | null };

/** Which restriction (if any) applies to a track. Absolute NEVER PLAY always wins. */
export function restrictionFor(track: TrackRef, restrictions: Restriction[]): Restriction | null {
  const hits = restrictions.filter(
    (r) =>
      (r.target_type === 'track' && r.track_id === track.id) ||
      (r.target_type === 'artist' && r.artist_id === track.artist_id) ||
      (r.target_type === 'genre' && !!track.genre_id && r.genre_id === track.genre_id),
  );
  const rank = (r: Restriction) =>
    r.kind === 'never_play' && r.strength === 'absolute' ? 0 :
    r.kind === 'never_play' ? 1 :
    r.kind === 'must_play' && r.strength === 'absolute' ? 2 : 3;
  return hits.sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

export const isHardBlocked = (track: TrackRef, restrictions: Restriction[]) => {
  const r = restrictionFor(track, restrictions);
  return !!r && r.kind === 'never_play' && r.strength === 'absolute';
};

/**
 * Filters any automatically generated suggestion list (AI, "more like this", DJ shelves).
 * Absolute NEVER PLAY items are removed; preference-level ones are kept but flagged.
 * The database enforces the same rule for DJ recommendations (guard_never_play trigger).
 */
export function applyRestrictions<T extends TrackRef>(tracks: T[], restrictions: Restriction[]) {
  return tracks
    .filter((t) => !isHardBlocked(t, restrictions))
    .map((t) => ({ track: t, restriction: restrictionFor(t, restrictions) }));
}

export function splitRestrictions(restrictions: Restriction[]) {
  return {
    mustPlay: restrictions.filter((r) => r.kind === 'must_play'),
    neverAbsolute: restrictions.filter((r) => r.kind === 'never_play' && r.strength === 'absolute'),
    neverPreference: restrictions.filter((r) => r.kind === 'never_play' && r.strength === 'preference'),
  };
}
