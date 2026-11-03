'use client';
import { useState, useTransition } from 'react';
import { requestCall } from '@/server/actions/couple';
import { useToast } from '@/components/overlay';
import { useI18n } from '@/i18n/client';
import { cx } from '@/components/ui';

export function RequestCallButton({ label, done, variant }: { label: string; done: string; variant: 'champagne' | 'ghost' }) {
  const { m } = useI18n();
  const toast = useToast();
  const [sent, setSent] = useState(false);
  const [busy, start] = useTransition();
  if (sent) return <p className={cx('font-bold', variant === 'champagne' ? 'text-champagne' : 'text-sm')}>{done}</p>;
  return (
    <button type="button" disabled={busy}
      onClick={() => start(async () => { const r = await requestCall(); if (r.ok) setSent(true); else toast(m.common.error, 'error'); })}
      className={cx('inline-flex items-center rounded-full font-bold transition disabled:opacity-60',
        variant === 'champagne' ? 'h-11 px-6 bg-champagne text-paper hover:brightness-105' : 'h-9 px-4 text-sm border border-line hover:border-paper-dim')}>
      {label}
    </button>
  );
}
