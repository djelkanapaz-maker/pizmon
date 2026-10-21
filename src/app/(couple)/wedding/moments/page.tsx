import { requireCouple } from '@/server/session';
import { getI18n } from '@/i18n/server';
import { PageHeader } from '@/components/ui';
import { MomentsList } from '@/components/MomentsList';

export default async function MomentsPage() {
  const s = await requireCouple();
  const { m } = await getI18n();
  return (
    <div>
      <PageHeader back={{ href: '/wedding', label: m.wedding.title }} title={m.moments.title} sub={m.moments.sub} />
      <MomentsList eventId={s.eventId} companyId={s.company.id} />
    </div>
  );
}
