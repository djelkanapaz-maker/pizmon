'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { useToast } from '@/components/overlay';
import { Button } from '@/components/ui';
import { requestAccountDeletion } from '@/server/actions/push';

export function AccountDeletion() {
  const { m } = useI18n();
  const toast = useToast();
  const [done, setDone] = useState(false);
  const [busy, start] = useTransition();
  return (
    <section className="card p-5 flex flex-col gap-3">
      <p className="label">{m.profile.deleteTitle}</p>
      <p className="text-sm text-paper-dim">{done ? m.profile.deleteRequested : m.profile.deleteHint}</p>
      {!done && (
        <Button variant="danger" size="sm" className="self-start" disabled={busy} onClick={() => {
          if (!confirm(m.profile.deleteConfirm)) return;
          start(async () => { const r = await requestAccountDeletion(); if (!r.ok) return toast(m.common.error, 'error'); setDone(true); });
        }}>{m.profile.deleteCta}</Button>
      )}
      <Link href="/privacy" className="text-sm underline underline-offset-4 text-paper-dim self-start">{m.profile.privacy}</Link>
    </section>
  );
}
