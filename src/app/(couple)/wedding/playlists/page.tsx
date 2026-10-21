import Link from 'next/link';
import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/format';
import { TRACK_SELECT, type Track } from '@/server/queries';
import { ButtonLink, Cover, EmptyState, PageHeader } from '@/components/ui';
import { PlaylistEditor } from './PlaylistControls';

/** The couple's one playlist: every pick from the Music library lands here. */
export default async function PlaylistsPage() {
  const s = await requireCouple();
  const { m } = await getI18n();
  const db = await supabaseServer();
  const { data } = await db.from('playlists')
    .select(`id, title, purpose, shared_with_dj, is_main, playlist_tracks(id, position, status, note, track:music_tracks(${TRACK_SELECT}))`)
    .eq('event_id', s.eventId).eq('kind', 'couple').order('created_at');
  type Row = { id: string; title: string; purpose: string | null; shared_with_dj: boolean; is_main: boolean; playlist_tracks: { id: string; position: number; status: 'tentative' | 'confirmed' | 'backup'; note: string | null; track: Track | null }[] };
  const lists = (data ?? []) as unknown as Row[];
  const main = lists.find((p) => p.is_main);
  const others = lists.filter((p) => !p.is_main);
  const items = (main?.playlist_tracks ?? []).filter((x) => x.track).sort((a, b) => a.position - b.position) as { id: string; position: number; status: 'tentative' | 'confirmed' | 'backup'; note: string | null; track: Track }[];
  return (
    <div>
      <PageHeader back={{ href: '/wedding', label: m.wedding.title }} title={m.playlists.ours} sub={m.playlists.oursSub}
        actions={<ButtonLink href="/discover" size="sm" variant="secondary">{m.discover.title}</ButtonLink>} />
      {main && items.length > 0
        ? <PlaylistEditor playlist={{ id: main.id, title: main.title, purpose: main.purpose, shared_with_dj: main.shared_with_dj }} items={items} isMain />
        : <div className="gutter"><EmptyState title={m.playlists.emptyOurs} /></div>}
      {others.length > 0 && (
        <section className="gutter mt-10">
          <p className="label mb-3">{m.playlists.others}</p>
          <ul className="grid sm:grid-cols-2 gap-3">
            {others.map((p) => (
              <li key={p.id}>
                <Link href={`/wedding/playlists/${p.id}`} className="card p-3 flex items-center gap-3 hover:border-paper-dim">
                  <Cover seed={p.id} label={p.title} size={48} />
                  <span className="min-w-0 flex-1"><span className="block font-bold truncate" dir="auto">{p.title}</span>
                    <span className="block text-sm text-paper-dim">{fmt(m.playlists.tracks, { count: p.playlist_tracks.length })}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
