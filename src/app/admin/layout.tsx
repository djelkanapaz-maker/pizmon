import type { ReactNode } from 'react';
import { requireRole } from '@/server/session';
import { getI18n } from '@/i18n/server';
import { StaffShell } from '@/components/StaffShell';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const s = await requireRole('admin');
  const { m } = await getI18n();
  const items = [
    { href: '/admin', label: m.admin.overview, exact: true },
    { href: '/admin/couples', label: m.admin.couples },
    { href: '/admin/djs', label: m.admin.djs },
    { href: '/admin/catalog', label: m.admin.catalog },
    { href: '/admin/taxonomy', label: m.admin.taxonomy },
    { href: '/admin/moments', label: m.admin.moments },
    { href: '/admin/playlists', label: m.admin.playlists },
    { href: '/admin/content', label: m.admin.content },
    { href: '/admin/radio', label: m.admin.radio },
    { href: '/admin/questionnaire', label: m.admin.questionnaire },
    { href: '/admin/settings', label: m.admin.settings },
  ];
  return <StaffShell brand={s.company.brand_name} title={m.admin.title} items={items} email={s.email} notificationsHref="/admin/notifications">{children}</StaffShell>;
}
