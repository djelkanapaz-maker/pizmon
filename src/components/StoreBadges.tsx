import { cx } from '@/components/ui';

/** Paskol in the stores. */
export const STORE_LINKS = {
  appStore: 'https://apps.apple.com/il/app/%D7%A4%D7%A1%D7%A7%D7%95%D7%9C/id6834345653',
  googlePlay: 'https://play.google.com/store/apps/details?id=app.paskol&hl=he',
} as const;

/** The official App Store and Google Play badges (as supplied by Apple and Google), linking to Paskol. */
export function StoreBadges({ labels, className }: { labels: { appStore: string; googlePlay: string }; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-3', className)} dir="ltr">
      <a href={STORE_LINKS.appStore} target="_blank" rel="noopener" aria-label={labels.appStore} className="rounded-[10px] transition-transform hover:-translate-y-0.5 focus-visible:outline-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- official badge, as supplied */}
        <img src="/badges/app-store.svg" alt="Download on the App Store" width={144} height={48} className="block h-12 w-auto" />
      </a>
      <a href={STORE_LINKS.googlePlay} target="_blank" rel="noopener" aria-label={labels.googlePlay} className="rounded-[10px] transition-transform hover:-translate-y-0.5 focus-visible:outline-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- official badge, as supplied */}
        <img src="/badges/google-play.png" alt="Get it on Google Play" width={161} height={48} className="block h-12 w-auto" />
      </a>
    </div>
  );
}
