import Link from 'next/link';
import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/format';
import { Badge, EmptyState, PageHeader } from '@/components/ui';
import { IconChevron } from '@/components/icons';
import { cmsStrings } from '../_cms/strings';
import { NewPlaylistButton } from './PlaylistForms';

export default async function PlaylistsAdmin() {
  const s = await requireRole('admin');
  const { m, locale } = await getI18n();
  const t = cmsStrings(locale);
  const db = await supabaseServer();
  const { data } = await db.from('playlists').select('id, title, purpose, status, is_featured, playlist_tracks(count)')
    .eq('company_id', s.company.id).eq('kind', 'editorial').order('is_featured', { ascending: false }).order('updated_at', { ascending: false });
  const rows = (data ?? []) as unknown as { id: string; title: string; purpose: string | null; status: string; is_featured: boolean; playlist_tracks: { count: number }[] }[];
  const statusLabel: Record<string, string> = { draft: m.common.draft, published: m.common.published, archived: m.common.archived };

  return (
    <div className="pb-16">
      <PageHeader title={m.admin.playlists} actions={<NewPlaylistButton />} />
      <div className="gutter">
        {rows.length === 0 ? <EmptyState title={t.emptyPlaylists} /> : (
          <ul className="flex flex-col gap-2">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/playlists/${p.id}`} className="card p-4 flex items-center gap-3 hover:border-paper-dim transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate" dir="auto">{p.title}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge tone={p.status === 'published' ? 'ok' : p.status === 'archived' ? 'danger' : 'neutral'}>{statusLabel[p.status]}</Badge>
                      {p.is_featured && <Badge tone="gold">★ {m.admin.featured}</Badge>}
                      {p.purpose && <Badge>{(m.playlists.purposes as Record<string, string>)[p.purpose] ?? p.purpose}</Badge>}
                      <Badge>{fmt(m.playlists.tracks, { count: p.playlist_tracks?.[0]?.count ?? 0 })}</Badge>
                    </div>
                  </div>
                  <IconChevron size={18} className="text-paper-dim shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
