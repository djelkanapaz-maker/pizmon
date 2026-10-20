import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt, formatDateTime } from '@/i18n/format';
import { Badge, EmptyState, PageHeader } from '@/components/ui';
import { cmsStrings } from '../_cms/strings';
import { DraftEditor, NewVersionButton } from './VersionEditor';

type Version = { id: string; version: number; definition: unknown; published_at: string | null; created_at: string };

export default async function QuestionnaireAdmin() {
  const s = await requireRole('admin');
  const { m, locale } = await getI18n();
  const t = cmsStrings(locale);
  const db = await supabaseServer();
  const { data: versionsData } = await db.from('questionnaire_versions')
    .select('id, version, definition, published_at, created_at, questionnaire:questionnaires!inner(company_id, is_active)')
    .eq('questionnaire.company_id', s.company.id).order('version', { ascending: false });
  const versions = (versionsData ?? []) as unknown as Version[];
  const counts = new Map<string, number>();
  await Promise.all(versions.map(async (v) => {
    const { count } = await db.from('questionnaire_responses').select('id', { count: 'exact', head: true }).eq('version_id', v.id);
    counts.set(v.id, count ?? 0);
  }));
  const latestPublished = versions.find((v) => v.published_at)?.id;

  return (
    <div className="pb-16">
      <PageHeader title={m.admin.questionnaire} sub={m.admin.immutable} actions={<NewVersionButton />} />
      <div className="gutter flex flex-col gap-4">
        {versions.length === 0 ? <EmptyState title={t.noVersions} /> : versions.map((v) => (
          <details key={v.id} className="card group" open={!v.published_at}>
            <summary className="p-4 flex flex-wrap items-center gap-3 cursor-pointer list-none">
              <span className="display text-xl">{fmt(m.admin.version, { n: v.version })}</span>
              {v.published_at ? <Badge tone="ok">{m.common.published}</Badge> : <Badge tone="gold">{m.common.draft}</Badge>}
              {v.id === latestPublished && <Badge tone="ember">{t.current}</Badge>}
              <Badge>{fmt(m.admin.responsesOn, { count: counts.get(v.id) ?? 0 })}</Badge>
              <span className="text-sm text-paper-dim ms-auto tabular">{v.published_at ? formatDateTime(v.published_at, locale) : `${m.admin.created} ${formatDateTime(v.created_at, locale)}`}</span>
            </summary>
            <div className="px-4 pb-4">
              {v.published_at ? (
                <>
                  <p className="text-sm text-paper-dim mb-3">{m.admin.immutable}</p>
                  <pre dir="ltr" className="text-xs bg-ink-3 rounded-[12px] p-4 overflow-auto max-h-[60dvh] whitespace-pre">{JSON.stringify(v.definition, null, 2)}</pre>
                </>
              ) : (
                <DraftEditor versionId={v.id} initial={JSON.stringify(v.definition, null, 2)} />
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
