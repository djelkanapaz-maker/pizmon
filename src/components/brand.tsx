import Link from 'next/link';
import { FLOW_LINES, PE_PATH, PE_STROKE, TAGLINE_HE, WAVE, WORDMARK } from './pizmon-mark';

export const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Pizmon';

/** The פזמון wordmark (thin Hebrew letters, as on the brand board). `tagline` adds "הרגעים שלכם. המוזיקה שלנו." */
export function BrandMark({ name = BRAND, href = '/', tagline = false, size = 26 }: { name?: string; href?: string; tagline?: boolean; size?: number }) {
  return (
    <Link href={href} className="inline-flex flex-col items-start leading-none text-paper" aria-label={name} dir="rtl">
      <span className="font-[family-name:var(--font-display)] font-extralight tracking-[0.02em]" style={{ fontSize: size }}>{WORDMARK}</span>
      {tagline && <span className="mt-1.5 text-[10.5px] tracking-[0.22em] text-paper-dim">{TAGLINE_HE}</span>}
    </Link>
  );
}

/** The icon mark "פ" in currentColor. */
export function PizmonMark({ size = 32, className, strokeWidth = PE_STROKE }: { size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={className}>
      <path d={PE_PATH} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Thin sound-wave ornament (brand element), in currentColor. */
export function SoundWave({ height = 40, className }: { height?: number; className?: string }) {
  const step = 7, w = WAVE.length * step;
  return (
    <svg width={(w * height) / 60} height={height} viewBox={`0 0 ${w} 60`} aria-hidden className={className}>
      {WAVE.map((h, i) => <line key={i} x1={i * step + 3.5} x2={i * step + 3.5} y1={30 - h / 2} y2={30 + h / 2} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />)}
    </svg>
  );
}

/** Thin flowing lines (brand element "FLOW LINES"), decorative, in champagne/taupe. */
export function FlowLines({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden className={className}>
      {FLOW_LINES.map((d, i) => <path key={i} d={d} fill="none" stroke={i % 3 === 2 ? '#1f1f1f' : i % 2 ? '#a89886' : '#b89f7c'} strokeOpacity={i % 3 === 2 ? 0.25 : 0.6} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}
