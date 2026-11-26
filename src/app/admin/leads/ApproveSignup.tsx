'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adminApproveSignup, adminDeleteCouple } from '@/server/actions/admin-people';
import { useI18n } from '@/i18n/client';
import { fmt } from '@/i18n/format';
import { useToast } from '@/components/overlay';
import { Button } from '@/components/ui';

/** Approve (lets the couple sign in) or reject (deletes the sign-up) a self sign-up that is waiting. */
export function ApproveSignup({ eventId, names, wa }: { eventId: string; names: string; wa: string | null }) {
  const { m } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [approved, setApproved] = useState(false);
  const approve = () => start(async () => {
    const r = await adminApproveSignup(eventId);
    if (!r.ok) { toast(m.common.error, 'error'); return; }
    toast(r.data.emailSent ? m.leads.approvedEmail : m.leads.approved, 'ok');
    setApproved(true);
    if (!wa) router.refresh();
  });
  const reject = () => {
    if (!window.confirm(fmt(m.leads.rejectConfirm, { names }))) return;
    start(async () => {
      const r = await adminDeleteCouple(eventId);
      toast(r.ok ? m.leads.rejected : m.common.error, r.ok ? 'ok' : 'error');
      if (r.ok) router.refresh();
    });
  };
  if (approved) return wa ? (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <a href={wa} target="_blank" rel="noopener" onClick={() => setTimeout(() => router.refresh(), 500)}
        className="h-10 px-5 inline-flex items-center rounded-full bg-paper text-ink font-bold">{m.leads.approvedWa}</a>
      <Button type="button" variant="ghost" onClick={() => router.refresh()}>{m.common.close}</Button>
    </div>
  ) : null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Button type="button" onClick={approve} disabled={busy}>{busy ? m.leads.approving : m.leads.approve}</Button>
      <Button type="button" variant="ghost" onClick={reject} disabled={busy}>{m.leads.reject}</Button>
    </div>
  );
}
