import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { TRACK_SELECT, getMoments, type Track } from '@/server/queries';
import { EmptyState, PageHeader } from '@/components/ui';
import { RecommendationCards } from './RecommendationCards';

export default async function RecommendationsPage() {
  const s = await requireCouple();
  const { m, locale } = await getI18n();
  const db = await supabaseServer();
  const [{ data }, moments] = await Promise.all([
    db.from('dj_recommendations').select(`id, message, created_at, is_ai_suggestion, moment_id, dj:djs(display_name), track:music_tracks(${TRACK_SELECT}), playlist:playlists(id, title), response:recommendation_responses(status, comment)`)
      .eq('event_id', s.eventId).order('created_at', { ascending: false }),
    getMoments(s.company.id),
  ]);
  const recs = (data ?? []) as unknown as { id: string; message: string | null; created_at: string; is_ai_suggestion: boolean; moment_id: string | null; dj: { display_name: string } | null; track: Track | null; playlist: { id: string; title: string } | null; response: { status: string; comment: string | null } | null }[];
  return (
    <div>
      <PageHeader back={{ href: '/wedding', label: m.wedding.title }} title={m.recommendations.title} sub={m.recommendations.sub} />
      {recs.length === 0 ? <div className="gutter"><EmptyState title={m.recommendations.empty} /></div>
        : <RecommendationCards recs={recs} momentNames={Object.fromEntries(moments.map((x) => [x.id, locale === 'he' ? x.name_he : x.name_en]))} />}
    </div>
  );
}
