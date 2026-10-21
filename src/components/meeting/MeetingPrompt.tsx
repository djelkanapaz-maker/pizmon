'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { Sheet } from '@/components/overlay';
import { Button } from '@/components/ui';
import { IconChevron } from '@/components/icons';
import { MeetingScheduler } from './MeetingScheduler';

/** Within a month of the wedding: a reminder card, and the booking calendar pops up once per visit. */
export function MeetingPrompt({ djName, eventId }: { djName: string; eventId: string }) {
  const { m } = useI18n();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const k = `meeting-prompt:${eventId}`;
    let seen = false;
    try { seen = sessionStorage.getItem(k) === '1'; sessionStorage.setItem(k, '1'); } catch { /* storage unavailable */ }
    if (!seen) { const t = setTimeout(() => setOpen(true), 600); return () => clearTimeout(t); }
  }, [eventId]);
  return (
    <>
      <Link href="/wedding/meeting" className="block rounded-[20px] border-2 border-ember p-5 hover:bg-ink-2 transition">
        <p className="display text-xl leading-tight">{m.meeting.reminder}</p>
        <span className="mt-3 inline-flex items-center gap-2 font-bold text-ember">{m.meeting.cta}<IconChevron size={16} /></span>
      </Link>
      <Sheet open={open} onClose={() => setOpen(false)} title={m.meeting.reminder}>
        <MeetingScheduler djName={djName} onBooked={() => setOpen(false)} />
        <Button variant="ghost" className="mt-4" onClick={() => setOpen(false)}>{m.meeting.later}</Button>
      </Sheet>
    </>
  );
}
