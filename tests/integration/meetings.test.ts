// Music-planning meetings: booking rules, DJ double-booking, reminders, token storage permissions.
import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient, createCouple, createDj, sql } from '../helpers/stack';

let admin: SupabaseClient;
const at = (daysAhead: number, hourUtc: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + daysAhead); d.setUTCHours(hourUtc, 0, 0, 0); return d.toISOString(); };

beforeAll(async () => { admin = await adminClient(); }, 60_000);

async function weddingWith(dj: Awaited<ReturnType<typeof createDj>>, name: string, inDays = 20) {
  const c = await createCouple(name);
  const { error } = await admin.rpc('admin_assign_dj', { p_event: c.eventId, p_dj: dj.djId, p_confirm: true });
  expect(error).toBeNull();
  await sql(`update public.wedding_events set wedding_date = current_date + $2::int where id = $1`, [c.eventId, inDays]);
  return c;
}

describe('dj meetings', () => {
  it('books one meeting per wedding, and a DJ cannot be double-booked', async () => {
    const dj = await createDj('Meeting DJ');
    const a = await weddingWith(dj, 'MeetA');
    const b = await weddingWith(dj, 'MeetB');
    const first = await a.client.rpc('book_dj_meeting', { p_event: a.eventId, p_start: at(5, 8), p_mode: 'office' });
    expect(first.error).toBeNull();
    const clash = await b.client.rpc('book_dj_meeting', { p_event: b.eventId, p_start: at(5, 8), p_mode: 'zoom' });
    expect(clash.error?.message).toContain('slot_taken');
    const overlap = await b.client.rpc('book_dj_meeting', { p_event: b.eventId, p_start: new Date(Date.parse(at(5, 8)) + 30 * 60_000).toISOString(), p_mode: 'zoom' });
    expect(overlap.error?.message).toContain('slot_taken');
    // rebooking replaces the couple's previous meeting
    const again = await a.client.rpc('book_dj_meeting', { p_event: a.eventId, p_start: at(6, 9), p_mode: 'zoom' });
    expect(again.error).toBeNull();
    const rows = await sql<{ status: string }>(`select status from public.dj_meetings where event_id = $1 order by created_at`, [a.eventId]);
    expect(rows.map((r) => r.status)).toEqual(['cancelled', 'booked']);
    // the freed slot is now available to the other couple
    expect((await b.client.rpc('book_dj_meeting', { p_event: b.eventId, p_start: at(5, 8), p_mode: 'zoom' })).error).toBeNull();
    // the DJ sees it; other couples don't
    const { data: seen } = await dj.client.from('dj_meetings').select('id').eq('status', 'booked');
    expect(seen?.length).toBe(2);
    const { data: leak } = await a.client.from('dj_meetings').select('id').eq('event_id', b.eventId);
    expect(leak).toEqual([]);
    // couples cannot write the table directly
    const direct = await a.client.from('dj_meetings').insert({ event_id: a.eventId, dj_id: dj.djId, starts_at: at(9, 8), ends_at: at(9, 9), mode: 'office' });
    expect(direct.error).not.toBeNull();
  });

  it('rejects past or off-grid times and other weddings', async () => {
    const dj = await createDj('Rules DJ');
    const a = await weddingWith(dj, 'Rules');
    const other = await createCouple('Outsider');
    expect((await a.client.rpc('book_dj_meeting', { p_event: a.eventId, p_start: at(-1, 8), p_mode: 'office' })).error?.code).toBe('22023');
    expect((await a.client.rpc('book_dj_meeting', { p_event: a.eventId, p_start: new Date(Date.parse(at(3, 8)) + 10 * 60_000).toISOString(), p_mode: 'office' })).error?.code).toBe('22023');
    expect((await other.client.rpc('book_dj_meeting', { p_event: a.eventId, p_start: at(3, 8), p_mode: 'office' })).error?.code).toBe('42501');
  });

  it('reminds couples once inside the 31-day window', async () => {
    const dj = await createDj('Reminder DJ');
    const near = await weddingWith(dj, 'Near', 31);
    const far = await weddingWith(dj, 'Far', 45);
    await sql(`select public.queue_meeting_reminders()`);
    await sql(`select public.queue_meeting_reminders()`);
    const [n] = await sql<{ near: string; far: string }>(`select (select count(*) from public.notifications where event_id = $1 and type = 'meeting_reminder') near,
      (select count(*) from public.notifications where event_id = $2 and type = 'meeting_reminder') far`, [near.eventId, far.eventId]);
    expect(n).toEqual({ near: '1', far: '0' });
  });

  it('only the DJ or an admin can store a calendar connection; couples can read the sealed token only for their own wedding', async () => {
    const dj = await createDj('Token DJ');
    const a = await weddingWith(dj, 'TokenCouple');
    expect((await a.client.rpc('save_google_connection', { p_dj: dj.djId, p_cipher: 'v1.x.y.z', p_email: 'x@y.z' })).error?.code).toBe('42501');
    expect((await dj.client.rpc('save_google_connection', { p_dj: dj.djId, p_cipher: 'v1.a.b.c', p_email: 'dj@example.com' })).error).toBeNull();
    const ctx = await a.client.rpc('meeting_context', { p_event: a.eventId });
    expect((ctx.data as { token_cipher: string }[])[0].token_cipher).toBe('v1.a.b.c');
    const stranger = await createCouple('Stranger');
    expect((await stranger.client.rpc('meeting_context', { p_event: a.eventId })).error?.code).toBe('42501');
  });
});
