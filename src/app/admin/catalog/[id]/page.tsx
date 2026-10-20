import { notFound } from 'next/navigation';
import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { col } from '@/core/i18n-text';
import { Badge, DemoBadge, PageHeader } from '@/components/ui';
import { cmsStrings } from '../../_cms/strings';
import { DeleteTrack, TrackForm, TrackMomentsEditor, TrackTagsEditor, type TrackFormValue } from '../TrackForm';

export default async function TrackAdmin({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole('admin');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { m, locale } = await getI18n();
  const t = cmsStrings(locale);
  const db = await supabaseServer();
  const [{ data: track }, { data: genres }, { data: tags }, { data: moments }, { data: tt }, { data: mt }] = await Promise.all([
    db.from('music_tracks').select('*, artist:artists(name)').eq('id', id).eq('company_id', s.company.id).maybeSingle(),
    db.from('genres').select('id, name_he, name_en').eq('company_id', s.company.id).order('sort_order').order('name_en'),
    db.from('tags').select('id, kind, name_he, name_en').eq('company_id', s.company.id).order('sort_order').order('name_en'),
    db.from('wedding_moments').select('id, name_he, name_en, has_language_collections').eq('company_id', s.company.id).order('sort_order'),
    db.from('track_tags').select('tag_id').eq('track_id', id),
    db.from('moment_tracks').select('moment_id, collection').eq('track_id', id),
  ]);
  if (!track) notFound();
  const value: TrackFormValue = {
    id: track.id, title: track.title, artist_name: (track.artist as { name: string } | null)?.name ?? '', album: track.album, genre_id: track.genre_id,
    energy: track.energy, language: track.language, decade: track.decade, artwork_url: track.artwork_url, provider: track.provider,
    provider_track_id: track.provider_track_id, preview_url: track.preview_url, playback_url: track.playback_url, external_url: track.external_url,
    rights_status: track.rights_status, rights_notes: track.rights_notes, status: track.status,
  };
  const opt = (r: { id: string; name_he: string; name_en: string }) => ({ id: r.id, label: col(r, 'name', locale) });
  const statusLabel: Record<string, string> = { draft: m.common.draft, published: m.common.published, archived: m.common.archived };

  return (
    <div className="pb-16">
      <PageHeader title={track.title} kicker={value.artist_name} back={{ href: '/admin/catalog', label: m.admin.catalog }}
        actions={<DeleteTrack id={track.id} />} />
      <div className="gutter -mt-2 mb-6 flex flex-wrap gap-2">
        <Badge tone={track.status === 'published' ? 'ok' : 'neutral'}>{statusLabel[track.status]}</Badge>
        <Badge tone="gold">{m.admin.rightsLevels[track.rights_status as keyof typeof m.admin.rightsLevels]}</Badge>
        {track.is_demo && <DemoBadge label={m.common.demo} />}
      </div>
      <div className="gutter grid lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] gap-6 items-start">
        <section className="card p-5" aria-label={m.common.details}>
          <TrackForm track={value} genres={(genres ?? []).map(opt)} />
        </section>
        <div className="flex flex-col gap-6">
          <section className="card p-5">
            <h2 className="display text-xl mb-4">{t.tagsTitle}</h2>
            <TrackTagsEditor trackId={track.id} selected={(tt ?? []).map((x) => x.tag_id as string)}
              categories={(tags ?? []).filter((x) => x.kind === 'category').map(opt)} moods={(tags ?? []).filter((x) => x.kind === 'mood').map(opt)} />
          </section>
          <section className="card p-5">
            <h2 className="display text-xl mb-4">{t.momentsTitle}</h2>
            <TrackMomentsEditor trackId={track.id}
              moments={(moments ?? []).map((x) => ({ ...opt(x), collections: !!x.has_language_collections }))}
              selected={(mt ?? []).map((x) => ({ moment_id: x.moment_id as string, collection: (x.collection as 'he' | 'intl' | null) ?? null }))} />
          </section>
        </div>
      </div>
    </div>
  );
}
