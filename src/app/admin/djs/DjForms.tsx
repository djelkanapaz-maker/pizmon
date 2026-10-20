'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { adminActivationLink, adminCreateDj, adminLinkDjAccount, adminUpdateDj } from '@/server/actions/admin-people';
import { Sheet, useToast } from '@/components/overlay';
import { Button, ErrorNote, Field, Input, Textarea } from '@/components/ui';
import { ActivationLinkBox } from '@/components/ActivationLinkBox';

export function NewDjButton() {
  const { m } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>{m.admin.newDj}</Button>
      <Sheet open={open} onClose={() => { setOpen(false); setLink(null); setError(null); }} title={m.admin.newDj}>
        {link ? <ActivationLinkBox link={link} /> : (
          <form className="flex flex-col gap-4" noValidate onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            start(async () => {
              const r = await adminCreateDj(f);
              if (!r.ok) return setError((m.errors as Record<string, string>)[r.error] ?? m.common.error);
              router.refresh();
              if (r.data.link) setLink(r.data.link); else setOpen(false);
            });
          }}>
            {error && <ErrorNote>{error}</ErrorNote>}
            <Field label={m.admin.displayName} htmlFor="dj-n"><Input id="dj-n" name="display_name" required maxLength={80} /></Field>
            <Field label={m.admin.djEmail} htmlFor="dj-e"><Input id="dj-e" name="email" type="email" dir="ltr" /></Field>
            <Field label={`${m.admin.bio} (עב)`} htmlFor="dj-bh"><Textarea id="dj-bh" name="bio_he" maxLength={2000} dir="rtl" /></Field>
            <Field label={`${m.admin.bio} (EN)`} htmlFor="dj-be"><Textarea id="dj-be" name="bio_en" maxLength={2000} dir="ltr" /></Field>
            <Field label={m.admin.specialties} htmlFor="dj-s"><Input id="dj-s" name="specialties" maxLength={400} /></Field>
            <Button type="submit" disabled={busy}>{busy ? m.common.saving : m.common.create}</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}

type Dj = { id: string; display_name: string; bio_he: string | null; bio_en: string | null; specialties: string[]; photo_url: string | null; is_active: boolean; accepts_new_couples: boolean; sort_order: number; user_id: string | null };

export function DjEditForm({ dj }: { dj: Dj }) {
  const { m } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, after?: (d: unknown) => void) => start(async () => {
    const r = await fn();
    if (!r.ok) return toast((m.errors as Record<string, string>)[r.error ?? ''] ?? m.common.error, 'error');
    toast(m.common.saved); after?.(r.data); router.refresh();
  });
  return (
    <div className="flex flex-col gap-6">
      <form className="card p-4 flex flex-col gap-4" onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        run(() => adminUpdateDj(dj.id, { ...f, is_active: f.is_active === 'on', accepts_new_couples: f.accepts_new_couples === 'on' }));
      }}>
        <Field label={m.admin.displayName} htmlFor="d-n"><Input id="d-n" name="display_name" defaultValue={dj.display_name} required maxLength={80} /></Field>
        <Field label={`${m.admin.bio} (עב)`} htmlFor="d-bh"><Textarea id="d-bh" name="bio_he" defaultValue={dj.bio_he ?? ''} maxLength={2000} dir="rtl" /></Field>
        <Field label={`${m.admin.bio} (EN)`} htmlFor="d-be"><Textarea id="d-be" name="bio_en" defaultValue={dj.bio_en ?? ''} maxLength={2000} dir="ltr" /></Field>
        <Field label={m.admin.specialties} htmlFor="d-s"><Input id="d-s" name="specialties" defaultValue={dj.specialties.join(', ')} maxLength={400} /></Field>
        <Field label={m.admin.artworkUrl} htmlFor="d-p"><Input id="d-p" name="photo_url" type="url" defaultValue={dj.photo_url ?? ''} dir="ltr" /></Field>
        <Field label="#" htmlFor="d-o"><Input id="d-o" name="sort_order" type="number" min={0} max={999} defaultValue={dj.sort_order} /></Field>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="is_active" defaultChecked={dj.is_active} className="size-5 accent-ember" />{m.admin.active}</label>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="accepts_new_couples" defaultChecked={dj.accepts_new_couples} className="size-5 accent-ember" />{m.admin.acceptsNew}</label>
        <Button type="submit" disabled={busy} className="self-start">{m.common.save}</Button>
      </form>
      <div className="card p-4 flex flex-col gap-3">
        <p className="label">{m.profile.account}</p>
        {dj.user_id ? (
          <Button size="sm" variant="secondary" className="self-start" disabled={busy} onClick={() => run(() => adminActivationLink({ djId: dj.id }), (d) => setLink((d as { link: string }).link))}>{m.admin.newLink}</Button>
        ) : (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => adminLinkDjAccount(dj.id, email), (d) => setLink((d as { link: string }).link)); }}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={m.admin.djEmail} aria-label={m.admin.djEmail} dir="ltr" />
            <Button type="submit" disabled={busy || !email}>{m.admin.linkAccount}</Button>
          </form>
        )}
        {link && <ActivationLinkBox link={link} />}
      </div>
    </div>
  );
}
