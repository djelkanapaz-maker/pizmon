import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt, formatDate, formatDateTime, relativeTime } from '@/i18n/format';
import { lt } from '@/core/i18n-text';
import { formatAnswer } from '@/core/questionnaire/format';
import { daysUntil } from '@/core/progress';
import { loadBrief } from '@/server/brief';
import { getActiveAssignment, getEvent, getGenres, getMoments, getRestrictions, getSelections, getTracksByIds, describeRestriction, trackLabel, TRACK_SELECT, type Track } from '@/server/queries';
import { BriefView } from '@/components/BriefView';
import { Badge, Cover, DemoBadge, EmptyState, cx } from '@/components/ui';
import { STATUS_TONE } from '@/components/music/status';
import { IconBan, IconStar } from '@/components/icons';
import { AskCoupleForm, DeleteNoteButton, DeleteRecButton, MarkReviewedButton, NoteForm, RecommendForm, RequestReply } from './StaffForms';

export const WORKSPACE_TABS = ['brief', 'moments', 'restrictions', 'playlists', 'questionnaire', 'recommendations', 'requests', 'notes', 'activity'] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

type Activity = { id: string; type: string; created_at: string; actor_id: string | null; is_important: boolean; payload: Record<string, unknown> };

export async function CoupleWorkspace({ eventId, companyId, tab, basePath, viewer }: {
  eventId: string; companyId: string; tab: WorkspaceTab; basePath: string; viewer: { userId: string; djId: string | null; isAdmin: boolean };
}) {
  const { m, locale } = await getI18n();
  const db = await supabaseServer();
  const [event, assignment, restrictions, moments, selections, review, { data: activityRows }] = await Promise.all([
    getEvent(eventId), getActiveAssignment(eventId), getRestrictions(eventId), getMoments(companyId), getSelections(eventId),
    viewer.djId ? db.from('dj_event_reviews').select('last_reviewed_at').eq('dj_id', viewer.djId).eq('event_id', eventId).maybeSingle() : Promise.resolve({ data: null }),
    db.from('activity_events').select('id, type, created_at, actor_id, is_important, payload').eq('event_id', eventId).order('created_at', { ascending: false }).limit(80),
  ]);
  if (!event) return <EmptyState title={m.errors.not_found} />;
  const activity = (activityRows ?? []) as Activity[];
  const lastReviewed = (review.data as { last_reviewed_at: string } | null)?.last_reviewed_at ?? null;
  const newSince = activity.filter((a) => a.actor_id !== viewer.userId && (!lastReviewed || a.created_at > lastReviewed));
  const neverAbs = restrictions.filter((r) => r.kind === 'never_play' && r.strength === 'absolute');
  const requiredMoments = moments.filter((x) => x.is_required);
  const confirmed = requiredMoments.filter((x) => selections.some((s) => s.moment_id === x.id && s.status === 'confirmed')).length;
  const momentName = (id: string | null | undefined) => { const x = moments.find((y) => y.id === id); return x ? (locale === 'he' ? x.name_he : x.name_en) : ''; };
  const momentOpts = moments.map((x) => ({ id: x.id, label: locale === 'he' ? x.name_he : x.name_en }));
  const days = daysUntil(event.wedding_date);
  const tabHref = (t: WorkspaceTab) => `${basePath}?tab=${t}`;
  const [{ data: openReq }, { data: qStatus }, briefData, { data: meeting }] = await Promise.all([
    db.from('couple_requests').select('id').eq('event_id', eventId).in('status', ['open', 'in_progress']),
    db.from('questionnaire_responses').select('status').eq('event_id', eventId).maybeSingle(),
    tab === 'brief' || tab === 'questionnaire' ? loadBrief(eventId, companyId, locale) : Promise.resolve(null),
    db.from('dj_meetings').select('starts_at, mode').eq('event_id', eventId).eq('status', 'booked').maybeSingle(),
  ]);

  return (
    <div>
      {/* the DJ should understand the couple within seconds */}
      <section className="gutter pt-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="label">{event.wedding_date ? `${formatDate(event.wedding_date, locale)}${days !== null && days >= 0 ? ` · ${fmt(m.home.countdown, { days })}` : ''}` : m.common.notSet}</p>
            <h1 className="display-l mt-2" dir="auto">{[event.partner_one_name, event.partner_two_name].filter(Boolean).join(' & ')}</h1>
            <p className="text-paper-dim mt-2 text-sm" dir="auto">
              {[event.venue_name, event.venue_city, event.guest_count && `${event.guest_count} ${locale === 'he' ? 'אורחים' : 'guests'}`].filter(Boolean).join(' · ')}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {event.is_demo && <DemoBadge label={m.common.demo} />}
              {assignment?.dj && <Badge>{m.admin.dj}: {assignment.dj.display_name}</Badge>}
              <Badge tone={qStatus?.status === 'submitted' ? 'gold' : 'neutral'}>{qStatus?.status === 'submitted' ? m.dj.submitted : m.dj.notSubmitted}</Badge>
              <Badge tone={confirmed === requiredMoments.length && requiredMoments.length ? 'gold' : 'neutral'}>{fmt(m.moments.confirmedCount, { done: confirmed, total: requiredMoments.length })}</Badge>
              {meeting && <Badge tone="gold">{m.meeting.nav}: {formatDateTime(meeting.starts_at as string, locale)} · {meeting.mode === 'office' ? m.meeting.office : m.meeting.zoom}</Badge>}
              {(openReq?.length ?? 0) > 0 && <Badge tone="ember">{fmt(m.dj.openRequests, { count: openReq!.length })}</Badge>}
            </div>
          </div>
          {viewer.djId && (
            <div className="flex flex-col items-end gap-2">
              <Badge tone={newSince.length ? 'ember' : 'ok'}>{newSince.length ? fmt(m.dj.changes, { count: newSince.length }) : m.dj.noChanges}</Badge>
              {lastReviewed && <span className="text-xs text-paper-dim">{fmt(m.dj.reviewed, { time: relativeTime(lastReviewed, locale) })}</span>}
              <MarkReviewedButton eventId={eventId} />
            </div>
          )}
        </div>

        {neverAbs.length > 0 && (
          <div className="mt-5 rounded-[14px] border-2 border-danger bg-danger/10 p-4" role="note">
            <p className="display text-base text-danger flex items-center gap-2"><IconBan size={18} />{m.brief.neverPlay}</p>
            <p className="mt-2 font-bold" dir="auto">{neverAbs.map((r) => describeRestriction(r, locale)).join(' · ')}</p>
          </div>
        )}

        {newSince.filter((a) => a.is_important).length > 0 && (
          <div className="mt-4 card p-4 border-ember/60">
            <p className="label mb-2">{m.dj.changedSince}</p>
            <ul className="flex flex-col gap-1 text-sm">
              {newSince.filter((a) => a.is_important).slice(0, 6).map((a) => <li key={a.id} className="flex justify-between gap-3"><span>{(m.activity as Record<string, string>)[a.type] ?? m.activity.unknown}</span><span className="text-paper-dim shrink-0">{relativeTime(a.created_at, locale)}</span></li>)}
            </ul>
          </div>
        )}
      </section>

      <nav className="mt-6 border-b border-line" aria-label={m.dj.title}>
        <ul className="scroll-x">
          {WORKSPACE_TABS.map((t) => (
            <li key={t}>
              <Link href={tabHref(t)} aria-current={tab === t ? 'page' : undefined} scroll={false}
                className={cx('inline-flex h-11 items-center px-3 font-bold text-sm border-b-2 -mb-px whitespace-nowrap', tab === t ? 'border-ember text-paper' : 'border-transparent text-paper-dim hover:text-paper')}>
                {m.dj.tabs[t]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="gutter pt-6">
        {tab === 'brief' && (briefData ? <BriefView brief={briefData.brief} m={m} /> : <EmptyState title={m.dj.briefEmpty} />)}
        {tab === 'moments' && <MomentsTab />}
        {tab === 'restrictions' && <RestrictionsTab />}
        {tab === 'playlists' && <PlaylistsTab />}
        {tab === 'questionnaire' && <AnswersTab />}
        {tab === 'recommendations' && <RecsTab />}
        {tab === 'requests' && <RequestsTab />}
        {tab === 'notes' && <NotesTab />}
        {tab === 'activity' && <ActivityTab />}
      </div>
    </div>
  );

  async function MomentsTab() {
    const tracks = await getTracksByIds(selections.flatMap((s) => [s.primary_track_id ?? '', s.backup_track_id ?? '', s.second_track_id ?? '', ...s.shortlist]));
    const label = (id: string | null) => (id ? trackLabel(tracks.find((t) => t.id === id)) : null);
    return (
      <ul className="flex flex-col gap-3">
        {moments.map((mo) => {
          const s = selections.find((x) => x.moment_id === mo.id);
          const status = s?.status ?? 'not_started';
          const hist = activity.filter((a) => a.type === 'confirmed_moment_changed' && (a.payload.after as { moment_id?: string } | undefined)?.moment_id === mo.id);
          return (
            <li key={mo.id} className={cx('card p-4', status === 'confirmed' && 'border-gold/60', status === 'change_requested' && 'border-danger/60')}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold">{locale === 'he' ? mo.name_he : mo.name_en}{!mo.is_required && <span className="text-xs text-paper-dim font-normal"> · {m.moments.optional}</span>}</p>
                <Badge tone={STATUS_TONE[status]}>{m.moments.status[status]}</Badge>
              </div>
              <dl className="mt-2 grid sm:grid-cols-2 gap-2 text-sm">
                {s?.split ? (<>
                  <div><dt className="text-paper-dim">{m.moments.groomSong}</dt><dd className="font-bold whitespace-pre-wrap" dir="auto">{label(s.primary_track_id) ?? s.custom_song ?? '—'}</dd></div>
                  <div><dt className="text-paper-dim">{m.moments.brideSong}</dt><dd className="font-bold whitespace-pre-wrap" dir="auto">{label(s.second_track_id ?? null) ?? s.second_custom_song ?? '—'}</dd></div>
                </>) : (
                  <div className="sm:col-span-2"><dt className="text-paper-dim">{m.moments.yourSong}</dt><dd className="font-bold whitespace-pre-wrap" dir="auto">{label(s?.primary_track_id ?? null) ?? s?.custom_song ?? '—'}</dd></div>
                )}
                {s?.backup_track_id && <div><dt className="text-paper-dim">{m.moments.backup}</dt><dd dir="auto">{label(s.backup_track_id)}</dd></div>}
                {s && s.shortlist.length > 0 && <div className="sm:col-span-2"><dt className="text-paper-dim">{m.moments.shortlist}</dt><dd dir="auto">{s.shortlist.map((id) => label(id)).filter(Boolean).join(' · ')}</dd></div>}
                {s?.notes && <div className="sm:col-span-2"><dt className="text-paper-dim">{m.moments.notes}</dt><dd className="whitespace-pre-wrap" dir="auto">{s.notes}</dd></div>}
              </dl>
              {hist.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line text-xs text-paper-dim flex flex-col gap-1">
                  {hist.map((h) => <p key={h.id}>{m.activity.confirmed_moment_changed} · {m.dj.previousValue}: <span dir="auto">{label((h.payload.before as { primary_track_id?: string } | null)?.primary_track_id ?? null) ?? (h.payload.before as { custom_song?: string } | null)?.custom_song ?? '—'}</span> · {relativeTime(h.created_at, locale)}</p>)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  function RestrictionsTab() {
    if (!restrictions.length) return <EmptyState title={m.restrictions.emptyNever} />;
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {(['never_play', 'must_play'] as const).map((k) => (
          <section key={k} className={cx('card p-4', k === 'never_play' ? 'border-danger/50' : 'border-gold/50')}>
            <h2 className={cx('display text-lg flex items-center gap-2 mb-3', k === 'never_play' ? 'text-danger' : 'text-gold')}>{k === 'never_play' ? <IconBan size={18} /> : <IconStar size={18} />}{k === 'never_play' ? m.restrictions.never : m.restrictions.must}</h2>
            <ul className="flex flex-col gap-2">
              {restrictions.filter((r) => r.kind === k).map((r) => (
                <li key={r.id} className="rounded-[12px] bg-ink-3 p-3">
                  <p className="font-bold" dir="auto">{describeRestriction(r, locale)}</p>
                  <div className="flex gap-1.5 mt-1"><Badge>{m.restrictions.types[r.target_type]}</Badge><Badge tone={r.strength === 'absolute' ? (k === 'never_play' ? 'danger' : 'gold') : 'neutral'}>{r.strength === 'absolute' ? m.restrictions.absolute : m.restrictions.preference}</Badge></div>
                  {r.reason && <p className="text-sm text-paper-dim mt-1" dir="auto">{r.reason}</p>}
                  <p className="text-xs text-paper-dim mt-1">{formatDateTime(r.created_at, locale)}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  async function PlaylistsTab() {
    const { data } = await db.from('playlists').select(`id, title, purpose, updated_at, playlist_tracks(id, position, status, note, track:music_tracks(${TRACK_SELECT}))`)
      .eq('event_id', eventId).eq('kind', 'couple').order('created_at');
    const lists = (data ?? []) as unknown as { id: string; title: string; purpose: string | null; updated_at: string; playlist_tracks: { id: string; position: number; status: string; note: string | null; track: Track | null }[] }[];
    if (!lists.length) return <EmptyState title={m.dj.noPlaylists} body={m.playlists.notFinal} />;
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-paper-dim">{m.playlists.notFinal}</p>
        {lists.map((pl) => (
          <section key={pl.id} className="card p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="display text-lg" dir="auto">{pl.title}</h2>
              <span className="text-xs text-paper-dim">{pl.purpose ? (m.playlists.purposes as Record<string, string>)[pl.purpose] : ''} · {relativeTime(pl.updated_at, locale)}</span>
            </div>
            <ol className="flex flex-col divide-y divide-line">
              {pl.playlist_tracks.sort((a, b) => a.position - b.position).map((pt) => pt.track && (
                <li key={pt.id} className="py-2 flex items-center gap-3">
                  <Cover seed={pt.track.id} label={pt.track.title} src={pt.track.artwork_url} size={36} />
                  <span className="flex-1 min-w-0"><span className="block font-bold text-sm truncate" dir="auto">{pt.track.title}</span><span className="block text-xs text-paper-dim truncate" dir="auto">{pt.track.artist?.name}{pt.note ? ` — ${pt.note}` : ''}</span></span>
                  <Badge tone={pt.status === 'confirmed' ? 'gold' : 'neutral'}>{(m.playlists as unknown as Record<string, string>)[pt.status]}</Badge>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    );
  }

  async function AnswersTab() {
    if (!briefData) return <EmptyState title={m.dj.briefEmpty} />;
    const genres = await getGenres(companyId);
    const gname = (id: string) => { const g = genres.find((x) => x.id === id); return g ? (locale === 'he' ? g.name_he : g.name_en) : id; };
    const answers = briefData.response?.answers ?? {};
    return (
      <div className="flex flex-col gap-4">
        <p className="text-xs text-paper-dim">v{briefData.version}{briefData.response?.updated_at ? ` · ${formatDateTime(briefData.response.updated_at, locale)}` : ''}</p>
        {briefData.definition.sections.filter((s) => s.kind === 'questions').map((s) => (
          <section key={s.id} className="card p-4">
            <h2 className="display text-lg mb-3">{s.letter}. {lt(s.title, locale)}</h2>
            <dl className="flex flex-col gap-3">
              {s.questions.filter((q) => q.type !== 'event_details').map((q) => (
                <div key={q.id}><dt className="text-sm text-paper-dim">{lt(q.label, locale)}</dt><dd className="font-bold whitespace-pre-wrap" dir="auto">{formatAnswer(q, answers[q.id], locale, gname)}</dd></div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    );
  }

  async function RecsTab() {
    const { data } = await db.from('dj_recommendations').select(`id, message, created_at, created_by, is_ai_suggestion, moment_id, track:music_tracks(title, artist:artists(name)), response:recommendation_responses(status, comment, responded_at)`)
      .eq('event_id', eventId).order('created_at', { ascending: false });
    const recs = (data ?? []) as unknown as { id: string; message: string | null; created_at: string; created_by: string; is_ai_suggestion: boolean; moment_id: string | null; track: { title: string; artist: { name: string } | null } | null; response: { status: string; comment: string | null; responded_at: string } | null }[];
    const blocked = (await db.from('music_tracks').select('id, artist_id, genre_id').eq('company_id', companyId).eq('status', 'published')).data ?? [];
    const blockedIds = blocked.filter((t) => neverAbs.some((r) => (r.target_type === 'track' && r.track_id === t.id) || (r.target_type === 'artist' && r.artist_id === t.artist_id) || (r.target_type === 'genre' && r.genre_id === t.genre_id))).map((t) => t.id as string);
    return (
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <ul className="flex flex-col gap-2 order-2 lg:order-1">
          {recs.length === 0 && <EmptyState title={m.recommendations.empty} />}
          {recs.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {r.track && <p className="font-bold" dir="auto">{r.track.title} — {r.track.artist?.name}</p>}
                  {r.message && <p className="text-sm" dir="auto">{r.message}</p>}
                  <p className="text-xs text-paper-dim mt-1">{r.moment_id && `${fmt(m.recommendations.forMoment, { moment: momentName(r.moment_id) })} · `}{relativeTime(r.created_at, locale)}</p>
                </div>
                <Badge tone={r.response?.status === 'approved' ? 'gold' : r.response?.status === 'question' ? 'ember' : 'neutral'}>{m.recommendations.status[(r.response?.status ?? 'pending') as keyof typeof m.recommendations.status]}</Badge>
                {r.created_by === viewer.userId && !r.response && <DeleteRecButton recId={r.id} eventId={eventId} />}
              </div>
              {r.response?.comment && <p className="mt-2 text-sm rounded-[10px] bg-ink-3 p-2" dir="auto">“{r.response.comment}”</p>}
            </li>
          ))}
        </ul>
        <div className="order-1 lg:order-2"><RecommendForm eventId={eventId} moments={momentOpts} blockedTrackIds={blockedIds} /></div>
      </div>
    );
  }

  async function RequestsTab() {
    const { data } = await db.from('couple_requests').select('id, category, title, description, status, opened_by_staff, created_at, moment_id, request_messages(id, body, author_id, created_at)')
      .eq('event_id', eventId).order('updated_at', { ascending: false });
    const reqs = (data ?? []) as unknown as { id: string; category: string; title: string; description: string | null; status: string; opened_by_staff: boolean; created_at: string; moment_id: string | null; request_messages: { id: string; body: string; author_id: string | null; created_at: string }[] }[];
    return (
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <ul className="flex flex-col gap-3 order-2 lg:order-1">
          {reqs.length === 0 && <EmptyState title={m.requests.empty} />}
          {reqs.map((r) => (
            <li key={r.id} className={cx('card p-4', ['open', 'in_progress'].includes(r.status) && 'border-ember/50')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-paper-dim">{(m.requests.categories as Record<string, string>)[r.category]}{r.moment_id ? ` · ${momentName(r.moment_id)}` : ''}{r.opened_by_staff ? ` · ${m.requests.fromDj}` : ''}</p>
                  <p className="font-bold" dir="auto">{r.title}</p>
                </div>
                <Badge tone={['open', 'in_progress'].includes(r.status) ? 'ember' : r.status === 'awaiting_couple' ? 'gold' : 'neutral'}>{(m.requests.status as Record<string, string>)[r.status]}</Badge>
              </div>
              {r.description && <p className="text-sm mt-2 whitespace-pre-wrap" dir="auto">{r.description}</p>}
              {r.request_messages.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {r.request_messages.sort((a, b) => a.created_at.localeCompare(b.created_at)).map((msg) => (
                    <li key={msg.id} className={cx('rounded-[12px] p-2.5 text-sm max-w-[85%]', msg.author_id === viewer.userId ? 'bg-paper text-ink ms-auto' : 'bg-ink-3')}>
                      <p className="whitespace-pre-wrap" dir="auto">{msg.body}</p><p className="text-[10px] opacity-60 mt-1">{relativeTime(msg.created_at, locale)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <RequestReply requestId={r.id} status={r.status} />
            </li>
          ))}
        </ul>
        <div className="order-1 lg:order-2"><AskCoupleForm eventId={eventId} moments={momentOpts} /></div>
      </div>
    );
  }

  async function NotesTab() {
    const { data } = await db.from('internal_notes').select('id, body, author_id, created_at').eq('event_id', eventId).order('created_at', { ascending: false });
    const notes = (data ?? []) as unknown as { id: string; body: string; author_id: string; created_at: string }[];
    return (
      <div className="flex flex-col gap-4 max-w-2xl">
        <p className="text-sm text-gold">{m.dj.notesPrivate}</p>
        <NoteForm eventId={eventId} />
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="card p-4 flex items-start gap-3">
              <div className="flex-1"><p className="whitespace-pre-wrap" dir="auto">{n.body}</p><p className="text-xs text-paper-dim mt-2">{formatDateTime(n.created_at, locale)}</p></div>
              {n.author_id === viewer.userId && <DeleteNoteButton noteId={n.id} eventId={eventId} />}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function ActivityTab() {
    if (!activity.length) return <EmptyState title={m.dj.noActivity} />;
    return (
      <ol className="flex flex-col gap-2 max-w-2xl">
        {activity.map((a) => {
          const isNew = newSince.some((x) => x.id === a.id);
          const keys = (a.payload.changed_keys as string[] | undefined) ?? [];
          return (
            <li key={a.id} className={cx('card p-3 flex items-start gap-3', isNew && 'border-ember/60', a.is_important && 'bg-ink-2')}>
              <span className={cx('mt-1.5 size-2 rounded-full shrink-0', a.is_important ? 'bg-ember' : 'bg-line')} aria-hidden />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{(m.activity as Record<string, string>)[a.type] ?? m.activity.unknown}</p>
                {keys.length > 0 && <p className="text-xs text-paper-dim">{fmt(m.activity.changedKeys, { keys: keys.join(', ') })}</p>}
                {typeof a.payload.text === 'string' && <p className="text-xs text-paper-dim" dir="auto">{a.payload.text}</p>}
                {typeof a.payload.title === 'string' && <p className="text-xs text-paper-dim" dir="auto">{a.payload.title}</p>}
              </div>
              <time className="text-xs text-paper-dim shrink-0" dateTime={a.created_at}>{relativeTime(a.created_at, locale)}</time>
            </li>
          );
        })}
      </ol>
    );
  }
}
