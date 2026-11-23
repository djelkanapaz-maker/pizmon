'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { createPlaylist, deletePlaylist, removePlaylistTrack, reorderPlaylist, updatePlaylist, updatePlaylistTrack } from '@/server/actions/couple';
import { Sheet, useToast } from '@/components/overlay';
import { Badge, Button, Cover, ErrorNote, Field, Input, Select } from '@/components/ui';
import { TrackPlay } from '@/components/music/TrackPlay';
import { IconArrowDown, IconArrowUp, IconTrash } from '@/components/icons';
import type { Track } from '@/server/queries';
import { PLAYLIST_SECTIONS, sectionOf, type PlaylistSection } from '@/core/playlist-sections';

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

type Item = { id: string; position: number; status: 'tentative' | 'confirmed' | 'backup'; note: string | null; section?: string | null; track: Track };

export function PlaylistEditor({ playlist, items, isMain = false }: { playlist: { id: string; title: string; purpose: string | null; shared_with_dj: boolean }; items: Item[]; isMain?: boolean }) {
  const { m } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const [sections, setSections] = useState(() => new Map(items.map((i) => [i.id, sectionOf(i.section)])));
  // the main playlist is shown by stage of the night; within a stage, in the couple's order
  const grouped = (ids: string[]) => (isMain ? PLAYLIST_SECTIONS.flatMap((sec) => ids.filter((id) => sections.get(id) === sec)) : ids);
  const [order, setOrder] = useState(() => grouped(items.map((i) => i.id)));
  const byId = new Map(items.map((i) => [i.id, i]));
  const run = (fn: () => Promise<{ ok: boolean }>, after?: () => void) => start(async () => {
    const r = await fn();
    if (!r.ok) { toast(m.common.error, 'error'); setOrder(items.map((i) => i.id)); return; }
    after?.(); router.refresh();
  });
  // moves stay inside the song's own stage
  const neighbour = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    return j >= 0 && j < order.length && (!isMain || sections.get(order[j]) === sections.get(order[idx])) ? j : -1;
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = neighbour(idx, dir); if (j < 0) return;
    const next = [...order];
    [next[idx], next[j]] = [next[j], next[idx]];
    setOrder(next);
    run(() => reorderPlaylist(playlist.id, next));
  };
  const moveToSection = (id: string, sec: PlaylistSection) => {
    const nextSections = new Map(sections); nextSections.set(id, sec);
    setSections(nextSections);
    const next = PLAYLIST_SECTIONS.flatMap((x) => order.filter((o) => nextSections.get(o) === x));
    setOrder(next);
    run(async () => {
      const r = await updatePlaylistTrack(id, { section: sec });
      return r.ok ? reorderPlaylist(playlist.id, next) : r;
    });
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
            const sec = sections.get(id) ?? 'party';
            const startsSection = isMain && (idx === 0 || sections.get(order[idx - 1]) !== sec);
            const count = order.filter((o) => sections.get(o) === sec).length;
            return (
              <li key={id} className="flex flex-col gap-2">
                {startsSection && (
                  <h2 className={`display-m flex items-baseline gap-2 ${idx === 0 ? '' : 'mt-6'}`}>
                    {m.playlists.sections[sec]}<span className="text-sm font-normal text-paper-dim tabular">{count}</span>
                  </h2>
                )}
                <div className="card p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm text-paper-dim tabular">{idx + 1}</span>
                    <Cover seed={it.track.id} label={it.track.title} src={it.track.artwork_url} size={44} />
                    <div className="flex-1 min-w-0"><p className="font-bold break-words leading-snug" dir="auto">{it.track.title}</p><p className="text-sm text-paper-dim break-words leading-snug" dir="auto">{it.track.artist?.name}</p></div>
                    <TrackPlay track={it.track} />
                    <div className="flex flex-col">
                      <button type="button" aria-label={m.playlists.moveUp} disabled={busy || neighbour(idx, -1) < 0} onClick={() => move(idx, -1)} className="size-7 grid place-items-center rounded hover:bg-ink-3 disabled:opacity-30"><IconArrowUp size={14} /></button>
                      <button type="button" aria-label={m.playlists.moveDown} disabled={busy || neighbour(idx, 1) < 0} onClick={() => move(idx, 1)} className="size-7 grid place-items-center rounded hover:bg-ink-3 disabled:opacity-30"><IconArrowDown size={14} /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap ps-9">
                    <NoteInline itemId={it.id} note={it.note} />
                    {isMain && (
                      <Select aria-label={`${m.playlists.moveTo}: ${it.track.title}`} value={sec} disabled={busy} className="!h-8 !w-auto text-xs"
                        onChange={(e) => moveToSection(id, e.target.value as PlaylistSection)}>
                        {PLAYLIST_SECTIONS.map((x) => <option key={x} value={x}>{m.playlists.sections[x]}</option>)}
                      </Select>
                    )}
                    <button type="button" disabled={busy} onClick={() => run(() => removePlaylistTrack(it.id))} aria-label={`${m.common.remove}: ${it.track.title}`} className="ms-auto size-8 grid place-items-center rounded-full hover:bg-ink-3 text-paper-dim"><IconTrash size={16} /></button>
                  </div>
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
