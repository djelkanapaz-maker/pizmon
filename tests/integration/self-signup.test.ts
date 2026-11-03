// A couple signs up for free (paskol.app): a lead for the company, no DJ step, can ask to be called back.
import { describe, expect, it } from 'vitest';
import { adminClient, createCouple, fn, signIn, sql, TEST_PASSWORD, uniq } from '../helpers/stack';

const ip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const base = (email: string, extra: Record<string, unknown> = {}) => ({
  email, password: TEST_PASSWORD, partner_one_name: 'נועה', partner_two_name: 'איתי', phone: '050-1234567',
  wedding_date: '2027-06-10', venue_name: 'גן אירועים', venue_city: 'תל אביב', guest_count: 300, has_dj: false, contact_consent: true, source: 'fb / group', ...extra,
});

describe('free self sign-up', () => {
  it('creates the login, the wedding and a lead, and tells the admins', async () => {
    const email = uniq('self');
    const r = await fn('self_signup', base(email), undefined, { 'x-forwarded-for': ip() });
    expect(r.status).toBe(200);
    const eventId = r.body.event_id as string;
    const [ev] = await sql<{ signup_source: string; phone: string; has_dj: boolean; contact_consent: boolean }>(
      'select signup_source, phone, has_dj, contact_consent from public.wedding_events where id = $1', [eventId]);
    expect(ev).toEqual({ signup_source: 'self', phone: '050-1234567', has_dj: false, contact_consent: true });
    const [lead] = await sql<{ status: string; source: string }>('select status, source from public.event_leads where event_id = $1', [eventId]);
    expect(lead).toEqual({ status: 'new', source: 'fb / group' });
    expect(await sql('select 1 from public.dj_assignments where event_id = $1', [eventId])).toHaveLength(0);
    expect((await sql(`select 1 from public.notifications where event_id = $1 and type = 'lead_new'`, [eventId])).length).toBeGreaterThan(0);

    // the couple signs in with the password they chose, sees their wedding but never the lead
    const couple = await signIn(email);
    const { data: own } = await couple.from('wedding_events').select('id, phone').eq('id', eventId).single();
    expect(own?.phone).toBe('050-1234567');
    const { data: leads } = await couple.from('event_leads').select('*');
    expect(leads ?? []).toHaveLength(0);
  });

  it('rejects a registered email, a missing DJ answer, a bad phone and bots', async () => {
    const email = uniq('self2');
    expect((await fn('self_signup', base(email), undefined, { 'x-forwarded-for': ip() })).status).toBe(200);
    const again = await fn('self_signup', base(email), undefined, { 'x-forwarded-for': ip() });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('email_exists');
    expect((await fn('self_signup', base(uniq('nodj'), { has_dj: undefined }), undefined, { 'x-forwarded-for': ip() })).status).toBe(400);
    expect((await fn('self_signup', base(uniq('phone'), { phone: 'abc' }), undefined, { 'x-forwarded-for': ip() })).status).toBe(400);
    expect((await fn('self_signup', base(uniq('bot'), { website: 'http://spam' }), undefined, { 'x-forwarded-for': ip() })).status).toBe(400);
  });

  it('limits sign-ups per address', async () => {
    const addr = ip();
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await fn('self_signup', base(uniq(`rl${i}`), { phone: 'x' }), undefined, { 'x-forwarded-for': addr })).status);
    expect(statuses.slice(0, 6).every((s) => s === 400)).toBe(true);
    expect(statuses[6]).toBe(429);
  });

  it('trusts the visitor IP forwarded by the web app (shared secret)', async () => {
    await sql(`insert into private.app_secrets (name, secret_hash) values ('signup', encode(extensions.digest('local-signup-secret', 'sha256'), 'hex'))
               on conflict (name) do update set secret_hash = excluded.secret_hash`);
    const server = ip();
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await fn('self_signup', base(uniq(`tr${i}`), { phone: 'x' }), undefined,
      { 'x-forwarded-for': server, 'x-signup-secret': 'local-signup-secret', 'x-client-ip': ip() })).status);
    expect(statuses.every((s) => s === 400)).toBe(true);
    // a wrong secret falls back to the caller's own address
    for (let i = 0; i < 6; i++) await fn('self_signup', base(uniq(`ws${i}`), { phone: 'x' }), undefined, { 'x-forwarded-for': server, 'x-signup-secret': 'nope', 'x-client-ip': ip() });
    expect((await fn('self_signup', base(uniq('ws7'), { phone: 'x' }), undefined, { 'x-forwarded-for': server, 'x-signup-secret': 'nope', 'x-client-ip': ip() })).status).toBe(429);
  });

  it('a couple asks to be called back; the admin works the lead', async () => {
    const email = uniq('call');
    const r = await fn('self_signup', base(email, { contact_consent: false }), undefined, { 'x-forwarded-for': ip() });
    const eventId = r.body.event_id as string;
    const couple = await signIn(email);
    expect((await couple.rpc('couple_request_call')).error).toBeNull();
    const [ev] = await sql<{ contact_consent: boolean; called: boolean }>('select contact_consent, call_requested_at is not null as called from public.wedding_events where id = $1', [eventId]);
    expect(ev).toEqual({ contact_consent: true, called: true });
    expect((await sql<{ status: string }>('select status from public.event_leads where event_id = $1', [eventId]))[0].status).toBe('call_requested');
    expect((await sql(`select 1 from public.notifications where event_id = $1 and type = 'lead_call_requested'`, [eventId]))).not.toHaveLength(0);

    // couples cannot change the lead
    expect((await couple.rpc('admin_update_lead', { p_event: eventId, p_status: 'booked', p_note: 'x' })).error?.code).toBe('42501');
    const admin = await adminClient();
    expect((await admin.rpc('admin_update_lead', { p_event: eventId, p_status: 'contacted', p_note: 'דיברנו, שולח הצעה' })).error).toBeNull();
    const { data: lead } = await admin.from('event_leads').select('status, note').eq('event_id', eventId).single();
    expect(lead).toEqual({ status: 'contacted', note: 'דיברנו, שולח הצעה' });
    // asking again doesn't undo the admin's progress
    await sql('update public.wedding_events set call_requested_at = now() - interval \'2 days\' where id = $1', [eventId]);
    await couple.rpc('couple_request_call');
    expect((await sql<{ status: string }>('select status from public.event_leads where event_id = $1', [eventId]))[0].status).toBe('contacted');
  });

  it('only self-signed-up couples can ask for a call', async () => {
    const c = await createCouple('NotLead');
    expect((await c.client.rpc('couple_request_call')).error?.code).toBe('42501');
    expect(await sql('select 1 from public.event_leads where event_id = $1', [c.eventId])).toHaveLength(0);
  });
});
