import Link from 'next/link';

const LOGO = process.env.NEXT_PUBLIC_BRAND_LOGO ?? '/brand/atisuto-slick.svg';

/** Company wordmark (Atisuto logo by default). Set NEXT_PUBLIC_BRAND_LOGO="" to fall back to a text mark. */
export function BrandMark({ name = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'ATISUTO', href = '/' }: { name?: string; href?: string }) {
  if (LOGO) {
    return (
      <Link href={href} className="inline-flex items-center" aria-label={name}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt={name} width={126} height={24} className="h-6 w-auto" />
      </Link>
    );
  }
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label={name}>
      <span aria-hidden className="size-8 rounded-full bg-ember" />
      <span className="display text-[15px]" dir="ltr">{name}</span>
    </Link>
  );
}

/** The Atisuto star mark, inline so it can take any colour. */
export function StarMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60.2 60.2" aria-hidden className={className}>
      <path fill="currentColor" d="M30.1,0A30.1,30.1,0,1,0,60.2,30.1,30.13,30.13,0,0,0,30.1,0ZM43.9,49.8,30.1,39.7,16.2,49.8l5.3-16.3L7.7,23.4H24.8L30.1,7.1l5.3,16.3H52.5L38.7,33.5Z" />
    </svg>
  );
}
