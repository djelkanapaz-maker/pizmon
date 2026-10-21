/** Deterministic generated cover for items without authorized artwork. */
const PALETTES: [string, string][] = [
  ['#C01F22', '#FBD100'], ['#FBD100', '#0B0909'], ['#FFFFFF', '#C01F22'], ['#0B0909', '#FBD100'],
  ['#9A171A', '#FFFFFF'], ['#241C1C', '#FBD100'], ['#C01F22', '#FFFFFF'], ['#FBD100', '#C01F22'],
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
