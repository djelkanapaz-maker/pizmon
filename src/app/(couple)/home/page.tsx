import Link from 'next/link';
import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt, relativeTime, formatDate } from '@/i18n/format';
import { getEvent, getProgressFacts, getTracksByIds, TRACK_SELECT, type Track } from '@/server/queries';
import { getTrackContext } from '@/server/track-context';
import { daysUntil, nextAction, planningTasks, progressPercent, type NextAction } from '@/core/progress';
import { ButtonLink, Cover, DemoBadge, Portrait, Progress, SectionHeader, Badge, cx } from '@/components/ui';
import { TrackList } from '@/components/music/TrackList';
import { PlayToggle } from '@/components/audio/MiniPlayer';
import { IconCheck, IconChevron } from '@/components/icons';

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
  const [event, facts, ctx, savedRows, recRows, featured, editorial, station, updates] = await Promise.all([
    getEvent(s.eventId),
    getProgressFacts(s.eventId, s.company.id),
    getTrackContext(s.eventId, s.company.id),
    db.from('saved_tracks').select('track_id').eq('event_id', s.eventId).order('created_at', { ascending: false }).limit(5),
    db.from('dj_recommendations').select(`id, message, created_at, track:music_tracks(${TRACK_SELECT}), response:recommendation_responses(status)`).eq('event_id', s.eventId).order('created_at', { ascending: false }).limit(6),
    db.from('content_items').select('id, title, kind, media_url, external_url, is_demo, creator:djs(display_name)').eq('company_id', s.company.id).eq('status', 'published').eq('is_featured', true).limit(6),
    db.from('playlists').select('id, title, description, purpose, is_featured, artwork_url, playlist_tracks(count)').eq('company_id', s.company.id).eq('kind', 'editorial').eq('status', 'published').order('is_featured', { ascending: false }).limit(6),
    db.from('radio_stations').select('id, name, mode, stream_url').eq('company_id', s.company.id).eq('is_primary', true).maybeSingle(),
    db.from('notifications').select('id, title_he, title_en, link, created_at, read_at').eq('user_id', s.userId).order('created_at', { ascending: false }).limit(3),
  ]);
  if (!event) return null;

  const tasks = planningTasks(facts);
  const pct = progressPercent(tasks);
  const action = nextAction(facts);
  const actionCopy = m.home.action[action.kind];
  const days = daysUntil(event.wedding_date);
  const names = [event.partner_one_name, event.partner_two_name].filter(Boolean).join(' & ');
  const saved = await getTracksByIds((savedRows.data ?? []).map((r) => r.track_id as string));
  const savedOrdered = (savedRows.data ?? []).map((r) => saved.find((t) => t.id === r.track_id)).filter(Boolean) as Track[];
  const recs = ((recRows.data ?? []) as unknown as { id: string; track: Track | null; response: { status: string } | null }[]);
  const pendingRecTracks = recs.filter((r) => !r.response && r.track).map((r) => r.track!) ;
  const dj = facts.djStatusRaw?.dj;

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

      {/* ceremony & editorial collections */}
      {(editorial.data ?? []).length > 0 && (
        <section className="mt-12">
          <SectionHeader title={m.home.ceremony} href="/discover" action={m.common.seeAll} />
          <div className="scroll-x pb-2">
            {(editorial.data ?? []).map((p) => (
              <Link key={p.id} href={`/discover/collection/${p.id}`} className="w-40 group">
                <Cover seed={p.id} label={p.title} src={p.artwork_url} size={160} className="group-hover:-translate-y-1 transition-transform" />
                <p className="font-bold mt-2 leading-tight" dir="auto">{p.title}</p>
                <p className="text-xs text-paper-dim">{fmt(m.playlists.tracks, { count: (p.playlist_tracks as unknown as { count: number }[])[0]?.count ?? 0 })}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* recently saved */}
      <section className="mt-12">
        <SectionHeader title={m.home.savedRecently} href="/wedding/saved" action={m.common.seeAll} />
        {savedOrdered.length ? <TrackList tracks={savedOrdered} ctx={ctx} compare={false} />
          : <div className="gutter"><div className="card p-5 flex items-center justify-between gap-4"><p className="text-paper-dim text-sm">{m.home.emptySaved}</p><ButtonLink href="/discover" size="sm">{m.home.exploreNow}</ButtonLink></div></div>}
      </section>

      {/* mixes */}
      {(featured.data ?? []).length > 0 && (
        <section className="mt-12">
          <SectionHeader title={m.home.featuredMixes} href="/radio" action={m.common.seeAll} />
          <div className="scroll-x pb-2">
            {(featured.data ?? []).map((c) => (
              <div key={c.id} className="w-56 card p-3 flex flex-col gap-3">
                <Cover seed={c.id} label={c.title} size={200} className="!w-full !h-auto aspect-square" />
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm leading-tight line-clamp-2">{c.title}</p>
                    <p className="text-xs text-paper-dim mt-1">{(c.creator as unknown as { display_name: string } | null)?.display_name}</p>
                  </div>
                  {c.media_url && <PlayToggle source={{ id: `content:${c.id}`, kind: 'company_mix', url: c.media_url, title: c.title, subtitle: (c.creator as unknown as { display_name: string } | null)?.display_name }} size="sm" />}
                </div>
                {c.is_demo && <DemoBadge label={m.common.demo} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* radio */}
      {station.data && station.data.mode !== 'off' && (
        <section className="gutter mt-12">
          <div className="card-hard p-5 flex items-center gap-4">
            {station.data.stream_url && <PlayToggle source={{ id: `radio:${station.data.id}`, kind: station.data.mode === 'live' ? 'live_stream' : 'demo_stream', url: station.data.stream_url, title: station.data.name }} size="lg" />}
            <div className="min-w-0 flex-1">
              <p className="label">{m.home.radio}</p>
              <p className="display text-xl">{station.data.name}</p>
              <Badge tone={station.data.mode === 'live' ? 'danger' : 'neutral'}>{station.data.mode === 'live' ? m.radio.live : m.radio.demo}</Badge>
            </div>
            <Link href="/radio" aria-label={m.radio.title} className="size-11 grid place-items-center rounded-full hover:bg-ink-3"><IconChevron /></Link>
          </div>
        </section>
      )}
    </div>
  );
}
