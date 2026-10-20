import Link from 'next/link';

/** Wordmark. The product name is configurable per company (companies.brand_name). */
export function BrandMark({ name = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'WEDDING MUSIC CLUB', href = '/' }: { name?: string; href?: string }) {
  const words = name.split(' ');
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 group" aria-label={name}>
      <span aria-hidden className="relative size-8 rounded-full bg-ember grid place-items-center">
        <span className="size-3 rounded-full bg-ink" />
        <span className="absolute inset-[5px] rounded-full border border-ink/40" />
      </span>
      <span className="display text-[13px] leading-[0.9] tracking-tight" dir="ltr">
        {words.slice(0, Math.ceil(words.length / 2)).join(' ')}<br />{words.slice(Math.ceil(words.length / 2)).join(' ')}
      </span>
    </Link>
  );
}
