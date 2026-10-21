import Link from 'next/link';
import { getI18n } from '@/i18n/server';
import { fmt, relativeTime } from '@/i18n/format';
import { getMoments, getSelections, getTracksByIds, trackLabel } from '@/server/queries';
import { Badge, Progress, cx } from '@/components/ui';
import { IconCheck, IconChevron } from '@/components/icons';
import type { SelectionStatus } from '@/core/moments';
import { STATUS_TONE } from '@/components/music/status';

/** Progress + list of every special moment; used by the moments page and questionnaire section. */
export async function MomentsList({ eventId, companyId, from }: { eventId: string; companyId: string; from?: 'questionnaire' }) {
  const { m, locale } = await getI18n();
  const [moments, selections] = await Promise.all([getMoments(companyId), getSelections(eventId)]);
  const tracks = await getTracksByIds(selections.map((x) => x.primary_track_id ?? ''));
  const required = moments.filter((x) => x.is_required);
  const confirmed = required.filter((x) => selections.find((y) => y.moment_id === x.id)?.status === 'confirmed').length;
  const qs = from ? `?from=${from}` : '';
  return (
    <>
      <div className="gutter mb-6">
        <p className="text-sm font-bold mb-2">{fmt(m.moments.confirmedCount, { done: confirmed, total: required.length })}</p>
        <Progress value={required.length ? Math.round((confirmed / required.length) * 100) : 0} tone="gold" label={m.moments.title} />
      </div>
      <ol className="gutter flex flex-col gap-3">
        {moments.map((mo, i) => {
          const sel = selections.find((x) => x.moment_id === mo.id);
          const status: SelectionStatus = sel?.status ?? 'not_started';
          const song = sel?.primary_track_id ? trackLabel(tracks.find((t) => t.id === sel.primary_track_id)) : sel?.custom_song;
          return (
            <li key={mo.id}>
              <Link href={`/wedding/moments/${mo.slug}${qs}`} className={cx('card p-4 flex items-center gap-4 hover:border-paper-dim', status === 'confirmed' && 'border-gold/60')}>
                <span className={cx('display text-xl size-11 rounded-full grid place-items-center shrink-0 tabular', status === 'confirmed' ? 'bg-gold text-ink' : 'bg-ink-3')}>
                  {status === 'confirmed' ? <IconCheck size={18} /> : i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{locale === 'he' ? mo.name_he : mo.name_en}</span>
                    {!mo.is_required && <span className="text-xs text-paper-dim">{m.moments.optional}</span>}
                  </span>
                  {song ? <span className="block text-sm text-paper-dim truncate" dir="auto">{song}</span> : null}
                  <span className="flex items-center gap-2 mt-1.5">
                    <Badge tone={STATUS_TONE[status]}>{m.moments.status[status]}</Badge>
                    {sel?.updated_at && <span className="text-xs text-paper-dim">{relativeTime(sel.updated_at, locale)}</span>}
                  </span>
                </span>
                <IconChevron size={18} className="text-paper-dim shrink-0" />
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}
