import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/server/session';
import { GOOGLE_SCOPES, googleConfigured } from '@/server/google';

/** A DJ (for themself) or an admin (for any DJ of the company) connects a Google Calendar. */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const s = await getSession();
  if (!s || !s.company || (s.role !== 'dj' && s.role !== 'admin')) return NextResponse.redirect(new URL('/login', origin));
  const djParam = request.nextUrl.searchParams.get('dj') ?? '';
  const djId = s.role === 'dj' ? s.djId : /^[0-9a-f-]{36}$/i.test(djParam) ? djParam : null;
  const back = s.role === 'dj' ? '/dj/profile' : djId ? `/admin/djs/${djId}` : '/admin/djs';
  if (!djId) return NextResponse.redirect(new URL(back, origin));
  if (!googleConfigured()) return NextResponse.redirect(new URL(`${back}?google=not_configured`, origin));
  const state = randomBytes(18).toString('base64url');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: `${origin}/api/google/callback`, response_type: 'code',
    scope: GOOGLE_SCOPES, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set('google_oauth', JSON.stringify({ state, djId, back }), { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/google', maxAge: 600 });
  return res;
}
