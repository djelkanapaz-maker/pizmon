import 'server-only';
import { buildBrief } from '@/core/brief';
import { songText } from '@/core/moments';
import { describeRestriction, getGenres, getMoments, getQuestionnaire, getRestrictions, getSelections, getTracksByIds, trackLabel } from './queries';

/** Assembles the structured brief for an event (RLS decides who may read it). */
export async function loadBrief(eventId: string, companyId: string, locale: 'he' | 'en') {
  const [q, restrictions, genres, moments, selections] = await Promise.all([
    getQuestionnaire(eventId, companyId), getRestrictions(eventId), getGenres(companyId), getMoments(companyId), getSelections(eventId),
  ]);
  if (!q) return null;
  const tracks = await getTracksByIds(selections.flatMap((s) => [s.primary_track_id ?? '', s.backup_track_id ?? '', s.second_track_id ?? '']));
  const names = locale === 'he' ? { first: 'חתן', second: 'כלה' } : { first: 'Groom', second: 'Bride' };
  const label = (id: string | null) => (id ? trackLabel(tracks.find((t) => t.id === id)) : null);
  const brief = buildBrief({
    definition: q.definition,
    answers: q.response?.answers ?? {},
    restrictions,
    genres,
    moments,
    selections: selections.map((s) => ({ moment_id: s.moment_id, status: s.status, song: songText(s, label, names), backup: label(s.backup_track_id) })),
    describe: (r) => describeRestriction(r as Parameters<typeof describeRestriction>[0], locale),
  }, locale);
  return { brief, response: q.response, version: q.version, definition: q.definition };
}
