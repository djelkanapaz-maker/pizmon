import { notFound } from 'next/navigation';
import { requireDj } from '@/server/session';
import { getEvent } from '@/server/queries';
import { getI18n } from '@/i18n/server';
import { CoupleWorkspace, WORKSPACE_TABS, type WorkspaceTab } from '@/components/staff/CoupleWorkspace';
import Link from 'next/link';
import { IconChevron } from '@/components/icons';

export default async function DjCouple({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requireDj();
  const event = await getEvent(id); // RLS: null unless this DJ is assigned or granted
  if (!event) notFound();
  const { m } = await getI18n();
  const tab = (WORKSPACE_TABS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as WorkspaceTab) : 'brief';
  return (
    <div>
      <div className="gutter pt-4"><Link href="/dj" className="inline-flex items-center gap-1 text-sm font-bold text-paper-dim hover:text-paper"><IconChevron size={16} className="rotate-180" />{m.dj.couples}</Link></div>
      <CoupleWorkspace eventId={id} companyId={s.company.id} tab={tab} basePath={`/dj/couples/${id}`} viewer={{ userId: s.userId, djId: s.djId, isAdmin: false }} />
    </div>
  );
}
