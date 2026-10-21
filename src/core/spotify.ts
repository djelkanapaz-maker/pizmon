// Pure helpers for reading public Spotify playlists (shared by the server sync and tests).

export type SpotifyTrack = { id: string; title: string; artists: string; durationMs: number | null; artworkUrl: string | null };
export type SpotifyPlaylist = { id: string; name: string; description: string | null; artworkUrl: string | null; tracks: SpotifyTrack[]; truncated: boolean };

const ID = /^[A-Za-z0-9]{22}$/;

/** Every playlist id found in free text: links (open.spotify.com/playlist/…, with or without locale/query) or URIs. */
export function parsePlaylistIds(text: string): string[] {
  const out: string[] = [];
  const re = /(?:open\.spotify\.com\/(?:[a-z-]+\/)?(?:embed\/)?playlist\/|spotify:playlist:)([A-Za-z0-9]{22})/g;
  for (const m of text.matchAll(re)) if (!out.includes(m[1])) out.push(m[1]);
  for (const tok of text.split(/\s+/)) if (ID.test(tok) && !out.includes(tok)) out.push(tok);
  return out;
}

/** The public embed page carries the first 100 tracks of a playlist in its __NEXT_DATA__ JSON. */
export const EMBED_LIMIT = 100;

export function parseEmbedHtml(id: string, html: string): SpotifyPlaylist {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('spotify_unreadable');
  const entity = JSON.parse(m[1])?.props?.pageProps?.state?.data?.entity;
  if (!entity || !Array.isArray(entity.trackList)) throw new Error('spotify_unreadable');
  const tracks: SpotifyTrack[] = [];
  for (const t of entity.trackList as { uri?: string; title?: string; subtitle?: string; duration?: number; entityType?: string }[]) {
    const tid = t.uri?.match(/^spotify:track:([A-Za-z0-9]{22})$/)?.[1];
    if (!tid || !t.title) continue; // skips podcast episodes and local files
    tracks.push({ id: tid, title: t.title.trim().slice(0, 300), artists: (t.subtitle ?? '').replace(/ /g, ' ').trim().slice(0, 300) || 'Unknown', durationMs: t.duration ?? null, artworkUrl: null });
  }
  const art = (entity.coverArt?.sources ?? []) as { url?: string }[];
  return {
    id, name: String(entity.name ?? entity.title ?? 'Spotify playlist').trim().slice(0, 120) || 'Spotify playlist',
    description: null, artworkUrl: art.find((s) => s.url?.startsWith('https://'))?.url ?? null,
    tracks, truncated: entity.trackList.length >= EMBED_LIMIT,
  };
}
