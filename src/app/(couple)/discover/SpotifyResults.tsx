'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { useToast } from '@/components/overlay';
import { Cover, cx } from '@/components/ui';
import { IconCheck, IconPlus } from '@/components/icons';
import { SpotifyPlayButton } from '@/components/audio/SpotifyPlayer';
import { addSpotifyToOurPlaylist } from '@/server/actions/couple';
import type { SpotifySearchHit } from '@/server/spotify';

/** Songs from Spotify's whole catalog that aren't in the company library yet. */
export function SpotifyResults({ hits, added }: { hits: SpotifySearchHit[]; added: string[] }) {
  const { m } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [done, setDone] = useState(() => new Set(added));
  const [busy, start] = useTransition();
  const add = (h: SpotifySearchHit) => start(async () => {
    const r = await addSpotifyToOurPlaylist(h.id, m.playlists.ours);
    if (!r.ok) return toast((m.errors as Record<string, string>)[r.error] ?? m.common.error, 'error');
    setDone((s) => new Set(s).add(h.id));
    toast(m.playlists.addedOurs); router.refresh();
  });
  if (!hits.length) return null;
  return (
    <section className="mt-8" aria-labelledby="sp-results">
      <p id="sp-results" className="gutter label mb-1">{m.discover.fromSpotify}</p>
      <p className="gutter text-xs text-paper-dim mb-2">{m.discover.fromSpotifyHint}</p>
      <ul className="flex flex-col">
        {hits.map((h) => {
          const isIn = done.has(h.id);
          return (
            <li key={h.id} className="gutter flex items-center gap-3 py-2.5 border-b border-line/50 last:border-0">
              <Cover seed={h.id} label={h.title} src={h.artworkUrl} size={52} />
              <span className="min-w-0 flex-1">
                <span className="block font-bold truncate" dir="auto">{h.title}</span>
                <span className="block text-sm text-paper-dim truncate" dir="auto">{h.artists}</span>
              </span>
              <SpotifyPlayButton trackId={h.id} title={h.title} />
              <button type="button" disabled={busy || isIn} onClick={() => add(h)} aria-pressed={isIn}
                aria-label={`${isIn ? m.playlists.inOurs : m.playlists.addOurs}: ${h.title}`}
                className={cx('size-11 grid place-items-center rounded-full transition-colors', isIn ? 'bg-gold text-ink' : 'text-paper-dim hover:text-paper border border-line')}>
                {isIn ? <IconCheck size={18} /> : <IconPlus size={18} />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
