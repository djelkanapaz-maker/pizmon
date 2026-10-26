import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';

const ALLOWED_NEXT = ['/activate', '/', '/home', '/dj', '/admin'];
const TYPES: EmailOtpType[] = ['invite', 'recovery', 'magiclink', 'signup', 'email', 'email_change'];

const safeNext = (v: string | null) => (v && ALLOWED_NEXT.includes(v) ? v : '/activate');

/**
 * Activation / recovery links land here.
 *
 * The token_hash is one-time. Link previews (WhatsApp, Gmail, Outlook safe-links…) open the URL
 * in the background, so verifying on GET burns the token before the couple ever taps it.
 * GET therefore only forwards to a confirmation page (/activate/start); the token is spent on
 * the POST that page's button sends — something a preview bot never does.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (tokenHash && type) {
    const dest = new URL('/activate/start', url.origin);
    dest.searchParams.set('token_hash', tokenHash);
    dest.searchParams.set('type', type);
    dest.searchParams.set('next', next);
    return NextResponse.redirect(dest);
  }

  // PKCE `code`: only the browser holding the code verifier can exchange it, so a preview can't burn it.
  let ok = false;
  if (code) {
    const db = await supabaseServer();
    const { error } = await db.auth.exchangeCodeForSession(code);
    ok = !error;
  }
  return NextResponse.redirect(new URL(ok ? next : '/login?error=link', url.origin));
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const tokenHash = String(form.get('token_hash') ?? '');
  const type = String(form.get('type') ?? '') as EmailOtpType;
  const next = safeNext(String(form.get('next') ?? ''));
  const db = await supabaseServer();

  let ok = false;
  if (tokenHash && TYPES.includes(type)) {
    const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }
  if (!ok) {
    // Tapped twice / reopened in the same browser: the first tap already signed them in — carry on.
    const { data } = await db.auth.getUser();
    ok = !!data.user;
  }
  // 303 so the browser follows with a GET
  return NextResponse.redirect(new URL(ok ? next : '/login?error=link', request.nextUrl.origin), 303);
}
