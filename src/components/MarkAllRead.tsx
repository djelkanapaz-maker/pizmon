'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { markNotificationsRead } from '@/server/actions/common';
import { Button } from './ui';

export function MarkAllRead() {
  const { m } = useI18n();
  const router = useRouter();
  const [busy, start] = useTransition();
  return <Button size="sm" variant="secondary" disabled={busy} onClick={() => start(async () => { await markNotificationsRead(); router.refresh(); })}>{m.notifications.markAll}</Button>;
}
