import { notFound, redirect } from 'next/navigation';
import { requireCouple } from '@/server/session';
import { getI18n } from '@/i18n/server';
import { lt } from '@/core/i18n-text';
import { getEvent, getGenres, getQuestionnaire } from '@/server/queries';
import { ButtonLink, PageHeader } from '@/components/ui';
import { QuestionSection } from './QuestionSection';
import { MomentsList } from '@/components/MomentsList';

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: sid } = await params;
  const s = await requireCouple();
  const { m, locale } = await getI18n();
  const [q, event, genres] = await Promise.all([getQuestionnaire(s.eventId, s.company.id), getEvent(s.eventId), getGenres(s.company.id)]);
  if (!q || !event) notFound();
  const idx = q.definition.sections.findIndex((x) => x.id === sid);
  if (idx < 0) notFound();
  const sec = q.definition.sections[idx];
  if (sec.kind === 'brief') redirect('/wedding/brief');
  const prev = q.definition.sections[idx - 1];
  const next = q.definition.sections[idx + 1];
  const nextHref = next ? (next.kind === 'brief' ? '/wedding/brief' : `/wedding/questionnaire/${next.id}`) : '/wedding/brief';

  return (
    <div>
      <PageHeader back={{ href: '/wedding/questionnaire', label: m.questionnaire.title }} kicker={m.questionnaire.section.replace('{letter}', sec.letter)}
        title={lt(sec.title, locale)} sub={lt(sec.intro, locale)} />
      <div className="gutter flex gap-1.5 mb-8" aria-hidden>
        {q.definition.sections.map((x, i) => <span key={x.id} className={`h-1.5 flex-1 rounded-full ${i <= idx ? 'bg-ember' : 'bg-ink-3'}`} />)}
      </div>
      {sec.kind === 'questions' && (
        <QuestionSection section={sec} answers={q.response?.answers ?? {}} event={event} genres={genres.map((g) => ({ id: g.id, label: locale === 'he' ? g.name_he : g.name_en }))} />
      )}
      {sec.kind === 'restrictions' && (
        <div className="gutter"><ButtonLink href="/wedding/restrictions?from=questionnaire" size="lg">{m.questionnaire.restrictionsCta}</ButtonLink></div>
      )}
      {sec.kind === 'moments' && (
        <MomentsList eventId={s.eventId} companyId={s.company.id} from="questionnaire" />
      )}
      <nav className="gutter mt-12 flex items-center justify-between gap-3">
        {prev ? <ButtonLink href={`/wedding/questionnaire/${prev.id}`} variant="ghost">{m.questionnaire.prevSection}</ButtonLink> : <span />}
        <ButtonLink href={nextHref} size="lg">{next?.kind === 'brief' || !next ? m.questionnaire.briefCta : m.questionnaire.nextSection}</ButtonLink>
      </nav>
    </div>
  );
}
