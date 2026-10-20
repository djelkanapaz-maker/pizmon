import { requireCouple } from '@/server/session';
import { getI18n } from '@/i18n/server';
import { describeRestriction, getGenres, getRestrictions } from '@/server/queries';
import { PageHeader } from '@/components/ui';
import { RestrictionsBoard } from './RestrictionsBoard';

export default async function RestrictionsPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const s = await requireCouple();
  const sp = await searchParams;
  const { m, locale } = await getI18n();
  const [list, genres] = await Promise.all([getRestrictions(s.eventId), getGenres(s.company.id)]);
  const back = sp.from === 'questionnaire' ? { href: '/wedding/questionnaire/restrictions', label: m.questionnaire.title } : { href: '/wedding', label: m.wedding.title };
  return (
    <div>
      <PageHeader back={back} title={m.restrictions.title} sub={m.restrictions.sub} />
      <RestrictionsBoard
        items={list.map((r) => ({ id: r.id, kind: r.kind, strength: r.strength, target_type: r.target_type, label: describeRestriction(r, locale), reason: r.reason ?? null }))}
        genres={genres.map((g) => ({ id: g.id, label: locale === 'he' ? g.name_he : g.name_en }))}
      />
    </div>
  );
}
