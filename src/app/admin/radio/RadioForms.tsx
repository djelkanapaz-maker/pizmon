'use client';
import { useState } from 'react';
import { Button, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui';
import { adminDeleteShow, adminSaveShow, adminSaveStation } from '@/server/actions/admin-cms';
import { ConfirmButton, fieldErrors, formObject, fromLocalInput, useCms, useErrText, useRun } from '../_cms/client';

export type Station = { id: string; name: string; description: string | null; mode: 'off' | 'demo' | 'live'; stream_url: string | null; metadata_url: string | null } | null;
export type Opt = { id: string; label: string };

export function StationForm({ station }: { station: Station }) {
  const { m, s } = useCms();
  const err = useErrText();
  const { busy, run } = useRun();
  const [mode, setMode] = useState(station?.mode ?? 'off');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault();
      const f = formObject(e.currentTarget);
      setError(null); setFields({});
      run(() => adminSaveStation({ ...f, mode }), {
        silentError: true,
        onFail: (r) => { if (!r.ok) { setError(err(r.error)); setFields(fieldErrors(r, s)); } },
      });
    }}>
      {error && <ErrorNote>{error}</ErrorNote>}
      <fieldset>
        <legend className="text-sm font-bold mb-2">{m.admin.mode}</legend>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-5">
          {(['off', 'demo', 'live'] as const).map((x) => (
            <label key={x} className="flex items-center gap-2 min-h-11 text-sm font-bold">
              <input type="radio" name="mode_radio" checked={mode === x} onChange={() => setMode(x)} className="size-5 accent-[var(--color-ember)]" />{m.admin.modes[x]}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={s.stationName} htmlFor="st-name" error={fields.name}><Input id="st-name" name="name" defaultValue={station?.name ?? ''} required maxLength={120} dir="auto" /></Field>
      <Field label={s.description} htmlFor="st-desc"><Textarea id="st-desc" name="description" defaultValue={station?.description ?? ''} maxLength={1000} dir="auto" className="min-h-20" /></Field>
      <Field label={m.admin.streamUrl} htmlFor="st-url" error={fields.stream_url} hint={mode === 'demo' ? '/demo-audio/golden-hour.mp3' : 'https://'}>
        <Input id="st-url" name="stream_url" defaultValue={station?.stream_url ?? ''} dir="ltr" inputMode="url" required={mode !== 'off'} placeholder={mode === 'demo' ? '/demo-audio/…' : 'https://'} />
      </Field>
      <Field label={m.admin.metadataUrl} htmlFor="st-meta" error={fields.metadata_url}>
        <Input id="st-meta" name="metadata_url" defaultValue={station?.metadata_url ?? ''} dir="ltr" inputMode="url" placeholder="https://" />
      </Field>
      <Button type="submit" disabled={busy}>{busy ? m.common.saving : m.common.save}</Button>
    </form>
  );
}

export function AddShowForm({ djs }: { djs: Opt[] }) {
  const { m, s } = useCms();
  const err = useErrText();
  const { busy, run } = useRun();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = formObject(form);
      const starts_at = fromLocalInput(f.starts_at), ends_at = fromLocalInput(f.ends_at);
      setError(null); setFields({});
      if (!starts_at || !ends_at || new Date(ends_at) <= new Date(starts_at)) {
        setFields({ ...(!starts_at ? { starts_at: s.errors.invalid } : {}), ends_at: s.errors.invalid });
        return setError(m.errors.validation);
      }
      run(() => adminSaveShow({ ...f, starts_at, ends_at }), {
        silentError: true, onOk: () => form.reset(),
        onFail: (r) => { if (!r.ok) { setError(err(r.error)); setFields(fieldErrors(r, s)); } },
      });
    }}>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Field label={s.title} htmlFor="sh-title" error={fields.title}><Input id="sh-title" name="title" required maxLength={160} dir="auto" /></Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={m.admin.startsAt} htmlFor="sh-start" error={fields.starts_at}><Input id="sh-start" name="starts_at" type="datetime-local" required /></Field>
        <Field label={m.admin.endsAt} htmlFor="sh-end" error={fields.ends_at}><Input id="sh-end" name="ends_at" type="datetime-local" required /></Field>
      </div>
      <Field label={m.admin.host} htmlFor="sh-host">
        <Select id="sh-host" name="host_dj_id" defaultValue="">
          <option value="">{m.common.none}</option>
          {djs.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </Select>
      </Field>
      <Field label={s.description} htmlFor="sh-desc"><Textarea id="sh-desc" name="description" maxLength={1000} dir="auto" className="min-h-20" /></Field>
      <Button type="submit" disabled={busy}>{busy ? m.common.saving : m.admin.newShow}</Button>
    </form>
  );
}

export function DeleteShow({ id }: { id: string }) {
  const { m, s } = useCms();
  const { busy, run } = useRun();
  return <ConfirmButton label={m.common.delete} confirmLabel={s.deleteConfirm} disabled={busy} onConfirm={() => run(() => adminDeleteShow(id))} />;
}
