import { NextResponse } from 'next/server';
import { spotifyConfigured } from '@/server/spotify-auth';

export const dynamic = 'force-dynamic';

/** Diagnostic: is Spotify reachable with the app's credentials? Returns status codes only, cached for a minute. */
let last: { at: number; body: unknown } | null = null;

export async function GET() {
  if (last && Date.now() - last.at < 60_000) return NextResponse.json(last.body);
  const body: Record<string, unknown> = { configured: spotifyConfigured() };
  if (body.configured) {
    const basic = `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`;
    const t = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { authorization: basic, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials', cache: 'no-store', signal: AbortSignal.timeout(10000),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }) as unknown as Response);
    body.token = t.status;
    if (!t.ok) body.tokenError = (await t.text()).slice(0, 200);
    else {
      const { access_token } = await t.json() as { access_token: string };
      const s = await fetch('https://api.spotify.com/v1/search?type=track&market=IL&limit=10&q=omer%20adam', {
        headers: { authorization: `Bearer ${access_token}` }, cache: 'no-store', signal: AbortSignal.timeout(10000),
      });
      body.search = s.status;
      body.retryAfter = s.headers.get('retry-after');
      if (!s.ok) body.searchError = (await s.text()).slice(0, 300);
      else body.items = ((await s.json()) as { tracks?: { items?: unknown[] } }).tracks?.items?.length ?? 0;
    }
  }
  last = { at: Date.now(), body };
  return NextResponse.json(body);
}
