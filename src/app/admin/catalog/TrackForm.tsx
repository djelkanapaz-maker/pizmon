'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/components/overlay';
import { Button, Chip, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui';
import { IconPlus } from '@/components/icons';
import { adminCreateTrack, adminDeleteTrack, adminSetTrackMoments, adminSetTrackTags, adminUpdateTrack } from '@/server/actions/admin-cms';
import type { ActionResult } from '@/server/result';
import { ConfirmButton, fieldErrors, formObject, useCms, useErrText, useRun } from '../_cms/client';

export type TrackFormValue = {
  id?: string; title: string; artist_name: string; album: string | null; genre_id: string | null; energy: number | null; language: string | null;
  decade: number | null; artwork_url: string | null; provider: string | null; provider_track_id: string | null; preview_url: string | null;
  playback_url: string | null; external_url: string | null; rights_status: string; rights_notes: string | null; status: string;
};
export type Opt = { id: string; label: string };

const LANGS = ['he', 'en', 'ar', 'fr', 'es', 'instrumental', 'other'] as const;
const PROVIDERS = ['spotify', 'apple_music', 'youtube', 'soundcloud', 'company'] as const;
const RIGHTS = ['metadata_only', 'preview_licensed', 'full_licensed', 'company_owned'] as const;
const STATUSES = ['draft', 'published', 'archived'] as const;

const EMPTY: TrackFormValue = {
  title: '', artist_name: '', album: null, genre_id: null, energy: null, language: null, decade: null, artwork_url: null, provider: null,
  provider_track_id: null, preview_url: null, playback_url: null, external_url: null, rights_status: 'metadata_only', rights_notes: null, status: 'draft',
};

export function TrackForm({ track, genres, onSaved }: { track?: TrackFormValue; genres: Opt[]; onSaved?: (id: string) => void }) {
  const { m, s } = useCms();
  const err = useErrText();
  const { busy, run } = useRun();
  const v = track ?? EMPTY;
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [rights, setRights] = useState(v.rights_status);
  const statusLabel = { draft: m.common.draft, published: m.common.published, archived: m.common.archived };
  const fe = (k: string) => fields[k] ?? null;

  return (
    <form noValidate className="flex flex-col gap-5" onSubmit={(e) => {
      e.preventDefault();
      const f = formObject(e.currentTarget);
      setError(null); setFields({});
      const id = v.id;
      const onFail = (r: ActionResult<unknown>) => { if (!r.ok) { setError(err(r.error)); setFields(fieldErrors(r, s)); } };
      if (id) run(() => adminUpdateTrack(id, f), { silentError: true, onFail, onOk: () => onSaved?.(id) });
      else run(() => adminCreateTrack(f), { silentError: true, onFail, onOk: (d) => onSaved?.(d.id) });
    }}>
      {error && <ErrorNote>{error}</ErrorNote>}
      <fieldset className="flex flex-col gap-4">
        <legend className="label mb-3">{s.basics}</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={m.admin.trackTitle} htmlFor="t-title" error={fe('title')}><Input id="t-title" name="title" defaultValue={v.title} required maxLength={200} dir="auto" /></Field>
          <Field label={m.admin.artist} htmlFor="t-artist" error={fe('artist_name')}><Input id="t-artist" name="artist_name" defaultValue={v.artist_name} required maxLength={200} dir="auto" /></Field>
          <Field label={m.admin.album} htmlFor="t-album"><Input id="t-album" name="album" defaultValue={v.album ?? ''} maxLength={200} dir="auto" /></Field>
          <Field label={s.genre} htmlFor="t-genre" error={fe('genre_id')}>
            <Select id="t-genre" name="genre_id" defaultValue={v.genre_id ?? ''}>
              <option value="">{m.common.none}</option>
              {genres.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </Select>
          </Field>
          <Field label={s.energy} htmlFor="t-energy">
            <Select id="t-energy" name="energy" defaultValue={v.energy ? String(v.energy) : ''}>
              <option value="">{m.common.notSet}</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} · {m.discover.energyLevels[n]}</option>)}
            </Select>
          </Field>
          <Field label={s.language} htmlFor="t-lang">
            <Select id="t-lang" name="language" defaultValue={v.language ?? ''}>
              <option value="">{m.common.notSet}</option>
              {LANGS.map((l) => <option key={l} value={l}>{m.discover.languages[l]}</option>)}
            </Select>
          </Field>
          <Field label={s.decade} htmlFor="t-decade" error={fe('decade')}><Input id="t-decade" name="decade" defaultValue={v.decade ?? ''} inputMode="numeric" placeholder="1990" pattern="(19|20|21)\d0" maxLength={4} /></Field>
          <Field label={m.common.status} htmlFor="t-status">
            <Select id="t-status" name="status" defaultValue={v.status}>{STATUSES.map((x) => <option key={x} value={x}>{statusLabel[x]}</option>)}</Select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="label mb-3">{m.admin.rights}</legend>
        <Field label={m.admin.rights} htmlFor="t-rights" hint={m.admin.rightsHint}>
          <Select id="t-rights" name="rights_status" value={rights} onChange={(e) => setRights(e.target.value)}>
            {RIGHTS.map((r) => <option key={r} value={r}>{m.admin.rightsLevels[r]}</option>)}
          </Select>
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={m.admin.previewUrl} htmlFor="t-prev" error={fe('preview_url')} hint={rights === 'metadata_only' ? m.admin.rightsHint : undefined}>
            <Input id="t-prev" name="preview_url" defaultValue={v.preview_url ?? ''} dir="ltr" inputMode="url" placeholder="https://" />
          </Field>
          <Field label={m.admin.playbackUrl} htmlFor="t-play" error={fe('playback_url')} hint={rights !== 'full_licensed' && rights !== 'company_owned' ? m.admin.rightsHint : undefined}>
            <Input id="t-play" name="playback_url" defaultValue={v.playback_url ?? ''} dir="ltr" inputMode="url" placeholder="https://" />
          </Field>
        </div>
        <Field label={m.admin.rightsNotes} htmlFor="t-rnotes"><Textarea id="t-rnotes" name="rights_notes" defaultValue={v.rights_notes ?? ''} maxLength={2000} className="min-h-20" dir="auto" /></Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="label mb-3">{s.media}</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={m.admin.externalUrl} htmlFor="t-ext" error={fe('external_url')}><Input id="t-ext" name="external_url" defaultValue={v.external_url ?? ''} dir="ltr" inputMode="url" placeholder="https://" /></Field>
          <Field label={m.admin.artworkUrl} htmlFor="t-art" error={fe('artwork_url')}><Input id="t-art" name="artwork_url" defaultValue={v.artwork_url ?? ''} dir="ltr" inputMode="url" placeholder="https://" /></Field>
          <Field label={s.provider} htmlFor="t-prov">
            <Select id="t-prov" name="provider" defaultValue={v.provider ?? ''}>
              <option value="">{m.common.none}</option>
              {PROVIDERS.map((p) => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
            </Select>
          </Field>
          <Field label={s.providerId} htmlFor="t-provid"><Input id="t-provid" name="provider_track_id" defaultValue={v.provider_track_id ?? ''} dir="ltr" maxLength={200} /></Field>
        </div>
      </fieldset>
      <Button type="submit" disabled={busy}>{busy ? m.common.saving : v.id ? m.common.save : m.common.create}</Button>
    </form>
  );
}

export function AddTrackButton({ genres }: { genres: Opt[] }) {
  const { m } = useCms();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><IconPlus size={16} />{m.admin.newTrack}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={m.admin.newTrack} wide>
        <TrackForm genres={genres} onSaved={(id) => { setOpen(false); router.push(`/admin/catalog/${id}`); }} />
      </Sheet>
    </>
  );
}

export function DeleteTrack({ id }: { id: string }) {
  const { m, s } = useCms();
  const router = useRouter();
  const { busy, run } = useRun();
  return <ConfirmButton label={m.common.delete} confirmLabel={s.deleteConfirm} disabled={busy}
    onConfirm={() => run(() => adminDeleteTrack(id), { onOk: () => router.push('/admin/catalog') })} />;
}

export function TrackTagsEditor({ trackId, categories, moods, selected }: { trackId: string; categories: Opt[]; moods: Opt[]; selected: string[] }) {
  const { m, s } = useCms();
  const { busy, run } = useRun();
  const [sel, setSel] = useState<string[]>(selected);
  const toggle = (id: string) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const group = (title: string, items: Opt[], tone: 'ember' | 'gold') => (
    <fieldset>
      <legend className="text-sm font-bold mb-2">{title}</legend>
      {items.length ? (
        <div className="flex flex-wrap gap-2">{items.map((t) => <Chip key={t.id} tone={tone} selected={sel.includes(t.id)} onClick={() => toggle(t.id)}>{t.label}</Chip>)}</div>
      ) : <p className="text-sm text-paper-dim">{s.emptyList}</p>}
    </fieldset>
  );
  return (
    <div className="flex flex-col gap-4">
      {group(m.admin.categories, categories, 'ember')}
      {group(m.admin.moods, moods, 'gold')}
      <div><Button size="sm" disabled={busy} onClick={() => run(() => adminSetTrackTags(trackId, sel))}>{busy ? m.common.saving : m.common.save}</Button></div>
    </div>
  );
}

export function TrackMomentsEditor({ trackId, moments, selected }: { trackId: string; moments: (Opt & { collections: boolean })[]; selected: { moment_id: string; collection: 'he' | 'intl' | null }[] }) {
  const { m, s } = useCms();
  const { busy, run } = useRun();
  const [sel, setSel] = useState(new Map(selected.map((x) => [x.moment_id, x.collection])));
  const toggle = (id: string) => setSel((x) => { const n = new Map(x); if (n.has(id)) n.delete(id); else n.set(id, null); return n; });
  const setCol = (id: string, c: string) => setSel((x) => new Map(x).set(id, c === 'he' || c === 'intl' ? c : null));
  return (
    <div className="flex flex-col gap-4">
      {moments.length ? (
        <ul className="flex flex-col gap-2">
          {moments.map((mo) => (
            <li key={mo.id} className="flex flex-wrap items-center gap-2">
              <Chip selected={sel.has(mo.id)} onClick={() => toggle(mo.id)}>{mo.label}</Chip>
              {sel.has(mo.id) && mo.collections && (
                <label className="flex items-center gap-2 text-sm text-paper-dim">
                  {s.collection}
                  <select value={sel.get(mo.id) ?? ''} onChange={(e) => setCol(mo.id, e.target.value)} className="h-9 px-3 rounded-full bg-ink-3 border border-line text-paper text-sm">
                    <option value="">{s.anyCollection}</option>
                    <option value="he">{m.moments.he}</option>
                    <option value="intl">{m.moments.intl}</option>
                  </select>
                </label>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-paper-dim">{s.emptyMoments}</p>}
      <div><Button size="sm" disabled={busy} onClick={() => run(() => adminSetTrackMoments(trackId, [...sel].map(([moment_id, collection]) => ({ moment_id, collection }))))}>{busy ? m.common.saving : m.common.save}</Button></div>
    </div>
  );
}
