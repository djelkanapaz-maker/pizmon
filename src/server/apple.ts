import 'server-only';
import { unstable_cache } from 'next/cache';

/**
 * Apple's public catalog search (iTunes Search API, Israeli store): the fallback while Spotify
 * is rate-limiting. Free, no account. Apple allows roughly 20 requests a minute, so results are
 * cached per query like Spotify's, and a refusal pauses calls for a minute.
 */
export type AppleHit = { id: string; title: string; artists: string; artworkUrl: string | null; url: string | null };
type ApiItem = { kind?: string; trackId?: number; trackName?: string; artistName?: string; artworkUrl100?: string; trackViewUrl?: string };

const ART = /^https:\/\/is[0-9]+-ssl\.mzstatic\.com\/image\/thumb\/[A-Za-z0-9/._-]{1,400}$/;
const URL_RE = /^https:\/\/music\.apple\.com\/[a-z]{2}\/[^\s<>"]{1,400}$/;
let blockedUntil = 0;

export function toAppleHit(t: ApiItem): AppleHit | null {
  if (t.kind !== 'song' || !t.trackId || !t.trackName) return null;
  const art = t.artworkUrl100?.replace('/100x100bb.', '/200x200bb.') ?? null;
  // trackViewUrl points at the iTunes store; music.apple.com is the same page in Apple Music
  const url = t.trackViewUrl?.replace(/^https:\/\/itunes\.apple\.com\//, 'https://music.apple.com/').split('&uo=')[0] ?? null;
  return {
    id: String(t.trackId), title: t.trackName.trim().slice(0, 300), artists: (t.artistName ?? '').trim().slice(0, 300) || 'Unknown',
    artworkUrl: art && ART.test(art) ? art : null, url: url && URL_RE.test(url) ? url : null,
  };
}

async function call(path: string): Promise<ApiItem[]> {
  if (Date.now() < blockedUntil) throw new Error('apple_busy');
  const r = await fetch(`https://itunes.apple.com/${path}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (r.status === 403 || r.status === 429) {
    blockedUntil = Date.now() + 60_000;
    console.error('apple search', r.status);
    throw new Error('apple_busy');
  }
  if (!r.ok) { console.error('apple search', r.status); throw new Error('apple_failed'); }
  return ((await r.json()) as { results?: ApiItem[] }).results ?? [];
}

export async function searchAppleTracks(q: string, total = 30): Promise<AppleHit[]> {
  const items = await call(`search?term=${encodeURIComponent(q.slice(0, 100))}&country=IL&media=music&entity=song&limit=${Math.min(total, 50)}`);
  const seen = new Set<string>();
  return items.map(toAppleHit).filter((h): h is AppleHit => !!h && !seen.has(h.id) && !!seen.add(h.id));
}

/** One song by id (to validate what a couple adds). */
export async function getAppleTrack(id: string): Promise<AppleHit | null> {
  if (!/^[0-9]{1,15}$/.test(id)) return null;
  return toAppleHit((await call(`lookup?id=${id}&country=IL&entity=song`))[0] ?? {});
}

const cached = unstable_cache((q: string, total: number) => searchAppleTracks(q, total), ['apple-search-v1'], { revalidate: 7 * 86_400 });

export async function searchAppleCached(q: string, total = 30): Promise<AppleHit[]> {
  const key = q.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 100);
  if (key.length < 2) return [];
  return cached(key, total);
}
