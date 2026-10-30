import type { ReactNode } from 'react';
import { after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { completeAppleTracks } from '@/server/spotify-link';
import { requireRole } from '@/server/session';
import { getI18n } from '@/i18n/server';
import { StaffShell } from '@/components/StaffShell';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const s = await requireRole('admin');
  // songs couples added from Apple's catalog get their Spotify link once Spotify answers again
  const token = (await (await supabaseServer()).auth.getSession()).data.session?.access_token;
  if (token) after(async () => {
    const db = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    try { await completeAppleTracks(db, s.company.id); } catch (e) { console.error('apple→spotify linking', e instanceof Error ? e.message : e); }
  });
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
