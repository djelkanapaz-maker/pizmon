'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { fmt } from '@/i18n/format';
import { Sheet } from '@/components/overlay';
import { Button, ErrorNote, Field, Input } from '@/components/ui';
import { importSpotifyPlaylistToOurs } from '@/server/actions/couple';

type Done = { name: string; added: number; already: number; blocked: number; skipped: number; truncated: boolean };

/** "Upload our playlist": paste a Spotify playlist link, its songs join the couple's playlist. */
export function ImportPlaylist() {
  const { m } = useI18n();
  const t = m.playlists.import;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [busy, start] = useTransition();
  const close = () => { setOpen(false); setError(null); setDone(null); setLink(''); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await importSpotifyPlaylistToOurs(link, m.playlists.ours);
      if (!r.ok) return setError((t.errors as Record<string, string>)[r.error] ?? (m.errors as Record<string, string>)[r.error] ?? m.common.error);
      setDone(r.data);
      router.refresh();
    });
  };
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{t.button}</Button>
      <Sheet open={open} onClose={close} title={t.title}>
        {done ? (
          <div className="flex flex-col gap-3" role="status">
            <p className="display-m" dir="auto">{done.name}</p>
            <p className="text-lg font-bold">{fmt(t.added, { count: done.added })}</p>
            {done.already > 0 && <p className="text-sm text-paper-dim">{fmt(t.already, { count: done.already })}</p>}
            {done.blocked > 0 && <p className="text-sm text-paper-dim">{fmt(t.blocked, { count: done.blocked })}</p>}
            {done.skipped > 0 && <p className="text-sm text-paper-dim">{fmt(t.skipped, { count: done.skipped })}</p>}
            {done.truncated && <p className="text-sm text-paper-dim">{t.truncated}</p>}
            <Button size="lg" full onClick={close} className="mt-2">{m.common.done}</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <p className="text-paper-dim">{t.sub}</p>
            {error && <ErrorNote>{error}</ErrorNote>}
            <Field label={t.label} hint={t.hint} htmlFor="pl-link">
              <Input id="pl-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://open.spotify.com/playlist/…" dir="ltr" inputMode="url" autoComplete="off" />
            </Field>
            <Button type="submit" size="lg" full disabled={busy || !link.trim()}>{busy ? t.working : t.submit}</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}
