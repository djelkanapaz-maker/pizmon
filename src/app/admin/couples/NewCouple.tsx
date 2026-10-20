'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { adminCreateCouple } from '@/server/actions/admin-people';
import { Sheet } from '@/components/overlay';
import { Button, ErrorNote, Field, Input, Select } from '@/components/ui';
import { ActivationLinkBox } from '@/components/ActivationLinkBox';

export function NewCoupleButton({ djs, autoOpen }: { djs: { id: string; display_name: string }[]; autoOpen?: boolean }) {
  const { m } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(!!autoOpen);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ eventId: string; link: string; emailSent: boolean } | null>(null);
  const [busy, start] = useTransition();
  const close = () => { setOpen(false); setResult(null); setError(null); if (autoOpen) router.replace('/admin/couples'); };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>{m.admin.newCouple}</Button>
      <Sheet open={open} onClose={close} title={m.admin.newCouple}>
        {result ? (
          <div className="flex flex-col gap-4">
            <ActivationLinkBox link={result.link} emailSent={result.emailSent} />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => router.push(`/admin/couples/${result.eventId}`)}>{m.admin.openWorkspace}</Button>
              <Button variant="ghost" onClick={close}>{m.common.close}</Button>
            </div>
          </div>
        ) : (
          <form noValidate className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
            start(async () => {
              const r = await adminCreateCouple({ ...f, send_email: f.send_email === 'on' });
              if (!r.ok) return setError((m.errors as Record<string, string>)[r.error] ?? m.common.error);
              setError(null); setResult(r.data); router.refresh();
            });
          }}>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={m.onboarding.partnerOne} htmlFor="n-p1"><Input id="n-p1" name="partner_one_name" required maxLength={80} /></Field>
              <Field label={m.onboarding.partnerTwo} htmlFor="n-p2"><Input id="n-p2" name="partner_two_name" maxLength={80} /></Field>
            </div>
            <Field label={m.admin.coupleEmail} htmlFor="n-email"><Input id="n-email" name="email" type="email" required dir="ltr" /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={m.onboarding.date} htmlFor="n-date"><Input id="n-date" name="wedding_date" type="date" /></Field>
              <Field label={m.onboarding.guests} htmlFor="n-g"><Input id="n-g" name="guest_count" inputMode="numeric" pattern="\d*" maxLength={4} /></Field>
              <Field label={m.onboarding.venue} htmlFor="n-v"><Input id="n-v" name="venue_name" maxLength={120} /></Field>
              <Field label={m.onboarding.city} htmlFor="n-c"><Input id="n-c" name="venue_city" maxLength={80} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={m.common.language} htmlFor="n-l"><Select id="n-l" name="locale" defaultValue="he"><option value="he">עברית</option><option value="en">English</option></Select></Field>
              <Field label={m.admin.assignDj} hint={m.common.optional} htmlFor="n-dj">
                <Select id="n-dj" name="dj_id" defaultValue=""><option value="">{m.admin.unassigned}</option>{djs.map((d) => <option key={d.id} value={d.id}>{d.display_name}</option>)}</Select>
              </Field>
            </div>
            <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" name="send_email" className="size-5 accent-ember" />{m.admin.sendEmail}</label>
            <Button type="submit" size="lg" disabled={busy}>{busy ? m.common.saving : m.common.create}</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}
