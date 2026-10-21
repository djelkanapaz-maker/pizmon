import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { googleToken, sealGoogle } from '@/server/google';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  let saved: { state: string; djId: string; back: string } | null = null;
  try { saved = JSON.parse(request.cookies.get('google_oauth')?.value ?? 'null'); } catch { saved = null; }
  const backPath = saved?.back && /^\/(dj\/profile|admin\/djs(\/[0-9a-f-]{36})?)$/i.test(saved.back) ? saved.back : '/';
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`${backPath}?google=${status}`, origin));
    res.cookies.delete({ name: 'google_oauth', path: '/api/google' });
    return res;
  };
  const s = await getSession();
  if (!s || !s.company) return NextResponse.redirect(new URL('/login', origin));
  const p = request.nextUrl.searchParams;
  const state = p.get('state') ?? '';
  if (!saved || !state || state.length !== saved.state.length || !timingSafeEqual(Buffer.from(state), Buffer.from(saved.state))) return back('state');
  const code = p.get('code');
  if (!code) return back(p.get('error') === 'access_denied' ? 'denied' : 'failed');
  try {
    const t = await googleToken({ grant_type: 'authorization_code', code, redirect_uri: `${origin}/api/google/callback` });
    if (!t.refresh_token) return back('failed');
    const granted = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(t.access_token)}`, { cache: 'no-store' }).then((r) => r.json() as Promise<{ scope?: string; email?: string }>);
    if (!granted.scope?.includes('calendar.freebusy') || !granted.scope.includes('calendar.events')) return back('scopes');
    const email = granted.email ?? '';
    const db = await supabaseServer();
    const { error } = await db.rpc('save_google_connection', { p_dj: saved.djId, p_cipher: sealGoogle(t.refresh_token), p_email: email });
    return back(error ? 'failed' : 'connected');
  } catch {
    return back('failed');
  }
}
