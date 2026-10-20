import { notFound } from 'next/navigation';
import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { formatDateTime, relativeTime } from '@/i18n/format';
import { Badge, PageHeader, cx } from '@/components/ui';
import { RequestReply } from '@/components/staff/StaffForms';

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireCouple();
  const { m, locale } = await getI18n();
  const db = await supabaseServer();
  const { data: r } = await db.from('couple_requests').select('id, category, title, description, status, opened_by_staff, created_at, request_messages(id, body, author_id, created_at)')
    .eq('id', id).eq('event_id', s.eventId).maybeSingle();
  if (!r) notFound();
  const msgs = ((r.request_messages ?? []) as { id: string; body: string; author_id: string | null; created_at: string }[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <div>
      <PageHeader back={{ href: '/wedding/requests', label: m.requests.title }} kicker={r.opened_by_staff ? m.requests.fromDj : (m.requests.categories as Record<string, string>)[r.category]} title={r.title} />
      <div className="gutter flex flex-col gap-4 max-w-2xl">
        <div className="flex items-center gap-2"><Badge tone={r.status === 'awaiting_couple' ? 'ember' : 'neutral'}>{(m.requests.status as Record<string, string>)[r.status]}</Badge><span className="text-xs text-paper-dim">{formatDateTime(r.created_at, locale)}</span></div>
        {r.description && <p className="card p-4 whitespace-pre-wrap" dir="auto">{r.description}</p>}
        <ul className="flex flex-col gap-2" aria-live="polite">
          {msgs.map((msg) => (
            <li key={msg.id} className={cx('rounded-[14px] p-3 max-w-[85%]', msg.author_id === s.userId ? 'bg-paper text-ink ms-auto' : 'bg-ink-3')}>
              <p className="whitespace-pre-wrap" dir="auto">{msg.body}</p>
              <p className="text-[10px] opacity-60 mt-1">{relativeTime(msg.created_at, locale)}</p>
            </li>
          ))}
        </ul>
        <RequestReply requestId={r.id} status={r.status} />
      </div>
    </div>
  );
}
