import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { col } from '@/core/i18n-text';
import { Badge, EmptyState, PageHeader } from '@/components/ui';
import { cmsStrings } from '../_cms/strings';
import { MomentActions, NewMomentButton, type MomentRow } from './MomentEditor';

export default async function MomentsAdmin() {
  const s = await requireRole('admin');
  const { m, locale } = await getI18n();
  const t = cmsStrings(locale);
  const db = await supabaseServer();
  const [{ data }, { data: counts }] = await Promise.all([
    db.from('wedding_moments').select('id, slug, name_he, name_en, description_he, description_en, sort_order, is_required, is_active, has_language_collections')
      .eq('company_id', s.company.id).order('sort_order').order('slug'),
    db.from('moment_tracks').select('moment_id, moment:wedding_moments!inner(company_id)').eq('moment.company_id', s.company.id),
  ]);
  const rows = (data ?? []) as MomentRow[];
  const tracksPer = new Map<string, number>();
  for (const c of counts ?? []) tracksPer.set(c.moment_id as string, (tracksPer.get(c.moment_id as string) ?? 0) + 1);

  return (
    <div className="pb-16">
      <PageHeader title={m.admin.moments} actions={<NewMomentButton />} />
      <div className="gutter">
        {rows.length === 0 ? <EmptyState title={t.emptyMoments} /> : (
          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-paper-dim tabular text-sm">#{r.sort_order}</span>
                    <p className="font-bold">{col(r, 'name', locale)}</p>
                    {r.is_required ? <Badge tone="ember">{m.admin.required}</Badge> : <Badge>{m.moments.optional}</Badge>}
                    {!r.is_active && <Badge tone="danger">{t.inactive}</Badge>}
                    {r.has_language_collections && <Badge tone="gold">{m.moments.he} / {m.moments.intl}</Badge>}
                    <Badge>{tracksPer.get(r.id) ?? 0} ♪</Badge>
                  </div>
                  <p className="text-xs text-paper-dim mt-1" dir="ltr">{r.slug}</p>
                  {col(r, 'description', locale) && <p className="text-sm text-paper-dim mt-1">{col(r, 'description', locale)}</p>}
                </div>
                <MomentActions row={r} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
