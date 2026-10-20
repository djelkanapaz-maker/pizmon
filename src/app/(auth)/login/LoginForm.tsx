'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useI18n } from '@/i18n/client';
import { useHydrated } from '@/components/useHydrated';
import { Button, ErrorNote, Field, Input } from '@/components/ui';

export function LoginForm({ next }: { next: string }) {
  const { m } = useI18n();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email: String(f.get('email') ?? '').trim(),
      password: String(f.get('password') ?? ''),
    });
    if (error) {
      setBusy(false);
      setError(error.status === 429 ? m.auth.rateLimited : error.status && error.status >= 500 ? m.errors.network : m.auth.invalid);
      return;
    }
    window.location.assign(next);
  }

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Field label={m.auth.email} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required dir="ltr" />
      </Field>
      <Field label={m.auth.password} htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required dir="ltr" />
      </Field>
      <Button type="submit" size="lg" full disabled={busy || !hydrated}>{busy ? m.auth.signingIn : m.auth.signIn}</Button>
    </form>
  );
}
