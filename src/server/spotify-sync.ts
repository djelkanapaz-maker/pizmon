import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SpotifyPlaylist } from '@/core/spotify';

const chunk = <T,>(a: T[], n = 100) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Mirrors one Spotify playlist into an editorial playlist + catalog tracks (metadata only). Runs as the admin (RLS). */
export async function syncSpotifyPlaylist(db: SupabaseClient, companyId: string, userId: string, pl: SpotifyPlaylist) {
  // 1. the editorial playlist (title/purpose/status are left alone once the admin has it)
  const { data: existing, error: e0 } = await db.from('playlists').select('id').eq('company_id', companyId).eq('spotify_playlist_id', pl.id).maybeSingle();
  if (e0) throw e0;
  let playlistId = existing?.id as string | undefined;
  const syncFields = { artwork_url: pl.artworkUrl, synced_at: new Date().toISOString(), sync_truncated: pl.truncated };
  if (playlistId) {
    const { error } = await db.from('playlists').update(syncFields).eq('id', playlistId);
    if (error) throw error;
  } else {
    const purpose = /חופה|hupa|chupp?ah/i.test(pl.name) ? 'ceremony' : null;
    const { data, error } = await db.from('playlists').insert({
      ...syncFields, company_id: companyId, kind: 'editorial', title: pl.name, description: pl.description, purpose,
      status: 'published', spotify_playlist_id: pl.id, created_by: userId,
    }).select('id').single();
    if (error) throw error;
    playlistId = data.id as string;
  }

  // 2. artists (one row per credited-artists string, as Spotify shows it)
  const names = [...new Set(pl.tracks.map((t) => t.artists))];
  const artistId = new Map<string, string>();
  for (const part of chunk(names)) {
    const { error } = await db.from('artists').upsert(part.map((name) => ({ company_id: companyId, name })), { onConflict: 'company_id,name', ignoreDuplicates: true });
    if (error) throw error;
    const { data, error: e2 } = await db.from('artists').select('id, name').eq('company_id', companyId).in('name', part);
    if (e2) throw e2;
    (data ?? []).forEach((a) => artistId.set(a.name as string, a.id as string));
  }

  // 3. tracks: new ones are added as published metadata; existing ones keep admin edits
  const ids = [...new Set(pl.tracks.map((t) => t.id))];
  const trackId = new Map<string, string>();
  for (const part of chunk(ids)) {
    const { data, error } = await db.from('music_tracks').select('id, provider_track_id').eq('company_id', companyId).eq('provider', 'spotify').in('provider_track_id', part);
    if (error) throw error;
    (data ?? []).forEach((t) => trackId.set(t.provider_track_id as string, t.id as string));
  }
  // songs a couple added on their own become regular catalog songs once the company playlist has them
  const adopted = [...trackId.values()];
  for (const part of chunk(adopted)) {
    const { error } = await db.from('music_tracks').update({ added_by_event: null }).in('id', part).not('added_by_event', 'is', null);
    if (error) throw error;
  }
  // the same song from another release (new Spotify id, same title + artist) is the same catalog song
  const songKey = (title: string, artist: string) => `${artist}\u0000${title.trim().toLowerCase()}`;
  const unmatched = pl.tracks.filter((t) => !trackId.has(t.id) && artistId.has(t.artists));
  const byArtist = [...new Set(unmatched.map((t) => artistId.get(t.artists)!))];
  const known = new Map<string, string>();
  for (const part of chunk(byArtist)) {
    const { data, error } = await db.from('music_tracks').select('id, title, artist_id, added_by_event, created_at').eq('company_id', companyId).in('artist_id', part)
      .order('added_by_event', { ascending: true, nullsFirst: true }).order('created_at');
    if (error) throw error;
    for (const r of data ?? []) { const k = songKey(r.title as string, r.artist_id as string); if (!known.has(k)) known.set(k, r.id as string); }
  }
  for (const t of unmatched) {
    const hit = known.get(songKey(t.title, artistId.get(t.artists)!));
    if (hit) trackId.set(t.id, hit);
  }
  // …and two releases of one song inside this playlist become one new row
  const seen = new Set<string>();
  const missing = pl.tracks.filter((t) => {
    if (trackId.has(t.id) || !artistId.has(t.artists)) return false;
    const k = songKey(t.title, artistId.get(t.artists)!);
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  for (const part of chunk(missing)) {
    const { data, error } = await db.from('music_tracks').upsert(part.map((t) => ({
      company_id: companyId, title: t.title, artist_id: artistId.get(t.artists)!, provider: 'spotify', provider_track_id: t.id,
      external_url: `https://open.spotify.com/track/${t.id}`, artwork_url: t.artworkUrl, rights_status: 'metadata_only', status: 'published',
    })), { onConflict: 'company_id,provider,provider_track_id' }).select('id, provider_track_id');
    if (error) throw error;
    (data ?? []).forEach((t) => trackId.set(t.provider_track_id as string, t.id as string));
  }
  // the other releases of a song added just now point at that one row
  const added = new Map(missing.filter((t) => trackId.has(t.id)).map((t) => [songKey(t.title, artistId.get(t.artists)!), trackId.get(t.id)!]));
  for (const t of pl.tracks) {
    if (!trackId.has(t.id) && artistId.has(t.artists)) { const hit = added.get(songKey(t.title, artistId.get(t.artists)!)); if (hit) trackId.set(t.id, hit); }
  }
  // songs matched by title + artist that a couple had added become company songs too
  for (const part of chunk([...new Set(trackId.values())])) {
    const { error } = await db.from('music_tracks').update({ added_by_event: null }).in('id', part).not('added_by_event', 'is', null);
    if (error) throw error;
  }

  // 4. playlist order mirrors Spotify (one row per song)
  const { error: e3 } = await db.from('playlist_tracks').delete().eq('playlist_id', playlistId);
  if (e3) throw e3;
  const songs = [...new Set(ids.filter((id) => trackId.has(id)).map((id) => trackId.get(id)!))];
  const rows = songs.map((track_id, position) => ({ playlist_id: playlistId, track_id, position, added_by: userId }));
  for (const part of chunk(rows, 200)) {
    const { error } = await db.from('playlist_tracks').insert(part);
    if (error) throw error;
  }
  return { playlistId: playlistId!, title: pl.name, tracks: rows.length, truncated: pl.truncated };
}
