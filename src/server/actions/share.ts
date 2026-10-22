'use server';
// Friends help pick songs. The couple manages one share link; friends (no account) use it to
// see the couple's playlist and suggest songs from Spotify. Suggestions wait for the couple.
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { getSession } from '@/server/session';
import { errorCode, fail, ok, type ActionResult } from '@/server/result';
import { appAccessToken } from '@/server/spotify-auth';
import { getSpotifyTrack, searchSpotifyTracks, type SpotifySearchHit } from '@/server/spotify';
import { addSpotifyToOurPlaylist } from './couple';

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const SPOTIFY = /^[A-Za-z0-9]{22}$/;
const ART = /^https:\/\/i\.scdn\.co\/image\/[A-Za-z0-9]+$/;

async function coupleCtx() {
  const s = await getSession();
  if (!s || s.role !== 'couple' || !s.eventId) return null;
  return { s: s as typeof s & { eventId: string }, db: await supabaseServer() };
}

// ── couple side ──
export async function createShareLink(rotate = false): Promise<ActionResult<{ token: string }>> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const { data: cur } = await c.db.from('share_links').select('id, token').eq('event_id', c.s.eventId).is('revoked_at', null).maybeSingle();
  if (cur && !rotate) return ok({ token: cur.token as string });
  if (cur) {
    const { error } = await c.db.from('share_links').update({ revoked_at: new Date().toISOString() }).eq('id', cur.id);
    if (error) return fail(errorCode(error));
  }
  const token = randomBytes(18).toString('base64url');
  const { error } = await c.db.from('share_links').insert({ event_id: c.s.eventId, token, created_by: c.s.userId });
  if (error) return fail(errorCode(error));
  revalidatePath('/wedding/playlists');
  return ok({ token });
}

export async function revokeShareLink(): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const { error } = await c.db.from('share_links').update({ revoked_at: new Date().toISOString() }).eq('event_id', c.s.eventId).is('revoked_at', null);
  if (error) return fail(errorCode(error));
  revalidatePath('/wedding/playlists');
  return ok(undefined);
}

export async function handleFriendSuggestion(id: string, action: 'add' | 'dismiss', playlistTitle?: string): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  if (!z.guid().safeParse(id).success) return fail('validation');
  const { data: sug } = await c.db.from('friend_suggestions').select('id, spotify_track_id').eq('id', id).eq('event_id', c.s.eventId).maybeSingle();
  if (!sug) return fail('not_found');
  if (action === 'add') {
    const r = await addSpotifyToOurPlaylist(sug.spotify_track_id as string, playlistTitle);
    if (!r.ok) return fail(r.error);
  }
  const { error } = await c.db.from('friend_suggestions').update({ status: action === 'add' ? 'added' : 'dismissed', handled_at: new Date().toISOString() }).eq('id', id);
  if (error) return fail(errorCode(error));
  revalidatePath('/wedding/playlists');
  return ok(undefined);
}

// ── friend side (no account; the link token is the key) ──
async function validToken(token: string) {
  if (!TOKEN.test(token)) return false;
  const db = await supabaseServer();
  const { data } = await db.rpc('share_view', { p_token: token });
  return !!data;
}

export async function shareSearch(token: string, q: string): Promise<ActionResult<SpotifySearchHit[]>> {
  const query = String(q ?? '').trim().slice(0, 100);
  if (query.length < 2) return ok([]);
  if (!(await validToken(token))) return fail('not_found');
  const app = await appAccessToken();
  if (!app) return fail('network');
  try { return ok(await searchSpotifyTracks(query, app, 30)); } catch { return fail('network'); }
}

const suggestion = z.object({
  name: z.string().trim().min(1).max(60),
  message: z.string().trim().max(300).optional(),
  spotifyId: z.string().regex(SPOTIFY),
});

export async function shareSuggest(token: string, input: unknown): Promise<ActionResult> {
  if (!TOKEN.test(String(token))) return fail('not_found');
  const p = suggestion.safeParse(input);
  if (!p.success) return fail('validation');
  // song details come from Spotify, not from the browser
  const app = await appAccessToken();
  if (!app) return fail('network');
  let t: Awaited<ReturnType<typeof getSpotifyTrack>>;
  try { t = await getSpotifyTrack(p.data.spotifyId, app); } catch { return fail('network'); }
  if (!t) return fail('validation');
  const db = await supabaseServer();
  const { error } = await db.rpc('share_suggest', {
    p_token: token, p_name: p.data.name, p_message: p.data.message ?? null, p_spotify: t.id,
    p_title: t.title, p_artists: t.artists, p_artwork: t.artworkUrl && ART.test(t.artworkUrl) ? t.artworkUrl : null,
  });
  if (error) return fail(error.message.includes('not_found') ? 'not_found' : error.message.includes('limit') ? 'limit' : errorCode(error));
  return ok(undefined);
}
