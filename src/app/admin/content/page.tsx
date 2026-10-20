import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { formatDate } from '@/i18n/format';
import { Badge, Cover, DemoBadge, EmptyState, PageHeader } from '@/components/ui';
import { cmsStrings } from '../_cms/strings';
import { ContentActions, NewContentButton, type ContentRow } from './ContentEditor';

export default async function ContentAdmin() {
  const s = await requireRole('admin');
  const { m, locale } = await getI18n();
  const t = cmsStrings(locale);
  const db = await supabaseServer();
  const [{ data }, { data: djs }, { data: events }] = await Promise.all([
    db.from('content_items').select('id, kind, title, description, creator_dj_id, artwork_url, media_url, external_url, duration_seconds, genre_tags, status, visibility, visible_event_id, is_featured, is_demo')
      .eq('company_id', s.company.id).order('updated_at', { ascending: false }).limit(200),
    db.from('djs').select('id, display_name').eq('company_id', s.company.id).order('sort_order').order('display_name'),
    db.from('wedding_events').select('id, partner_one_name, partner_two_name, wedding_date').eq('company_id', s.company.id)
      .order('wedding_date', { ascending: false, nullsFirst: false }).limit(300),
  ]);
  const rows = (data ?? []) as ContentRow[];
  const djOpts = (djs ?? []).map((d) => ({ id: d.id as string, label: d.display_name as string }));
  const evOpts = (events ?? []).map((e) => ({
    id: e.id as string,
    label: [[e.partner_one_name, e.partner_two_name].filter(Boolean).join(' & '), e.wedding_date ? formatDate(e.wedding_date as string, locale) : null].filter(Boolean).join(' · '),
  }));
  const djName = new Map(djOpts.map((d) => [d.id, d.label]));
  const evName = new Map(evOpts.map((e) => [e.id, e.label]));
  const statusLabel: Record<string, string> = { draft: m.common.draft, published: m.common.published, archived: m.common.archived };

  return (
    <div className="pb-16">
      <PageHeader title={m.admin.content} actions={<NewContentButton djs={djOpts} events={evOpts} />} />
      <div className="gutter">
        {rows.length === 0 ? <EmptyState title={t.emptyContent} /> : (
          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Cover seed={r.id} label={r.title} src={r.artwork_url} size={56} />
                  <div className="min-w-0">
                    <p className="font-bold truncate" dir="auto">{r.title}</p>
                    <p className="text-sm text-paper-dim truncate">
                      {(m.radio.kinds as Record<string, string>)[r.kind] ?? r.kind}
                      {r.creator_dj_id && djName.get(r.creator_dj_id) ? ` · ${djName.get(r.creator_dj_id)}` : ''}
                      {r.duration_seconds ? ` · ${Math.round(r.duration_seconds / 60)} ${t.minutes}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge tone={r.status === 'published' ? 'ok' : r.status === 'archived' ? 'danger' : 'neutral'}>{statusLabel[r.status]}</Badge>
                      <Badge>{r.visibility === 'company' ? m.admin.visibilityCompany : `${m.admin.visibilityEvent}${r.visible_event_id && evName.get(r.visible_event_id) ? ` · ${evName.get(r.visible_event_id)}` : ''}`}</Badge>
                      {r.is_featured && <Badge tone="gold">★ {m.admin.featured}</Badge>}
                      {r.is_demo && <DemoBadge label={m.common.demo} />}
                    </div>
                  </div>
                </div>
                <ContentActions row={r} djs={djOpts} events={evOpts} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
