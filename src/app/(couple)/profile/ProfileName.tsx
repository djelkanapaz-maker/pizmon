'use client';
import { useState, useTransition } from 'react';
import { useI18n } from '@/i18n/client';
import { updateMyName } from '@/server/actions/profile';
import { useToast } from '@/components/overlay';
import { Button, Field, Input } from '@/components/ui';

export function ProfileName({ initial }: { initial: string }) {
  const { m } = useI18n();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [busy, start] = useTransition();
  return (
    <form className="flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updateMyName(v); toast(r.ok ? m.common.saved : m.common.error, r.ok ? 'ok' : 'error'); }); }}>
      <Field label={m.profile.name} htmlFor="pn"><Input id="pn" value={v} onChange={(e) => setV(e.target.value)} maxLength={80} dir="auto" /></Field>
      <Button type="submit" variant="secondary" disabled={busy || v === initial}>{m.common.save}</Button>
    </form>
  );
}
