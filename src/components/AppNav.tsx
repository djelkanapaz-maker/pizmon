'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import { useI18n } from '@/i18n/client';
import { IconBell, IconDiscover, IconHome, IconRadio, IconRings, IconUser } from './icons';
import { cx } from './ui';
import { BrandMark } from './brand';

export type NavItem = { href: string; label: string; icon: 'home' | 'discover' | 'wedding' | 'radio' | 'profile' };
const ICONS: Record<NavItem['icon'], ComponentType<{ size?: number }>> = {
  home: IconHome, discover: IconDiscover, wedding: IconRings, radio: IconRadio, profile: IconUser,
};

export function AppNav({ items, brand, unread }: { items: NavItem[]; brand: string; unread: number }) {
  const path = usePathname();
  const { m, fmt } = useI18n();
  const active = (href: string) => path === href || path.startsWith(`${href}/`);
  return (
    <>
      {/* phone: bottom tab bar */}
      <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-ink/95 backdrop-blur border-t border-line pb-[var(--safe-b)]">
        <ul className="grid grid-cols-5 h-[var(--nav-h)]">
          {items.map((it) => {
            const Icon = ICONS[it.icon];
            const on = active(it.href);
            return (
              <li key={it.href}>
                <Link href={it.href} aria-current={on ? 'page' : undefined}
                  className={cx('h-full flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors', on ? 'text-paper' : 'text-paper-dim')}>
                  <span className={cx('grid place-items-center h-7 w-12 rounded-full transition-colors', on && 'bg-ember text-ink')}><Icon size={20} /></span>
                  <span className="truncate max-w-full px-1">{it.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* tablet / desktop: side rail */}
      <aside className="hidden md:flex fixed inset-y-0 start-0 z-30 w-[240px] flex-col border-e border-line bg-ink px-4 py-6">
        <div className="-mx-4 -mt-6 mb-8 brand-frame px-6 py-5"><BrandMark name={brand} /></div>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {items.map((it) => {
            const Icon = ICONS[it.icon];
            const on = active(it.href);
            return (
              <Link key={it.href} href={it.href} aria-current={on ? 'page' : undefined}
                className={cx('flex items-center gap-3 h-12 px-3 rounded-full font-bold transition-colors', on ? 'bg-paper text-ink' : 'text-paper-dim hover:text-paper hover:bg-ink-3')}>
                <Icon size={20} />{it.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/notifications" className="mt-auto flex items-center gap-3 h-12 px-3 rounded-full font-bold text-paper-dim hover:text-paper hover:bg-ink-3">
          <span className="relative"><IconBell size={20} />{unread > 0 && <span className="absolute -top-1 -end-1 size-2.5 rounded-full bg-ember" />}</span>
          {m.nav.notifications}{unread > 0 && <span className="ms-auto text-xs text-ember">{fmt(m.notifications.unread, { count: unread })}</span>}
        </Link>
      </aside>
    </>
  );
}

export function TopBell({ unread }: { unread: number }) {
  const { m, fmt } = useI18n();
  return (
    <Link href="/notifications" aria-label={unread ? `${m.nav.notifications} — ${fmt(m.notifications.unread, { count: unread })}` : m.nav.notifications}
      className="md:hidden relative size-11 grid place-items-center rounded-full hover:bg-ink-3">
      <IconBell />
      {unread > 0 && <span className="absolute top-2 end-2 min-w-4 h-4 px-1 rounded-full bg-ember text-ink text-[10px] font-bold grid place-items-center">{unread > 9 ? '9+' : unread}</span>}
    </Link>
  );
}
