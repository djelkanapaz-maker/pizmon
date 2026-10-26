// Admin can remove a couple's login, and delete a couple entirely (wedding + logins).
import { describe, expect, it } from 'vitest';
import { adminClient, COMPANY_ID, fn, sql, token, uniq } from '../helpers/stack';

async function newCouple() {
  const admin = await adminClient();
  const email = uniq('del');
  const r = await fn('create_couple', { company_id: COMPANY_ID, partner_one_name: 'מחיקה', partner_two_name: 'בדיקה', email }, await token(admin));
  expect(r.status).toBe(200);
  return { admin, eventId: r.body.event_id as string, userId: r.body.user_id as string };
}

describe('deleting couples', () => {
  it('removes one login but keeps the wedding', async () => {
    const { admin, eventId } = await newCouple();
    const p = await fn('add_partner', { event_id: eventId, email: uniq('partner') }, await token(admin));
    expect(p.status).toBe(200);
    const r = await fn('remove_couple_login', { event_id: eventId, user_id: p.body.user_id }, await token(admin));
    expect(r.status).toBe(200);
    expect(await sql('select 1 from auth.users where id = $1', [p.body.user_id])).toHaveLength(0);
    expect(await sql('select 1 from public.wedding_events where id = $1', [eventId])).toHaveLength(1);
    expect(await sql('select 1 from public.couple_members where event_id = $1', [eventId])).toHaveLength(1);
  });

  it('deletes the wedding and the couple logins', async () => {
    const { admin, eventId, userId } = await newCouple();
    const r = await fn('delete_couple', { event_id: eventId }, await token(admin));
    expect(r.status).toBe(200);
    expect(r.body.removed_users).toBe(1);
    expect(await sql('select 1 from public.wedding_events where id = $1', [eventId])).toHaveLength(0);
    expect(await sql('select 1 from auth.users where id = $1', [userId])).toHaveLength(0);
  });

  it('is admin-only', async () => {
    const { eventId, userId } = await newCouple();
    const r = await fn('delete_couple', { event_id: eventId });
    expect(r.status).toBe(401);
    expect(await sql('select 1 from auth.users where id = $1', [userId])).toHaveLength(1);
  });
});
