import Link from 'next/link';
import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { formatDate, formatNumber, isolate } from '@/i18n/format';
import { Badge, ButtonLink, PageHeader } from '@/components/ui';

type Metrics = {
  events: number; events_onboarded: number; questionnaires_started: number; questionnaires_submitted: number; moments_required: number; moments_confirmed: number;
  pending_assignments: number; open_requests: number; recommendations: number; recommendations_approved: number; recommendations_answered: number;
  median_days_to_submit: number | null; dj_workload: { dj_id: string; name: string; couples: number; open_requests: number }[]; includes_demo_data: boolean;
};

export default async function AdminOverview() {
  const s = await requireRole('admin');
  const { m, locale } = await getI18n();
  const db = await supabaseServer();
  const [{ data: metrics }, { data: pending }] = await Promise.all([
    db.rpc('company_metrics', { p_company: s.company.id }),
    db.from('dj_assignments').select('id, event_id, dj:djs(display_name), event:wedding_events!inner(partner_one_name, partner_two_name, wedding_date, company_id)')
      .eq('status', 'pending_approval').eq('event.company_id', s.company.id).limit(10),
  ]);
  const x = metrics as Metrics | null;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const tiles = x ? [
    { label: m.admin.metrics.events, value: formatNumber(x.events, locale) },
    { label: m.admin.metrics.onboarded, value: `${formatNumber(x.events_onboarded, locale)} · ${pct(x.events_onboarded, x.events)}` },
    { label: m.admin.metrics.qStarted, value: `${formatNumber(x.questionnaires_started, locale)} · ${pct(x.questionnaires_started, x.events)}` },
    { label: m.admin.metrics.qSubmitted, value: `${formatNumber(x.questionnaires_submitted, locale)} · ${pct(x.questionnaires_submitted, x.events)}` },
    { label: m.admin.metrics.momentsConfirmed, value: pct(x.moments_confirmed, x.moments_required * x.events) },
    { label: m.admin.metrics.recApproval, value: pct(x.recommendations_approved, x.recommendations_answered) },
    { label: m.admin.metrics.pendingAssignments, value: formatNumber(x.pending_assignments, locale), alert: x.pending_assignments > 0 },
    { label: m.admin.metrics.openRequests, value: formatNumber(x.open_requests, locale) },
    { label: m.admin.metrics.medianDays, value: x.median_days_to_submit !== null ? x.median_days_to_submit.toFixed(1) : '—' },
  ] : [];
  return (
    <div>
      <PageHeader title={m.admin.overview} kicker={s.company.brand_name} actions={<ButtonLink href="/admin/couples?new=1" size="sm">{m.admin.newCouple}</ButtonLink>} />
      {x?.includes_demo_data && <p className="gutter -mt-2 mb-4"><Badge tone="gold">{m.admin.metrics.demoWarning}</Badge></p>}
      {x && x.events === 0 && <p className="gutter mb-4 text-paper-dim">{m.admin.metrics.none}</p>}
      <section className="gutter grid grid-cols-2 md:grid-cols-3 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className={`card p-4 ${t.alert ? 'border-ember' : ''}`}>
            <p className="label">{t.label}</p>
            <p className="numeral text-3xl mt-2">{t.value}</p>
          </div>
        ))}
      </section>
      {(pending ?? []).length > 0 && (
        <section className="gutter mt-8">
          <h2 className="display-m mb-3">{m.admin.metrics.pendingAssignments}</h2>
          <ul className="flex flex-col gap-2">
            {(pending ?? []).map((p) => {
              const ev = p.event as unknown as { partner_one_name: string; partner_two_name: string | null; wedding_date: string | null };
              return (
                <li key={p.id}>
                  <Link href={`/admin/couples/${p.event_id}`} className="card p-4 flex items-center justify-between gap-3 border-ember/50 hover:border-ember">
                    <span className="font-bold" dir="auto">{[ev.partner_one_name, ev.partner_two_name].filter(Boolean).join(' & ')}</span>
                    <span className="text-sm text-paper-dim">{m.admin.pendingApproval.replace('{dj}', isolate((p.dj as unknown as { display_name: string }).display_name))}</span>
                    {ev.wedding_date && <span className="text-xs text-paper-dim hidden sm:block">{formatDate(ev.wedding_date, locale)}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {x && x.dj_workload.length > 0 && (
        <section className="gutter mt-8">
          <h2 className="display-m mb-3">{m.admin.metrics.workload}</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-start text-paper-dim"><th className="text-start p-3">{m.admin.dj}</th><th className="text-start p-3">{m.admin.couples}</th><th className="text-start p-3">{m.admin.metrics.openRequests}</th></tr></thead>
              <tbody>{x.dj_workload.map((d) => (
                <tr key={d.dj_id} className="border-t border-line"><td className="p-3 font-bold">{d.name}</td><td className="p-3 tabular">{d.couples}</td><td className="p-3 tabular">{d.open_requests}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
