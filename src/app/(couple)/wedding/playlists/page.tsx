import Link from 'next/link';
import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt, relativeTime } from '@/i18n/format';
import { Badge, Cover, EmptyState, PageHeader } from '@/components/ui';
import { NewPlaylistButton } from './PlaylistControls';

export default async function PlaylistsPage() {
  const s = await requireCouple();
  const { m, locale } = await getI18n();
  const db = await supabaseServer();
  const { data } = await db.from('playlists').select('id, title, purpose, shared_with_dj, updated_at, playlist_tracks(status)').eq('event_id', s.eventId).eq('kind', 'couple').order('created_at');
  const lists = (data ?? []) as unknown as { id: string; title: string; purpose: string | null; shared_with_dj: boolean; updated_at: string; playlist_tracks: { status: string }[] }[];
  return (
    <div>
      <PageHeader back={{ href: '/wedding', label: m.wedding.title }} title={m.playlists.title} sub={m.playlists.notFinal} actions={<NewPlaylistButton />} />
      {lists.length === 0 ? <div className="gutter"><EmptyState title={m.playlists.empty} /></div> : (
        <ul className="gutter grid sm:grid-cols-2 gap-3">
          {lists.map((p) => (
            <li key={p.id}>
              <Link href={`/wedding/playlists/${p.id}`} className="card p-4 flex items-center gap-4 hover:border-paper-dim">
                <Cover seed={p.id} label={p.title} size={72} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate" dir="auto">{p.title}</p>
                  <p className="text-sm text-paper-dim">{fmt(m.playlists.tracks, { count: p.playlist_tracks.length })} · {relativeTime(p.updated_at, locale)}</p>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {p.purpose && <Badge>{(m.playlists.purposes as Record<string, string>)[p.purpose] ?? p.purpose}</Badge>}
                    <Badge tone={p.shared_with_dj ? 'ok' : 'neutral'}>{p.shared_with_dj ? m.playlists.shared : m.playlists.notShared}</Badge>
                    {p.playlist_tracks.some((t) => t.status === 'confirmed') && <Badge tone="gold">{p.playlist_tracks.filter((t) => t.status === 'confirmed').length} {m.playlists.confirmed}</Badge>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
