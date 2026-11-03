'use client';
import { useState, useTransition } from 'react';
import { adminUpdateLead } from '@/server/actions/admin-people';
import { useI18n } from '@/i18n/client';
import { useToast } from '@/components/overlay';
import { Button, Input, Select } from '@/components/ui';

type Status = 'new' | 'call_requested' | 'contacted' | 'booked' | 'not_relevant';
const STATUSES: Status[] = ['new', 'call_requested', 'contacted', 'booked', 'not_relevant'];

export function LeadActions({ eventId, status: initialStatus, note: initialNote }: { eventId: string; status: Status; note: string }) {
  const { m } = useI18n();
  const toast = useToast();
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState(initialNote);
  const [busy, start] = useTransition();
  const save = (s: Status, n: string) => start(async () => {
    const r = await adminUpdateLead(eventId, s, n);
    toast(r.ok ? m.common.saved : m.common.error, r.ok ? 'ok' : 'error');
  });
  return (
    <div className="mt-4 pt-4 border-t border-line grid sm:grid-cols-[12rem_1fr_auto] gap-2 items-center">
      <Select aria-label={m.leads.title} value={status} disabled={busy} onChange={(e) => { const s = e.target.value as Status; setStatus(s); save(s, note); }}>
        {STATUSES.map((s) => <option key={s} value={s}>{m.leads.status[s]}</option>)}
      </Select>
      <Input aria-label={m.leads.note} placeholder={m.leads.note} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} dir="auto" />
      <Button type="button" variant="ghost" disabled={busy || note === initialNote} onClick={() => save(status, note)}>{m.leads.saveNote}</Button>
    </div>
  );
}
