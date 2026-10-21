'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { useToast } from '@/components/overlay';
import { Badge, Button, Chip, Field, Input } from '@/components/ui';
import { disconnectGoogle, saveMeetingHours } from '@/server/actions/calendar';
import type { MeetingHours } from '@/core/slots';

/** Google Calendar link + weekly meeting hours for one DJ (shown to the DJ and to admins). */
export function CalendarSettings({ djId, connectedEmail, hours, configured, status, connectHref }: {
  djId: string; connectedEmail: string | null; hours: MeetingHours; configured: boolean; status?: string; connectHref: string;
}) {
  const { m } = useI18n();
  const t = m.calendar;
  const toast = useToast();
  const router = useRouter();
  const [days, setDays] = useState(hours.days);
  const [startT, setStart] = useState(hours.start);
  const [endT, setEnd] = useState(hours.end);
  const [busy, start] = useTransition();
  return (
    <section className="card p-5 flex flex-col gap-4" aria-labelledby={`cal-${djId}`}>
      <h2 id={`cal-${djId}`} className="display text-xl">{t.title}</h2>
      {status && (t.status as Record<string, string>)[status] && <p role="status" className={status === 'connected' ? 'text-gold font-bold text-sm' : 'text-danger font-bold text-sm'}>{(t.status as Record<string, string>)[status]}</p>}
      {!configured ? <p className="text-sm text-paper-dim">{t.notConfigured}</p> : connectedEmail ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="ok" ><span dir="ltr">{connectedEmail}</span></Badge>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => start(async () => { const r = await disconnectGoogle(djId); if (!r.ok) return toast(m.common.error, 'error'); router.refresh(); })}>{t.disconnect}</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 items-start">
          <p className="text-sm text-paper-dim">{t.help}</p>
          <a href={connectHref} className="inline-flex items-center h-11 px-5 rounded-full bg-paper text-ink font-bold">{t.connect}</a>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <p className="label">{t.hours}</p>
        <div className="flex flex-wrap gap-2">
          {m.meeting.days.map((d, i) => <Chip key={d} selected={days.includes(i)} onClick={() => setDays((x) => x.includes(i) ? x.filter((y) => y !== i) : [...x, i])}>{d}</Chip>)}
        </div>
        <div className="grid grid-cols-2 gap-3 max-w-xs">
          <Field label={t.from} htmlFor={`hs-${djId}`}><Input id={`hs-${djId}`} type="time" step={1800} value={startT} onChange={(e) => setStart(e.target.value)} dir="ltr" /></Field>
          <Field label={t.to} htmlFor={`he-${djId}`}><Input id={`he-${djId}`} type="time" step={1800} value={endT} onChange={(e) => setEnd(e.target.value)} dir="ltr" /></Field>
        </div>
        <Button size="sm" className="self-start" disabled={busy} onClick={() => start(async () => {
          const r = await saveMeetingHours(djId, { days, start: startT, end: endT });
          if (!r.ok) return toast((m.errors as Record<string, string>)[r.error] ?? m.common.error, 'error');
          toast(m.common.saved); router.refresh();
        })}>{m.common.save}</Button>
      </div>
    </section>
  );
}
