import Link from 'next/link';
import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/format';
import { col } from '@/core/i18n-text';
import { Badge, ButtonLink, DemoBadge, EmptyState, Input, PageHeader } from '@/components/ui';
import { cmsStrings } from '../_cms/strings';
import { AddTrackButton } from './TrackForm';

const PAGE = 30;

type Row = {
  id: string; title: string; energy: number | null; language: string | null; rights_status: 'metadata_only' | 'preview_licensed' | 'full_licensed' | 'company_owned';
  status: 'draft' | 'published' | 'archived'; is_demo: boolean; artist: { name: string } | null; genre: { name_he: string; name_en: string } | null;
};

export default async function CatalogAdmin({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const s = await requireRole('admin');
  const { m, locale } = await getI18n();
  const t = cmsStrings(locale);
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const db = await supabaseServer();

  let query = db.from('music_tracks')
    .select('id, title, energy, language, rights_status, status, is_demo, artist:artists(name), genre:genres(name_he, name_en)', { count: 'exact' })
    .eq('company_id', s.company.id);
  if (q) {
    // PostgREST "or" filter: escape characters that would break the filter grammar
    const safe = q.replace(/[%_,()*\\]/g, ' ').trim();
    const { data: artists } = await db.from('artists').select('id').eq('company_id', s.company.id).ilike('name', `%${safe}%`).limit(50);
    const ids = (artists ?? []).map((a) => a.id as string);
    query = query.or([`title.ilike.%${safe}%`, ids.length ? `artist_id.in.(${ids.join(',')})` : null].filter(Boolean).join(','));
  }
  const [{ data, count, error }, { data: genres }] = await Promise.all([
    query.order('updated_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1),
    db.from('genres').select('id, name_he, name_en').eq('company_id', s.company.id).order('sort_order').order('name_en'),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (p: number) => `/admin/catalog?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;
  const statusTone = { draft: 'neutral', published: 'ok', archived: 'danger' } as const;
  const statusLabel = { draft: m.common.draft, published: m.common.published, archived: m.common.archived };
  const rightsTone = { metadata_only: 'neutral', preview_licensed: 'gold', full_licensed: 'ember', company_owned: 'ok' } as const;

  return (
    <div className="pb-16">
      <PageHeader title={m.admin.catalog} sub={fmt(t.tracksCount, { count: total })}
        actions={<AddTrackButton genres={(genres ?? []).map((g) => ({ id: g.id as string, label: col(g, 'name', locale) }))} />} />
      <form className="gutter mb-4 flex gap-2" role="search" action="/admin/catalog">
        <label htmlFor="cat-q" className="sr-only">{m.common.search}</label>
        <Input id="cat-q" name="q" type="search" defaultValue={q} placeholder={t.searchTracks} dir="auto" className="flex-1" />
        <button className="h-12 px-5 rounded-full border-2 border-paper font-bold hover:bg-paper hover:text-ink shrink-0">{m.common.search}</button>
      </form>
      {error && <p className="gutter mb-4 text-danger">{m.common.error}</p>}
      <div className="gutter">
        {rows.length === 0 ? (
          <EmptyState title={q ? t.noMatches : t.noTracks} />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-start border-b border-line">
                  {[m.admin.trackTitle, m.admin.artist, t.genre, t.energy, t.language, m.admin.rights, m.common.status].map((h) => (
                    <th key={h} scope="col" className="label text-start font-bold px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-ink-3/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/catalog/${r.id}`} className="font-bold hover:text-ember inline-flex items-center gap-2" dir="auto">{r.title}</Link>
                      {r.is_demo && <span className="ms-2"><DemoBadge label={m.common.demo} /></span>}
                    </td>
                    <td className="px-4 py-3" dir="auto">{r.artist?.name ?? '—'}</td>
                    <td className="px-4 py-3">{r.genre ? col(r.genre, 'name', locale) : '—'}</td>
                    <td className="px-4 py-3 tabular">{r.energy ?? '—'}</td>
                    <td className="px-4 py-3">{r.language ? (m.discover.languages as Record<string, string>)[r.language] ?? r.language : '—'}</td>
                    <td className="px-4 py-3"><Badge tone={rightsTone[r.rights_status]}>{m.admin.rightsLevels[r.rights_status]}</Badge></td>
                    <td className="px-4 py-3"><Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <nav className="flex items-center justify-between gap-3 mt-4" aria-label={fmt(t.page, { n: page, total: pages })}>
            {page > 1 ? <ButtonLink href={href(page - 1)} variant="secondary" size="sm">{t.prev}</ButtonLink> : <span />}
            <span className="text-sm text-paper-dim tabular">{fmt(t.page, { n: page, total: pages })}</span>
            {page < pages ? <ButtonLink href={href(page + 1)} variant="secondary" size="sm">{t.next}</ButtonLink> : <span />}
          </nav>
        )}
      </div>
    </div>
  );
}
