// The Pizmon mark: a round badge holding a five-bar sound wave. Shared by the header,
// splash, app icons and the PDF brief so the logo lives in one place.
export const MARK_VIEWBOX = '0 0 64 64';
export const BRAND_COLORS = { violet: '#8b7bff', violetStrong: '#6f5cff', electric: '#3fa9ff', magenta: '#e04cc4', ink: '#07070a' };
// [x, height] of each bar, centred on y = 32
export const MARK_BARS: [number, number][] = [[14, 14], [23, 28], [32, 40], [41, 24], [50, 12]];
export const BAR_W = 5.4;

/** Bars as SVG path data (rounded caps), centred in the 64×64 box. */
export const barsPath = () =>
  MARK_BARS.map(([x, h]) => {
    const r = BAR_W / 2, top = 32 - h / 2, bottom = 32 + h / 2, l = x - r, rr = x + r;
    return `M${l},${top + r}A${r},${r},0,0,1,${rr},${top + r}V${bottom - r}A${r},${r},0,0,1,${l},${bottom - r}Z`;
  }).join('');

/** A standalone SVG string (for the PDF brief and icons). */
export function markSvg(opts: { size?: number; mono?: string } = {}) {
  const { size = 64, mono } = opts;
  const fill = mono ? mono : 'url(#pzg)';
  const bars = mono ? '#fff' : BRAND_COLORS.ink;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${MARK_VIEWBOX}">${mono ? '' : `<defs><linearGradient id="pzg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BRAND_COLORS.violetStrong}"/><stop offset=".55" stop-color="${BRAND_COLORS.electric}"/><stop offset="1" stop-color="${BRAND_COLORS.magenta}"/></linearGradient></defs>`}<circle cx="32" cy="32" r="32" fill="${fill}"/><path d="${barsPath()}" fill="${bars}"/></svg>`;
}
