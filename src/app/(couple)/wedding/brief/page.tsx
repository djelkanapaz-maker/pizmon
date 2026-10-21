import { requireCouple } from '@/server/session';
import { getI18n } from '@/i18n/server';
import { fmt, relativeTime } from '@/i18n/format';
import { loadBrief } from '@/server/brief';
import { BriefView } from '@/components/BriefView';
import { ButtonA, EmptyState, PageHeader } from '@/components/ui';
import { IconDownload } from '@/components/icons';
import { SubmitBrief } from './SubmitBrief';

export default async function BriefPage() {
  const s = await requireCouple();
  const { m, locale } = await getI18n();
  const data = await loadBrief(s.eventId, s.company.id, locale);
  if (!data) return (<div><PageHeader back={{ href: '/wedding', label: m.wedding.title }} title={m.brief.title} /><div className="gutter"><EmptyState title={m.questionnaire.noQuestionnaire} /></div></div>);
  const submitted = data.response?.status === 'submitted';
  return (
    <div>
      <PageHeader back={{ href: '/wedding', label: m.wedding.title }} kicker="G" title={m.brief.title} sub={m.questionnaire.submitHint} />
      <div className="gutter"><BriefView brief={data.brief} m={m} /></div>
      <div className="gutter mt-8 flex flex-col gap-3">
        {submitted && data.response?.submitted_at && <p className="text-sm text-gold">{fmt(m.questionnaire.submitted, { time: relativeTime(data.response.submitted_at, locale) })}</p>}
        <SubmitBrief submitted={submitted} />
        <ButtonA href="/api/brief/pdf" download variant="secondary" size="lg"><IconDownload size={18} />{m.brief.downloadPdf}</ButtonA>
        <p className="text-xs text-paper-dim text-center">{m.brief.downloadHint}</p>
      </div>
    </div>
  );
}
