'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { getSession } from '@/server/session';
import { errorCode, fail, ok, type ActionResult } from '@/server/result';
import { computeSlots, parseHours, zonedToUtc, type DaySlots } from '@/core/slots';
import { MEETING_MINUTES, MEETING_TZ, OFFICE_ADDRESS } from '@/core/meeting';
import { accessFromCipher, createCalendarEvent, deleteCalendarEvent, freeBusy } from '@/server/google';
import { esc, sendMail } from '@/server/mail';

async function coupleCtx() {
  const s = await getSession();
  if (!s || s.role !== 'couple' || !s.eventId || !s.company) return null;
  return { s: s as typeof s & { eventId: string }, db: await supabaseServer() };
}
type Ctx = { dj_id: string; dj_name: string; meeting_hours: unknown; token_cipher: string | null; dj_email: string | null; wedding_date: string | null };

async function meetingContext(db: Awaited<ReturnType<typeof supabaseServer>>, eventId: string) {
  const { data } = await db.rpc('meeting_context', { p_event: eventId });
  return ((data ?? []) as Ctx[])[0] ?? null;
}

export type Availability =
  | { state: 'no_dj' }
  | { state: 'not_connected'; djName: string }
  | { state: 'error'; djName: string }
  | { state: 'ok'; djName: string; month: string; days: DaySlots[]; minMonth: string; maxMonth: string };

const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

export async function getMeetingAvailability(month?: string): Promise<ActionResult<Availability>> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const ctx = await meetingContext(c.db, c.s.eventId);
  if (!ctx) return ok({ state: 'no_dj' });
  const token = await accessFromCipher(ctx.token_cipher);
  if (!token) return ok({ state: 'not_connected', djName: ctx.dj_name });

  const now = Date.now();
  const from0 = now + 24 * 3600_000;
  const nowZ = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: MEETING_TZ }).format(now));
  const minMonth = monthKey(nowZ.getUTCFullYear(), nowZ.getUTCMonth() + 1);
  let last = now + 92 * 24 * 3600_000;
  if (ctx.wedding_date) {
    const [wy, wm, wd] = ctx.wedding_date.split('-').map(Number);
    last = Math.min(last, zonedToUtc(wy, wm, wd, 0, 0, MEETING_TZ));
  }
  const lastZ = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: MEETING_TZ }).format(last));
  const maxMonth = monthKey(lastZ.getUTCFullYear(), lastZ.getUTCMonth() + 1);
  const key = month && /^\d{4}-\d{2}$/.test(month) && month >= minMonth && month <= maxMonth ? month : minMonth;
  const [y, m] = key.split('-').map(Number);
  const from = Math.max(from0, zonedToUtc(y, m, 1, 0, 0, MEETING_TZ));
  const to = Math.min(last, zonedToUtc(y, m + 1, 1, 0, 0, MEETING_TZ));
  if (to <= from) return ok({ state: 'ok', djName: ctx.dj_name, month: key, days: [], minMonth, maxMonth });
  try {
    const busy = await freeBusy(token, from, to);
    const days = computeSlots({ hours: parseHours(ctx.meeting_hours), busy, from, to, tz: MEETING_TZ, durationMin: MEETING_MINUTES });
    return ok({ state: 'ok', djName: ctx.dj_name, month: key, days, minMonth, maxMonth });
  } catch {
    return ok({ state: 'error', djName: ctx.dj_name });
  }
}

const fmtWhen = (iso: string, locale: 'he' | 'en') => new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
  timeZone: MEETING_TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(iso));

export async function bookMeeting(input: unknown): Promise<ActionResult<{ id: string; djNotified: boolean; calendar: boolean }>> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const p = z.object({ start: z.iso.datetime(), mode: z.enum(['office', 'zoom', 'other']), location: z.string().trim().min(2).max(200).optional() }).refine((v) => v.mode !== 'other' || !!v.location).safeParse(input);
  if (!p.success) return fail('validation');
  const ctx = await meetingContext(c.db, c.s.eventId);
  if (!ctx) return fail('validation');
  const token = await accessFromCipher(ctx.token_cipher);
  if (!token) return fail('network');
  const start = Date.parse(p.data.start), end = start + MEETING_MINUTES * 60_000;
  // the slot must still be inside the DJ's hours and free right now
  try {
    const busy = await freeBusy(token, start - 60_000, end + 60_000);
    const fits = computeSlots({ hours: parseHours(ctx.meeting_hours), busy, from: start, to: end, tz: MEETING_TZ, durationMin: MEETING_MINUTES })
      .some((d) => d.slots.includes(new Date(start).toISOString()));
    if (!fits) return fail('slot_taken' as never);
  } catch { return fail('network'); }

  const { data: previous } = await c.db.from('dj_meetings').select('google_event_id').eq('event_id', c.s.eventId).eq('status', 'booked').maybeSingle();
  const { data: id, error } = await c.db.rpc('book_dj_meeting', { p_event: c.s.eventId, p_start: new Date(start).toISOString(), p_mode: p.data.mode, p_location: p.data.mode === 'other' ? p.data.location : null });
  if (error || !id) return fail(error?.code === '23P01' || error?.message?.includes('slot_taken') ? ('slot_taken' as never) : errorCode(error));

  if (previous?.google_event_id) await deleteCalendarEvent(token, previous.google_event_id as string);
  const { data: ev } = await c.db.from('wedding_events').select('partner_one_name, partner_two_name, wedding_date, venue_name').eq('id', c.s.eventId).single();
  const couple = [ev?.partner_one_name, ev?.partner_two_name].filter(Boolean).join(' & ');
  const when = fmtWhen(new Date(start).toISOString(), 'he');
  const place = p.data.mode === 'office' ? `במשרד: ${OFFICE_ADDRESS.he}` : p.data.mode === 'zoom' ? 'בזום. נא לשלוח לזוג קישור לפגישה.' : `מקום אחר: ${p.data.location}`;
  const contact = c.s.email ?? '';

  let googleId: string | null = null;
  try {
    googleId = await createCalendarEvent(token, {
      summary: `פגישת תיאום מוזיקה · ${couple}`,
      description: `${place}\nהזוג: ${couple}${contact ? ` (${contact})` : ''}\nתאריך החתונה: ${ev?.wedding_date ?? '—'}${ev?.venue_name ? ` · ${ev.venue_name}` : ''}`,
      location: p.data.mode === 'office' ? OFFICE_ADDRESS.he : p.data.mode === 'zoom' ? 'Zoom' : p.data.location,
      start: new Date(start).toISOString(), end: new Date(end).toISOString(), attendees: contact ? [contact] : [],
    });
  } catch { googleId = null; }

  let notified = false;
  if (ctx.dj_email) {
    const rows = [['זוג', couple], ['מתי', when], ['איפה', place], ['תאריך החתונה', ev?.wedding_date ?? '—'], ['מייל הזוג', contact || '—']];
    notified = await sendMail({
      to: ctx.dj_email, replyTo: contact || undefined,
      subject: `נקבעה פגישת תיאום מוזיקה: ${couple} · ${when}`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px"><h2 style="margin:0 0 12px">נקבעה פגישת תיאום מוזיקה</h2><table cellpadding="6">${rows.map(([k, v]) => `<tr><td style="color:#666">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}</table>${p.data.mode === 'zoom' ? '<p>הפגישה בזום: נא לשלוח לזוג קישור לפגישה (אפשר להשיב למייל הזה).</p>' : ''}</div>`,
    });
  }
  await c.db.rpc('record_meeting_delivery', { p_meeting: id, p_google_event: googleId, p_notified: notified });
  revalidatePath('/wedding/meeting'); revalidatePath('/home');
  return ok({ id: id as string, djNotified: notified, calendar: !!googleId });
}

export async function cancelMeeting(meetingId: string): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  if (!z.guid().safeParse(meetingId).success) return fail('validation');
  const { data: m } = await c.db.from('dj_meetings').select('id, starts_at, google_event_id').eq('id', meetingId).eq('event_id', c.s.eventId).eq('status', 'booked').maybeSingle();
  if (!m) return fail('validation');
  const { error } = await c.db.rpc('cancel_dj_meeting', { p_meeting: meetingId });
  if (error) return fail(errorCode(error));
  const ctx = await meetingContext(c.db, c.s.eventId);
  const token = await accessFromCipher(ctx?.token_cipher);
  if (token && m.google_event_id) await deleteCalendarEvent(token, m.google_event_id as string);
  if (ctx?.dj_email) {
    const when = fmtWhen(m.starts_at as string, 'he');
    await sendMail({ to: ctx.dj_email, subject: `פגישת תיאום בוטלה · ${when}`, text: `הזוג ביטל את פגישת התיאום שנקבעה ל-${when}.`, html: `<div dir="rtl" style="font-family:Arial,sans-serif">הזוג ביטל את פגישת התיאום שנקבעה ל-<b>${esc(when)}</b>.</div>` });
  }
  revalidatePath('/wedding/meeting'); revalidatePath('/home');
  return ok(undefined);
}
