'use client';
import { useI18n } from '@/i18n/client';
import { IconPause, IconPlay, IconX } from '../icons';
import { cx, Badge } from '../ui';
import { useAudio, type AudioSource } from './AudioProvider';

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function MiniPlayer() {
  const { source, status, toggle, stop, position, duration, seek } = useAudio();
  const { m } = useI18n();
  if (!source) return null;
  const playing = status === 'playing';
  const busy = status === 'loading' || status === 'reconnecting';
  const isStream = source.kind === 'live_stream' || source.kind === 'demo_stream';
  return (
    <div className="fixed inset-x-0 z-40 bottom-[calc(var(--nav-h)+var(--safe-b))] md:bottom-4 md:inset-x-auto md:end-4 md:w-[380px]">
      <div className="mx-2 md:mx-0 h-[60px] rounded-[16px] bg-paper text-ink flex items-center gap-3 px-2 shadow-[var(--shadow-hard)] relative overflow-hidden">
        {!isStream && duration > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-[3px] bg-ink/10">
            <div className="h-full bg-ember" style={{ width: `${(position / duration) * 100}%` }} />
          </div>
        )}
        <button type="button" onClick={() => toggle()} aria-label={playing ? m.player.pause : m.player.play}
          className="size-11 shrink-0 rounded-full bg-ink text-paper grid place-items-center">
          {busy ? <span className="size-4 rounded-full border-2 border-paper border-t-transparent animate-spin" /> : playing ? <IconPause size={18} /> : <IconPlay size={18} />}
        </button>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-60 flex items-center gap-2">
            {status === 'error' ? m.player.error : status === 'reconnecting' ? m.radio.reconnecting : m.player.nowPlaying}
            {source.kind === 'live_stream' && <Badge tone="danger" className="h-5">{m.radio.live}</Badge>}
            {source.kind === 'demo_stream' && <Badge tone="neutral" className="h-5 bg-ink/10 text-ink">{m.radio.demo}</Badge>}
          </p>
          <p className="font-bold truncate leading-tight">{source.title}</p>
        </div>
        {!isStream && duration > 0 && (
          <label className="hidden sm:flex items-center text-xs tabular gap-2">
            <span className="sr-only">seek</span>
            <input type="range" min={0} max={duration} value={position} onChange={(e) => seek(Number(e.target.value))} className="w-20 accent-ember" />
            {fmtTime(position)}
          </label>
        )}
        <button type="button" onClick={stop} aria-label={m.player.close} className="size-10 shrink-0 grid place-items-center rounded-full hover:bg-ink/10"><IconX size={18} /></button>
      </div>
    </div>
  );
}

export function PlayToggle({ source, label, className, size = 'md' }: { source: AudioSource; label?: string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const { source: cur, status, toggle } = useAudio();
  const { m } = useI18n();
  const active = cur?.id === source.id;
  const playing = active && status === 'playing';
  const busy = active && (status === 'loading' || status === 'reconnecting');
  const dim = { sm: 'size-9', md: 'size-11', lg: 'size-14' }[size];
  return (
    <button type="button" onClick={() => toggle(source)} aria-pressed={playing}
      aria-label={`${playing ? m.player.pause : m.player.play}: ${label ?? source.title}`}
      className={cx(dim, 'shrink-0 rounded-full grid place-items-center transition-colors', playing ? 'bg-paper text-ink' : 'bg-ember text-ink hover:bg-[#ffdc33]', className)}>
      {busy ? <span className="size-4 rounded-full border-2 border-ink border-t-transparent animate-spin" /> : playing ? <IconPause size={size === 'lg' ? 22 : 16} /> : <IconPlay size={size === 'lg' ? 22 : 16} />}
    </button>
  );
}
