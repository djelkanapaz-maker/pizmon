import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { relativeTime } from '@/i18n/format';
import { requireSession } from '@/server/session';
import { EmptyState, PageHeader, cx } from './ui';
import { MarkAllRead } from './MarkAllRead';

export async function NotificationsView() {
  const s = await requireSession();
  const { m, locale } = await getI18n();
  const db = await supabaseServer();
  const { data } = await db.from('notifications').select('id, title_he, title_en, link, read_at, created_at').eq('user_id', s.userId).order('created_at', { ascending: false }).limit(100);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <div>
      <PageHeader title={m.notifications.title} sub={unread ? m.notifications.unread.replace('{count}', String(unread)) : undefined} actions={unread ? <MarkAllRead /> : undefined} />
      {items.length === 0 ? <div className="gutter"><EmptyState title={m.notifications.empty} /></div> : (
        <ul className="gutter flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={n.link ?? '#'} className={cx('card p-4 flex items-center gap-3 hover:border-paper-dim', !n.read_at && 'border-ember/50')}>
                <span className={cx('size-2 rounded-full shrink-0', n.read_at ? 'bg-transparent' : 'bg-ember')} aria-hidden />
                <span className={cx('flex-1 text-sm', !n.read_at && 'font-bold')}>{locale === 'he' ? n.title_he : n.title_en}</span>
                <time className="text-xs text-paper-dim shrink-0" dateTime={n.created_at}>{relativeTime(n.created_at, locale)}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
