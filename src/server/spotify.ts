import 'server-only';
import { unstable_cache } from 'next/cache';
import { appAccessToken } from '@/server/spotify-auth';
import { parseEmbedHtml, type SpotifyPlaylist, type SpotifyTrack } from '@/core/spotify';

/**
 * Reads a public Spotify playlist.
 * - With a user access token (the company's connected account), uses the official Web API and gets every track.
 * - Otherwise reads Spotify's public embed page, which carries up to 100 tracks.
 */
export async function fetchSpotifyPlaylist(id: string, userToken?: string | null): Promise<SpotifyPlaylist> {
  if (userToken) {
    try { return await viaWebApi(id, userToken); } catch { /* fall back to the embed page */ }
  }
  const r = await fetch(`https://open.spotify.com/embed/playlist/${id}`, {
    headers: { 'accept-language': 'he,en;q=0.8', 'user-agent': 'Mozilla/5.0 (compatible; PizmonWeddingMusic/1.0)' },
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (r.status === 404) throw new Error('spotify_not_found');
  if (!r.ok) throw new Error('spotify_unreachable');
  return parseEmbedHtml(id, await r.text());
}

type ApiTrack = { id: string | null; name: string; type?: string; duration_ms?: number; artists?: { name: string }[]; album?: { images?: { url: string }[] } };

/** Set when Spotify answers 429: no calls until then (this server instance). */
let blockedUntil = 0;
export const spotifyBlocked = () => Date.now() < blockedUntil;

async function api<T>(url: string, token: string): Promise<T> {
  if (spotifyBlocked()) throw new Error('spotify_quota');
  const r = await fetch(url.startsWith('https://') ? url : `https://api.spotify.com/v1${url}`, {
    headers: { authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (r.status === 404) throw new Error('spotify_not_found');
  if (r.status === 429) {
    const wait = Number(r.headers.get('retry-after')) || 60;
    blockedUntil = Date.now() + Math.min(wait, 86_400) * 1000;
    console.error('spotify api 429', url.split('?')[0], 'retry-after', wait);
    throw new Error('spotify_quota');
  }
  if (!r.ok) {
    console.error('spotify api', r.status, url.split('?')[0], r.headers.get('retry-after') ?? '', (await r.text().catch(() => '')).slice(0, 200));
    throw new Error('spotify_api');
  }
  return await r.json() as T;
}

async function viaWebApi(id: string, token: string): Promise<SpotifyPlaylist> {
  const pm = await api<{ name: string; description?: string; images?: { url: string }[] }>(`/playlists/${id}?fields=name,description,images`, token);
  const tracks: SpotifyTrack[] = [];
  // newer API: /items with { item }, older: /tracks with { track }
  let next: string | null = `/playlists/${id}/items?limit=50`;
  for (let page = 0; next && page < 40; page++) {
    const j: { next: string | null; items: { item?: ApiTrack | null; track?: ApiTrack | null }[] } = await api(next, token);
    for (const it of j.items ?? []) {
      const t = it.item ?? it.track;
      if (!t || !t.id || (t.type && t.type !== 'track')) continue;
      tracks.push({
        id: t.id, title: t.name.slice(0, 300), artists: (t.artists ?? []).map((a) => a.name).join(', ').slice(0, 300) || 'Unknown',
        durationMs: t.duration_ms ?? null, artworkUrl: t.album?.images?.at(-2)?.url ?? t.album?.images?.[0]?.url ?? null,
      });
    }
    next = j.next;
  }
  return { id, name: pm.name.replace(/\s+/g, ' ').trim().slice(0, 120) || 'Spotify playlist', description: pm.description?.replace(/<[^>]+>/g, '').slice(0, 2000) || null, artworkUrl: pm.images?.[0]?.url ?? null, tracks, truncated: false };
}

/** Public playlists owned by the connected account. */
export async function listOwnPlaylists(token: string) {
  const me = await api<{ id: string }>('/me', token);
  const ids: string[] = [];
  let next: string | null = '/me/playlists?limit=50';
  for (let page = 0; next && page < 20; page++) {
    const j: { next: string | null; items: ({ id: string; public: boolean | null; owner?: { id: string } } | null)[] } = await api(next, token);
    for (const p of j.items ?? []) if (p && p.owner?.id === me.id && p.public !== false) ids.push(p.id);
    next = j.next;
  }
  return ids;
}

export type SpotifySearchHit = { id: string; title: string; artists: string; artworkUrl: string | null };
const hit = (t: ApiTrack): SpotifySearchHit | null => (t.id ? {
  id: t.id, title: t.name.slice(0, 300), artists: (t.artists ?? []).map((a) => a.name).join(', ').slice(0, 300) || 'Unknown',
  artworkUrl: (t.album?.images?.at(-1)?.url ?? null),
} : null);

/** Spotify's whole catalog (market IL). */
/**
 * Search Spotify's whole catalog. Since Feb 2026 a search request returns at most 10 items,
 * so larger result sets are fetched as parallel pages (offset 0, 10, 20, …).
 */
export async function searchSpotifyTracks(q: string, token: string, total = 50): Promise<SpotifySearchHit[]> {
  const pages = Math.max(1, Math.ceil(Math.min(total, 100) / 10));
  const query = encodeURIComponent(q.slice(0, 100));
  const results = await Promise.allSettled(Array.from({ length: pages }, (_, i) =>
    api<{ tracks?: { items: ApiTrack[] } }>(`/search?type=track&market=IL&limit=10&offset=${i * 10}&q=${query}`, token)));
  // nothing came back and Spotify is rate-limiting: fail, so the empty answer isn't cached
  if (results.every((r) => r.status === 'rejected')) throw (results[0] as PromiseRejectedResult).reason;
  const seen = new Set<string>();
  const hits: SpotifySearchHit[] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const item of r.value.tracks?.items ?? []) {
      const h = hit(item);
      if (h && !seen.has(h.id)) { seen.add(h.id); hits.push(h); }
    }
  }
  return hits;
}

/**
 * Catalog search through a shared server cache (a week per query), so a search typed by many couples,
 * re-rendered after adding a song, or repeated later costs Spotify nothing. Failures aren't cached.
 */
const cachedSearch = unstable_cache(async (q: string, total: number) => {
  const token = await appAccessToken();
  if (!token) throw new Error('spotify_auth');
  return searchSpotifyTracks(q, token, total);
}, ['spotify-search-v1'], { revalidate: 7 * 86_400 });

export async function searchSpotifyCached(q: string, total = 30): Promise<SpotifySearchHit[]> {
  const key = q.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 100);
  if (key.length < 2) return [];
  if (spotifyBlocked()) throw new Error('spotify_quota');
  return cachedSearch(key, total);
}

export async function getSpotifyTrack(id: string, token: string) {
  return hit(await api<ApiTrack>(`/tracks/${id}?market=IL`, token));
}

/** Loose song identity: lower case, no "(…)", "[…]" or " - …" version suffixes, no punctuation. */
export const normSong = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s*[([].*?[)\]]/g, '').replace(/\s+-\s+.*$/, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const artistsOf = (s: string) => s.split(/,|&| x | feat\.? | ft\.? /i).map(normSong).filter(Boolean);

/** Finds the Spotify track for a title + artist (one request), or null when nothing matches closely. */
export async function findSpotifyTrack(title: string, artist: string, token: string): Promise<SpotifySearchHit | null> {
  const lead = artistsOf(artist)[0] ?? '';
  const q = encodeURIComponent(`track:${normSong(title)} artist:${lead}`.slice(0, 200));
  const r = await api<{ tracks?: { items: ApiTrack[] } }>(`/search?type=track&market=IL&limit=5&q=${q}`, token);
  const want = normSong(title);
  for (const item of r.tracks?.items ?? []) {
    const h = hit(item);
    if (h && normSong(h.title) === want && artistsOf(h.artists).includes(lead)) return h;
  }
  return null;
}
