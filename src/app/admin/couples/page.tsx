import Link from 'next/link';
import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { formatDate } from '@/i18n/format';
import { Badge, DemoBadge, EmptyState, PageHeader } from '@/components/ui';
import { NewCoupleButton } from './NewCouple';
import { CoupleSearch } from './CoupleSearch';

export default async function AdminCouples({ searchParams }: { searchParams: Promise<{ q?: string; new?: string }> }) {
  const s = await requireRole('admin');
  const sp = await searchParams;
  const { m, locale } = await getI18n();
  const db = await supabaseServer();
  let query = db.from('wedding_events')
    .select('id, partner_one_name, partner_two_name, wedding_date, venue_name, is_demo, onboarding_completed_at, invite_email, dj_assignments(status, dj:djs(display_name)), questionnaire_responses(status)')
    .eq('company_id', s.company.id).order('wedding_date', { ascending: true, nullsFirst: false }).limit(200);
  const q = (sp.q ?? '').replace(/[,()*%\\]/g, ' ').trim();
  if (q) query = query.or(`partner_one_name.ilike.%${q}%,partner_two_name.ilike.%${q}%,invite_email.ilike.%${q}%,venue_name.ilike.%${q}%`);
  const [{ data: events }, { data: djs }] = await Promise.all([
    query,
    db.from('djs').select('id, display_name').eq('company_id', s.company.id).eq('is_active', true).order('sort_order'),
  ]);
  type Row = { id: string; partner_one_name: string; partner_two_name: string | null; wedding_date: string | null; venue_name: string | null; is_demo: boolean; onboarding_completed_at: string | null; invite_email: string | null;
    dj_assignments: { status: string; dj: { display_name: string } | null }[]; questionnaire_responses: { status: string } | { status: string }[] | null };
  const rows = (events ?? []) as unknown as Row[];
  return (
    <div>
      <PageHeader title={m.admin.couples} actions={<NewCoupleButton djs={(djs ?? []) as { id: string; display_name: string }[]} autoOpen={sp.new === '1'} />} />
      <div className="gutter mb-4"><CoupleSearch initial={sp.q ?? ''} /></div>
      {rows.length === 0 ? <div className="gutter"><EmptyState title={m.admin.noCouplesYet} /></div> : (
        <ul className="gutter flex flex-col gap-2">
          {rows.map((e) => {
            const active = e.dj_assignments.find((a) => ['proposed', 'pending_approval', 'confirmed'].includes(a.status));
            const resp = Array.isArray(e.questionnaire_responses) ? e.questionnaire_responses[0] : e.questionnaire_responses;
            return (
              <li key={e.id}>
                <Link href={`/admin/couples/${e.id}`} className="card p-4 grid sm:grid-cols-[1fr_auto_auto] gap-2 sm:gap-6 items-center hover:border-paper-dim">
                  <span className="min-w-0">
                    <span className="font-bold flex items-center gap-2 flex-wrap" dir="auto">{[e.partner_one_name, e.partner_two_name].filter(Boolean).join(' & ')}{e.is_demo && <DemoBadge label={m.common.demo} />}</span>
                    <span className="block text-sm text-paper-dim truncate">{[e.wedding_date && formatDate(e.wedding_date, locale), e.venue_name].filter(Boolean).join(' · ') || e.invite_email}</span>
                  </span>
                  <span className="text-sm">{active?.dj?.display_name ?? <span className="text-paper-dim">{m.admin.unassigned}</span>}
                    {active?.status === 'pending_approval' && <Badge tone="ember" className="ms-2">{m.home.djPending}</Badge>}
                    {active?.status === 'proposed' && <Badge className="ms-2">{m.home.djProposed}</Badge>}
                  </span>
                  <span className="flex gap-1.5">
                    {!e.onboarding_completed_at && <Badge>{m.home.tasks.onboarding}</Badge>}
                    {resp?.status === 'submitted' ? <Badge tone="gold">{m.dj.submitted}</Badge> : <Badge>{m.dj.notSubmitted}</Badge>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
