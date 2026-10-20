// Backend authorization rules, exercised through the real API (PostgREST + Auth + RLS).
import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient, anonClient, anyTrack, COMPANY_ID, createCouple, createDj, fn, sql, token } from '../helpers/stack';

let admin: SupabaseClient;
let dj1: Awaited<ReturnType<typeof createDj>>;
let dj2: Awaited<ReturnType<typeof createDj>>;
let coupleA: Awaited<ReturnType<typeof createCouple>>;
let coupleB: Awaited<ReturnType<typeof createCouple>>;
let otherCompanyDj: string;

beforeAll(async () => {
  admin = await adminClient();
  dj1 = await createDj('Test DJ One');
  dj2 = await createDj('Test DJ Two');
  coupleA = await createCouple('Alpha');
  coupleB = await createCouple('Bravo');
  const [c] = await sql<{ id: string }>(`insert into public.companies (slug, brand_name) values ('other-' || substr(md5(random()::text), 1, 6), 'Other Co') returning id`);
  const [d] = await sql<{ id: string }>(`insert into public.djs (company_id, display_name, slug) values ($1, 'Foreign DJ', 'foreign') returning id`, [c.id]);
  otherCompanyDj = d.id;
}, 60_000);

describe('anonymous access', () => {
  it('cannot read any table', async () => {
    const anon = anonClient();
    for (const t of ['wedding_events', 'music_tracks', 'djs', 'internal_notes', 'companies']) {
      const { data, error } = await anon.from(t).select('*').limit(1);
      expect(error?.code === '42501' || (data ?? []).length === 0, t).toBe(true);
    }
  });
  it('cannot call admin functions', async () => {
    const r = await fn('create_couple', { company_id: COMPANY_ID, partner_one_name: 'x', email: 'x@wmc.test' });
    expect(r.status).toBe(401);
  });
  it('cannot bootstrap a second admin', async () => {
    const r = await fn('bootstrap', { company_slug: 'wmc', email: 'evil@wmc.test' }, undefined, { 'x-bootstrap-secret': 'wrong' });
    expect(r.status).toBe(403);
  });
});

describe('couple isolation', () => {
  it('a couple sees only its own event', async () => {
    const { data } = await coupleA.client.from('wedding_events').select('id');
    expect(data?.map((e) => e.id)).toEqual([coupleA.eventId]);
  });
  it('a couple cannot write into another couple’s event', async () => {
    const track = await anyTrack();
    const { error } = await coupleA.client.from('music_restrictions').insert({
      event_id: coupleB.eventId, kind: 'never_play', target_type: 'track', track_id: track.id });
    expect(error).not.toBeNull();
    const { error: e2 } = await coupleA.client.from('saved_tracks').insert({ event_id: coupleB.eventId, track_id: track.id });
    expect(e2).not.toBeNull();
  });
  it('a couple cannot change protected event columns', async () => {
    const { error } = await coupleA.client.from('wedding_events').update({ company_id: COMPANY_ID, invite_email: 'x@y.z' }).eq('id', coupleA.eventId);
    expect(error?.code).toBe('42501');
    const { error: ok } = await coupleA.client.from('wedding_events').update({ venue_name: 'Test Venue' }).eq('id', coupleA.eventId);
    expect(ok).toBeNull();
  });
  it('a couple cannot create DJ assignments directly', async () => {
    const { error } = await coupleA.client.from('dj_assignments').insert({ event_id: coupleA.eventId, dj_id: dj1.djId, status: 'confirmed', source: 'couple' });
    expect(error).not.toBeNull();
  });
  it('a couple cannot use the admin API', async () => {
    const r = await fn('create_couple', { company_id: COMPANY_ID, partner_one_name: 'x', email: 'y@wmc.test' }, await token(coupleA.client));
    expect(r.status).toBe(403);
  });
});

describe('DJ selection & assignment', () => {
  it('rejects a DJ from another company', async () => {
    const { error } = await coupleA.client.rpc('select_dj', { p_event: coupleA.eventId, p_dj: otherCompanyDj });
    expect(error?.message).toContain('dj_not_eligible');
  });
  it('rejects selecting for another couple’s event', async () => {
    const { error } = await coupleA.client.rpc('select_dj', { p_event: coupleB.eventId, p_dj: dj1.djId });
    expect(error?.message).toContain('not_your_event');
  });
  it('couple pick is pending until admin approval; DJ gains access only after approval', async () => {
    const { data, error } = await coupleA.client.rpc('select_dj', { p_event: coupleA.eventId, p_dj: dj1.djId });
    expect(error).toBeNull();
    expect(data.status).toBe('pending_approval');
    const before = await dj1.client.from('wedding_events').select('id').eq('id', coupleA.eventId);
    expect(before.data).toEqual([]);
    const notes = await sql(`select type from public.notifications where event_id = $1 and type = 'assignment_pending'`, [coupleA.eventId]);
    expect(notes.length).toBeGreaterThan(0);
    const { error: e2 } = await admin.rpc('admin_decide_assignment', { p_assignment: data.id, p_approve: true });
    expect(e2).toBeNull();
    const after = await dj1.client.from('wedding_events').select('id').eq('id', coupleA.eventId);
    expect(after.data?.length).toBe(1);
  });
  it('a confirmed DJ cannot be swapped by the couple', async () => {
    const { error } = await coupleA.client.rpc('select_dj', { p_event: coupleA.eventId, p_dj: dj2.djId });
    expect(error?.message).toContain('assignment_locked');
  });
  it('an unassigned DJ sees nothing of the couple', async () => {
    for (const t of ['wedding_events', 'moment_selections', 'music_restrictions', 'questionnaire_responses', 'saved_tracks']) {
      const { data } = await dj2.client.from(t).select('*').eq(t === 'wedding_events' ? 'id' : 'event_id', coupleA.eventId);
      expect(data, t).toEqual([]);
    }
  });
  it('admin reassignment keeps history', async () => {
    await admin.rpc('admin_assign_dj', { p_event: coupleB.eventId, p_dj: dj2.djId, p_confirm: true });
    await admin.rpc('admin_assign_dj', { p_event: coupleB.eventId, p_dj: dj1.djId, p_confirm: true });
    const rows = await sql<{ status: string }>(`select status from public.dj_assignments where event_id = $1 order by created_at`, [coupleB.eventId]);
    expect(rows.map((r) => r.status)).toEqual(['ended', 'confirmed']);
    const { data } = await dj2.client.from('wedding_events').select('id').eq('id', coupleB.eventId);
    expect(data).toEqual([]);
  });
  it('non-admins cannot approve assignments', async () => {
    const { error } = await dj1.client.rpc('admin_assign_dj', { p_event: coupleA.eventId, p_dj: dj1.djId });
    expect(error?.message).toContain('admin_only');
  });
});

describe('internal notes', () => {
  it('are visible to the assigned DJ and hidden from the couple', async () => {
    const { data: me } = await dj1.client.auth.getUser();
    const { error } = await dj1.client.from('internal_notes').insert({ event_id: coupleA.eventId, author_id: me.user!.id, body: 'Private: confirm timing with venue.' });
    expect(error).toBeNull();
    const dj = await dj1.client.from('internal_notes').select('body').eq('event_id', coupleA.eventId);
    expect(dj.data?.length).toBe(1);
    const couple = await coupleA.client.from('internal_notes').select('body').eq('event_id', coupleA.eventId);
    expect(couple.data).toEqual([]);
    const { data: cu } = await coupleA.client.auth.getUser();
    const { error: e2 } = await coupleA.client.from('internal_notes').insert({ event_id: coupleA.eventId, author_id: cu.user!.id, body: 'x' });
    expect(e2).not.toBeNull();
  });
});

describe('never-play enforcement', () => {
  it('a DJ cannot recommend a track that matches an absolute NEVER PLAY artist', async () => {
    const track = await anyTrack(`language = 'en'`);
    const { error } = await coupleA.client.from('music_restrictions').insert({
      event_id: coupleA.eventId, kind: 'never_play', strength: 'absolute', target_type: 'artist', artist_id: track.artist_id, reason: 'test' });
    expect(error).toBeNull();
    const { data: me } = await dj1.client.auth.getUser();
    const { error: e2 } = await dj1.client.from('dj_recommendations').insert({
      event_id: coupleA.eventId, dj_id: dj1.djId, track_id: track.id, created_by: me.user!.id });
    expect(e2?.message).toContain('violates_never_play');
    const notif = await sql(`select 1 from public.notifications where event_id = $1 and type = 'never_play_added'`, [coupleA.eventId]);
    expect(notif.length).toBe(1);
  });
  it('the same item cannot be both MUST and NEVER', async () => {
    const track = await anyTrack(`language = 'en'`);
    const { error } = await coupleA.client.from('music_restrictions').insert({
      event_id: coupleA.eventId, kind: 'must_play', target_type: 'artist', artist_id: track.artist_id });
    expect(error?.message).toContain('restriction_conflict');
  });
  it('a DJ can recommend an allowed track and the couple can respond', async () => {
    const track = await anyTrack(`language = 'he'`);
    const { data: me } = await dj1.client.auth.getUser();
    const { data: rec, error } = await dj1.client.from('dj_recommendations').insert({
      event_id: coupleA.eventId, dj_id: dj1.djId, track_id: track.id, created_by: me.user!.id, message: 'Try this' }).select().single();
    expect(error).toBeNull();
    const { data: cu } = await coupleA.client.auth.getUser();
    const { error: e2 } = await coupleA.client.from('recommendation_responses').insert({ recommendation_id: rec.id, status: 'approved', responded_by: cu.user!.id });
    expect(e2).toBeNull();
    const n = await sql(`select 1 from public.notifications n join public.djs d on d.user_id = n.user_id where d.id = $1 and n.type = 'recommendation_response'`, [dj1.djId]);
    expect(n.length).toBe(1);
  });
});

describe('moment change tracking', () => {
  it('confirming and then changing a song is recorded and surfaced to the DJ', async () => {
    const [m] = await sql<{ id: string }>(`select id from public.wedding_moments where company_id = $1 and slug = 'first-dance'`, [COMPANY_ID]);
    const [t1, t2] = await sql<{ id: string }>(`select t.id from public.moment_tracks mt join public.music_tracks t on t.id = mt.track_id where mt.moment_id = $1 order by t.title limit 2`, [m.id]);
    const ins = await coupleA.client.from('moment_selections').insert({ event_id: coupleA.eventId, moment_id: m.id, primary_track_id: t1.id, status: 'confirmed' }).select().single();
    expect(ins.error).toBeNull();
    const up = await coupleA.client.from('moment_selections').update({ primary_track_id: t2.id, status: 'change_requested' }).eq('id', ins.data.id);
    expect(up.error).toBeNull();
    const acts = await sql<{ type: string; payload: { before: { primary_track_id: string } } }>(
      `select type, payload from public.activity_events where entity_id = $1 order by created_at`, [ins.data.id]);
    expect(acts.map((a) => a.type)).toEqual(['moment_confirmed', 'confirmed_moment_changed']);
    expect(acts[1].payload.before.primary_track_id).toBe(t1.id);
    const djActivity = await dj1.client.from('activity_events').select('type').eq('event_id', coupleA.eventId).eq('type', 'confirmed_moment_changed');
    expect(djActivity.data?.length).toBe(1);
  });
  it('a selection cannot be confirmed without a song', async () => {
    const [m] = await sql<{ id: string }>(`select id from public.wedding_moments where company_id = $1 and slug = 'closing-song'`, [COMPANY_ID]);
    const { error } = await coupleA.client.from('moment_selections').insert({ event_id: coupleA.eventId, moment_id: m.id, status: 'confirmed' });
    expect(error).not.toBeNull();
  });
});

describe('questionnaire', () => {
  it('is pinned to a version, submit is RPC-only, and edits after submission are tracked', async () => {
    const { data: resp, error } = await coupleA.client.rpc('start_questionnaire', { p_event: coupleA.eventId });
    expect(error).toBeNull();
    expect(resp.version_id).toBeTruthy();
    const { error: direct } = await coupleA.client.from('questionnaire_responses').update({ status: 'submitted' }).eq('id', resp.id);
    expect(direct?.code).toBe('42501');
    await coupleA.client.from('questionnaire_responses').update({ answers: { singalong: 4 } }).eq('id', resp.id);
    const { data: sub } = await coupleA.client.rpc('submit_questionnaire', { p_event: coupleA.eventId });
    expect(sub.status).toBe('submitted');
    await coupleA.client.from('questionnaire_responses').update({ answers: { singalong: 2 } }).eq('id', resp.id);
    const acts = await sql<{ payload: { changed_keys: string[] } }>(`select payload from public.activity_events where event_id = $1 and type = 'questionnaire_edited'`, [coupleA.eventId]);
    expect(acts[0].payload.changed_keys).toEqual(['singalong']);
  });
  it('published template versions are immutable', async () => {
    const [v] = await sql<{ id: string }>(`select v.id from public.questionnaire_versions v join public.questionnaires q on q.id = v.questionnaire_id where q.company_id = $1`, [COMPANY_ID]);
    const { error } = await admin.from('questionnaire_versions').update({ definition: { schema: 1, sections: [] } }).eq('id', v.id);
    expect(error?.message).toContain('published_version_immutable');
    const { error: e2 } = await coupleA.client.from('questionnaire_versions').update({ published_at: null }).eq('id', v.id);
    expect(e2 === null).toBe(true); // silently matches no rows for non-admins …
    const [still] = await sql<{ published_at: string | null }>(`select published_at from public.questionnaire_versions where id = $1`, [v.id]);
    expect(still.published_at).not.toBeNull(); // … and nothing changed
  });
});

describe('playlists', () => {
  it('an unshared couple playlist is hidden from the DJ', async () => {
    const { data: pl, error } = await coupleA.client.from('playlists').insert({
      company_id: COMPANY_ID, kind: 'couple', event_id: coupleA.eventId, title: 'Secret', shared_with_dj: false }).select().single();
    expect(error).toBeNull();
    const dj = await dj1.client.from('playlists').select('id').eq('id', pl.id);
    expect(dj.data).toEqual([]);
    await coupleA.client.from('playlists').update({ shared_with_dj: true }).eq('id', pl.id);
    const dj2r = await dj1.client.from('playlists').select('id').eq('id', pl.id);
    expect(dj2r.data?.length).toBe(1);
  });
  it('a couple cannot create a playlist inside another couple’s event or as editorial', async () => {
    const a = await coupleA.client.from('playlists').insert({ company_id: COMPANY_ID, kind: 'couple', event_id: coupleB.eventId, title: 'x' });
    expect(a.error).not.toBeNull();
    const b = await coupleA.client.from('playlists').insert({ company_id: COMPANY_ID, kind: 'editorial', title: 'x' });
    expect(b.error).not.toBeNull();
  });
});

describe('notifications', () => {
  it('are private to their recipient', async () => {
    const mine = await dj1.client.from('notifications').select('user_id');
    const { data: me } = await dj1.client.auth.getUser();
    expect((mine.data ?? []).every((n) => n.user_id === me.user!.id)).toBe(true);
    expect((mine.data ?? []).length).toBeGreaterThan(0);
    const { error } = await coupleA.client.from('notifications').insert({ user_id: me.user!.id, company_id: COMPANY_ID, type: 'x', title_he: 'x', title_en: 'x' });
    expect(error).not.toBeNull();
  });
});
