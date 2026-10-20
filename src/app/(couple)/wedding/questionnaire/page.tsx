import Link from 'next/link';
import { requireCouple } from '@/server/session';
import { getI18n } from '@/i18n/server';
import { fmt, relativeTime } from '@/i18n/format';
import { lt } from '@/core/i18n-text';
import { sectionStatus, nextIncompleteSection } from '@/core/questionnaire/answers';
import { getEvent, getMoments, getQuestionnaire, getRestrictions, getSelections } from '@/server/queries';
import { ButtonLink, EmptyState, PageHeader, Badge, cx } from '@/components/ui';
import { IconCheck, IconChevron } from '@/components/icons';

export default async function QuestionnaireOverview() {
  const s = await requireCouple();
  const { m, locale } = await getI18n();
  const [q, event, restrictions, moments, selections] = await Promise.all([
    getQuestionnaire(s.eventId, s.company.id), getEvent(s.eventId), getRestrictions(s.eventId), getMoments(s.company.id), getSelections(s.eventId),
  ]);
  if (!q) return (<div><PageHeader back={{ href: '/wedding', label: m.wedding.title }} title={m.questionnaire.title} /><div className="gutter"><EmptyState title={m.questionnaire.noQuestionnaire} /></div></div>);
  const answers = q.response?.answers ?? {};
  const required = moments.filter((x) => x.is_required);
  const facts = { event: event ?? undefined, restrictionsCount: restrictions.length, requiredMoments: required.length,
    confirmedRequiredMoments: required.filter((x) => selections.some((y) => y.moment_id === x.id && y.status === 'confirmed')).length };
  const next = nextIncompleteSection(q.definition, answers, facts);
  return (
    <div>
      <PageHeader back={{ href: '/wedding', label: m.wedding.title }} title={m.questionnaire.title} sub={m.questionnaire.sub} />
      {q.response?.status === 'submitted' && (
        <p className="gutter -mt-2 mb-6 text-sm text-gold">{fmt(m.questionnaire.submitted, { time: relativeTime(q.response.submitted_at!, locale) })}</p>
      )}
      {next && <div className="gutter mb-6"><ButtonLink href={`/wedding/questionnaire/${next.id}`} size="lg">{q.response ? m.common.continue : m.home.action.start_questionnaire.cta}</ButtonLink></div>}
      <ol className="gutter flex flex-col gap-3">
        {q.definition.sections.map((sec) => {
          const st = sectionStatus(sec, answers, facts);
          const href = sec.kind === 'brief' ? '/wedding/brief' : `/wedding/questionnaire/${sec.id}`;
          return (
            <li key={sec.id}>
              <Link href={href} className={cx('card p-4 flex items-center gap-4 hover:border-paper-dim', st.complete && 'border-gold/50')}>
                <span className={cx('display text-2xl size-12 rounded-full grid place-items-center shrink-0', st.complete ? 'bg-gold text-ink' : 'bg-ink-3')}>
                  {st.complete ? <IconCheck size={20} /> : sec.letter}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold">{lt(sec.title, locale)}</span>
                  <span className="block text-sm text-paper-dim line-clamp-1">{lt(sec.intro, locale)}</span>
                </span>
                {st.total > 0 && <Badge tone={st.complete ? 'gold' : 'neutral'}>{st.complete ? m.questionnaire.complete : fmt(m.questionnaire.incomplete, { answered: st.answered, total: st.total })}</Badge>}
                <IconChevron size={18} className="text-paper-dim shrink-0" />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
