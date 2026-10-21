'use client';
import { useState } from 'react';
import { fmt } from '@/i18n/format';
import { Badge, Button, Textarea } from '@/components/ui';
import { adminImportSpotify, adminSyncAllSpotify, type SpotifyImportResult } from '@/server/actions/admin-cms';
import { useCms, useRun } from '../_cms/client';

export function SpotifyImport({ hasLinked }: { hasLinked: boolean }) {
  const { s } = useCms();
  const { busy, run } = useRun();
  const [text, setText] = useState('');
  const [results, setResults] = useState<SpotifyImportResult[] | null>(null);
  return (
    <section className="card p-4 flex flex-col gap-3 mb-6" aria-labelledby="sp-title">
      <h2 id="sp-title" className="display text-xl">{s.spotifyTitle}</h2>
      <p className="text-sm text-paper-dim">{s.spotifyHelp}</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} dir="ltr" className="min-h-24 text-sm" aria-label={s.spotifyTitle}
        placeholder="https://open.spotify.com/playlist/…" />
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !text.trim()} onClick={() => run(() => adminImportSpotify(text), { onOk: (d) => { setResults(d); setText(''); } })}>{s.spotifyImport}</Button>
        {hasLinked && <Button variant="secondary" disabled={busy} onClick={() => run(() => adminSyncAllSpotify(), { onOk: setResults })}>{s.spotifySyncAll}</Button>}
        {busy && <span className="self-center size-4 rounded-full border-2 border-paper-dim border-t-transparent animate-spin" aria-hidden />}
      </div>
      {results && (
        <ul className="flex flex-col gap-1 text-sm" aria-live="polite">
          {results.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2">
              {r.ok ? <span dir="auto">✓ {fmt(s.spotifyResult, { title: r.title ?? r.id, count: r.tracks ?? 0 })}</span> : <span className="text-danger" dir="ltr">✕ {s.spotifyFailed}: {r.id}</span>}
              {r.truncated && <Badge tone="danger">{s.spotifyTruncated}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
