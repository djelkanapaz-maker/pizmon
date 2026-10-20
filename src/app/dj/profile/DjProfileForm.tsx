'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { updateMyDjProfile } from '@/server/actions/profile';
import { useToast } from '@/components/overlay';
import { Button, Field, Input, Textarea } from '@/components/ui';

export function DjProfileForm({ dj }: { dj: { display_name: string; bio_he: string | null; bio_en: string | null; specialties: string[]; photo_url: string | null; accepts_new_couples: boolean } }) {
  const { m } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  return (
    <form className="card p-4 flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      start(async () => {
        const r = await updateMyDjProfile({ ...f, accepts_new_couples: f.accepts_new_couples === 'on' });
        if (!r.ok) return toast(m.common.error, 'error');
        toast(m.common.saved); router.refresh();
      });
    }}>
      <Field label={m.admin.displayName} htmlFor="dp-n"><Input id="dp-n" name="display_name" defaultValue={dj.display_name} required maxLength={80} /></Field>
      <Field label={`${m.admin.bio} (עב)`} htmlFor="dp-bh"><Textarea id="dp-bh" name="bio_he" defaultValue={dj.bio_he ?? ''} maxLength={2000} dir="rtl" /></Field>
      <Field label={`${m.admin.bio} (EN)`} htmlFor="dp-be"><Textarea id="dp-be" name="bio_en" defaultValue={dj.bio_en ?? ''} maxLength={2000} dir="ltr" /></Field>
      <Field label={m.admin.specialties} htmlFor="dp-s"><Input id="dp-s" name="specialties" defaultValue={dj.specialties.join(', ')} maxLength={400} /></Field>
      <Field label={m.admin.artworkUrl} htmlFor="dp-p"><Input id="dp-p" name="photo_url" type="url" defaultValue={dj.photo_url ?? ''} dir="ltr" /></Field>
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="accepts_new_couples" defaultChecked={dj.accepts_new_couples} className="size-5 accent-ember" />{m.admin.acceptsNew}</label>
      <Button type="submit" disabled={busy} className="self-start">{m.common.save}</Button>
    </form>
  );
}
