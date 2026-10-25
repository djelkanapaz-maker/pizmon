// פזמון brand marks (from the brand board). One place for the icon "פ", the sound-wave and
// the flow lines, shared by the header, splash, app icons and the PDF brief.
export const BRAND_COLORS = { ivory: '#f8f4ed', champagne: '#d7c3a6', taupe: '#a89886', charcoal: '#1f1f1f', white: '#ffffff' };
export const WORDMARK = 'פזמון';
export const TAGLINE_HE = 'הרגעים שלכם. המוזיקה שלנו.';
export const TAGLINE_EN = 'Your moments. Our music.';

/** The icon mark: a thin, rounded "פ" drawn as strokes in a 64×64 box (stroke it, don't fill it). */
export const PE_PATH = 'M17 19H41Q49 19 49 27V37Q49 45 41 45H13M17 19V26Q17 30 21 30H28';
export const PE_STROKE = 3.4;

/** Sound-wave bar heights (brand element "SOUNDWAVE"): symmetric, tallest in the middle. */
export const WAVE = [10, 18, 28, 42, 56, 42, 30, 20, 34, 48, 34, 22, 14];

/** Flow lines (brand element "FLOW LINES"), drawn in a 1200×400 box. */
export const FLOW_LINES = Array.from({ length: 7 }, (_, i) => {
  const o = i * 11; // lines run side by side and fan out gently, like the board's flow lines
  return `M-40 ${236 + o}C 200 ${150 + o * 1.5}, 430 ${330 + o * 0.7}, 650 ${236 + o}S 1010 ${110 + o * 1.7}, 1240 ${196 + o * 0.6}`;
});

/** Stand-alone SVG of the icon mark (for the PDF brief and icons). */
export function peSvg({ size = 64, color = BRAND_COLORS.charcoal } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><path d="${PE_PATH}" fill="none" stroke="${color}" stroke-width="${PE_STROKE}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
