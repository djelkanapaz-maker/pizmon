'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useI18n } from '@/i18n/client';
import { Sheet, useToast } from '@/components/overlay';
import { Button, Cover, Field, Input, Textarea, cx } from '@/components/ui';
import { IconCheck, IconPlus } from '@/components/icons';
import { SpotifyPlayButton } from '@/components/audio/SpotifyPlayer';
import { shareSearch, shareSuggest } from '@/server/actions/share';
import type { SpotifySearchHit } from '@/server/spotify';

export type ShareTrack = { title: string; artist: string | null; artwork: string | null; spotify: string | null };
const NAME_KEY = 'pizmon-friend-name';

export function ShareClient({ token, names, tracks }: { token: string; names: string; tracks: ShareTrack[] }) {
  const { m, fmt } = useI18n();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SpotifySearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [pick, setPick] = useState<SpotifySearchHit | null>(null);
  // the friend's name is remembered on this device (read lazily; the form only renders after a tap)
  const [name, setName] = useState(() => { try { return typeof window === 'undefined' ? '' : localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; } });
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<Set<string>>(() => new Set());
  const [busy, start] = useTransition();
  const seq = useRef(0);
  const inPlaylist = new Set(tracks.map((t) => t.spotify).filter(Boolean));

  useEffect(() => {
    const query = q.trim();
    const n = ++seq.current;
    if (query.length < 2) return;
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await shareSearch(token, query);
      if (n !== seq.current) return;
      setSearching(false);
      if (r.ok) setHits(r.data); else toast(r.error === 'not_found' ? m.friends.invalid : m.common.error, 'error');
    }, 350);
    return () => clearTimeout(t);
  }, [q, token, toast, m]);

  const send = () => start(async () => {
    if (!pick) return;
    const r = await shareSuggest(token, { name, message: message || undefined, spotifyId: pick.id });
    if (!r.ok) return toast(r.error === 'limit' ? m.friends.limit : r.error === 'not_found' ? m.friends.invalid : m.common.error, 'error');
    try { localStorage.setItem(NAME_KEY, name.trim()); } catch { /* storage unavailable */ }
    setSent((s) => new Set(s).add(pick.id));
    setPick(null); setMessage('');
    toast(fmt(m.friends.thanks, { names }));
  });

  return (
    <div className="gutter max-w-2xl mx-auto pt-8 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="display-l" dir="auto">{fmt(m.friends.pageTitle, { names })}</h1>
        <p className="text-paper-dim">{m.friends.pageSub}</p>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="share-search">
        <label id="share-search" htmlFor="share-q" className="sr-only">{m.friends.searchPlaceholder}</label>
        <Input id="share-q" type="search" value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < 2) setHits([]); }} placeholder={m.friends.searchPlaceholder} dir="auto" autoComplete="off" />
        {searching && <p className="text-sm text-paper-dim">{m.common.loading}</p>}
        {hits.length > 0 && (
          <ul className="flex flex-col">
            {hits.map((h) => {
              const done = sent.has(h.id) || inPlaylist.has(h.id);
              return (
                <li key={h.id} className="flex items-center gap-3 py-2.5 border-b border-line/50 last:border-0">
                  <Cover seed={h.id} label={h.title} src={h.artworkUrl} size={52} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold truncate" dir="auto">{h.title}</span>
                    <span className="block text-sm text-paper-dim truncate" dir="auto">{h.artists}</span>
                  </span>
                  <SpotifyPlayButton trackId={h.id} title={h.title} />
                  <button type="button" disabled={done} onClick={() => setPick(h)} aria-label={`${done ? m.friends.suggested : m.friends.suggest}: ${h.title}`}
                    className={cx('h-11 px-4 rounded-full text-sm font-bold flex items-center gap-1.5 transition-colors', done ? 'bg-gold text-ink' : 'border border-line text-paper hover:border-paper')}>
                    {done ? <IconCheck size={16} /> : <IconPlus size={16} />}{done ? m.friends.suggested : m.friends.suggest}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="display text-xl">{m.friends.theirPlaylist} <span className="text-paper-dim text-base">({tracks.length})</span></h2>
        {tracks.length === 0 ? <p className="text-paper-dim">{m.friends.emptyPlaylist}</p> : (
          <ol className="flex flex-col">
            {tracks.map((t, i) => (
              <li key={`${t.spotify ?? t.title}-${i}`} className="flex items-center gap-3 py-2 border-b border-line/50 last:border-0">
                <span className="w-6 text-center text-sm text-paper-dim tabular">{i + 1}</span>
                <Cover seed={t.spotify ?? t.title} label={t.title} src={t.artwork} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold truncate" dir="auto">{t.title}</span>
                  <span className="block text-sm text-paper-dim truncate" dir="auto">{t.artist}</span>
                </span>
                {t.spotify && <SpotifyPlayButton trackId={t.spotify} title={t.title} />}
              </li>
            ))}
          </ol>
        )}
      </section>

      <Sheet open={!!pick} onClose={() => setPick(null)} title={m.friends.suggest}>
        {pick && (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <div className="flex items-center gap-3">
              <Cover seed={pick.id} label={pick.title} src={pick.artworkUrl} size={64} />
              <div className="min-w-0"><p className="font-bold truncate" dir="auto">{pick.title}</p><p className="text-sm text-paper-dim truncate" dir="auto">{pick.artists}</p></div>
            </div>
            <Field label={m.friends.yourName} htmlFor="f-name"><Input id="f-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} dir="auto" autoComplete="given-name" /></Field>
            <Field label={m.friends.message} htmlFor="f-msg"><Textarea id="f-msg" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} className="min-h-20" dir="auto" /></Field>
            <Button type="submit" size="lg" disabled={busy || !name.trim()}>{busy ? m.common.saving : m.friends.send}</Button>
          </form>
        )}
      </Sheet>
    </div>
  );
}
