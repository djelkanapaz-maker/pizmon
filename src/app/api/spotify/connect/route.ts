import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/server/session';
import { SPOTIFY_SCOPES, spotifyConfigured } from '@/server/spotify-auth';

/** Admin starts connecting the company's Spotify account (OAuth authorization code flow). */
export async function GET(request: NextRequest) {
  const s = await getSession();
  const origin = request.nextUrl.origin;
  if (!s || s.role !== 'admin' || !s.company) return NextResponse.redirect(new URL('/login', origin));
  if (!spotifyConfigured()) return NextResponse.redirect(new URL('/admin/playlists?spotify=not_configured', origin));
  const state = randomBytes(18).toString('base64url');
  const url = new URL('https://accounts.spotify.com/authorize');
  url.search = new URLSearchParams({
    response_type: 'code', client_id: process.env.SPOTIFY_CLIENT_ID!, scope: SPOTIFY_SCOPES,
    redirect_uri: `${origin}/api/spotify/callback`, state, show_dialog: 'true',
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set('spotify_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/spotify', maxAge: 600 });
  return res;
}
