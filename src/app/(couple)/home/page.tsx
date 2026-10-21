import Link from 'next/link';
import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt, relativeTime, formatDate } from '@/i18n/format';
import { getEvent, getProgressFacts, TRACK_SELECT, type Track } from '@/server/queries';
import { getTrackContext } from '@/server/track-context';
import { daysUntil, nextAction, planningTasks, progressPercent, type NextAction } from '@/core/progress';
import { DemoBadge, Portrait, Progress, SectionHeader, Badge, cx } from '@/components/ui';
import { TrackList } from '@/components/music/TrackList';
import { IconCheck, IconChevron, IconList } from '@/components/icons';
import { MeetingPrompt } from '@/components/meeting/MeetingPrompt';
import { MEETING_WINDOW_DAYS } from '@/core/meeting';

const ACTION_HREF: Record<NextAction['kind'], string> = {
  answer_clarification: '/wedding/requests', finish_onboarding: '/onboarding', choose_dj: '/onboarding?step=dj', await_dj_approval: '/onboarding?step=dj',
  confirm_dj: '/onboarding?step=dj', review_recommendations: '/wedding/recommendations', start_questionnaire: '/wedding/questionnaire',
  continue_questionnaire: '/wedding/questionnaire', choose_moments: '/wedding/moments', add_restrictions: '/wedding/restrictions',
  submit_brief: '/wedding/brief', all_done: '/discover',
};

export default async function HomePage() {
  const s = await requireCouple();
  const { m, locale } = await getI18n();
  const db = await supabaseServer();
  const [event, facts, ctx, recRows, updates] = await Promise.all([
    getEvent(s.eventId),
    getProgressFacts(s.eventId, s.company.id),
    getTrackContext(s.eventId, s.company.id),
    db.from('dj_recommendations').select(`id, message, created_at, track:music_tracks(${TRACK_SELECT}), response:recommendation_responses(status)`).eq('event_id', s.eventId).order('created_at', { ascending: false }).limit(6),
    db.from('notifications').select('id, title_he, title_en, link, created_at, read_at').eq('user_id', s.userId).order('created_at', { ascending: false }).limit(3),
  ]);
  if (!event) return null;

  const tasks = planningTasks(facts);
  const pct = progressPercent(tasks);
  const action = nextAction(facts);
  const actionCopy = m.home.action[action.kind];
  const days = daysUntil(event.wedding_date);
  const names = [event.partner_one_name, event.partner_two_name].filter(Boolean).join(' & ');
  const recs = ((recRows.data ?? []) as unknown as { id: string; track: Track | null; response: { status: string } | null }[]);
  const pendingRecTracks = recs.filter((r) => !r.response && r.track).map((r) => r.track!) ;
  const dj = facts.djStatusRaw?.dj;
  const meetingDue = !!dj && facts.djStatus === 'confirmed' && days !== null && days >= 0 && days <= MEETING_WINDOW_DAYS;
  let showMeetingPrompt = false;
  if (meetingDue) {
    const { data: booked } = await db.from('dj_meetings').select('id').eq('event_id', s.eventId).eq('status', 'booked').maybeSingle();
    if (!booked) { showMeetingPrompt = true; await db.rpc('ensure_my_meeting_reminder', { p_event: s.eventId }); }
  }

  return (
    <div className="pt-6 md:pt-10">
      {/* hero */}
      <section className="gutter animate-rise">
        <p className="label mb-3">
          {days === null ? <Link href="/wedding" className="underline underline-offset-4">{m.home.noDate}</Link>
            : days > 0 ? fmt(m.home.countdown, { days }) : days === 0 ? m.home.countdownToday : fmt(m.home.countdownPast, { days: -days })}
          {event.wedding_date && <span className="text-paper-dim/70"> · {formatDate(event.wedding_date, locale)}</span>}
        </p>
        <h1 className="display-xl poster-shadow break-words" dir="auto">{fmt(m.home.hello, { names })}</h1>
        {event.venue_name && <p className="mt-3 text-paper-dim" dir="auto">{event.venue_name}{event.venue_city ? `, ${event.venue_city}` : ''}</p>}
      </section>

      {showMeetingPrompt && dj && <section className="gutter mt-8"><MeetingPrompt djName={dj.display_name} eventId={s.eventId} /></section>}

      {/* next action */}
      <section className="gutter mt-8">
        <Link href={ACTION_HREF[action.kind]} className="block rounded-[20px] bg-ember text-ink p-5 md:p-6 shadow-[var(--shadow-hard-paper)] hover:brightness-105 transition">
          <p className="text-xs font-bold uppercase tracking-wider opacity-70">{m.home.nextUp}</p>
          <p className="display text-2xl md:text-3xl mt-2 leading-tight">{fmt(actionCopy.title, { count: 'count' in action ? action.count : 0, remaining: 'remaining' in action ? action.remaining : 0 })}</p>
          <span className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-full bg-ink text-paper font-bold text-sm">{actionCopy.cta}<IconChevron size={16} /></span>
        </Link>
      </section>

      {/* DJ + progress */}
      <section className="gutter mt-6 grid md:grid-cols-2 gap-4">
        <div className="card p-5 flex items-center gap-4">
          {dj ? <Portrait name={dj.display_name} src={dj.photo_url} size={72} /> : <div className="size-[72px] rounded-full border-2 border-dashed border-line" />}
          <div className="min-w-0">
            <p className="label">{m.home.yourDj}</p>
            <p className="display text-xl truncate">{dj?.display_name ?? '—'}</p>
            {facts.djStatus === 'pending_approval' && <Badge tone="gold">{m.home.djPending}</Badge>}
            {facts.djStatus === 'proposed' && <Badge tone="ember">{m.home.djProposed}</Badge>}
            {dj?.is_demo && <DemoBadge label={m.common.demo} />}
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-baseline justify-between mb-3">
            <p className="label">{m.home.progress}</p>
            <p className="display text-2xl tabular">{pct}%</p>
          </div>
          <Progress value={pct} label={m.home.progress} />
          <p className="text-sm text-paper-dim mt-2">{fmt(m.home.progressDetail, { done: tasks.filter((t) => t.done).length, total: tasks.length })}</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {tasks.map((t) => (
              <li key={t.id} className={cx('text-xs flex items-center gap-1.5', t.done ? 'text-paper' : 'text-paper-dim')}>
                <span className={cx('size-4 rounded-full grid place-items-center shrink-0', t.done ? 'bg-gold text-ink' : 'border border-line')}>{t.done && <IconCheck size={10} />}</span>
                {m.home.tasks[t.id]}{t.detail && t.detail.total > 0 && !t.done ? ` ${t.detail.done}/${t.detail.total}` : ''}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* DJ recommendations */}
      {pendingRecTracks.length > 0 && (
        <section className="mt-12">
          <SectionHeader title={m.home.recommended} href="/wedding/recommendations" action={m.common.seeAll} />
          <TrackList tracks={pendingRecTracks.slice(0, 3)} ctx={ctx} compare={false} />
        </section>
      )}

      {/* updates */}
      {(updates.data ?? []).length > 0 && (
        <section className="mt-12">
          <SectionHeader title={m.home.updates} href="/notifications" action={m.common.seeAll} />
          <ul className="gutter flex flex-col gap-2">
            {(updates.data ?? []).map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? '/notifications'} className="card p-4 flex items-center gap-3 hover:border-paper-dim">
                  {!n.read_at && <span className="size-2 rounded-full bg-ember shrink-0" aria-hidden />}
                  <span className="flex-1 font-bold text-sm">{locale === 'he' ? n.title_he : n.title_en}</span>
                  <span className="text-xs text-paper-dim shrink-0">{relativeTime(n.created_at, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* our playlist */}
      <section className="gutter mt-12">
        <Link href="/wedding/playlists" className="card-hard p-5 flex items-center gap-4 hover:brightness-110 transition">
          <span className="size-12 rounded-full bg-ember text-ink grid place-items-center shrink-0"><IconList size={22} /></span>
          <span className="min-w-0 flex-1">
            <span className="block display text-xl">{m.playlists.ours}</span>
            <span className="block text-sm text-paper-dim">{fmt(m.playlists.tracks, { count: ctx.ours?.length ?? 0 })}</span>
          </span>
          <IconChevron size={20} className="text-paper-dim shrink-0" />
        </Link>
      </section>

    </div>
  );
}
