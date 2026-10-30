import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { appAccessToken } from '@/server/spotify-auth';
import { findSpotifyTrack, spotifyBlocked } from '@/server/spotify';

/**
 * Songs couples added from Apple's catalog (while Spotify was rate-limiting) get their Spotify
 * track once Spotify answers again. Runs as an admin (RLS + admin_link_spotify checks), a few at a time.
 * Songs with no close match keep their Apple link and are tried again later.
 */
export async function completeAppleTracks(db: SupabaseClient, companyId: string, max = 12) {
  if (spotifyBlocked()) return { linked: 0, tried: 0 };
  const token = await appAccessToken();
  if (!token) return { linked: 0, tried: 0 };
  const { data } = await db.from('music_tracks').select('id, title, artist:artists(name)')
    .eq('company_id', companyId).eq('provider', 'apple_music').order('updated_at', { ascending: true }).limit(max);
  let linked = 0, tried = 0;
  for (const t of (data ?? []) as unknown as { id: string; title: string; artist: { name: string } | null }[]) {
    tried++;
    let h;
    try { h = await findSpotifyTrack(t.title, t.artist?.name ?? '', token); } catch { break; } // quota or network: stop for now
    if (h) {
      const art = h.artworkUrl && /^https:\/\/i\.scdn\.co\/image\/[A-Za-z0-9]+$/.test(h.artworkUrl) ? h.artworkUrl : null;
      const { error } = await db.rpc('admin_link_spotify', { p_track: t.id, p_spotify: h.id, p_artwork: art });
      if (!error) linked++;
    } else {
      // move it to the back of the queue
      await db.from('music_tracks').update({ updated_at: new Date().toISOString() }).eq('id', t.id);
    }
  }
  return { linked, tried };
}
