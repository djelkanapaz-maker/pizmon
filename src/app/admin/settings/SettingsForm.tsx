'use client';
import { useState } from 'react';
import { Button, ErrorNote, Field, Input, Select } from '@/components/ui';
import { adminUpdateSettings } from '@/server/actions/admin-people';
import { formObject, useCms, useErrText, useRun } from '../_cms/client';

export type Settings = {
  brand_name: string; brand_tagline_he: string | null; brand_tagline_en: string | null; assignment_policy: 'couple_selects' | 'company_assigned';
  couple_selection_requires_approval: boolean; default_locale: 'he' | 'en'; contact_email: string | null;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const { m, s } = useCms();
  const err = useErrText();
  const { busy, run } = useRun();
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState(settings.assignment_policy);
  return (
    <form noValidate className="flex flex-col gap-6" onSubmit={(e) => {
      e.preventDefault();
      const f = formObject(e.currentTarget);
      setError(null);
      run(() => adminUpdateSettings({
        brand_name: f.brand_name, brand_tagline_he: f.brand_tagline_he, brand_tagline_en: f.brand_tagline_en, assignment_policy: policy,
        couple_selection_requires_approval: f.couple_selection_requires_approval === 'on', default_locale: f.default_locale, contact_email: f.contact_email,
      }), { silentError: true, success: s.settingsSaved, onFail: (r) => { if (!r.ok) setError(err(r.error)); } });
    }}>
      {error && <ErrorNote>{error}</ErrorNote>}
      <fieldset className="card p-5 flex flex-col gap-4">
        <legend className="sr-only">{m.admin.branding}</legend>
        <h2 className="display text-xl" aria-hidden>{m.admin.branding}</h2>
        <Field label={m.admin.brandName} htmlFor="set-brand"><Input id="set-brand" name="brand_name" defaultValue={settings.brand_name} required maxLength={60} dir="auto" /></Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={m.admin.taglineHe} htmlFor="set-the"><Input id="set-the" name="brand_tagline_he" defaultValue={settings.brand_tagline_he ?? ''} maxLength={160} dir="rtl" /></Field>
          <Field label={m.admin.taglineEn} htmlFor="set-ten"><Input id="set-ten" name="brand_tagline_en" defaultValue={settings.brand_tagline_en ?? ''} maxLength={160} dir="ltr" /></Field>
        </div>
      </fieldset>
      <fieldset className="card p-5 flex flex-col gap-4">
        <legend className="sr-only">{m.admin.policy}</legend>
        <h2 className="display text-xl" aria-hidden>{m.admin.policy}</h2>
        <div className="flex flex-col">
          {(['couple_selects', 'company_assigned'] as const).map((p) => (
            <label key={p} className="flex items-center gap-3 min-h-11 text-sm font-bold">
              <input type="radio" name="policy_radio" checked={policy === p} onChange={() => setPolicy(p)} className="size-5 accent-[var(--color-ember)]" />{m.admin.policies[p]}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-3 min-h-11 text-sm font-bold" aria-disabled={policy !== 'couple_selects'}>
          <input type="checkbox" name="couple_selection_requires_approval" defaultChecked={settings.couple_selection_requires_approval} className="size-5 accent-[var(--color-ember)]" />
          {m.admin.requireApproval}
        </label>
      </fieldset>
      <fieldset className="card p-5 grid sm:grid-cols-2 gap-4">
        <legend className="sr-only">{m.common.details}</legend>
        <Field label={m.admin.defaultLocale} htmlFor="set-loc">
          <Select id="set-loc" name="default_locale" defaultValue={settings.default_locale}>
            <option value="he">{m.common.hebrew}</option>
            <option value="en">{m.common.english}</option>
          </Select>
        </Field>
        <Field label={m.admin.contactEmail} htmlFor="set-email"><Input id="set-email" name="contact_email" type="email" defaultValue={settings.contact_email ?? ''} dir="ltr" maxLength={254} /></Field>
      </fieldset>
      <div><Button type="submit" disabled={busy}>{busy ? m.common.saving : m.common.save}</Button></div>
    </form>
  );
}
