import Link from 'next/link';
import { FLOW_LINES, LOGO, PE_PATH, PE_STROKE, TAGLINE_HE, WAVE } from './pizmon-mark';

export const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'פסקול';

/** The פסקול logo (record, horn and wordmark). `size` is the logo height in px; `tagline` adds "הרגעים שלכם. המוזיקה שלנו." */
export function BrandMark({ name = BRAND, href = '/', tagline = false, size = 26 }: { name?: string; href?: string; tagline?: boolean; size?: number }) {
  const h = Math.round(size * 1.7);
  return (
    <Link href={href} className="inline-flex items-center gap-3 leading-none text-paper" aria-label={name} dir="rtl">
      {/* eslint-disable-next-line @next/next/no-img-element -- small static brand asset */}
      <img src={h > 80 ? LOGO.src : LOGO.small} alt={name} width={Math.round(h * LOGO.ratio)} height={h} className="shrink-0" style={{ height: h, width: 'auto' }} />
      {tagline && <span className="text-[11px] font-bold tracking-[0.02em] text-paper-dim max-w-[9rem] leading-snug">{TAGLINE_HE}</span>}
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
