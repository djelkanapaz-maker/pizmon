import 'server-only';
import { openWith, sealWith } from './seal';
import type { Interval } from '@/core/slots';

export const GOOGLE_SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy';
/** Local demos/tests only: a stand-in calendar so the booking flow can be shown without Google. Never set in production. */
const FAKE = process.env.WMC_FAKE_GOOGLE === '1';
export const googleConfigured = () => FAKE || !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const sealGoogle = (plain: string) => sealWith(process.env.GOOGLE_CLIENT_SECRET, 'wmc-google-v1', plain);
const openGoogle = (sealed: string) => openWith(process.env.GOOGLE_CLIENT_SECRET, 'wmc-google-v1', sealed);

export async function googleToken(params: Record<string, string>) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...params }).toString(),
    cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error('google_auth');
  return await r.json() as { access_token: string; refresh_token?: string; expires_in: number; id_token?: string };
}

/** Access token from a sealed refresh token, or null when the connection is gone/revoked. */
export async function accessFromCipher(cipher: string | null | undefined) {
  if (FAKE) return cipher ? 'fake-token' : null;
  if (!cipher || !googleConfigured()) return null;
  try { return (await googleToken({ grant_type: 'refresh_token', refresh_token: openGoogle(cipher) })).access_token; } catch { return null; }
}

export async function freeBusy(token: string, from: number, to: number): Promise<Interval[]> {
  if (FAKE) {
    // a realistic week: busy Tuesday/Thursday afternoons and every day 13:00–14:00 UTC
    const out: Interval[] = [];
    for (let t = from - (from % 86_400_000); t < to; t += 86_400_000) {
      out.push({ start: t + 10 * 3_600_000, end: t + 11 * 3_600_000 });
      const wd = new Date(t).getUTCDay();
      if (wd === 2 || wd === 4) out.push({ start: t + 12 * 3_600_000, end: t + 16 * 3_600_000 });
    }
    return out;
  }
  const r = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), items: [{ id: 'primary' }] }),
    cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error('google_calendar');
  const j = await r.json() as { calendars?: { primary?: { busy?: { start: string; end: string }[]; errors?: unknown[] } } };
  if (j.calendars?.primary?.errors?.length) throw new Error('google_calendar');
  return (j.calendars?.primary?.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
}

export async function createCalendarEvent(token: string, ev: { summary: string; description: string; location?: string; start: string; end: string; attendees?: string[] }) {
  if (FAKE) return `fake-${Date.now()}`;
  const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      summary: ev.summary, description: ev.description, location: ev.location,
      start: { dateTime: ev.start, timeZone: 'Asia/Jerusalem' }, end: { dateTime: ev.end, timeZone: 'Asia/Jerusalem' },
      attendees: (ev.attendees ?? []).map((email) => ({ email })), reminders: { useDefault: true },
    }),
    cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error('google_calendar');
  return (await r.json() as { id: string }).id;
}

export async function deleteCalendarEvent(token: string, id: string) {
  if (FAKE) return;
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(id)}?sendUpdates=all`, {
    method: 'DELETE', headers: { authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(10000),
  }).catch(() => undefined);
}
