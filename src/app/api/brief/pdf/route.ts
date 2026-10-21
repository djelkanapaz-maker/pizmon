import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/server/session';
import { loadBriefDoc } from '@/server/brief-pdf/load';
import { renderBriefPdf } from '@/server/brief-pdf/render';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/brief/pdf            → the signed-in couple's own brief
 * GET /api/brief/pdf?event=<id> → a DJ's / admin's couple (RLS decides whether they may read it)
 */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s?.company) return NextResponse.json({ error: 'forbidden' }, { status: 401 });
  const requested = req.nextUrl.searchParams.get('event');
  const eventId = s.role === 'couple' ? s.eventId : requested;
  if (!eventId || !/^[0-9a-f-]{36}$/i.test(eventId)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const locale = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : s.locale;
  const doc = await loadBriefDoc(eventId, s.company.id, locale);
  if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const pdf = await renderBriefPdf(doc);
  const name = `ATISUTO brief - ${doc.couple}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="atisuto-brief.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'cache-control': 'private, no-store',
    },
  });
}
