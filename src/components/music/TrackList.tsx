'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { restrictionFor, type Restriction } from '@/core/restrictions';
import { addToPlaylist, createPlaylist, saveSelection, setTrackPreference } from '@/server/actions/couple';
import { Sheet, useToast } from '@/components/overlay';
import { Badge, Button, Cover, cx, Input } from '@/components/ui';
import { PlayToggle } from '@/components/audio/MiniPlayer';
import { IconBan, IconCheck, IconCompare, IconExternal, IconHeart, IconList, IconPlus, IconStar } from '@/components/icons';
import { externalOptions, playableSource } from './listening';
import type { Track } from '@/server/queries';

export type TrackContext = {
  saved: string[];
  rejected: string[];
  restrictions: Pick<Restriction, 'id' | 'kind' | 'strength' | 'target_type' | 'track_id' | 'artist_id' | 'genre_id' | 'text_value'>[];
  playlists: { id: string; title: string }[];
  moments: { id: string; name_he: string; name_en: string }[];
  readOnly?: boolean;
};

export function TrackList({ tracks, ctx, compare = true, emptyText }: { tracks: Track[]; ctx: TrackContext; compare?: boolean; emptyText?: string }) {
  const { m, locale } = useI18n();
  const [saved, setSaved] = useState(() => new Set(ctx.saved));
  const [rejected, setRejected] = useState(() => new Set(ctx.rejected));
  const [active, setActive] = useState<Track | null>(null);
  const [comparing, setComparing] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const errMsg = (code: string) => (m.errors as Record<string, string>)[code] ?? m.common.error;

  const pref = (t: Track, p: 'save' | 'unsave' | 'reject' | 'unreject') => start(async () => {
    const r = await setTrackPreference(t.id, p);
    if (!r.ok) return toast(errMsg(r.error), 'error');
    setSaved((s) => { const n = new Set(s); if (p === 'save') n.add(t.id); else if (p === 'unsave' || p === 'reject') n.delete(t.id); return n; });
    setRejected((s) => { const n = new Set(s); if (p === 'reject') n.add(t.id); else if (p === 'unreject' || p === 'save') n.delete(t.id); return n; });
    toast(p === 'save' ? m.discover.saved : p === 'reject' ? m.discover.rejected : m.common.saved);
  });

  if (!tracks.length) return emptyText ? <p className="gutter text-paper-dim">{emptyText}</p> : null;
  const cmpTracks = tracks.filter((t) => comparing.includes(t.id));

  return (
    <>
      <ul className="flex flex-col">
        {tracks.map((t) => {
          const r = restrictionFor(t, ctx.restrictions as Restriction[]);
          const blocked = r?.kind === 'never_play' && r.strength === 'absolute';
          const src = playableSource(t);
          const isSaved = saved.has(t.id);
          return (
            <li key={t.id} className={cx('gutter flex items-center gap-3 py-2.5 border-b border-line/50 last:border-0', rejected.has(t.id) && 'opacity-50')}>
              <button type="button" onClick={() => setActive(t)} className="flex items-center gap-3 min-w-0 flex-1 text-start" aria-haspopup="dialog">
                <Cover seed={t.id} label={t.title} src={t.artwork_url} size={52} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold truncate" dir="auto">{t.title}</span>
                  <span className="block text-sm text-paper-dim truncate" dir="auto">{t.artist?.name}</span>
                  <span className="flex flex-wrap gap-1.5 mt-1">
                    {blocked && <Badge tone="danger"><IconBan size={12} />{m.discover.neverBlocked}</Badge>}
                    {r?.kind === 'never_play' && r.strength === 'preference' && <Badge tone="danger">{m.discover.neverPref}</Badge>}
                    {r?.kind === 'must_play' && <Badge tone="gold"><IconStar size={12} />{m.discover.mustPlay}</Badge>}
                    {t.energy && <span className="text-[11px] text-paper-dim">{m.discover.energyLevels[t.energy]}</span>}
                    {t.genre && <span className="text-[11px] text-paper-dim">· {locale === 'he' ? t.genre.name_he : t.genre.name_en}</span>}
                  </span>
                </span>
              </button>
              {compare && (
                <button type="button" aria-pressed={comparing.includes(t.id)} aria-label={`${m.discover.compare}: ${t.title}`}
                  onClick={() => setComparing((c) => c.includes(t.id) ? c.filter((x) => x !== t.id) : c.length >= 3 ? c : [...c, t.id])}
                  className={cx('hidden sm:grid size-9 place-items-center rounded-full', comparing.includes(t.id) ? 'bg-paper text-ink' : 'text-paper-dim hover:bg-ink-3')}>
                  <IconCompare size={18} />
                </button>
              )}
              {src && <PlayToggle source={src} size="sm" />}
              {!ctx.readOnly && (
                <button type="button" disabled={pending} onClick={() => pref(t, isSaved ? 'unsave' : 'save')}
                  aria-pressed={isSaved} aria-label={`${isSaved ? m.discover.saved : m.discover.save}: ${t.title}`}
                  className={cx('size-11 grid place-items-center rounded-full transition-colors', isSaved ? 'text-ember' : 'text-paper-dim hover:text-paper')}>
                  <IconHeart filled={isSaved} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {compare && comparing.length > 0 && (
        <div className="fixed z-40 inset-x-0 bottom-[calc(var(--nav-h)+var(--player-h)+var(--safe-b)+8px)] md:bottom-24 flex justify-center px-4">
          <div className="card flex items-center gap-3 px-3 py-2 shadow-[var(--shadow-hard)]">
            <span className="text-sm font-bold">{m.discover.compare} · {comparing.length}/3</span>
            <Button size="sm" onClick={() => setShowCompare(true)} disabled={comparing.length < 2}>{m.discover.compare}</Button>
            <Button size="sm" variant="ghost" onClick={() => setComparing([])}>{m.common.clear}</Button>
          </div>
        </div>
      )}

      <Sheet open={showCompare} onClose={() => setShowCompare(false)} title={m.discover.compareTitle} wide>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cmpTracks.length}, minmax(0,1fr))` }}>
          {cmpTracks.map((t) => {
            const src = playableSource(t);
            return (
              <div key={t.id} className="flex flex-col gap-2 min-w-0">
                <Cover seed={t.id} label={t.title} src={t.artwork_url} size={96} />
                <p className="font-bold leading-tight" dir="auto">{t.title}</p>
                <p className="text-sm text-paper-dim" dir="auto">{t.artist?.name}</p>
                <dl className="text-sm flex flex-col gap-1 mt-1">
                  <div><dt className="label">{m.track.genre}</dt><dd>{t.genre ? (locale === 'he' ? t.genre.name_he : t.genre.name_en) : '—'}</dd></div>
                  <div><dt className="label">{m.track.energy}</dt><dd>{t.energy ? `${m.discover.energyLevels[t.energy]} (${t.energy}/5)` : '—'}</dd></div>
                  <div><dt className="label">{m.track.language}</dt><dd>{t.language ? (m.discover.languages as Record<string, string>)[t.language] : '—'}</dd></div>
                  <div><dt className="label">{m.track.era}</dt><dd>{t.decade ? m.discover.decade.replace('{decade}', String(t.decade).slice(locale === 'he' ? 2 : 0)) : '—'}</dd></div>
                </dl>
                {src && <PlayToggle source={src} size="sm" />}
                {!ctx.readOnly && <Button size="sm" variant={saved.has(t.id) ? 'gold' : 'secondary'} onClick={() => pref(t, saved.has(t.id) ? 'unsave' : 'save')}>{saved.has(t.id) ? m.discover.saved : m.discover.save}</Button>}
              </div>
            );
          })}
        </div>
      </Sheet>

      {active && <TrackSheet track={active} ctx={ctx} onClose={() => setActive(null)} isSaved={saved.has(active.id)} isRejected={rejected.has(active.id)} onPref={(p) => pref(active, p)} />}
    </>
  );
}

function TrackSheet({ track: t, ctx, onClose, isSaved, isRejected, onPref }: {
  track: Track; ctx: TrackContext; onClose: () => void; isSaved: boolean; isRejected: boolean; onPref: (p: 'save' | 'unsave' | 'reject' | 'unreject') => void;
}) {
  const { m, locale, fmt } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [mode, setMode] = useState<'main' | 'playlist' | 'moment'>('main');
  const [newName, setNewName] = useState('');
  const [busy, start] = useTransition();
  const src = playableSource(t);
  const r = restrictionFor(t, ctx.restrictions as Restriction[]);
  const errMsg = (code: string) => (m.errors as Record<string, string>)[code] ?? m.common.error;

  const add = (playlistId: string, name: string) => start(async () => {
    const res = await addToPlaylist(playlistId, t.id);
    if (!res.ok) return toast(errMsg(res.error), 'error');
    toast(fmt(m.playlists.added, { name })); onClose(); router.refresh();
  });
  const createAndAdd = () => start(async () => {
    const res = await createPlaylist({ title: newName.trim(), purpose: 'other' });
    if (!res.ok) return toast(errMsg(res.error), 'error');
    const r2 = await addToPlaylist(res.data.id, t.id);
    if (!r2.ok) return toast(errMsg(r2.error), 'error');
    toast(fmt(m.playlists.added, { name: newName.trim() })); onClose(); router.refresh();
  });
  const moment = (momentId: string, how: 'shortlist' | 'primary' | 'backup') => start(async () => {
    const res = await saveSelection(momentId, how === 'primary' ? { primary_track_id: t.id } : how === 'backup' ? { backup_track_id: t.id } : { addShortlist: t.id });
    if (!res.ok) return toast(errMsg(res.error), 'error');
    toast(m.common.saved); onClose(); router.refresh();
  });

  return (
    <Sheet open onClose={onClose} title={mode === 'playlist' ? m.discover.addToPlaylist : mode === 'moment' ? m.discover.addToMoment : t.title}>
      {mode === 'main' && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <Cover seed={t.id} label={t.title} src={t.artwork_url} size={88} />
            <div className="min-w-0">
              <p className="display text-xl leading-tight" dir="auto">{t.title}</p>
              <p className="text-paper-dim" dir="auto">{t.artist?.name}</p>
              <p className="text-sm text-paper-dim mt-1">
                {[t.genre && (locale === 'he' ? t.genre.name_he : t.genre.name_en), t.energy && m.discover.energyLevels[t.energy], t.decade && String(t.decade)].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          {r && <Badge tone={r.kind === 'must_play' ? 'gold' : 'danger'}>{r.kind === 'must_play' ? m.discover.mustPlay : r.strength === 'absolute' ? m.discover.neverBlocked : m.discover.neverPref}</Badge>}
          {src ? (
            <div className="flex items-center gap-3"><PlayToggle source={src} size="lg" /><span className="font-bold">{src.kind === 'licensed_preview' ? m.discover.preview : m.discover.play}</span></div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="label">{m.discover.listen}</p>
              <div className="flex flex-wrap gap-2">
                {externalOptions(t).map((o) => (
                  <a key={o.url} href={o.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-line font-bold text-sm hover:border-paper">
                    <IconExternal size={16} />{o.isSearch ? fmt(m.discover.searchOn, { service: o.service }) : o.service}
                  </a>
                ))}
              </div>
              <p className="text-xs text-paper-dim">{m.discover.externalNote}</p>
            </div>
          )}
          {!ctx.readOnly && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant={isSaved ? 'gold' : 'primary'} onClick={() => onPref(isSaved ? 'unsave' : 'save')}><IconHeart size={18} filled={isSaved} />{isSaved ? m.discover.saved : m.discover.save}</Button>
              <Button variant="secondary" onClick={() => onPref(isRejected ? 'unreject' : 'reject')}><IconBan size={18} />{isRejected ? m.discover.rejected : m.discover.reject}</Button>
              <Button variant="ghost" className="border border-line" onClick={() => setMode('playlist')}><IconList size={18} />{m.discover.addToPlaylist}</Button>
              <Button variant="ghost" className="border border-line" onClick={() => setMode('moment')}><IconStar size={18} />{m.discover.addToMoment}</Button>
            </div>
          )}
        </div>
      )}
      {mode === 'playlist' && (
        <div className="flex flex-col gap-3">
          {ctx.playlists.map((p) => (
            <button key={p.id} type="button" disabled={busy} onClick={() => add(p.id, p.title)} className="card h-14 px-4 flex items-center justify-between font-bold hover:border-paper text-start">
              <span dir="auto">{p.title}</span><IconPlus size={18} />
            </button>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createAndAdd(); }} className="flex gap-2 mt-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={m.playlists.create} aria-label={m.playlists.name} maxLength={120} />
            <Button type="submit" disabled={busy || !newName.trim()}>{m.common.create}</Button>
          </form>
          <Button variant="ghost" onClick={() => setMode('main')}>{m.common.back}</Button>
        </div>
      )}
      {mode === 'moment' && (
        <div className="flex flex-col gap-3">
          {ctx.moments.map((mo) => (
            <div key={mo.id} className="card p-3 flex flex-col gap-2">
              <p className="font-bold">{locale === 'he' ? mo.name_he : mo.name_en}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => moment(mo.id, 'shortlist')}><IconPlus size={14} />{m.moments.addShortlist}</Button>
                <Button size="sm" disabled={busy} onClick={() => moment(mo.id, 'primary')}><IconCheck size={14} />{m.moments.setPrimary}</Button>
                <Button size="sm" variant="ghost" className="border border-line" disabled={busy} onClick={() => moment(mo.id, 'backup')}>{m.moments.setBackup}</Button>
              </div>
            </div>
          ))}
          <Button variant="ghost" onClick={() => setMode('main')}>{m.common.back}</Button>
        </div>
      )}
    </Sheet>
  );
}
