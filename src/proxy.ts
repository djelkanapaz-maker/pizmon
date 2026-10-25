import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_PATHS = ['/login', '/activate', '/forgot-password', '/auth/', '/setup', '/manifest.webmanifest', '/icon', '/apple-icon', '/privacy', '/s/', '/api/setup-sql'];

/**
 * Refreshes the Supabase session cookie on every navigation and sends signed-out
 * visitors to /login. Role-based authorization happens in the data access layer and
 * in Postgres RLS — this proxy is only a convenience redirect, not a security boundary.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (request.nextUrl.pathname.startsWith('/setup')) return NextResponse.next();
    return NextResponse.redirect(new URL('/setup', request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // getClaims verifies the token locally (asymmetric signing keys), so no Auth round trip per navigation
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims?.sub;

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  if (!signedIn && !isPublic) {
    const login = new URL('/login', request.url);
    if (path !== '/') login.searchParams.set('next', path + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|demo-audio/|sw.js|.*\\.(?:png|jpg|svg|webp|mp3|woff2?)$).*)'],
};
