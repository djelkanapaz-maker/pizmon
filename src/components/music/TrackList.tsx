'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { restrictionFor, type Restriction } from '@/core/restrictions';
import { saveSelection, setTrackPreference, toggleOurPlaylist } from '@/server/actions/couple';
import { Sheet, useToast } from '@/components/overlay';
import { Badge, Button, Cover, cx } from '@/components/ui';
import { TrackPlay } from './TrackPlay';
import { IconBan, IconCheck, IconCompare, IconExternal, IconPlus, IconStar } from '@/components/icons';
import { externalOptions, playableSource } from './listening';
import type { Track } from '@/server/queries';

export type TrackContext = {
  saved: string[];
  rejected: string[];
  restrictions: Pick<Restriction, 'id' | 'kind' | 'strength' | 'target_type' | 'track_id' | 'artist_id' | 'genre_id' | 'text_value'>[];
  playlists: { id: string; title: string }[];
  /** track ids already in the couple's main playlist */
  ours?: string[];
  moments: { id: string; name_he: string; name_en: string }[];
  readOnly?: boolean;
};

export function TrackList({ tracks, ctx, compare = true, emptyText }: { tracks: Track[]; ctx: TrackContext; compare?: boolean; emptyText?: string }) {
  const { m, locale } = useI18n();
  const [rejected, setRejected] = useState(() => new Set(ctx.rejected));
  const [ours, setOurs] = useState(() => new Set(ctx.ours ?? []));
  const [active, setActive] = useState<Track | null>(null);
  const [comparing, setComparing] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const errMsg = (code: string) => (m.errors as Record<string, string>)[code] ?? m.common.error;

  const pref = (t: Track, p: 'save' | 'unsave' | 'reject' | 'unreject') => start(async () => {
    const r = await setTrackPreference(t.id, p);
    if (!r.ok) return toast(errMsg(r.error), 'error');
    setRejected((s) => { const n = new Set(s); if (p === 'reject') n.add(t.id); else if (p === 'unreject' || p === 'save') n.delete(t.id); return n; });
    toast(p === 'save' ? m.discover.saved : p === 'reject' ? m.discover.rejected : m.common.saved);
  });

  const toggleOurs = (t: Track) => start(async () => {
    const add = !ours.has(t.id);
    const r = await toggleOurPlaylist(t.id, add, m.playlists.ours);
    if (!r.ok) return toast(errMsg(r.error), 'error');
    setOurs((s) => { const n = new Set(s); if (add) n.add(t.id); else n.delete(t.id); return n; });
    toast(add ? m.playlists.addedOurs : m.playlists.removedOurs);
  });

  if (!tracks.length) return emptyText ? <p className="gutter text-paper-dim">{emptyText}</p> : null;
  const cmpTracks = tracks.filter((t) => comparing.includes(t.id));

  return (
    <>
      <ul className="flex flex-col">
        {tracks.map((t) => {
          const r = restrictionFor(t, ctx.restrictions as Restriction[]);
          const blocked = r?.kind === 'never_play' && r.strength === 'absolute';
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
              <TrackPlay track={t} />
              {!ctx.readOnly && (
                <button type="button" disabled={pending} onClick={() => toggleOurs(t)}
                  aria-pressed={ours.has(t.id)} aria-label={`${ours.has(t.id) ? m.playlists.inOurs : m.playlists.addOurs}: ${t.title}`}
                  className={cx('size-11 grid place-items-center rounded-full transition-colors', ours.has(t.id) ? 'bg-gold text-ink' : 'text-paper-dim hover:text-paper border border-line')}>
                  {ours.has(t.id) ? <IconCheck size={18} /> : <IconPlus size={18} />}
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
                <TrackPlay track={t} />
                {!ctx.readOnly && <Button size="sm" variant={ours.has(t.id) ? 'gold' : 'secondary'} onClick={() => toggleOurs(t)}>{ours.has(t.id) ? <IconCheck size={14} /> : <IconPlus size={14} />}{ours.has(t.id) ? m.playlists.inOurs : m.playlists.addOurs}</Button>}
              </div>
            );
          })}
        </div>
      </Sheet>

      {active && <TrackSheet track={active} ctx={ctx} onClose={() => setActive(null)} isRejected={rejected.has(active.id)} onPref={(p) => pref(active, p)} inOurs={ours.has(active.id)} onOurs={() => toggleOurs(active)} />}
    </>
  );
}

function TrackSheet({ track: t, ctx, onClose, isRejected, onPref, inOurs, onOurs }: {
  track: Track; ctx: TrackContext; onClose: () => void; isRejected: boolean; onPref: (p: 'save' | 'unsave' | 'reject' | 'unreject') => void;
  inOurs: boolean; onOurs: () => void;
}) {
  const { m, locale, fmt } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [mode, setMode] = useState<'main' | 'moment'>('main');
  const [busy, start] = useTransition();
  const src = playableSource(t);
  const r = restrictionFor(t, ctx.restrictions as Restriction[]);
  const errMsg = (code: string) => (m.errors as Record<string, string>)[code] ?? m.common.error;

  const moment = (momentId: string, how: 'shortlist' | 'primary') => start(async () => {
    const res = await saveSelection(momentId, how === 'primary' ? { primary_track_id: t.id } : { addShortlist: t.id });
    if (!res.ok) return toast(errMsg(res.error), 'error');
    toast(m.common.saved); onClose(); router.refresh();
  });

  return (
    <Sheet open onClose={onClose} title={mode === 'moment' ? m.discover.addToMoment : t.title}>
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
          {src || (t.provider === 'spotify' && t.provider_track_id) ? (
            <div className="flex items-center gap-3"><TrackPlay track={t} size="lg" /><span className="font-bold">{src?.kind === 'licensed_preview' ? m.discover.preview : m.discover.play}</span></div>
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
              <Button variant={inOurs ? 'gold' : 'primary'} className="col-span-2" onClick={onOurs}>{inOurs ? <IconCheck size={18} /> : <IconPlus size={18} />}{inOurs ? m.playlists.inOurs : m.playlists.addOurs}</Button>
              <Button variant="secondary" onClick={() => onPref(isRejected ? 'unreject' : 'reject')}><IconBan size={18} />{isRejected ? m.discover.rejected : m.discover.reject}</Button>
              <Button variant="ghost" className="border border-line" onClick={() => setMode('moment')}><IconStar size={18} />{m.discover.addToMoment}</Button>
            </div>
          )}
        </div>
      )}
      {mode === 'moment' && (
        <div className="flex flex-col gap-3">
          {ctx.moments.map((mo) => (
            <div key={mo.id} className="card p-3 flex flex-col gap-2">
              <p className="font-bold">{locale === 'he' ? mo.name_he : mo.name_en}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => moment(mo.id, 'shortlist')}><IconPlus size={14} />{m.moments.addShortlist}</Button>
                <Button size="sm" disabled={busy} onClick={() => moment(mo.id, 'primary')}><IconCheck size={14} />{m.moments.choose}</Button>
              </div>
            </div>
          ))}
          <Button variant="ghost" onClick={() => setMode('main')}>{m.common.back}</Button>
        </div>
      )}
    </Sheet>
  );
}
