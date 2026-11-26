import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getI18n } from '@/i18n/server';
import { BrandMark } from '@/components/brand';
import { StoreBadges, STORE_LINKS } from '@/components/StoreBadges';

export const metadata = { title: 'Get the app · Paskol' };

/**
 * One link for "download the app" (used in notifications and messages): phones go straight to their store,
 * everything else gets both badges.
 */
export default async function GetApp() {
  const ua = (await headers()).get('user-agent') ?? '';
  if (/iPhone|iPad|iPod/i.test(ua)) redirect(STORE_LINKS.appStore);
  if (/Android/i.test(ua)) redirect(STORE_LINKS.googlePlay);
  const { m } = await getI18n();
  const L = m.landing;
  return (
    <main id="main" className="min-h-dvh flex flex-col">
      <header className="brand-frame gutter h-14 flex items-center"><BrandMark /></header>
      <section className="gutter flex-1 flex flex-col items-center justify-center text-center gap-6 py-16">
        <h1 className="display-l">{L.getAppTitle}</h1>
        <p className="text-paper-dim max-w-md">{L.getAppBody}</p>
        <StoreBadges labels={{ appStore: L.appStoreLabel, googlePlay: L.googlePlayLabel }} className="justify-center" />
      </section>
    </main>
  );
}
