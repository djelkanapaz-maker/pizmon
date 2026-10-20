import { notFound } from 'next/navigation';
import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/format';
import { PageHeader } from '@/components/ui';
import { cmsStrings } from '../../_cms/strings';
import { PlaylistFlags, PlaylistHeaderActions, PlaylistTrackSearch, PlaylistTracks, type PlaylistRow, type PlaylistTrackRow } from '../PlaylistForms';

export default async function PlaylistAdmin({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole('admin');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { m, locale } = await getI18n();
  const t = cmsStrings(locale);
  const db = await supabaseServer();
  const [{ data: pl }, { data: items }] = await Promise.all([
    db.from('playlists').select('id, title, description, purpose, status, is_featured').eq('id', id).eq('company_id', s.company.id).eq('kind', 'editorial').maybeSingle(),
    db.from('playlist_tracks').select('track_id, position, track:music_tracks(title, status, is_demo, artist:artists(name))').eq('playlist_id', id).order('position').order('created_at'),
  ]);
  if (!pl) notFound();
  type Item = { track_id: string; track: { title: string; status: string; is_demo: boolean; artist: { name: string } | null } | null };
  const tracks: PlaylistTrackRow[] = ((items ?? []) as unknown as Item[]).map((x) => ({
    track_id: x.track_id, title: x.track?.title ?? '—', artist: x.track?.artist?.name ?? null, is_demo: !!x.track?.is_demo, status: x.track?.status ?? 'draft',
  }));
  const row = pl as PlaylistRow;

  return (
    <div className="pb-16">
      <PageHeader title={row.title} sub={row.description ?? undefined} kicker={m.playlists.editorial}
        back={{ href: '/admin/playlists', label: m.admin.playlists }} />
      <div className="gutter -mt-2 mb-6 flex flex-wrap items-center justify-between gap-3">
        <PlaylistFlags row={row} />
        <PlaylistHeaderActions row={row} />
      </div>
      <div className="gutter grid lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] gap-6 items-start">
        <section className="card p-5" aria-labelledby="pl-tracks">
          <h2 id="pl-tracks" className="display text-xl mb-3">{t.tracksTitle} <span className="text-paper-dim text-base">· {fmt(m.playlists.tracks, { count: tracks.length })}</span></h2>
          <PlaylistTracks playlistId={row.id} tracks={tracks} />
        </section>
        <section className="card p-5">
          <PlaylistTrackSearch playlistId={row.id} existing={tracks.map((x) => x.track_id)} />
        </section>
      </div>
    </div>
  );
}
