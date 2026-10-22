'use client';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { useToast } from '@/components/overlay';
import { Button, Chip, Input, cx } from '@/components/ui';
import { IconCheck, IconChevron } from '@/components/icons';
import { bookMeeting, getMeetingAvailability, type Availability } from '@/server/actions/meeting';

const TZ = 'Asia/Jerusalem';
const timeOf = (iso: string, locale: string) => new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const monthLabel = (key: string, locale: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)));
};
const shiftMonth = (key: string, d: number) => {
  const [y, m] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + d, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** Month calendar with the DJ's real free slots; books a 60-minute meeting. */
export function MeetingScheduler({ djName, onBooked }: { djName: string; onBooked?: () => void }) {
  const { m, locale, fmt } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [data, setData] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [mode, setMode] = useState<'office' | 'zoom' | 'other' | null>(null);
  const [place, setPlace] = useState('');
  const [busy, start] = useTransition();

  const apply = useCallback((r: Awaited<ReturnType<typeof getMeetingAvailability>>) => {
    setLoading(false);
    if (r.ok) { setData(r.data); if (r.data.state === 'ok') setMonth(r.data.month); } else setData({ state: 'error', djName });
  }, [djName]);
  const load = useCallback(async (key?: string) => {
    setLoading(true); setDay(null); setSlot(null);
    apply(await getMeetingAvailability(key));
  }, [apply]);
  useEffect(() => {
    let alive = true;
    getMeetingAvailability().then((r) => { if (alive) apply(r); });
    return () => { alive = false; };
  }, [apply]);

  const byDate = useMemo(() => new Map((data?.state === 'ok' ? data.days : []).map((d) => [d.date, d.slots])), [data]);

  if (loading && !data) return <p className="text-paper-dim" role="status">{fmt(m.meeting.loading, { name: djName })}</p>;
  if (!data || data.state === 'no_dj') return <p className="text-paper-dim">{m.meeting.noDj}</p>;
  if (data.state === 'not_connected') return <p className="text-paper-dim">{fmt(m.meeting.notConnected, { name: data.djName })}</p>;
  if (data.state === 'error') return <div className="flex flex-col gap-3 items-start"><p className="text-paper-dim">{m.meeting.error}</p><Button size="sm" variant="secondary" onClick={() => load(month)}>{m.common.retry}</Button></div>;

  const key = data.month;
  const [y, mo] = key.split('-').map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const dateKey = (d: number) => `${key}-${String(d).padStart(2, '0')}`;
  const slots = day ? byDate.get(day) ?? [] : [];

  const placeOk = mode !== 'other' || place.trim().length >= 2;
  const book = () => slot && mode && placeOk && start(async () => {
    const r = await bookMeeting({ start: slot, mode, location: mode === 'other' ? place.trim() : undefined });
    if (!r.ok) {
      toast((m.errors as Record<string, string>)[r.error] ?? m.common.error, 'error');
      if (r.error === 'slot_taken') void load(key);
      return;
    }
    toast(`${m.meeting.booked}. ${r.data.djNotified ? m.meeting.djNotified : ''}`);
    onBooked?.(); router.refresh();
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="size-10 grid place-items-center rounded-full hover:bg-ink-3 disabled:opacity-30" aria-label={m.meeting.prev}
          disabled={loading || key <= data.minMonth} onClick={() => load(shiftMonth(key, -1))}><IconChevron size={18} className="rotate-180" /></button>
        <p className="display text-xl" aria-live="polite">{monthLabel(key, locale)}</p>
        <button type="button" className="size-10 grid place-items-center rounded-full hover:bg-ink-3 disabled:opacity-30" aria-label={m.meeting.next}
          disabled={loading || key >= data.maxMonth} onClick={() => load(shiftMonth(key, 1))}><IconChevron size={18} /></button>
      </div>

      <div className={cx('grid grid-cols-7 gap-1.5 text-center', loading && 'opacity-50')} role="grid" aria-label={monthLabel(key, locale)}>
        {m.meeting.days.map((d) => <span key={d} className="text-xs text-paper-dim font-bold py-1" role="columnheader">{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} />;
          const k = dateKey(d);
          const free = byDate.has(k);
          return (
            <button key={k} type="button" disabled={!free || loading} onClick={() => { setDay(k); setSlot(null); }} aria-pressed={day === k}
              className={cx('aspect-square rounded-[12px] text-sm font-bold grid place-items-center transition-colors',
                day === k ? 'bg-ember text-ink' : free ? 'bg-ink-3 hover:bg-line text-paper' : 'text-paper-dim/40')}>
              {d}
            </button>
          );
        })}
      </div>
      {!loading && byDate.size === 0 && <p className="text-paper-dim text-sm">{m.meeting.noSlots}</p>}

      {day && (
        <div className="flex flex-col gap-2">
          <p className="label">{m.meeting.pickTime}</p>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => <Chip key={s} selected={slot === s} onClick={() => setSlot(s)}><span dir="ltr">{timeOf(s, locale)}</span></Chip>)}
          </div>
        </div>
      )}

      {slot && (
        <div className="flex flex-col gap-2">
          <p className="label">{m.meeting.where}</p>
          <div className="grid sm:grid-cols-3 gap-2" role="radiogroup" aria-label={m.meeting.where}>
            {(['office', 'zoom', 'other'] as const).map((x) => (
              <button key={x} type="button" role="radio" aria-checked={mode === x} onClick={() => setMode(x)}
                className={cx('card p-4 text-start flex flex-col gap-1 transition-colors', mode === x ? 'border-ember' : 'hover:border-paper-dim')}>
                <span className="font-bold flex items-center gap-2">{mode === x && <IconCheck size={16} className="text-ember" />}{m.meeting[x]}</span>
                <span className="text-sm text-paper-dim">{x === 'office' ? m.meeting.officeAddress : x === 'zoom' ? m.meeting.zoomNote : m.meeting.otherNote}</span>
              </button>
            ))}
          </div>
          {mode === 'other' && (
            <label className="flex flex-col gap-1.5">
              <span className="label">{m.meeting.otherLabel}</span>
              <Input id="meeting-place" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={200} placeholder={m.meeting.otherPlaceholder} dir="auto" autoFocus />
            </label>
          )}
          <Button size="lg" className="mt-2" disabled={!mode || !placeOk || busy} onClick={book}>{busy ? m.common.saving : m.meeting.confirm}</Button>
        </div>
      )}
    </div>
  );
}
