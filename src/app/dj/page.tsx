import Link from 'next/link';
import { requireDj } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt, formatDate, relativeTime } from '@/i18n/format';
import { daysUntil } from '@/core/progress';
import { Badge, DemoBadge, EmptyState, PageHeader, cx } from '@/components/ui';
import { IconBan } from '@/components/icons';

type Filter = 'all' | 'upcoming' | 'needs' | 'submitted';

export default async function DjOverview({ searchParams }: { searchParams: Promise<{ f?: string; sort?: string }> }) {
  const s = await requireDj();
  const sp = await searchParams;
  const filter = (['all', 'upcoming', 'needs', 'submitted'].includes(sp.f ?? '') ? sp.f : 'all') as Filter;
  const sort = sp.sort === 'updated' ? 'updated' : 'date';
  const { m, locale } = await getI18n();
  const db = await supabaseServer();
  const { data: assigns } = await db.from('dj_assignments').select('event_id, status').eq('dj_id', s.djId).in('status', ['proposed', 'confirmed']);
  const ids = (assigns ?? []).map((a) => a.event_id as string);
  if (!ids.length) return (<div><PageHeader title={m.dj.couples} /><div className="gutter"><EmptyState title={m.dj.noCouples} /></div></div>);

  const [{ data: events }, { data: reviews }, { data: acts }, { data: reqs }, { data: restr }, { data: sels }, { data: resp }, { data: moments }] = await Promise.all([
    db.from('wedding_events').select('id, partner_one_name, partner_two_name, wedding_date, venue_name, guest_count, is_demo, updated_at').in('id', ids),
    db.from('dj_event_reviews').select('event_id, last_reviewed_at').eq('dj_id', s.djId),
    db.from('activity_events').select('event_id, created_at, actor_id, type').in('event_id', ids).neq('actor_id', s.userId).order('created_at', { ascending: false }).limit(500),
    db.from('couple_requests').select('event_id, status').in('event_id', ids).in('status', ['open', 'in_progress']),
    db.from('music_restrictions').select('event_id').in('event_id', ids).eq('kind', 'never_play').eq('strength', 'absolute'),
    db.from('moment_selections').select('event_id, moment_id, status').in('event_id', ids),
    db.from('questionnaire_responses').select('event_id, status').in('event_id', ids),
    db.from('wedding_moments').select('id').eq('company_id', s.company.id).eq('is_active', true).eq('is_required', true),
  ]);
  const required = (moments ?? []).map((x) => x.id as string);
  const rows = (events ?? []).map((e) => {
    const lastReviewed = reviews?.find((r) => r.event_id === e.id)?.last_reviewed_at as string | undefined;
    const evActs = (acts ?? []).filter((a) => a.event_id === e.id);
    const changes = evActs.filter((a) => !lastReviewed || (a.created_at as string) > lastReviewed).length;
    const openRequests = (reqs ?? []).filter((r) => r.event_id === e.id).length;
    const bans = (restr ?? []).filter((r) => r.event_id === e.id).length;
    const confirmed = (sels ?? []).filter((x) => x.event_id === e.id && x.status === 'confirmed' && required.includes(x.moment_id as string)).length;
    const unresolved = required.length - confirmed;
    const submitted = (resp ?? []).some((r) => r.event_id === e.id && r.status === 'submitted');
    const lastActivity = (evActs[0]?.created_at as string | undefined) ?? (e.updated_at as string);
    return { e, changes, openRequests, bans, unresolved, submitted, lastActivity, days: daysUntil(e.wedding_date as string | null), proposed: assigns?.find((a) => a.event_id === e.id)?.status === 'proposed' };
  });
  const filtered = rows.filter((r) =>
    filter === 'upcoming' ? r.days !== null && r.days >= 0 && r.days <= 60
    : filter === 'needs' ? r.changes > 0 || r.openRequests > 0
    : filter === 'submitted' ? r.submitted : true);
  filtered.sort((a, b) => sort === 'updated' ? b.lastActivity.localeCompare(a.lastActivity)
    : (a.days ?? 99999) - (b.days ?? 99999));
  const q = (f: Filter, so = sort) => `/dj?f=${f}&sort=${so}`;

  return (
    <div>
      <PageHeader title={m.dj.couples} kicker={m.dj.title} />
      <div className="gutter flex flex-wrap items-center gap-2 mb-5">
        {(['all', 'upcoming', 'needs', 'submitted'] as Filter[]).map((f) => (
          <Link key={f} href={q(f)} aria-current={filter === f ? 'page' : undefined}
            className={cx('h-9 px-4 rounded-full border text-sm font-bold inline-flex items-center', filter === f ? 'bg-ember text-ink border-ember' : 'border-line text-paper-dim hover:text-paper')}>{m.dj.filters[f]}</Link>
        ))}
        <span className="ms-auto text-sm text-paper-dim">{m.dj.sort}:</span>
        <Link href={q(filter, 'date')} className={cx('text-sm font-bold', sort === 'date' ? 'text-paper' : 'text-paper-dim')}>{m.admin.eventDate}</Link>
        <Link href={q(filter, 'updated')} className={cx('text-sm font-bold', sort === 'updated' ? 'text-paper' : 'text-paper-dim')}>{m.dj.recentActivity}</Link>
      </div>
      {filtered.length === 0 ? <div className="gutter"><EmptyState title={m.common.none} /></div> : (
        <ul className="gutter grid md:grid-cols-2 gap-3">
          {filtered.map(({ e, changes, openRequests, bans, unresolved, submitted, lastActivity, days, proposed }) => (
            <li key={e.id as string}>
              <Link href={`/dj/couples/${e.id}`} className={cx('card p-4 flex flex-col gap-3 h-full hover:border-paper-dim', changes > 0 && 'border-ember/60')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="label">{e.wedding_date ? formatDate(e.wedding_date as string, locale) : m.common.notSet}{days !== null && days >= 0 ? ` · ${fmt(m.home.countdown, { days })}` : ''}</p>
                    <p className="display text-xl mt-1 truncate" dir="auto">{[e.partner_one_name, e.partner_two_name].filter(Boolean).join(' & ')}</p>
                    <p className="text-sm text-paper-dim truncate" dir="auto">{[e.venue_name, e.guest_count && `${e.guest_count}`].filter(Boolean).join(' · ')}</p>
                  </div>
                  {e.is_demo && <DemoBadge label={m.common.demo} />}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={changes ? 'ember' : 'ok'}>{changes ? fmt(m.dj.changes, { count: changes }) : m.dj.noChanges}</Badge>
                  {proposed && <Badge>{m.home.djProposed}</Badge>}
                  <Badge tone={submitted ? 'gold' : 'neutral'}>{submitted ? m.dj.submitted : m.dj.notSubmitted}</Badge>
                  {unresolved > 0 && <Badge>{fmt(m.dj.unresolved, { count: unresolved })}</Badge>}
                  {openRequests > 0 && <Badge tone="ember">{fmt(m.dj.openRequests, { count: openRequests })}</Badge>}
                  {bans > 0 && <Badge tone="danger"><IconBan size={12} />{fmt(m.dj.restrictionsCount, { count: bans })}</Badge>}
                </div>
                <p className="text-xs text-paper-dim mt-auto">{m.dj.recentActivity}: {relativeTime(lastActivity, locale)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
