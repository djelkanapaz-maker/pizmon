import 'server-only';
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
    headers: { 'accept-language': 'he,en;q=0.8', 'user-agent': 'Mozilla/5.0 (compatible; AtisutoWeddingMusic/1.0)' },
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (r.status === 404) throw new Error('spotify_not_found');
  if (!r.ok) throw new Error('spotify_unreachable');
  return parseEmbedHtml(id, await r.text());
}

type ApiTrack = { id: string | null; name: string; type?: string; duration_ms?: number; artists?: { name: string }[]; album?: { images?: { url: string }[] } };

async function api<T>(url: string, token: string): Promise<T> {
  const r = await fetch(url.startsWith('https://') ? url : `https://api.spotify.com/v1${url}`, {
    headers: { authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (r.status === 404) throw new Error('spotify_not_found');
  if (!r.ok) throw new Error('spotify_api');
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
export async function searchSpotifyTracks(q: string, token: string, limit = 10): Promise<SpotifySearchHit[]> {
  const j = await api<{ tracks?: { items: ApiTrack[] } }>(`/search?type=track&market=IL&limit=${limit}&q=${encodeURIComponent(q.slice(0, 100))}`, token);
  return (j.tracks?.items ?? []).map(hit).filter(Boolean) as SpotifySearchHit[];
}

export async function getSpotifyTrack(id: string, token: string) {
  return hit(await api<ApiTrack>(`/tracks/${id}?market=IL`, token));
}
