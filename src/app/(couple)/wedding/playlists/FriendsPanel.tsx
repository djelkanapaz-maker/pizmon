'use client';
import { useTransition } from 'react';
import { useHydrated } from '@/components/useHydrated';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { useToast } from '@/components/overlay';
import { Button, Cover } from '@/components/ui';
import { IconCopy, IconPlus, IconX } from '@/components/icons';
import { SpotifyPlayButton } from '@/components/audio/SpotifyPlayer';
import { createShareLink, handleFriendSuggestion, revokeShareLink } from '@/server/actions/share';

export type FriendSuggestion = { id: string; friend_name: string; message: string | null; spotify_track_id: string; title: string; artists: string | null; artwork_url: string | null; created_at: string };

/** "Friends help pick": the share link, and suggestions waiting for the couple. */
export function FriendsPanel({ token, suggestions }: { token: string | null; suggestions: FriendSuggestion[] }) {
  const { m, fmt } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [busy, start] = useTransition();
  const hydrated = useHydrated();
  const url = token && hydrated ? `${window.location.origin}/s/${token}` : '';

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) => start(async () => {
    const r = await fn();
    if (!r.ok) return toast(m.common.error, 'error');
    if (done) toast(done);
    router.refresh();
  });
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast(m.friends.copied); } catch { toast(url); }
  };

  return (
    <section id="friends" className="gutter mt-10 flex flex-col gap-4 scroll-mt-24">
      <div className="card p-4 md:p-5 flex flex-col gap-3">
        <h2 className="display text-xl">{m.friends.title}</h2>
        <p className="text-sm text-paper-dim">{m.friends.sub}</p>
        {!token ? (
          <Button onClick={() => run(() => createShareLink())} disabled={busy} className="self-start">{m.friends.create}</Button>
        ) : (
          <>
            <p className="text-sm font-mono break-all bg-ink-2 rounded-[10px] px-3 py-2" dir="ltr">{url}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={copy} disabled={!url}><IconCopy size={16} />{m.friends.copy}</Button>
              <a className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-bold bg-[#25D366] text-ink" target="_blank" rel="noopener noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`${m.friends.waText} ${url}`)}`}>{m.friends.whatsapp}</a>
              <Button size="sm" variant="ghost" className="border border-line" disabled={busy} onClick={() => run(() => createShareLink(true))}>{m.friends.rotate}</Button>
              <Button size="sm" variant="ghost" className="border border-line" disabled={busy} onClick={() => { if (confirm(m.friends.revokeConfirm)) run(() => revokeShareLink()); }}>{m.friends.revoke}</Button>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="label">{m.friends.suggestions} {suggestions.length > 0 && <span className="text-gold">· {suggestions.length}</span>}</p>
        {suggestions.length === 0 ? <p className="text-sm text-paper-dim">{m.friends.noSuggestions}</p> : (
          <ul className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <li key={s.id} className="card p-3 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Cover seed={s.spotify_track_id} label={s.title} src={s.artwork_url} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate" dir="auto">{s.title}</p>
                    <p className="text-sm text-paper-dim truncate" dir="auto">{s.artists}</p>
                  </div>
                  <SpotifyPlayButton trackId={s.spotify_track_id} title={s.title} />
                  <button type="button" disabled={busy} onClick={() => run(() => handleFriendSuggestion(s.id, 'add', m.playlists.ours), m.friends.added)}
                    aria-label={`${m.friends.add}: ${s.title}`} className="size-11 grid place-items-center rounded-full border border-line text-paper hover:border-paper"><IconPlus size={18} /></button>
                  <button type="button" disabled={busy} onClick={() => run(() => handleFriendSuggestion(s.id, 'dismiss'))}
                    aria-label={`${m.friends.dismiss}: ${s.title}`} className="size-9 grid place-items-center rounded-full text-paper-dim hover:bg-ink-3"><IconX size={16} /></button>
                </div>
                <p className="text-sm" dir="auto"><span className="text-gold font-bold">{fmt(m.friends.from, { name: s.friend_name })}</span>{s.message ? <span className="text-paper-dim"> · {s.message}</span> : null}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
