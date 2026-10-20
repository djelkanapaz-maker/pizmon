import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { getTracksByIds, type Track } from '@/server/queries';
import { getTrackContext } from '@/server/track-context';
import { ButtonLink, EmptyState, PageHeader } from '@/components/ui';
import { TrackList } from '@/components/music/TrackList';

export default async function SavedPage() {
  const s = await requireCouple();
  const { m } = await getI18n();
  const db = await supabaseServer();
  const [{ data: rows }, ctx] = await Promise.all([
    db.from('saved_tracks').select('track_id, created_at').eq('event_id', s.eventId).order('created_at', { ascending: false }),
    getTrackContext(s.eventId, s.company.id),
  ]);
  const tracks = await getTracksByIds((rows ?? []).map((r) => r.track_id as string));
  const ordered = (rows ?? []).map((r) => tracks.find((t) => t.id === r.track_id)).filter(Boolean) as Track[];
  return (
    <div>
      <PageHeader back={{ href: '/wedding', label: m.wedding.title }} title={m.wedding.sections.saved} />
      {ordered.length ? <TrackList tracks={ordered} ctx={ctx} /> : <div className="gutter"><EmptyState title={m.wedding.savedEmpty} action={<ButtonLink href="/discover" size="sm">{m.home.exploreNow}</ButtonLink>} /></div>}
    </div>
  );
}
