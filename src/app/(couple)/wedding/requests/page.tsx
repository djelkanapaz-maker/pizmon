import Link from 'next/link';
import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { relativeTime } from '@/i18n/format';
import { getMoments } from '@/server/queries';
import { Badge, EmptyState, PageHeader, cx } from '@/components/ui';
import { IconChevron } from '@/components/icons';
import { NewRequestButton } from './NewRequest';

export default async function RequestsPage() {
  const s = await requireCouple();
  const { m, locale } = await getI18n();
  const db = await supabaseServer();
  const [{ data }, moments] = await Promise.all([
    db.from('couple_requests').select('id, category, title, status, opened_by_staff, updated_at, request_messages(count)').eq('event_id', s.eventId).order('updated_at', { ascending: false }),
    getMoments(s.company.id),
  ]);
  const reqs = (data ?? []) as unknown as { id: string; category: string; title: string; status: string; opened_by_staff: boolean; updated_at: string; request_messages: { count: number }[] }[];
  return (
    <div>
      <PageHeader back={{ href: '/wedding', label: m.wedding.title }} title={m.requests.title} sub={m.requests.sub}
        actions={<NewRequestButton moments={moments.map((x) => ({ id: x.id, label: locale === 'he' ? x.name_he : x.name_en }))} />} />
      {reqs.length === 0 ? <div className="gutter"><EmptyState title={m.requests.empty} /></div> : (
        <ul className="gutter flex flex-col gap-2">
          {reqs.map((r) => (
            <li key={r.id}>
              <Link href={`/wedding/requests/${r.id}`} className={cx('card p-4 flex items-center gap-3 hover:border-paper-dim', r.status === 'awaiting_couple' && 'border-ember')}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-paper-dim">{r.opened_by_staff ? m.requests.fromDj : (m.requests.categories as Record<string, string>)[r.category]} · {relativeTime(r.updated_at, locale)}</p>
                  <p className="font-bold truncate" dir="auto">{r.title}</p>
                </div>
                <Badge tone={r.status === 'awaiting_couple' ? 'ember' : r.status === 'resolved' ? 'ok' : 'neutral'}>{(m.requests.status as Record<string, string>)[r.status]}</Badge>
                <IconChevron size={18} className="text-paper-dim" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
