import Link from 'next/link';
import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt, formatDate, relativeTime } from '@/i18n/format';
import { daysUntil } from '@/core/progress';
import { Badge, EmptyState, PageHeader, cx } from '@/components/ui';
import { LeadActions } from './LeadActions';

export const metadata = { title: 'Leads' };

type Status = 'new' | 'call_requested' | 'contacted' | 'booked' | 'not_relevant';
type Row = {
  status: Status; note: string | null; source: string | null; created_at: string;
  event: { id: string; partner_one_name: string; partner_two_name: string | null; wedding_date: string | null; venue_name: string | null; venue_city: string | null;
    guest_count: number | null; phone: string | null; has_dj: boolean | null; other_dj_name: string | null; contact_consent: boolean; call_requested_at: string | null; invite_email: string | null } | null;
};
const FILTERS = ['open', 'noDj', 'call', 'all'] as const;

/** Israeli numbers → international digits for wa.me (050-1234567 → 972501234567). */
const waNumber = (phone: string) => { const d = phone.replace(/\D/g, ''); return d.startsWith('0') ? `972${d.slice(1)}` : d; };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const s = await requireRole('admin');
  const sp = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(sp.f ?? '') ? (sp.f as (typeof FILTERS)[number]) : 'open';
  const { m, locale } = await getI18n();
  const db = await supabaseServer();
  const { data } = await db.from('event_leads')
    .select('status, note, source, created_at, event:wedding_events(id, partner_one_name, partner_two_name, wedding_date, venue_name, venue_city, guest_count, phone, has_dj, other_dj_name, contact_consent, call_requested_at, invite_email)')
    .eq('company_id', s.company.id).order('created_at', { ascending: false }).limit(500);
  const all = ((data ?? []) as unknown as Row[]).filter((r) => r.event);
  const rows = all.filter((r) => filter === 'all' ? true
    : filter === 'open' ? !['booked', 'not_relevant'].includes(r.status)
    : filter === 'noDj' ? r.event!.has_dj === false
    : r.status === 'call_requested');
  // calls first, then the nearest weddings
  if (filter !== 'all') rows.sort((a, b) => Number(b.status === 'call_requested') - Number(a.status === 'call_requested')
    || (a.event!.wedding_date ?? '9999').localeCompare(b.event!.wedding_date ?? '9999'));

  return (
    <div>
      <PageHeader title={m.leads.title} sub={m.leads.sub} />
      <nav className="gutter mb-5 flex gap-2 flex-wrap" aria-label={m.common.filters}>
        {FILTERS.map((f) => (
          <Link key={f} href={f === 'open' ? '/admin/leads' : `/admin/leads?f=${f}`} aria-current={filter === f ? 'page' : undefined}
            className={cx('h-9 px-4 inline-flex items-center rounded-full text-sm font-bold border', filter === f ? 'bg-paper text-ink border-paper' : 'border-line hover:border-paper-dim')}>
            {m.leads.filters[f]}
          </Link>
        ))}
        <span className="ms-auto self-center text-sm text-paper-dim">{fmt(m.leads.count, { count: rows.length })}</span>
      </nav>
      {rows.length === 0 ? <div className="gutter"><EmptyState title={m.leads.empty} /></div> : (
        <ul className="gutter flex flex-col gap-3">
          {rows.map((r) => {
            const e = r.event!;
            const names = [e.partner_one_name, e.partner_two_name].filter(Boolean).join(' & ');
            const days = daysUntil(e.wedding_date);
            const wa = e.phone ? `https://wa.me/${waNumber(e.phone)}?text=${encodeURIComponent(fmt(m.leads.waText, { name: e.partner_one_name, date: e.wedding_date ? `${locale === 'he' ? ' ב-' : ' on '}${formatDate(e.wedding_date, locale)}` : '' }))}` : null;
            return (
              <li key={e.id} className={cx('card p-5', r.status === 'call_requested' && 'border-paper')}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/couples/${e.id}`} className="display text-xl hover:underline" dir="auto">{names}</Link>
                    <p className="text-sm text-paper-dim mt-1" dir="auto">
                      {[e.wedding_date && `${formatDate(e.wedding_date, locale)}${days !== null && days > 0 ? ` (${fmt(m.home.countdown, { days })})` : ''}`,
                        [e.venue_name, e.venue_city].filter(Boolean).join(', '), e.guest_count && fmt(m.leads.guests, { count: e.guest_count })].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {e.has_dj ? <Badge>{m.leads.hasDj}{e.other_dj_name ? `: ${e.other_dj_name}` : ''}</Badge> : <Badge tone="gold">{m.leads.noDj}</Badge>}
                    {e.call_requested_at && <Badge tone="ember">{fmt(m.leads.callRequested, { when: relativeTime(e.call_requested_at, locale) })}</Badge>}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  {e.phone && <a href={`tel:${e.phone.replace(/[^\d+]/g, '')}`} className="h-9 px-4 inline-flex items-center rounded-full bg-paper text-ink font-bold" dir="ltr">{m.leads.call} {e.phone}</a>}
                  {wa && <a href={wa} target="_blank" rel="noopener" className="h-9 px-4 inline-flex items-center rounded-full border border-line font-bold hover:border-paper-dim">{m.leads.whatsapp}</a>}
                  {e.invite_email && <a href={`mailto:${e.invite_email}`} className="h-9 px-4 inline-flex items-center rounded-full border border-line hover:border-paper-dim" dir="ltr">{e.invite_email}</a>}
                </div>
                <p className="mt-3 text-xs text-paper-dim">
                  {fmt(m.leads.signedUp, { when: relativeTime(r.created_at, locale) })}{r.source ? ` · ${fmt(m.leads.source, { source: r.source })}` : ''}
                </p>
                <LeadActions eventId={e.id} status={r.status} note={r.note ?? ''} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
