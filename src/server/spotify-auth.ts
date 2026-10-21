import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Spotify's playlist-items endpoint needs a signed-in user (Feb 2026 rules), so the company connects its own account once. */
export const SPOTIFY_SCOPES = 'playlist-read-private playlist-read-collaborative';
export const spotifyConfigured = () => !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);

const key = () => createHash('sha256').update(`wmc-spotify-v1:${process.env.SPOTIFY_CLIENT_SECRET ?? ''}`).digest();

export function sealToken(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${body.toString('base64url')}`;
}

export function openToken(sealed: string) {
  const [v, iv, tag, body] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !body) throw new Error('spotify_auth');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
}

const basic = () => `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`;

export async function tokenRequest(params: Record<string, string>) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { authorization: basic(), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(), cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error('spotify_auth');
  return await r.json() as { access_token: string; refresh_token?: string; expires_in: number };
}

export type SpotifyConnection = { spotify_user_id: string; display_name: string | null; connected_at: string };

export async function getConnection(db: SupabaseClient, companyId: string) {
  const { data } = await db.rpc('admin_spotify_connection', { p_company: companyId });
  const row = (data as (SpotifyConnection & { token_cipher: string })[] | null)?.[0];
  return row ?? null;
}

/** A fresh user access token for the company's connected Spotify account, or null if none / no longer valid. */
export async function companyAccessToken(db: SupabaseClient, companyId: string): Promise<string | null> {
  if (!spotifyConfigured()) return null;
  const row = await getConnection(db, companyId);
  if (!row) return null;
  let refresh: string;
  try { refresh = openToken(row.token_cipher); } catch { return null; }
  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refresh });
    if (t.refresh_token && t.refresh_token !== refresh) {
      await db.rpc('admin_save_spotify_connection', { p_company: companyId, p_cipher: sealToken(t.refresh_token), p_user: row.spotify_user_id, p_name: row.display_name ?? '' });
    }
    return t.access_token;
  } catch { return null; }
}

let appToken: { value: string; exp: number } | null = null;
/** App-only token (no user): enough for catalog search and track lookups. */
export async function appAccessToken() {
  if (!spotifyConfigured()) return null;
  if (appToken && appToken.exp > Date.now() + 60_000) return appToken.value;
  try {
    const t = await tokenRequest({ grant_type: 'client_credentials' });
    appToken = { value: t.access_token, exp: Date.now() + t.expires_in * 1000 };
    return appToken.value;
  } catch { return null; }
}
