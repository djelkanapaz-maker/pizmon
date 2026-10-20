/** Deterministic generated cover for items without authorized artwork. */
const PALETTES: [string, string][] = [
  ['#FF5B35', '#0F0E0D'], ['#E9B949', '#0F0E0D'], ['#F3ECDF', '#0F0E0D'], ['#2E4A3F', '#F3ECDF'],
  ['#5B2A86', '#F3ECDF'], ['#1F3A5F', '#E9B949'], ['#8C2F39', '#F3ECDF'], ['#3A3530', '#FF5B35'],
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function coverFor(seed: string) {
  const h = hash(seed);
  const [bg, fg] = PALETTES[h % PALETTES.length];
  return { bg, fg, variant: (h >> 4) % 4 };
}

export function initials(text: string) {
  const words = text.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}
