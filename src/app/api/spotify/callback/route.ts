import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getSession } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { sealToken, tokenRequest } from '@/server/spotify-auth';

/** Spotify sends the admin back here; the refresh token is sealed and stored for the company. */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/admin/playlists?spotify=${status}`, origin));
    res.cookies.delete({ name: 'spotify_oauth_state', path: '/api/spotify' });
    return res;
  };
  const s = await getSession();
  if (!s || s.role !== 'admin' || !s.company) return NextResponse.redirect(new URL('/login', origin));
  const p = request.nextUrl.searchParams;
  const state = p.get('state') ?? '';
  const expected = request.cookies.get('spotify_oauth_state')?.value ?? '';
  if (!state || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) return back('state');
  const code = p.get('code');
  if (!code) return back(p.get('error') === 'access_denied' ? 'denied' : 'failed');
  try {
    const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: `${origin}/api/spotify/callback` });
    if (!t.refresh_token) return back('failed');
    const me = await fetch('https://api.spotify.com/v1/me', { headers: { authorization: `Bearer ${t.access_token}` }, cache: 'no-store' });
    if (!me.ok) return back(me.status === 403 ? 'not_allowed' : 'failed');
    const profile = await me.json() as { id: string; display_name?: string | null };
    const db = await supabaseServer();
    const { error } = await db.rpc('admin_save_spotify_connection', { p_company: s.company.id, p_cipher: sealToken(t.refresh_token), p_user: profile.id, p_name: profile.display_name ?? profile.id });
    return back(error ? 'failed' : 'connected');
  } catch {
    return back('failed');
  }
}
