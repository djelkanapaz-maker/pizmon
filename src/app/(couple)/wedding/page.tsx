import Link from 'next/link';
import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt, formatDate } from '@/i18n/format';
import { getEvent, getProgressFacts } from '@/server/queries';
import { Badge, PageHeader, cx } from '@/components/ui';
import { EventDetailsButton } from '@/components/EventDetailsForm';
import { IconBan, IconChevron, IconList, IconMessage, IconNote, IconStar, IconHeart, IconSpark, IconCheck } from '@/components/icons';

export default async function WeddingHub() {
  const s = await requireCouple();
  const { m, locale } = await getI18n();
  const db = await supabaseServer();
  const [event, facts, playlists, requests, saved] = await Promise.all([
    getEvent(s.eventId), getProgressFacts(s.eventId, s.company.id),
    db.from('playlists').select('id', { count: 'exact', head: true }).eq('event_id', s.eventId),
    db.from('couple_requests').select('id', { count: 'exact', head: true }).eq('event_id', s.eventId).in('status', ['open', 'in_progress', 'awaiting_couple']),
    db.from('saved_tracks').select('track_id', { count: 'exact', head: true }).eq('event_id', s.eventId),
  ]);
  if (!event) return null;

  const rows = [
    { href: '/wedding/questionnaire', icon: IconNote, label: m.wedding.sections.questionnaire, meta: `${facts.questionnaireSectionsComplete}/${facts.questionnaireSectionsTotal}`, done: facts.questionnaireSectionsTotal > 0 && facts.questionnaireSectionsComplete === facts.questionnaireSectionsTotal },
    { href: '/wedding/moments', icon: IconStar, label: m.wedding.sections.moments, meta: fmt(m.moments.confirmedCount, { done: facts.confirmedRequiredMoments, total: facts.requiredMoments }), done: facts.requiredMoments > 0 && facts.confirmedRequiredMoments === facts.requiredMoments },
    { href: '/wedding/restrictions', icon: IconBan, label: m.wedding.sections.restrictions, meta: String(facts.restrictionsCount), done: facts.restrictionsCount > 0 },
    { href: '/wedding/playlists', icon: IconList, label: m.wedding.sections.playlists, meta: String(playlists.count ?? 0) },
    { href: '/wedding/saved', icon: IconHeart, label: m.wedding.sections.saved, meta: String(saved.count ?? 0) },
    { href: '/wedding/recommendations', icon: IconSpark, label: m.wedding.sections.recommendations, meta: facts.pendingRecommendations ? fmt(m.recommendations.status.pending) + ` · ${facts.pendingRecommendations}` : '', highlight: facts.pendingRecommendations > 0 },
    { href: '/wedding/requests', icon: IconMessage, label: m.wedding.sections.requests, meta: String(requests.count ?? 0), highlight: facts.openClarifications > 0 },
    { href: '/wedding/brief', icon: IconCheck, label: m.wedding.sections.brief, meta: facts.questionnaireSubmitted ? m.dj.submitted : m.dj.notSubmitted, done: facts.questionnaireSubmitted },
  ];

  return (
    <div>
      <PageHeader title={m.wedding.title} sub={m.wedding.sub} />
      <section className="gutter">
        <div className="card p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label">{m.wedding.details}</p>
              <p className="display text-2xl mt-1" dir="auto">{[event.partner_one_name, event.partner_two_name].filter(Boolean).join(' & ')}</p>
            </div>
            <EventDetailsButton event={event} label={m.common.edit} />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-paper-dim">{m.onboarding.date}</dt><dd className="font-bold">{event.wedding_date ? formatDate(event.wedding_date, locale) : m.common.notSet}</dd></div>
            <div><dt className="text-paper-dim">{m.onboarding.venue}</dt><dd className="font-bold" dir="auto">{event.venue_name ?? m.common.notSet}</dd></div>
            <div><dt className="text-paper-dim">{m.onboarding.guests}</dt><dd className="font-bold tabular">{event.guest_count ?? m.common.notSet}</dd></div>
            <div><dt className="text-paper-dim">{m.onboarding.city}</dt><dd className="font-bold" dir="auto">{event.venue_city ?? m.common.notSet}</dd></div>
          </dl>
        </div>
      </section>
      <nav className="gutter mt-6" aria-label={m.wedding.title}>
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.href}>
              <Link href={r.href} className={cx('card h-16 px-4 flex items-center gap-4 hover:border-paper-dim transition-colors', r.highlight && 'border-ember')}>
                <span className={cx('size-10 rounded-full grid place-items-center shrink-0', r.done ? 'bg-gold text-ink' : 'bg-ink-3')}><r.icon size={18} /></span>
                <span className="flex-1 font-bold">{r.label}</span>
                {r.meta && <Badge tone={r.highlight ? 'ember' : r.done ? 'gold' : 'neutral'}>{r.meta}</Badge>}
                <IconChevron size={18} className="text-paper-dim" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
