'use client';
/**
 * In-app playback for catalog tracks that come from Spotify, through Spotify's official
 * embed (iFrame API). One embed for the whole app, docked above the navigation.
 * Spotify decides the length: full songs for listeners signed in to Spotify in this
 * browser, otherwise a 30-second preview.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '@/i18n/client';
import { IconPause, IconPlay, IconX } from '../icons';
import { cx } from '../ui';
import { useAudio } from './AudioProvider';

type Controller = {
  loadUri: (uri: string) => void; play: () => void; pause: () => void; resume: () => void; togglePlay: () => void; destroy: () => void;
  addListener: (e: string, cb: (ev: { data: { isPaused?: boolean; isBuffering?: boolean; playingURI?: string } }) => void) => void;
};
type IFrameAPI = { createController: (el: HTMLElement, opts: { uri: string; width?: string | number; height?: number }, cb: (c: Controller) => void) => void };
declare global { interface Window { onSpotifyIframeApiReady?: (api: IFrameAPI) => void; __spotifyIframeApi?: IFrameAPI } }

type Ctx = { current: string | null; paused: boolean; toggle: (trackId: string) => void; close: () => void };
const SpotifyCtx = createContext<Ctx | null>(null);
export const useSpotifyPlayer = () => useContext(SpotifyCtx);

const ID = /^[A-Za-z0-9]{22}$/;
let apiPromise: Promise<IFrameAPI> | null = null;
function loadApi(): Promise<IFrameAPI> {
  if (window.__spotifyIframeApi) return Promise.resolve(window.__spotifyIframeApi);
  apiPromise ??= new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = (api) => { window.__spotifyIframeApi = api; resolve(api); };
    const s = document.createElement('script');
    s.src = 'https://open.spotify.com/embed/iframe-api/v1';
    s.async = true;
    s.onerror = () => { apiPromise = null; reject(new Error('spotify_embed')); };
    document.body.appendChild(s);
  });
  return apiPromise;
}

export function SpotifyPlayerProvider({ children }: { children: ReactNode }) {
  const { m } = useI18n();
  const audio = useAudio();
  const host = useRef<HTMLDivElement | null>(null);
  const ctrl = useRef<Controller | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);
  const [open, setOpen] = useState(false);
  // Safari on iPhone blocks starting audio inside the Spotify embed without a tap in it
  const [needsTap, setNeedsTap] = useState(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // the app's own player and the Spotify embed never play at the same time
  const audioPlaying = audio.status === 'playing';
  useEffect(() => { if (audioPlaying) ctrl.current?.pause(); }, [audioPlaying]);
  useEffect(() => {
    document.documentElement.dataset.spotify = open ? 'on' : 'off';
  }, [open]);

  // Spotify drops play() calls made while a new track is still loading, so playback is
  // started from the embed's "ready" event for the most recently requested track.
  const pending = useRef<string | null>(null);
  const creating = useRef<Promise<void> | null>(null);
  const start = useCallback(async (trackId: string) => {
    if (!ID.test(trackId)) return;
    const uri = `spotify:track:${trackId}`;
    if (audio.source) audio.stop();
    setOpen(true); setCurrent(trackId); setPaused(false);
    pending.current = uri;
    setNeedsTap(false);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { if (pending.current === uri) setNeedsTap(true); }, 3000);
    if (ctrl.current) { ctrl.current.loadUri(uri); return; }
    if (!creating.current) {
      creating.current = (async () => {
        const api = await loadApi();
        if (!host.current) return;
        const mount = document.createElement('div');
        host.current.replaceChildren(mount);
        await new Promise<void>((resolve) => api.createController(mount, { uri, width: '100%', height: 80 }, (c) => {
          ctrl.current = c;
          c.addListener('ready', () => {
            if (!pending.current) return;
            c.play();
            const want = pending.current;
            // retry once if the embed ignored the first call
            setTimeout(() => { if (pending.current === want) c.play(); }, 1500);
          });
          c.addListener('playback_update', (e) => {
            setPaused(!!e.data.isPaused);
            if (!e.data.isPaused) setNeedsTap(false);
            if (pending.current && e.data.playingURI === pending.current && !e.data.isPaused) pending.current = null;
          });
          resolve();
        }));
      })().catch(() => { creating.current = null; });
    }
    await creating.current;
    // a different track was requested while the player was being created
    const c = ctrl.current as Controller | null;
    if (c && pending.current && pending.current !== uri) c.loadUri(pending.current);
  }, [audio]);

  const toggle = useCallback((trackId: string) => {
    if (current === trackId && ctrl.current && !pending.current) { ctrl.current.togglePlay(); return; }
    void start(trackId);
  }, [current, start]);

  const close = useCallback(() => {
    pending.current = null; setNeedsTap(false); ctrl.current?.pause(); setOpen(false); setPaused(true);
  }, []);

  const value = useMemo(() => ({ current: open ? current : null, paused, toggle, close }), [current, open, paused, toggle, close]);
  return (
    <SpotifyCtx.Provider value={value}>
      {children}
      <div className={cx('fixed inset-x-0 z-40 bottom-[calc(var(--nav-h)+var(--safe-b)+4px)] md:bottom-4 md:inset-x-auto md:end-4 md:w-[420px] px-2 md:px-0', !open && 'invisible pointer-events-none h-0 overflow-hidden')}
        aria-hidden={!open} role="region" aria-label={m.player.nowPlaying}>
        {needsTap && <p role="status" className="mb-1.5 mx-auto w-fit rounded-full bg-ember text-ink text-xs font-bold px-3 py-1.5 shadow-[var(--shadow-hard)] animate-rise">{m.player.tapSpotify}</p>}
        <div className={cx('relative rounded-[14px] overflow-hidden bg-ink-2 shadow-[var(--shadow-hard)]', needsTap && 'ring-2 ring-ember')}>
          <div ref={host} className="h-[80px]" />
          <button type="button" onClick={close} aria-label={m.player.close}
            className="absolute top-1 end-1 size-7 grid place-items-center rounded-full bg-black/60 text-paper hover:bg-black/80"><IconX size={14} /></button>
        </div>
      </div>
    </SpotifyCtx.Provider>
  );
}

/** Play/pause button for a Spotify-backed track. */
export function SpotifyPlayButton({ trackId, title, size = 'sm' }: { trackId: string; title: string; size?: 'sm' | 'md' | 'lg' }) {
  const p = useSpotifyPlayer();
  const { m } = useI18n();
  if (!p || !ID.test(trackId)) return null;
  const playing = p.current === trackId && !p.paused;
  const dim = { sm: 'size-9', md: 'size-11', lg: 'size-14' }[size];
  return (
    <button type="button" onClick={() => p.toggle(trackId)} aria-pressed={playing}
      aria-label={`${playing ? m.player.pause : m.player.play}: ${title}`}
      className={cx(dim, 'shrink-0 rounded-full grid place-items-center transition-colors', playing ? 'bg-paper text-ink' : 'bg-ember text-ink hover:bg-[#ffdc33]')}>
      {playing ? <IconPause size={size === 'lg' ? 22 : 16} /> : <IconPlay size={size === 'lg' ? 22 : 16} />}
    </button>
  );
}
