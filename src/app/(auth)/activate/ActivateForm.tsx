'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useI18n } from '@/i18n/client';
import { useHydrated } from '@/components/useHydrated';
import { Button, ErrorNote, Field, Input } from '@/components/ui';

export function ActivateForm() {
  const { m } = useI18n();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const pw = String(f.get('password') ?? '');
    if (pw.length < 10) return setError(m.auth.passwordWeak);
    if (pw !== String(f.get('confirm') ?? '')) return setError(m.auth.passwordMismatch);
    setBusy(true); setError(null);
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    // same_password: the account already uses exactly this password (e.g. a double submit) — nothing to change
    if (error && error.code !== 'same_password') { setBusy(false); setError(error.status === 429 ? m.auth.rateLimited : m.common.error); return; }
    // auth cookies changed: do a full navigation so every server component re-reads the session
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional full reload after auth change
    window.location.assign('/');
  }

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Field label={m.auth.newPassword} hint={m.auth.passwordRule} htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required dir="ltr" />
      </Field>
      <Field label={m.auth.confirmPassword} htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required dir="ltr" />
      </Field>
      <Button type="submit" size="lg" full disabled={busy || !hydrated}>{busy ? m.common.saving : m.auth.setPassword}</Button>
    </form>
  );
}
