import Link from 'next/link';
import { BRAND_COLORS, MARK_VIEWBOX, barsPath } from './pizmon-mark';

export const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Pizmon';

/** Pizmon wordmark: the round sound-wave mark + the name. */
export function BrandMark({ name = BRAND, href = '/' }: { name?: string; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2" aria-label={name} dir="ltr">
      <PizmonMark size={28} />
      <span className="font-[family-name:var(--font-display)] font-bold text-[19px] tracking-[-0.02em] text-paper">{name}</span>
    </Link>
  );
}

/** The round mark. The gradient is CSS so no SVG <defs> ids are shared between copies. `mono` uses currentColor. */
export function PizmonMark({ size = 32, className, mono }: { size?: number; className?: string; mono?: boolean }) {
  return (
    <span aria-hidden className={className} style={{
      display: 'inline-grid', placeItems: 'center', width: size, height: size, borderRadius: '50%', flex: 'none',
      background: mono ? 'currentColor' : `linear-gradient(135deg, ${BRAND_COLORS.violetStrong}, ${BRAND_COLORS.electric} 55%, ${BRAND_COLORS.magenta})`,
    }}>
      <svg width={size} height={size} viewBox={MARK_VIEWBOX}><path d={barsPath()} fill={mono ? 'var(--color-ink)' : BRAND_COLORS.ink} /></svg>
    </span>
  );
}
