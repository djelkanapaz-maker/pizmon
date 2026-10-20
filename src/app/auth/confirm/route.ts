import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';

const ALLOWED_NEXT = ['/activate', '/', '/home', '/dj', '/admin'];
const TYPES: EmailOtpType[] = ['invite', 'recovery', 'magiclink', 'signup', 'email', 'email_change'];

/** Activation / recovery links land here (token_hash flow, or PKCE `code`). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next') ?? '/activate';
  const next = ALLOWED_NEXT.includes(nextParam) ? nextParam : '/activate';
  const db = await supabaseServer();

  let ok = false;
  if (tokenHash && type && TYPES.includes(type)) {
    const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  } else if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    ok = !error;
  }
  const dest = new URL(ok ? next : '/login?error=link', url.origin);
  return NextResponse.redirect(dest);
}
