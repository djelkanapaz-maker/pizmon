import Link from 'next/link';
import { getI18n } from '@/i18n/server';
import type { WeddingEvent } from '@/server/queries';
import { IconChevron } from '@/components/icons';
import { RequestCallButton } from './RequestCallButton';

/**
 * For couples who signed up on their own (no DJ of the company assigned): booked a DJ elsewhere →
 * their DJ's name and the way to the music brief; no DJ yet → an invitation to hear from Elkana.
 */
export async function LeadCard({ event, compact = false }: { event: WeddingEvent; compact?: boolean }) {
  const { m } = await getI18n();
  const requested = !!event.call_requested_at;
  if (event.has_dj) {
    return (
      <div className="card p-5">
        <p className="label">{m.lead.hasDjLabel}</p>
        <p className="display text-xl truncate mt-1" dir="auto">{event.other_dj_name || m.lead.hasDjNone}</p>
        <p className="text-sm text-paper-dim mt-2">{m.lead.hasDjBody}</p>
        <Link href="/wedding/brief" className="mt-3 inline-flex items-center gap-1 text-sm font-bold underline underline-offset-4">{m.lead.toBrief}<IconChevron size={14} /></Link>
        {!compact && !requested && (
          <div className="mt-4 pt-4 border-t border-line flex flex-wrap items-center gap-3">
            <span className="text-sm text-paper-dim">{m.lead.alsoOffer}</span>
            <RequestCallButton label={m.lead.request} done={m.lead.requested} variant="ghost" />
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="rounded-[20px] bg-paper text-ink p-5 md:p-6">
      <p className="display text-xl md:text-2xl">{m.lead.noDjTitle}</p>
      <p className="mt-2 text-sm opacity-85 leading-relaxed">{m.lead.noDjBody}</p>
      <div className="mt-4">
        {requested ? <p className="font-bold text-champagne">{m.lead.requested}</p> : <RequestCallButton label={m.lead.request} done={m.lead.requested} variant="champagne" />}
      </div>
    </div>
  );
}
