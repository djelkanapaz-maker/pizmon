'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { createPlaylist, deletePlaylist, removePlaylistTrack, reorderPlaylist, updatePlaylist, updatePlaylistTrack } from '@/server/actions/couple';
import { Sheet, useToast } from '@/components/overlay';
import { Badge, Button, Cover, ErrorNote, Field, Input, Select, cx } from '@/components/ui';
import { TrackPlay } from '@/components/music/TrackPlay';
import { IconArrowDown, IconArrowUp, IconTrash } from '@/components/icons';
import type { Track } from '@/server/queries';

const PURPOSES = ['reception', 'ceremony', 'dancefloor', 'late_night', 'family', 'inspiration', 'other'] as const;

export function NewPlaylistButton() {
  const { m } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>{m.playlists.create}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={m.playlists.create}>
        <form className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget));
          start(async () => {
            const r = await createPlaylist(f);
            if (!r.ok) return setError(m.common.error);
            router.push(`/wedding/playlists/${r.data.id}`);
          });
        }}>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Field label={m.playlists.name} htmlFor="pl-n"><Input id="pl-n" name="title" required maxLength={120} dir="auto" /></Field>
          <Field label={m.playlists.purpose} htmlFor="pl-p"><Select id="pl-p" name="purpose" defaultValue="other">{PURPOSES.map((p) => <option key={p} value={p}>{m.playlists.purposes[p]}</option>)}</Select></Field>
          <Button type="submit" disabled={busy}>{m.common.create}</Button>
        </form>
      </Sheet>
    </>
  );
}

type Item = { id: string; position: number; status: 'tentative' | 'confirmed' | 'backup'; note: string | null; track: Track };

export function PlaylistEditor({ playlist, items, isMain = false }: { playlist: { id: string; title: string; purpose: string | null; shared_with_dj: boolean }; items: Item[]; isMain?: boolean }) {
  const { m } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const [order, setOrder] = useState(items.map((i) => i.id));
  const byId = new Map(items.map((i) => [i.id, i]));
  const run = (fn: () => Promise<{ ok: boolean }>, after?: () => void) => start(async () => {
    const r = await fn();
    if (!r.ok) { toast(m.common.error, 'error'); setOrder(items.map((i) => i.id)); return; }
    after?.(); router.refresh();
  });
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...order]; const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setOrder(next);
    run(() => reorderPlaylist(playlist.id, next));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="gutter flex flex-wrap gap-2 items-center">
        <Button size="sm" variant={playlist.shared_with_dj ? 'gold' : 'secondary'} disabled={busy} onClick={() => run(() => updatePlaylist(playlist.id, { shared_with_dj: !playlist.shared_with_dj }))}>
          {playlist.shared_with_dj ? m.playlists.shared : m.playlists.share}
        </Button>
        {!isMain && (<>
        <Select aria-label={m.playlists.purpose} defaultValue={playlist.purpose ?? 'other'} className="!h-9 !w-auto text-sm" onChange={(e) => run(() => updatePlaylist(playlist.id, { purpose: e.target.value }))}>
          {PURPOSES.map((p) => <option key={p} value={p}>{m.playlists.purposes[p]}</option>)}
        </Select>
        <Button size="sm" variant="danger" className="ms-auto" disabled={busy} onClick={() => { if (confirm(`${m.common.delete}: ${playlist.title}?`)) start(async () => { const r = await deletePlaylist(playlist.id); if (!r.ok) { toast(m.common.error, 'error'); return; } router.push('/wedding/playlists'); }); }}>
          <IconTrash size={16} />{m.common.delete}
        </Button>
        </>)}
      </div>
      {order.length === 0 ? <p className="gutter text-paper-dim">{m.playlists.emptyTracks}</p> : (
        <ol className="gutter flex flex-col gap-2">
          {order.map((id, idx) => {
            const it = byId.get(id); if (!it) return null;
            return (
              <li key={id} className={cx('card p-3 flex flex-col gap-2', it.status === 'confirmed' && 'border-gold/60')}>
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center text-sm text-paper-dim tabular">{idx + 1}</span>
                  <Cover seed={it.track.id} label={it.track.title} src={it.track.artwork_url} size={44} />
                  <div className="flex-1 min-w-0"><p className="font-bold truncate" dir="auto">{it.track.title}</p><p className="text-sm text-paper-dim truncate" dir="auto">{it.track.artist?.name}</p></div>
                  <TrackPlay track={it.track} />
                  <div className="flex flex-col">
                    <button type="button" aria-label={m.playlists.moveUp} disabled={busy || idx === 0} onClick={() => move(idx, -1)} className="size-7 grid place-items-center rounded hover:bg-ink-3 disabled:opacity-30"><IconArrowUp size={14} /></button>
                    <button type="button" aria-label={m.playlists.moveDown} disabled={busy || idx === order.length - 1} onClick={() => move(idx, 1)} className="size-7 grid place-items-center rounded hover:bg-ink-3 disabled:opacity-30"><IconArrowDown size={14} /></button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap ps-9">
                  {(['tentative', 'confirmed', 'backup'] as const).map((st) => (
                    <button key={st} type="button" aria-pressed={it.status === st} disabled={busy} onClick={() => run(() => updatePlaylistTrack(it.id, { status: st }))}
                      className={cx('h-8 px-3 rounded-full text-xs font-bold border', it.status === st ? (st === 'confirmed' ? 'bg-gold text-ink border-gold' : 'bg-paper text-ink border-paper') : 'border-line text-paper-dim')}>
                      {m.playlists[st]}
                    </button>
                  ))}
                  <NoteInline itemId={it.id} note={it.note} />
                  <button type="button" disabled={busy} onClick={() => run(() => removePlaylistTrack(it.id))} aria-label={`${m.common.remove}: ${it.track.title}`} className="ms-auto size-8 grid place-items-center rounded-full hover:bg-ink-3 text-paper-dim"><IconTrash size={16} /></button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="gutter text-xs text-paper-dim"><Badge>{m.playlists.notFinal}</Badge></p>
    </div>
  );
}

function NoteInline({ itemId, note }: { itemId: string; note: string | null }) {
  const { m } = useI18n();
  const toast = useToast();
  const [v, setV] = useState(note ?? '');
  return (
    <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={m.playlists.note} aria-label={m.playlists.note} maxLength={500} className="!h-8 !w-48 text-xs" dir="auto"
      onBlur={async () => { if (v !== (note ?? '')) { const r = await updatePlaylistTrack(itemId, { note: v || null }); if (!r.ok) toast(m.common.error, 'error'); } }} />
  );
}
