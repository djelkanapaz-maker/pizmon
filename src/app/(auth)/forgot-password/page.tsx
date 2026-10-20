'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useI18n } from '@/i18n/client';
import { useHydrated } from '@/components/useHydrated';
import { publicEnv } from '@/lib/env';
import { Button, Field, Input } from '@/components/ui';

export default function ForgotPasswordPage() {
  const { m } = useI18n();
  const hydrated = useHydrated();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim();
    setBusy(true);
    // Same response whether or not the email exists (no account enumeration).
    await supabaseBrowser().auth.resetPasswordForEmail(email, { redirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/activate` });
    setBusy(false);
    setSent(true);
  }

  return (
    <div className="animate-rise">
      <h1 className="display-xl poster-shadow mb-3">{m.auth.forgotTitle}</h1>
      <p className="text-paper-dim mb-8">{m.auth.forgotSub}</p>
      {sent ? (
        <p role="status" className="card p-5 font-bold">{m.auth.linkSent}</p>
      ) : (
        <form method="post" onSubmit={onSubmit} className="flex flex-col gap-5">
          <Field label={m.auth.email} htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required dir="ltr" />
          </Field>
          <Button type="submit" size="lg" full disabled={busy || !hydrated}>{busy ? m.common.loading : m.auth.sendLink}</Button>
        </form>
      )}
      <p className="mt-6 text-center"><Link href="/login" className="text-sm font-bold text-paper-dim underline underline-offset-4">{m.auth.signIn}</Link></p>
    </div>
  );
}
