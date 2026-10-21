import type { ReactNode } from 'react';
import { NativeBridge } from '@/components/native/NativeBridge';
import { redirect } from 'next/navigation';
import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { AppNav, TopBell } from '@/components/AppNav';
import { MiniPlayer } from '@/components/audio/MiniPlayer';
import { BrandMark } from '@/components/brand';

export default async function CoupleLayout({ children }: { children: ReactNode }) {
  const s = await requireCouple();
  const db = await supabaseServer();
  const [{ data: ev }, { count }] = await Promise.all([
    db.from('wedding_events').select('onboarding_step').eq('id', s.eventId).single(),
    db.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', s.userId).is('read_at', null),
  ]);
  // first visit goes through the welcome flow; after that nothing is blocked
  if (ev?.onboarding_step === 'welcome') redirect('/onboarding');
  const { m } = await getI18n();
  const items = [
    { href: '/home', label: m.nav.home, icon: 'home' as const },
    { href: '/discover', label: m.nav.discover, icon: 'discover' as const },
    { href: '/wedding', label: m.nav.wedding, icon: 'wedding' as const },
    { href: '/radio', label: m.nav.radio, icon: 'radio' as const },
    { href: '/profile', label: m.nav.profile, icon: 'profile' as const },
  ];
  return (
    <>
      <div className="md:hidden sticky top-0 z-30 brand-frame gutter pt-[env(safe-area-inset-top)] h-[calc(56px+env(safe-area-inset-top))] flex items-center justify-between">
        <BrandMark name={s.company.brand_name} href="/home" />
        <TopBell unread={count ?? 0} />
      </div>
      <AppNav items={items} brand={s.company.brand_name} unread={count ?? 0} />
      <main id="main" className="md:ps-[240px] pb-app md:pb-24">
        <div className="mx-auto max-w-[1100px]">{children}</div>
      </main>
      <MiniPlayer />
      <NativeBridge />
    </>
  );
}
