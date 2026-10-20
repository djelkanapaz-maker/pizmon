'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, useToast } from '@/components/overlay';
import { Badge, Button, DemoBadge, Field, IconButton, Input, Select, Textarea } from '@/components/ui';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '@/components/icons';
import {
  adminAddPlaylistTrack, adminDeletePlaylist, adminRemovePlaylistTrack, adminReorderPlaylist, adminSavePlaylist, adminSearchTracks,
  adminSetPlaylistFlags, type AdminTrackHit,
} from '@/server/actions/admin-cms';
import { ConfirmButton, formObject, useCms, useErrText, useRun } from '../_cms/client';

export type PlaylistRow = { id: string; title: string; description: string | null; purpose: string | null; status: string; is_featured: boolean };
const PURPOSES = ['reception', 'ceremony', 'dancefloor', 'late_night', 'family', 'inspiration', 'other'] as const;
const STATUSES = ['draft', 'published', 'archived'] as const;

function PlaylistForm({ row, onDone }: { row?: PlaylistRow; onDone: (id: string) => void }) {
  const { m, s } = useCms();
  const { busy, run } = useRun();
  const statusLabel = { draft: m.common.draft, published: m.common.published, archived: m.common.archived };
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault();
      const f = formObject(e.currentTarget);
      run(() => adminSavePlaylist({ ...f, id: row?.id ?? '', is_featured: f.is_featured === 'on' }), { onOk: (d) => onDone(d.id) });
    }}>
      <Field label={s.title} htmlFor="pl-title"><Input id="pl-title" name="title" defaultValue={row?.title ?? ''} required maxLength={120} dir="auto" /></Field>
      <Field label={s.description} htmlFor="pl-desc"><Textarea id="pl-desc" name="description" defaultValue={row?.description ?? ''} maxLength={2000} dir="auto" className="min-h-20" /></Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={s.purpose} htmlFor="pl-purpose">
          <Select id="pl-purpose" name="purpose" defaultValue={row?.purpose ?? ''}>
            <option value="">{m.common.none}</option>
            {PURPOSES.map((p) => <option key={p} value={p}>{m.playlists.purposes[p]}</option>)}
          </Select>
        </Field>
        <Field label={m.common.status} htmlFor="pl-status">
          <Select id="pl-status" name="status" defaultValue={row?.status ?? 'draft'}>{STATUSES.map((x) => <option key={x} value={x}>{statusLabel[x]}</option>)}</Select>
        </Field>
      </div>
      <label className="flex items-center gap-3 min-h-11 text-sm font-bold">
        <input type="checkbox" name="is_featured" defaultChecked={row?.is_featured ?? false} className="size-5 accent-[var(--color-ember)]" />{m.admin.featured}
      </label>
      <Button type="submit" disabled={busy}>{busy ? m.common.saving : row ? m.common.save : m.common.create}</Button>
    </form>
  );
}

export function NewPlaylistButton() {
  const { m } = useCms();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><IconPlus size={16} />{m.admin.newPlaylist}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={m.admin.newPlaylist}>
        <PlaylistForm onDone={(id) => { setOpen(false); router.push(`/admin/playlists/${id}`); }} />
      </Sheet>
    </>
  );
}

export function PlaylistHeaderActions({ row }: { row: PlaylistRow }) {
  const { m, s } = useCms();
  const router = useRouter();
  const { busy, run } = useRun();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{m.common.edit}</Button>
      <ConfirmButton label={m.common.delete} confirmLabel={s.deleteConfirm} disabled={busy}
        onConfirm={() => run(() => adminDeletePlaylist(row.id), { onOk: () => router.push('/admin/playlists') })} />
      <Sheet open={open} onClose={() => setOpen(false)} title={row.title}><PlaylistForm row={row} onDone={() => setOpen(false)} /></Sheet>
    </div>
  );
}

export function PlaylistFlags({ row }: { row: PlaylistRow }) {
  const { m } = useCms();
  const { busy, run } = useRun();
  const statusLabel: Record<string, string> = { draft: m.common.draft, published: m.common.published, archived: m.common.archived };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="pl-flag-status" className="sr-only">{m.common.status}</label>
      <select id="pl-flag-status" value={row.status} disabled={busy}
        onChange={(e) => run(() => adminSetPlaylistFlags(row.id, { status: e.target.value }))}
        className="h-9 px-3 rounded-full bg-ink-3 border border-line text-paper text-sm font-bold">
        {STATUSES.map((x) => <option key={x} value={x}>{statusLabel[x]}</option>)}
      </select>
      <Button size="sm" variant={row.is_featured ? 'gold' : 'secondary'} aria-pressed={row.is_featured} disabled={busy}
        onClick={() => run(() => adminSetPlaylistFlags(row.id, { is_featured: !row.is_featured }))}>
        {row.is_featured ? '★ ' : '☆ '}{m.admin.featured}
      </Button>
    </div>
  );
}

export type PlaylistTrackRow = { track_id: string; title: string; artist: string | null; is_demo: boolean; status: string };

export function PlaylistTracks({ playlistId, tracks }: { playlistId: string; tracks: PlaylistTrackRow[] }) {
  const { m } = useCms();
  const { busy, run } = useRun();
  const move = (i: number, d: -1 | 1) => {
    const ids = tracks.map((t) => t.track_id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => adminReorderPlaylist(playlistId, ids), { success: false });
  };
  if (!tracks.length) return <p className="text-sm text-paper-dim">{m.playlists.emptyTracks}</p>;
  return (
    <ol className="flex flex-col divide-y divide-line">
      {tracks.map((t, i) => (
        <li key={t.track_id} className="py-2 flex items-center gap-2">
          <span className="w-6 text-paper-dim tabular text-sm text-center shrink-0">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate" dir="auto">{t.title}</p>
            <p className="text-sm text-paper-dim truncate flex items-center gap-2" dir="auto">
              {t.artist ?? '—'}
              {t.status !== 'published' && <Badge>{t.status === 'draft' ? m.common.draft : m.common.archived}</Badge>}
              {t.is_demo && <DemoBadge label={m.common.demo} />}
            </p>
          </div>
          <IconButton label={m.playlists.moveUp} disabled={busy || i === 0} onClick={() => move(i, -1)}><IconArrowUp size={18} /></IconButton>
          <IconButton label={m.playlists.moveDown} disabled={busy || i === tracks.length - 1} onClick={() => move(i, 1)}><IconArrowDown size={18} /></IconButton>
          <IconButton label={`${m.common.remove} — ${t.title}`} disabled={busy} className="text-danger"
            onClick={() => run(() => adminRemovePlaylistTrack(playlistId, t.track_id), { success: false })}><IconTrash size={18} /></IconButton>
        </li>
      ))}
    </ol>
  );
}

export function PlaylistTrackSearch({ playlistId, existing }: { playlistId: string; existing: string[] }) {
  const { m, s } = useCms();
  const err = useErrText();
  const toast = useToast();
  const { busy, run } = useRun();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<AdminTrackHit[]>([]);
  const [searching, startSearch] = useTransition();
  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const t = setTimeout(() => startSearch(async () => {
      const r = await adminSearchTracks(term).catch(() => ({ ok: false as const, error: 'network' }));
      if (r.ok) setHits(r.data); else toast(err(r.error), 'error');
    }), 250);
    return () => clearTimeout(t);
  }, [q, toast, err]);
  const shown = q.trim() ? hits : [];
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="pl-search" className="text-sm font-bold">{m.admin.addTrack}</label>
      <Input id="pl-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.searchTracks} dir="auto" autoComplete="off" />
      <p className="text-xs text-paper-dim" aria-live="polite">{searching ? m.common.loading : q.trim() && !hits.length ? s.noMatches : s.addTracksHint}</p>
      {shown.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {shown.map((h) => {
            const added = existing.includes(h.id);
            return (
              <li key={h.id} className="py-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate" dir="auto">{h.title}</p>
                  <p className="text-sm text-paper-dim truncate flex items-center gap-2" dir="auto">
                    {h.artist ?? '—'}{h.status !== 'published' && <Badge>{h.status === 'draft' ? m.common.draft : m.common.archived}</Badge>}
                    {h.is_demo && <DemoBadge label={m.common.demo} />}
                  </p>
                </div>
                {added ? <Badge tone="ok">{s.inPlaylist}</Badge> : (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => adminAddPlaylistTrack(playlistId, h.id), { success: m.common.add })}>
                    <IconPlus size={14} />{m.common.add}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
