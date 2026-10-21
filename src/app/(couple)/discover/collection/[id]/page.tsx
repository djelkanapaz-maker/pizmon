import { notFound } from 'next/navigation';
import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/format';
import { TRACK_SELECT, type Track } from '@/server/queries';
import { getTrackContext } from '@/server/track-context';
import { Cover, PageHeader, Badge } from '@/components/ui';
import { TrackList } from '@/components/music/TrackList';

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireCouple();
  const { m } = await getI18n();
  const db = await supabaseServer();
  const { data: pl } = await db.from('playlists').select(`id, title, description, kind, artwork_url, dj:djs(display_name), playlist_tracks(position, track:music_tracks(${TRACK_SELECT}))`)
    .eq('id', id).in('kind', ['editorial', 'dj']).maybeSingle();
  if (!pl) notFound();
  const ctx = await getTrackContext(s.eventId, s.company.id);
  const tracks = ((pl.playlist_tracks ?? []) as unknown as { position: number; track: Track | null }[])
    .sort((a, b) => a.position - b.position).map((x) => x.track).filter(Boolean) as Track[];
  return (
    <div>
      <PageHeader back={{ href: '/discover', label: m.discover.title }} title={pl.title} sub={pl.description ?? undefined}
        kicker={(pl.dj as unknown as { display_name: string } | null)?.display_name ?? m.playlists.editorial} />
      <div className="gutter -mt-2 mb-6 flex items-center gap-4">
        <Cover seed={pl.id} label={pl.title} src={pl.artwork_url} size={96} />
        <Badge>{fmt(m.playlists.tracks, { count: tracks.length })}</Badge>
      </div>
      <TrackList tracks={tracks} ctx={ctx} />
    </div>
  );
}
