import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { PageHeader } from '@/components/ui';
import { cmsStrings } from '../_cms/strings';
import { NamedList, type NamedRow } from './NamedList';
import { CategorySources } from './CategorySources';

export default async function TaxonomyAdmin() {
  const s = await requireRole('admin');
  const { m, locale } = await getI18n();
  const t = cmsStrings(locale);
  const db = await supabaseServer();
  const [{ data: genres }, { data: tags }, { data: sources }, { data: playlists }, { data: counts }] = await Promise.all([
    db.from('genres').select('id, slug, name_he, name_en, sort_order').eq('company_id', s.company.id).order('sort_order').order('slug'),
    db.from('tags').select('id, kind, slug, name_he, name_en, sort_order, is_hidden').eq('company_id', s.company.id).order('sort_order').order('slug'),
    db.from('category_sources').select('tag_id, playlist_id, language'),
    db.from('playlists').select('id, title, playlist_tracks(count)').eq('company_id', s.company.id).eq('kind', 'editorial').not('spotify_playlist_id', 'is', null).order('created_at'),
    db.from('track_tags').select('tag_id, tags!inner(company_id, kind)').eq('tags.company_id', s.company.id).eq('tags.kind', 'category'),
  ]);
  const countBy = new Map<string, number>();
  for (const r of (counts ?? []) as { tag_id: string }[]) countBy.set(r.tag_id, (countBy.get(r.tag_id) ?? 0) + 1);
  const pls = ((playlists ?? []) as unknown as { id: string; title: string; playlist_tracks: { count: number }[] }[])
    .map((p) => ({ id: p.id, title: p.title, tracks: p.playlist_tracks?.[0]?.count ?? 0 }));
  const tagRows = (tags ?? []) as (NamedRow & { kind: string; is_hidden: boolean })[];
  return (
    <div className="pb-16">
      <PageHeader title={m.admin.taxonomy} />
      <div className="gutter flex flex-col gap-6">
        <NamedList kind="genre" title={t.genres} addLabel={m.admin.newGenre} rows={(genres ?? []) as NamedRow[]} />
        <NamedList kind="category" title={t.categories} addLabel={m.admin.newTag} rows={tagRows.filter((x) => x.kind === 'category')} />
        <CategorySources
          playlists={pls}
          categories={tagRows.filter((x) => x.kind === 'category').map((x) => ({
            id: x.id, name: locale === 'he' ? x.name_he : x.name_en, hidden: !!x.is_hidden, tracks: countBy.get(x.id) ?? 0,
            sources: ((sources ?? []) as { tag_id: string; playlist_id: string; language: 'all' | 'he' | 'intl' }[]).filter((s2) => s2.tag_id === x.id).map((s2) => ({ playlist_id: s2.playlist_id, language: s2.language })),
          }))}
        />
        <NamedList kind="mood" title={t.moods} addLabel={t.newMood} rows={tagRows.filter((x) => x.kind === 'mood')} />
      </div>
    </div>
  );
}
