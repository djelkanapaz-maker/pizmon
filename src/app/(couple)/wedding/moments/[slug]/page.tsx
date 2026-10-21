import { notFound } from 'next/navigation';
import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { getMoments, getSelections, getTracksByIds, TRACK_SELECT, type Track } from '@/server/queries';
import { getTrackContext } from '@/server/track-context';
import { PageHeader } from '@/components/ui';
import { MomentEditor } from './MomentEditor';

export default async function MomentPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string }> }) {
  const { slug } = await params;
  const fromQ = (await searchParams).from === 'questionnaire';
  const s = await requireCouple();
  const { m, locale } = await getI18n();
  const moments = await getMoments(s.company.id);
  const moment = moments.find((x) => x.slug === slug);
  if (!moment) notFound();
  const db = await supabaseServer();
  const [selections, ctx, { data: curated }] = await Promise.all([
    getSelections(s.eventId),
    getTrackContext(s.eventId, s.company.id),
    db.from('moment_tracks').select(`collection, sort_order, track:music_tracks(${TRACK_SELECT})`).eq('moment_id', moment.id).order('sort_order'),
  ]);
  const sel = selections.find((x) => x.moment_id === moment.id) ?? null;
  const extra = await getTracksByIds([...(sel?.shortlist ?? []), sel?.primary_track_id ?? '', sel?.backup_track_id ?? '', sel?.second_track_id ?? '']);
  const suggestions = ((curated ?? []) as unknown as { collection: 'he' | 'intl' | null; track: Track | null }[])
    .filter((x) => x.track).map((x) => ({ collection: x.collection, track: x.track! }));
  return (
    <div>
      <PageHeader back={fromQ ? { href: '/wedding/questionnaire/moments', label: m.questionnaire.title } : { href: '/wedding/moments', label: m.moments.title }} title={locale === 'he' ? moment.name_he : moment.name_en}
        sub={(locale === 'he' ? moment.description_he : moment.description_en) ?? undefined} kicker={moment.is_required ? m.moments.required : m.moments.optional} />
      <MomentEditor moment={moment} selection={sel} suggestions={suggestions} known={extra} ctx={ctx} />
    </div>
  );
}
