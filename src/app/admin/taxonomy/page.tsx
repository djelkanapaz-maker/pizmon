import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { PageHeader } from '@/components/ui';
import { cmsStrings } from '../_cms/strings';
import { NamedList, type NamedRow } from './NamedList';

export default async function TaxonomyAdmin() {
  const s = await requireRole('admin');
  const { m, locale } = await getI18n();
  const t = cmsStrings(locale);
  const db = await supabaseServer();
  const [{ data: genres }, { data: tags }] = await Promise.all([
    db.from('genres').select('id, slug, name_he, name_en, sort_order').eq('company_id', s.company.id).order('sort_order').order('slug'),
    db.from('tags').select('id, kind, slug, name_he, name_en, sort_order').eq('company_id', s.company.id).order('sort_order').order('slug'),
  ]);
  const tagRows = (tags ?? []) as (NamedRow & { kind: string })[];
  return (
    <div className="pb-16">
      <PageHeader title={m.admin.taxonomy} />
      <div className="gutter flex flex-col gap-6">
        <NamedList kind="genre" title={t.genres} addLabel={m.admin.newGenre} rows={(genres ?? []) as NamedRow[]} />
        <NamedList kind="category" title={t.categories} addLabel={m.admin.newTag} rows={tagRows.filter((x) => x.kind === 'category')} />
        <NamedList kind="mood" title={t.moods} addLabel={t.newMood} rows={tagRows.filter((x) => x.kind === 'mood')} />
      </div>
    </div>
  );
}
