import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/format';
import { cx } from '@/components/ui';

export const PERIODS = [7, 30, 90] as const;
/** visits are counted from here on, so sign-ups are too (otherwise the conversion would be off) */
const COUNTING_SINCE = Date.parse('2026-11-26T14:00:00Z');
type Stat = { page: string; event: string; visits: number; visitors: number; sources: { source: string; visitors: number }[] };

/** The sign-up funnel: landing visitors → sign-up page → started the form → signed up. */
export async function VisitStats({ companyId, days, filter }: { companyId: string; days: number; filter: string }) {
  const { m } = await getI18n();
  const V = m.leads.visits;
  const db = await supabaseServer();
  const since = new Date(Math.max(Date.now() - days * 86_400_000, COUNTING_SINCE)).toISOString();
  const [{ data }, { count: signups }] = await Promise.all([
    db.rpc('admin_visit_stats', { p_company: companyId, p_days: days }),
    db.from('event_leads').select('*', { count: 'exact', head: true }).eq('company_id', companyId).gte('created_at', since),
  ]);
  const rows = (data ?? []) as Stat[];
  const get = (page: string, event = 'view') => rows.find((r) => r.page === page && r.event === event);
  const landing = get('landing')?.visitors ?? 0;
  const signupPage = get('signup')?.visitors ?? 0;
  const started = get('signup', 'form_start')?.visitors ?? 0;
  const done = signups ?? 0;
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '–');
  const sources = (get('signup')?.sources ?? []).filter((s) => s.source);
  const steps = [
    { label: V.landing, value: landing },
    { label: V.signupPage, value: signupPage },
    { label: V.started, value: started, rate: pct(started, signupPage) },
    { label: V.signedUp, value: done, rate: pct(done, started) },
  ];
  const href = (d: number) => `/admin/leads?${new URLSearchParams({ ...(filter !== 'open' ? { f: filter } : {}), ...(d !== 30 ? { d: String(d) } : {}) })}`;

  return (
    <section className="gutter mb-6" aria-labelledby="visits-title">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 id="visits-title" className="display text-lg">{V.title}</h2>
          <nav className="flex gap-1.5" aria-label={V.period}>
            {PERIODS.map((d) => (
              <Link key={d} href={href(d)} aria-current={d === days ? 'page' : undefined}
                className={cx('h-8 px-3 inline-flex items-center rounded-full text-xs font-bold border', d === days ? 'bg-paper text-ink border-paper' : 'border-line hover:border-paper-dim')}>
                {fmt(V.days, { days: d })}
              </Link>
            ))}
          </nav>
        </div>
        <ol className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {steps.map((s) => (
            <li key={s.label} className="rounded-2xl border border-line p-4">
              <p className="text-xs text-paper-dim">{s.label}</p>
              <p className="display text-3xl mt-1 tabular-nums">{s.value}</p>
              {s.rate && <p className="text-xs text-paper-dim mt-1">{fmt(V.rate, { rate: s.rate })}</p>}
            </li>
          ))}
        </ol>
        <p className="text-xs text-paper-dim mt-3">
          {V.note}{sources.length ? ` · ${V.sources}: ${sources.map((s) => `${s.source} (${s.visitors})`).join(', ')}` : ''}
        </p>
      </div>
    </section>
  );
}
