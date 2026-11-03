'use client';
import Link from 'next/link';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useI18n } from '@/i18n/client';
import { useHydrated } from '@/components/useHydrated';
import { Button, ErrorNote, Field, Input, cx } from '@/components/ui';
import { selfSignup } from '@/server/actions/signup';

export function SignupForm({ source, locale }: { source?: string; locale: string }) {
  const { m } = useI18n();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [hasDj, setHasDj] = useState<'yes' | 'no' | null>(null);
  const [noDate, setNoDate] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    // required: both names, phone, email, password, the date (unless not set yet) and the venue (once there is a date)
    const need = ['partner_one_name', 'partner_two_name', 'phone', 'email', 'password', ...(noDate ? [] : ['wedding_date', 'venue_name'])];
    const missing = Object.fromEntries(need.filter((k) => !String(f[k] ?? '').trim()).map((k) => [k, 'required']));
    if (Object.keys(missing).length) { setFields(missing); setError(m.signup.errors.required); return; }
    if (!hasDj) { setFields({ has_dj: 'required' }); setError(m.signup.errors.has_dj); return; }
    if (hasDj === 'yes' && !String(f.other_dj_name ?? '').trim()) { setFields({ other_dj_name: 'required' }); setError(m.signup.errors.other_dj); return; }
    setBusy(true); setError(null); setFields({});
    const r = await selfSignup({ ...f, ...(noDate ? { wedding_date: '' } : {}), no_date: noDate, has_dj: hasDj, source, locale });
    if (!r.ok) {
      setBusy(false);
      setFields(r.fields ?? {});
      const msgs = m.signup.errors as Record<string, string>;
      setError(r.fields?.phone ? msgs.phone : r.fields?.password ? m.auth.passwordWeak
        : msgs[r.error] ?? (m.errors as Record<string, string>)[r.error] ?? m.common.error);
      return;
    }
    const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({ email: f.email.trim().toLowerCase(), password: f.password });
    if (signInError) { window.location.assign('/login'); return; }
    window.location.assign('/onboarding');
  }
  const inv = (k: string) => (fields[k] ? true : undefined);

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid sm:grid-cols-2 gap-5">
        <Field label={m.signup.partnerOne} htmlFor="p1" required><Input id="p1" name="partner_one_name" required maxLength={80} autoComplete="given-name" aria-invalid={inv('partner_one_name')} /></Field>
        <Field label={m.signup.partnerTwo} htmlFor="p2" required><Input id="p2" name="partner_two_name" required maxLength={80} aria-invalid={inv('partner_two_name')} /></Field>
      </div>
      <Field label={m.signup.phone} htmlFor="phone" required>
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required dir="ltr" maxLength={20} placeholder="050-000-0000" aria-invalid={inv('phone')} />
      </Field>
      <Field label={m.signup.email} htmlFor="email" required>
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required dir="ltr" aria-invalid={inv('email')} />
      </Field>
      <Field label={m.signup.password} htmlFor="password" hint={m.auth.passwordRule} required>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} dir="ltr" aria-invalid={inv('password')} />
      </Field>
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-2">
          <Field label={m.signup.date} htmlFor="date" required={!noDate}>
            <Input id="date" name="wedding_date" type="date" required={!noDate} disabled={noDate} aria-invalid={inv('wedding_date')} className="disabled:opacity-50" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={noDate} onChange={(e) => setNoDate(e.target.checked)} className="size-5 accent-[var(--color-ember)]" />
            {m.signup.noDate}
          </label>
        </div>
        <Field label={m.signup.guests} htmlFor="guests"><Input id="guests" name="guest_count" type="number" inputMode="numeric" min={1} max={5000} aria-invalid={inv('guest_count')} /></Field>
        <Field label={m.signup.venue} htmlFor="venue" required={!noDate}><Input id="venue" name="venue_name" required={!noDate} maxLength={120} aria-invalid={inv('venue_name')} /></Field>
        <Field label={m.signup.city} htmlFor="city"><Input id="city" name="venue_city" maxLength={80} /></Field>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-bold mb-2">{m.signup.hasDjQ}<span className="text-danger" aria-hidden> *</span></legend>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-invalid={inv('has_dj')}>
          {(['no', 'yes'] as const).map((v) => (
            <label key={v} className={cx('card p-4 flex items-center gap-3 cursor-pointer font-bold', hasDj === v && 'border-ember ring-2 ring-ember/40')}>
              <input type="radio" name="has_dj_choice" value={v} checked={hasDj === v} onChange={() => setHasDj(v)} className="size-5 accent-[var(--color-ember)]" />
              {v === 'yes' ? m.signup.hasDjYes : m.signup.hasDjNo}
            </label>
          ))}
        </div>
        {hasDj === 'yes' && (
          <Field label={m.signup.otherDj} htmlFor="other_dj" required><Input id="other_dj" name="other_dj_name" required maxLength={120} aria-invalid={inv('other_dj_name')} /></Field>
        )}
      </fieldset>

      {/* honeypot: hidden from people, bots fill it in */}
      <div aria-hidden className="absolute -start-[9999px] size-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" size="lg" full disabled={busy || !hydrated}>{busy ? m.signup.submitting : m.signup.submit}</Button>
      <p className="text-xs text-paper-dim text-center">
        <Link href="/privacy" className="underline underline-offset-4">{m.signup.terms}</Link>
      </p>
    </form>
  );
}
