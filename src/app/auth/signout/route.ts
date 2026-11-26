import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Sign out at a fixed URL. A server action would be addressed by an id that changes with every deploy,
 * so a page left open across a deploy got "page not found" when signing out.
 */
export async function POST(request: NextRequest) {
  // only our own pages may sign someone out
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return new NextResponse(null, { status: 403 });
  const db = await supabaseServer();
  await db.auth.signOut();
  // 303 so the browser follows with a GET
  return NextResponse.redirect(new URL('/login', request.url), 303);
}
