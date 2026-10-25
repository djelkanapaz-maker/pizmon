/** Deterministic generated cover for items without authorized artwork. */
const PALETTES: [string, string][] = [
  ['#F8F4ED', '#1F1F1F'], ['#D7C3A6', '#1F1F1F'], ['#A89886', '#FFFFFF'], ['#1F1F1F', '#D7C3A6'],
  ['#EFE7DA', '#8F7756'], ['#FFFFFF', '#A89886'], ['#E9DCC8', '#1F1F1F'], ['#2B2925', '#F8F4ED'],
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
