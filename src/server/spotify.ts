import 'server-only';
import { parseEmbedHtml, type SpotifyPlaylist, type SpotifyTrack } from '@/core/spotify';

/**
 * Reads a public Spotify playlist.
 * - With SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET set (server-only env), uses the official Web API
 *   (client-credentials flow), which returns every track.
 * - Otherwise reads Spotify's public embed page, which carries up to 100 tracks.
 */
export async function fetchSpotifyPlaylist(id: string): Promise<SpotifyPlaylist> {
  if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    try { return await viaWebApi(id); } catch { /* fall back to the embed page */ }
  }
  const r = await fetch(`https://open.spotify.com/embed/playlist/${id}`, {
    headers: { 'accept-language': 'he,en;q=0.8', 'user-agent': 'Mozilla/5.0 (compatible; AtisutoWeddingMusic/1.0)' },
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (r.status === 404) throw new Error('spotify_not_found');
  if (!r.ok) throw new Error('spotify_unreachable');
  return parseEmbedHtml(id, await r.text());
}

let token: { value: string; exp: number } | null = null;
async function appToken() {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials', cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error('spotify_auth');
  const j = await r.json() as { access_token: string; expires_in: number };
  token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.value;
}

async function viaWebApi(id: string): Promise<SpotifyPlaylist> {
  const auth = { authorization: `Bearer ${await appToken()}` };
  const meta = await fetch(`https://api.spotify.com/v1/playlists/${id}?fields=name,description,images`, { headers: auth, cache: 'no-store' });
  if (!meta.ok) throw new Error('spotify_api');
  const pm = await meta.json() as { name: string; description?: string; images?: { url: string }[] };
  const tracks: SpotifyTrack[] = [];
  let next: string | null = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100&fields=next,items(track(id,name,type,duration_ms,artists(name),album(images)))`;
  for (let page = 0; next && page < 20; page++) {
    const r: Response = await fetch(next, { headers: auth, cache: 'no-store' });
    if (!r.ok) throw new Error('spotify_api');
    const j = await r.json() as { next: string | null; items: { track: { id: string | null; name: string; type: string; duration_ms: number; artists: { name: string }[]; album?: { images?: { url: string }[] } } | null }[] };
    for (const it of j.items) {
      const t = it.track;
      if (!t || !t.id || t.type !== 'track') continue;
      tracks.push({ id: t.id, title: t.name.slice(0, 300), artists: t.artists.map((a) => a.name).join(', ').slice(0, 300) || 'Unknown', durationMs: t.duration_ms, artworkUrl: t.album?.images?.at(-2)?.url ?? t.album?.images?.[0]?.url ?? null });
    }
    next = j.next;
  }
  return { id, name: pm.name.slice(0, 120), description: pm.description?.replace(/<[^>]+>/g, '').slice(0, 2000) || null, artworkUrl: pm.images?.[0]?.url ?? null, tracks, truncated: false };
}
