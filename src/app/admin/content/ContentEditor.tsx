'use client';
import { useRef, useState } from 'react';
import { Sheet, useToast } from '@/components/overlay';
import { Button, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui';
import { IconPlus, IconUpload } from '@/components/icons';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { adminDeleteContent, adminFinalizeUpload, adminPrepareUpload, adminSaveContent, uploadMedia } from '@/server/actions/admin-cms';
import type { ActionResult } from '@/server/result';
import { ConfirmButton, fieldErrors, formObject, useCms, useErrText, useRun } from '../_cms/client';

export type ContentRow = {
  id: string; kind: string; title: string; description: string | null; creator_dj_id: string | null; artwork_url: string | null; media_url: string | null;
  external_url: string | null; duration_seconds: number | null; genre_tags: string[]; status: string; visibility: 'company' | 'event';
  visible_event_id: string | null; is_featured: boolean; is_demo: boolean;
};
export type Opt = { id: string; label: string };
const KINDS = ['mix', 'training_set', 'genre_set', 'editorial', 'new_music', 'behind_the_scenes', 'release', 'seasonal', 'wedding_collection', 'video'] as const;
const STATUSES = ['draft', 'published', 'archived'] as const;
// Server Action bodies are capped at 1 MB by default; larger files go straight to storage via a signed upload URL.
const DIRECT_MAX = 900 * 1024;

type Uploaded = { url: string };
async function upload(file: File): Promise<ActionResult<Uploaded>> {
  if (file.size <= DIRECT_MAX) {
    const fd = new FormData(); fd.set('file', file);
    return uploadMedia(fd);
  }
  const prep = await adminPrepareUpload({ mime: file.type, size: file.size });
  if (!prep.ok) return prep;
  try {
    const { error } = await supabaseBrowser().storage.from(prep.data.bucket).uploadToSignedUrl(prep.data.path, prep.data.token, file, { contentType: prep.data.contentType });
    if (error) return { ok: false, error: 'upload_failed' };
  } catch {
    return { ok: false, error: 'upload_failed' };
  }
  return adminFinalizeUpload({ path: prep.data.path, mime: file.type, size: file.size });
}

function UploadField({ accept, onUrl }: { accept: string; onUrl: (url: string) => void }) {
  const { m, s } = useCms();
  const err = useErrText();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input ref={ref} type="file" accept={accept} className="sr-only" tabIndex={-1} aria-hidden onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setBusy(true);
        const r = await upload(file).catch(() => ({ ok: false as const, error: 'upload_failed' }));
        setBusy(false);
        if (!r.ok) return toast(`${m.admin.uploadFailed}: ${err(r.error)}`, 'error');
        onUrl(r.data.url);
        toast(s.uploadedTo);
      }} />
      <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => ref.current?.click()}>
        <IconUpload size={16} />{busy ? s.uploading : m.admin.upload}
      </Button>
    </>
  );
}

function ContentForm({ row, djs, events, onDone }: { row?: ContentRow; djs: Opt[]; events: Opt[]; onDone: () => void }) {
  const { m, s } = useCms();
  const err = useErrText();
  const { busy, run } = useRun();
  const [media, setMedia] = useState(row?.media_url ?? '');
  const [artwork, setArtwork] = useState(row?.artwork_url ?? '');
  const [visibility, setVisibility] = useState<'company' | 'event'>(row?.visibility ?? 'company');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const statusLabel = { draft: m.common.draft, published: m.common.published, archived: m.common.archived };
  const minutes = row?.duration_seconds ? String(Math.round((row.duration_seconds / 60) * 100) / 100) : '';

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault();
      const f = formObject(e.currentTarget);
      setError(null); setFields({});
      run(() => adminSaveContent({ ...f, id: row?.id ?? '', media_url: media, artwork_url: artwork, visibility, is_featured: f.is_featured === 'on' }), {
        silentError: true, onOk: onDone,
        onFail: (r) => { if (!r.ok) { setError(err(r.error)); setFields(fieldErrors(r, s)); } },
      });
    }}>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={m.admin.kind} htmlFor="c-kind">
          <Select id="c-kind" name="kind" defaultValue={row?.kind ?? 'mix'}>{KINDS.map((k) => <option key={k} value={k}>{m.radio.kinds[k]}</option>)}</Select>
        </Field>
        <Field label={m.common.status} htmlFor="c-status">
          <Select id="c-status" name="status" defaultValue={row?.status ?? 'draft'}>{STATUSES.map((x) => <option key={x} value={x}>{statusLabel[x]}</option>)}</Select>
        </Field>
      </div>
      <Field label={s.title} htmlFor="c-title" error={fields.title}><Input id="c-title" name="title" defaultValue={row?.title ?? ''} required maxLength={200} dir="auto" /></Field>
      <Field label={s.description} htmlFor="c-desc"><Textarea id="c-desc" name="description" defaultValue={row?.description ?? ''} maxLength={4000} dir="auto" className="min-h-20" /></Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={m.admin.creator} htmlFor="c-dj">
          <Select id="c-dj" name="creator_dj_id" defaultValue={row?.creator_dj_id ?? ''}>
            <option value="">{m.common.none}</option>
            {djs.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </Select>
        </Field>
        <Field label={m.admin.duration} htmlFor="c-dur" error={fields.duration_minutes}>
          <Input id="c-dur" name="duration_minutes" defaultValue={minutes} inputMode="decimal" placeholder="60" />
        </Field>
      </div>
      <Field label={m.admin.mediaUrl} htmlFor="c-media" hint={m.admin.uploadHint} error={fields.media_url}>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input id="c-media" value={media} onChange={(e) => setMedia(e.target.value)} dir="ltr" inputMode="url" placeholder="https:// · /demo-audio/…" className="flex-1" />
          <UploadField accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,.mp3,.m4a,.aac,.ogg,.wav" onUrl={setMedia} />
        </div>
      </Field>
      <Field label={m.admin.artworkUrl} htmlFor="c-art" error={fields.artwork_url}>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input id="c-art" value={artwork} onChange={(e) => setArtwork(e.target.value)} dir="ltr" inputMode="url" placeholder="https://" className="flex-1" />
          <UploadField accept="image/jpeg,image/png,image/webp" onUrl={setArtwork} />
        </div>
      </Field>
      <Field label={m.admin.externalUrl} htmlFor="c-ext" error={fields.external_url}><Input id="c-ext" name="external_url" defaultValue={row?.external_url ?? ''} dir="ltr" inputMode="url" placeholder="https://" /></Field>
      <Field label={s.genreTags} htmlFor="c-tags"><Input id="c-tags" name="genre_tags" defaultValue={(row?.genre_tags ?? []).join(', ')} maxLength={400} dir="auto" /></Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-bold mb-2">{m.admin.visibility}</legend>
        <div className="flex flex-wrap gap-4">
          {(['company', 'event'] as const).map((v) => (
            <label key={v} className="flex items-center gap-2 min-h-11 text-sm font-bold">
              <input type="radio" name="vis" checked={visibility === v} onChange={() => setVisibility(v)} className="size-5 accent-[var(--color-ember)]" />
              {v === 'company' ? m.admin.visibilityCompany : m.admin.visibilityEvent}
            </label>
          ))}
        </div>
        {visibility === 'event' && (
          <Field label={s.couple} htmlFor="c-event" error={fields.visible_event_id}>
            <Select id="c-event" name="visible_event_id" defaultValue={row?.visible_event_id ?? ''} required>
              <option value="">—</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.label}</option>)}
            </Select>
          </Field>
        )}
      </fieldset>
      <label className="flex items-center gap-3 min-h-11 text-sm font-bold">
        <input type="checkbox" name="is_featured" defaultChecked={row?.is_featured ?? false} className="size-5 accent-[var(--color-ember)]" />{m.admin.featured}
      </label>
      <Button type="submit" disabled={busy}>{busy ? m.common.saving : row ? m.common.save : m.common.create}</Button>
    </form>
  );
}

export function NewContentButton({ djs, events }: { djs: Opt[]; events: Opt[] }) {
  const { m } = useCms();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><IconPlus size={16} />{m.admin.newContent}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={m.admin.newContent} wide><ContentForm djs={djs} events={events} onDone={() => setOpen(false)} /></Sheet>
    </>
  );
}

export function ContentActions({ row, djs, events }: { row: ContentRow; djs: Opt[]; events: Opt[] }) {
  const { m, s } = useCms();
  const { busy, run } = useRun();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex gap-2 shrink-0">
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{m.common.edit}</Button>
      <ConfirmButton label={m.common.delete} confirmLabel={s.deleteConfirm} disabled={busy} onConfirm={() => run(() => adminDeleteContent(row.id))} />
      <Sheet open={open} onClose={() => setOpen(false)} title={row.title} wide><ContentForm row={row} djs={djs} events={events} onDone={() => setOpen(false)} /></Sheet>
    </div>
  );
}
