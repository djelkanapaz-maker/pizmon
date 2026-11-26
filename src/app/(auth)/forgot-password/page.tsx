'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { requestPasswordReset } from '@/server/actions/password';
import { useI18n } from '@/i18n/client';
import { useHydrated } from '@/components/useHydrated';
import { publicEnv } from '@/lib/env';
import { Button, ErrorNote, Field, Input } from '@/components/ui';

export default function ForgotPasswordPage() {
  const { m } = useI18n();
  const hydrated = useHydrated();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim();
    setBusy(true); setError(null);
    // Same response whether or not the email exists (no account enumeration).
    const r = await requestPasswordReset(email);
    if (!r.ok) { setBusy(false); setError(r.error === 'rate_limited' ? m.auth.rateLimited : m.auth.invalidEmail); return; }
    if (r.data.fallback) {
      // Supabase's own email. Implicit flow: the link carries the session in the URL, so it works even when
      // the email is opened in another browser than this one (PKCE would need this browser's code verifier).
      const implicit = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      await implicit.auth.resetPasswordForEmail(email, { redirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/activate` });
    }
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
          {error && <ErrorNote>{error}</ErrorNote>}
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
