'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { useToast } from '@/components/overlay';
import { Badge, Button } from '@/components/ui';
import { cancelMeeting } from '@/server/actions/meeting';
import { MeetingScheduler } from './MeetingScheduler';

export type BookedMeeting = { id: string; starts_at: string; mode: 'office' | 'zoom' | 'other'; location?: string | null };

const whenOf = (iso: string, locale: string) => new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
  timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
}).format(new Date(iso));

/** The booked meeting (with change / cancel), or the scheduler when nothing is booked. */
export function MeetingPanel({ meeting, djName, onBooked }: { meeting: BookedMeeting | null; djName: string; onBooked?: () => void }) {
  const { m, locale, fmt } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [changing, setChanging] = useState(false);
  const [busy, start] = useTransition();
  if (!meeting || changing) return <MeetingScheduler djName={djName} onBooked={() => { setChanging(false); onBooked?.(); }} />;
  return (
    <div className="card p-5 flex flex-col gap-3 border-gold/60">
      <Badge tone="gold" className="self-start">{m.meeting.booked}</Badge>
      <p className="display text-2xl leading-tight">{whenOf(meeting.starts_at, locale)}</p>
      <p className="text-paper-dim">{fmt(m.meeting.bookedWith, { name: djName })} · {meeting.mode === 'office' ? `${m.meeting.office}: ${m.meeting.officeAddress}` : meeting.mode === 'zoom' ? `${m.meeting.zoom}. ${m.meeting.zoomNote}` : <bdi>{meeting.location}</bdi>}</p>
      <div className="flex flex-wrap gap-2 mt-2">
        <Button size="sm" variant="secondary" onClick={() => setChanging(true)}>{m.meeting.change}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => {
          if (!confirm(m.meeting.cancelConfirm)) return;
          start(async () => {
            const r = await cancelMeeting(meeting.id);
            if (!r.ok) return toast(m.common.error, 'error');
            toast(m.meeting.cancelled); router.refresh();
          });
        }}>{m.meeting.cancel}</Button>
      </div>
    </div>
  );
}
