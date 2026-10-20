'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useI18n } from '@/i18n/client';
import { signOut } from '@/server/actions/common';
import { BrandMark } from './brand';
import { LocaleSwitch } from './LocaleSwitch';
import { MiniPlayer } from './audio/MiniPlayer';
import { IconBell, IconList, IconX } from './icons';
import { cx } from './ui';

export type StaffNavItem = { href: string; label: string; exact?: boolean };

/** Information-dense shell for DJ and admin desks; collapses to a drawer on small screens. */
export function StaffShell({ brand, title, items, email, unread = 0, notificationsHref, children }: { brand: string; title: string; items: StaffNavItem[]; email: string; unread?: number; notificationsHref: string; children: ReactNode }) {
  const path = usePathname();
  const { m } = useI18n();
  const [open, setOpen] = useState(false);
  const isActive = (it: StaffNavItem) => (it.exact ? path === it.href : path === it.href || path.startsWith(`${it.href}/`));
  const nav = (
    <nav aria-label={title} className="flex flex-col gap-0.5">
      {items.map((it) => (
        <Link key={it.href} href={it.href} onClick={() => setOpen(false)} aria-current={isActive(it) ? 'page' : undefined}
          className={cx('h-10 px-3 rounded-[10px] flex items-center text-sm font-bold transition-colors', isActive(it) ? 'bg-paper text-ink' : 'text-paper-dim hover:text-paper hover:bg-ink-3')}>
          {it.label}
        </Link>
      ))}
    </nav>
  );
  const foot = (
    <div className="mt-auto flex flex-col gap-3 pt-6">
      <Link href={notificationsHref} className="h-10 px-3 rounded-[10px] flex items-center gap-2 text-sm font-bold text-paper-dim hover:text-paper hover:bg-ink-3">
        <IconBell size={18} />{m.nav.notifications}{unread > 0 && <span className="ms-auto min-w-5 h-5 px-1.5 rounded-full bg-ember text-ink text-xs grid place-items-center">{unread}</span>}
      </Link>
      <LocaleSwitch compact />
      <p className="text-xs text-paper-dim truncate px-1" dir="ltr">{email}</p>
      <form action={signOut}><button className="text-sm font-bold text-paper-dim hover:text-paper px-1">{m.common.signOut}</button></form>
    </div>
  );
  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 bg-ink/95 backdrop-blur border-b border-line gutter h-14 flex items-center justify-between pt-[env(safe-area-inset-top)]">
        <BrandMark name={brand} />
        <button type="button" onClick={() => setOpen(true)} aria-label={title} aria-expanded={open} className="size-11 grid place-items-center rounded-full hover:bg-ink-3"><IconList /></button>
      </header>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative w-72 max-w-[85vw] bg-ink-2 border-e border-line p-4 flex flex-col overflow-y-auto animate-rise" role="dialog" aria-modal="true" aria-label={title}>
            <div className="flex items-center justify-between mb-6"><p className="label">{title}</p><button type="button" onClick={() => setOpen(false)} aria-label={m.common.close} className="size-10 grid place-items-center rounded-full hover:bg-ink-3"><IconX /></button></div>
            {nav}{foot}
          </div>
        </div>
      )}
      <aside className="hidden lg:flex fixed inset-y-0 start-0 w-60 flex-col border-e border-line bg-ink px-3 py-5 overflow-y-auto">
        <div className="px-2 mb-2"><BrandMark name={brand} /></div>
        <p className="label px-3 mt-6 mb-2">{title}</p>
        {nav}{foot}
      </aside>
      <main id="main" className="lg:ps-60 pb-24"><div className="mx-auto max-w-[1200px]">{children}</div></main>
      <MiniPlayer />
    </>
  );
}
