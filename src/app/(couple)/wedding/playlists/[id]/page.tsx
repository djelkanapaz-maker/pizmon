import { notFound } from 'next/navigation';
import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { TRACK_SELECT, type Track } from '@/server/queries';
import { ButtonLink, PageHeader } from '@/components/ui';
import { PlaylistEditor } from '../PlaylistControls';

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireCouple();
  const { m } = await getI18n();
  const db = await supabaseServer();
  const { data: pl } = await db.from('playlists').select(`id, title, purpose, shared_with_dj, playlist_tracks(id, position, status, note, track:music_tracks(${TRACK_SELECT}))`)
    .eq('id', id).eq('event_id', s.eventId).eq('kind', 'couple').maybeSingle();
  if (!pl) notFound();
  const items = ((pl.playlist_tracks ?? []) as unknown as { id: string; position: number; status: 'tentative' | 'confirmed' | 'backup'; note: string | null; track: Track | null }[])
    .filter((x) => x.track).sort((a, b) => a.position - b.position) as { id: string; position: number; status: 'tentative' | 'confirmed' | 'backup'; note: string | null; track: Track }[];
  return (
    <div>
      <PageHeader back={{ href: '/wedding/playlists', label: m.playlists.title }} title={pl.title} actions={<ButtonLink href="/discover" size="sm" variant="secondary">{m.discover.title}</ButtonLink>} />
      <PlaylistEditor playlist={{ id: pl.id, title: pl.title, purpose: pl.purpose, shared_with_dj: pl.shared_with_dj }} items={items} />
    </div>
  );
}
