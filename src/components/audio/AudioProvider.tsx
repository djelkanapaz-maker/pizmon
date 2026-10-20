'use client';
/**
 * Shared audio layer. Exactly one HTMLAudioElement exists for the whole app, so two
 * players can never overlap. Sources are typed by what they are (live stream, demo
 * stream, company mix, licensed preview, licensed full track) so the UI never
 * presents something as live or licensed when it isn't.
 *
 * Native note: a future Expo client implements the same `AudioSource` contract with
 * expo-audio (background audio + lock-screen controls via the OS audio session).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type AudioKind = 'live_stream' | 'demo_stream' | 'company_mix' | 'licensed_preview' | 'licensed_full';
export type AudioSource = { id: string; kind: AudioKind; url: string; title: string; subtitle?: string };
export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error' | 'reconnecting';

type Ctx = {
  source: AudioSource | null;
  status: PlayerStatus;
  volume: number;
  position: number;
  duration: number;
  play: (s: AudioSource) => void;
  toggle: (s?: AudioSource) => void;
  stop: () => void;
  setVolume: (v: number) => void;
  seek: (t: number) => void;
};
const AudioCtx = createContext<Ctx | null>(null);
export const useAudio = () => {
  const c = useContext(AudioCtx);
  if (!c) throw new Error('useAudio outside AudioProvider');
  return c;
};

const isStream = (k: AudioKind) => k === 'live_stream' || k === 'demo_stream';

export function AudioProvider({ children }: { children: ReactNode }) {
  const el = useRef<HTMLAudioElement | null>(null);
  const retries = useRef(0);
  const [source, setSource] = useState<AudioSource | null>(null);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [volume, setVol] = useState(1);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const sourceRef = useRef<AudioSource | null>(null);
  useEffect(() => { sourceRef.current = source; }, [source]);

  useEffect(() => {
    const a = new Audio();
    a.preload = 'none';
    el.current = a;
    const on = (e: string, f: () => void) => a.addEventListener(e, f);
    on('playing', () => { retries.current = 0; setStatus('playing'); });
    on('pause', () => setStatus((s) => (s === 'error' ? s : 'paused')));
    on('waiting', () => setStatus('loading'));
    on('timeupdate', () => setPosition(a.currentTime));
    on('durationchange', () => setDuration(Number.isFinite(a.duration) ? a.duration : 0));
    on('ended', () => {
      const s = sourceRef.current;
      if (s?.kind === 'demo_stream') { a.currentTime = 0; void a.play(); } // demo radio loops
      else setStatus('paused');
    });
    on('error', () => {
      const s = sourceRef.current;
      if (s && s.kind === 'live_stream' && retries.current < 3) {
        retries.current += 1;
        setStatus('reconnecting');
        setTimeout(() => { if (sourceRef.current?.id === s.id) { a.src = `${s.url}${s.url.includes('?') ? '&' : '?'}r=${Date.now()}`; void a.play().catch(() => setStatus('error')); } }, 1500 * retries.current);
      } else setStatus('error');
    });
    return () => { a.pause(); a.src = ''; };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.player = source ? 'on' : 'off';
    if (source && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: source.title, artist: source.subtitle ?? '' });
    }
  }, [source]);

  const play = useCallback((s: AudioSource) => {
    const a = el.current; if (!a) return;
    retries.current = 0;
    if (sourceRef.current?.id !== s.id) {
      a.src = s.url;
      a.loop = false;
      setPosition(0); setDuration(0);
      sourceRef.current = s;
      setSource(s);
    }
    setStatus('loading');
    a.play().catch(() => setStatus('error'));
  }, []);

  const toggle = useCallback((s?: AudioSource) => {
    const a = el.current; if (!a) return;
    if (s && sourceRef.current?.id !== s.id) return play(s);
    if (a.paused) {
      setStatus('loading');
      // a paused live stream would resume stale; reload it
      if (sourceRef.current && isStream(sourceRef.current.kind) && sourceRef.current.kind === 'live_stream') a.src = sourceRef.current.url;
      a.play().catch(() => setStatus('error'));
    } else a.pause();
  }, [play]);

  const stop = useCallback(() => {
    const a = el.current; if (!a) return;
    a.pause(); a.removeAttribute('src'); a.load();
    sourceRef.current = null; setSource(null); setStatus('idle');
  }, []);

  const setVolume = useCallback((v: number) => { if (el.current) el.current.volume = v; setVol(v); }, []);
  const seek = useCallback((t: number) => { if (el.current && sourceRef.current && !isStream(sourceRef.current.kind)) el.current.currentTime = t; }, []);

  const value = useMemo(() => ({ source, status, volume, position, duration, play, toggle, stop, setVolume, seek }),
    [source, status, volume, position, duration, play, toggle, stop, setVolume, seek]);
  return <AudioCtx value={value}>{children}</AudioCtx>;
}
