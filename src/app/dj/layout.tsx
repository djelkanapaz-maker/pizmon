import type { ReactNode } from 'react';
import { requireDj } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { StaffShell } from '@/components/StaffShell';

export default async function DjLayout({ children }: { children: ReactNode }) {
  const s = await requireDj();
  const { m } = await getI18n();
  const db = await supabaseServer();
  const { count } = await db.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', s.userId).is('read_at', null);
  const items = [
    { href: '/dj', label: m.dj.couples, exact: true },
    { href: '/dj/profile', label: m.profile.title },
  ];
  return <StaffShell brand={s.company.brand_name} title={m.dj.title} items={items} email={s.email} notificationsHref="/dj/notifications" unread={count ?? 0}>{children}</StaffShell>;
}
