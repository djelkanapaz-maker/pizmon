'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { getSession } from '@/server/session';
import { errorCode, fail, ok, type ActionResult } from '@/server/result';
import { deriveStatus, EMPTY_SELECTION, type SelectionState } from '@/core/moments';
import { sanitizeAnswers } from '@/core/questionnaire/answers';
import type { QuestionnaireDefinition } from '@/core/questionnaire/types';

const uuid = z.guid();

async function coupleCtx() {
  const s = await getSession();
  if (!s || s.role !== 'couple' || !s.eventId || !s.company) return null;
  return { s: s as typeof s & { eventId: string; company: NonNullable<typeof s.company> }, db: await supabaseServer() };
}

// ───────────── onboarding & event ─────────────
const details = z.object({
  partner_one_name: z.string().trim().min(1).max(80),
  partner_two_name: z.string().trim().max(80).optional().transform((v) => v || null),
  wedding_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')).transform((v) => v || null),
  venue_name: z.string().trim().max(120).optional().transform((v) => v || null),
  venue_city: z.string().trim().max(80).optional().transform((v) => v || null),
  guest_count: z.union([z.literal(''), z.coerce.number().int().min(1).max(5000)]).optional().transform((v) => (v === '' || v === undefined ? null : v)),
  languages: z.array(z.enum(['he', 'en', 'ar', 'fr', 'es', 'ru'])).max(6).optional(),
  cultural_notes: z.string().trim().max(1500).optional().transform((v) => v || null),
});

export async function saveEventDetails(input: unknown): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const parsed = details.safeParse(input);
  if (!parsed.success) return fail('validation', Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.code])));
  const { error } = await c.db.from('wedding_events').update(parsed.data).eq('id', c.s.eventId);
  if (error) return fail(errorCode(error));
  revalidatePath('/', 'layout');
  return ok(undefined);
}

export async function setOnboardingStep(step: 'welcome' | 'dj' | 'details' | 'done'): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  if (!['welcome', 'dj', 'details', 'done'].includes(step)) return fail('validation');
  const patch: Record<string, unknown> = { onboarding_step: step };
  if (step === 'done') patch.onboarding_completed_at = new Date().toISOString();
  const { error } = await c.db.from('wedding_events').update(patch).eq('id', c.s.eventId);
  if (error) return fail(errorCode(error));
  revalidatePath('/', 'layout');
  return ok(undefined);
}

export async function selectDj(djId: string): Promise<ActionResult<{ status: string }>> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  if (!uuid.safeParse(djId).success) return fail('validation');
  const { data, error } = await c.db.rpc('select_dj', { p_event: c.s.eventId, p_dj: djId });
  if (error) return fail(errorCode(error));
  revalidatePath('/', 'layout');
  return ok({ status: data.status as string });
}

export async function confirmAssignedDj(): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const { error } = await c.db.rpc('confirm_assigned_dj', { p_event: c.s.eventId });
  if (error) return fail(errorCode(error));
  revalidatePath('/', 'layout');
  return ok(undefined);
}

// ───────────── favourites ─────────────
export async function setTrackPreference(trackId: string, pref: 'save' | 'unsave' | 'reject' | 'unreject'): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  if (!uuid.safeParse(trackId).success) return fail('validation');
  const ev = c.s.eventId;
  let error = null;
  if (pref === 'save') {
    ({ error } = await c.db.from('saved_tracks').upsert({ event_id: ev, track_id: trackId, saved_by: c.s.userId }, { onConflict: 'event_id,track_id', ignoreDuplicates: true }));
    if (!error) await c.db.from('rejected_tracks').delete().eq('event_id', ev).eq('track_id', trackId);
  } else if (pref === 'unsave') {
    ({ error } = await c.db.from('saved_tracks').delete().eq('event_id', ev).eq('track_id', trackId));
  } else if (pref === 'reject') {
    ({ error } = await c.db.from('rejected_tracks').upsert({ event_id: ev, track_id: trackId, rejected_by: c.s.userId }, { onConflict: 'event_id,track_id', ignoreDuplicates: true }));
    if (!error) await c.db.from('saved_tracks').delete().eq('event_id', ev).eq('track_id', trackId);
  } else {
    ({ error } = await c.db.from('rejected_tracks').delete().eq('event_id', ev).eq('track_id', trackId));
  }
  if (error) return fail(errorCode(error));
  revalidatePath('/discover'); revalidatePath('/home'); revalidatePath('/wedding');
  return ok(undefined);
}

// ───────────── playlists ─────────────
const PURPOSES = ['reception', 'ceremony', 'dancefloor', 'late_night', 'family', 'inspiration', 'other'] as const;

export async function createPlaylist(input: unknown): Promise<ActionResult<{ id: string }>> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const p = z.object({ title: z.string().trim().min(1).max(120), purpose: z.enum(PURPOSES).default('other'), description: z.string().trim().max(500).optional() }).safeParse(input);
  if (!p.success) return fail('validation');
  const { data, error } = await c.db.from('playlists').insert({
    company_id: c.s.company.id, kind: 'couple', event_id: c.s.eventId, title: p.data.title, purpose: p.data.purpose,
    description: p.data.description || null, created_by: c.s.userId, shared_with_dj: true,
  }).select('id').single();
  if (error) return fail(errorCode(error));
  revalidatePath('/wedding/playlists');
  return ok({ id: data.id as string });
}

export async function updatePlaylist(id: string, input: unknown): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const p = z.object({ title: z.string().trim().min(1).max(120).optional(), purpose: z.enum(PURPOSES).optional(), description: z.string().trim().max(500).nullable().optional(), shared_with_dj: z.boolean().optional() }).safeParse(input);
  if (!p.success || !uuid.safeParse(id).success) return fail('validation');
  const { error } = await c.db.from('playlists').update(p.data).eq('id', id).eq('event_id', c.s.eventId).eq('kind', 'couple');
  if (error) return fail(errorCode(error));
  revalidatePath('/wedding/playlists'); revalidatePath(`/wedding/playlists/${id}`);
  return ok(undefined);
}

export async function deletePlaylist(id: string): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const { error } = await c.db.from('playlists').delete().eq('id', id).eq('event_id', c.s.eventId).eq('kind', 'couple');
  if (error) return fail(errorCode(error));
  revalidatePath('/wedding/playlists');
  return ok(undefined);
}

export async function addToPlaylist(playlistId: string, trackId: string): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  if (!uuid.safeParse(playlistId).success || !uuid.safeParse(trackId).success) return fail('validation');
  const { data: last } = await c.db.from('playlist_tracks').select('position').eq('playlist_id', playlistId).order('position', { ascending: false }).limit(1).maybeSingle();
  const { error } = await c.db.from('playlist_tracks').upsert(
    { playlist_id: playlistId, track_id: trackId, position: (last?.position ?? -1) + 1, added_by: c.s.userId },
    { onConflict: 'playlist_id,track_id', ignoreDuplicates: true });
  if (error) return fail(errorCode(error));
  revalidatePath(`/wedding/playlists/${playlistId}`); revalidatePath('/wedding/playlists');
  return ok(undefined);
}

export async function updatePlaylistTrack(id: string, input: unknown): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const p = z.object({ status: z.enum(['tentative', 'confirmed', 'backup']).optional(), note: z.string().trim().max(500).nullable().optional() }).safeParse(input);
  if (!p.success || !uuid.safeParse(id).success) return fail('validation');
  const { data, error } = await c.db.from('playlist_tracks').update(p.data).eq('id', id).select('playlist_id').single();
  if (error) return fail(errorCode(error));
  revalidatePath(`/wedding/playlists/${data.playlist_id}`);
  return ok(undefined);
}

export async function removePlaylistTrack(id: string): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const { data, error } = await c.db.from('playlist_tracks').delete().eq('id', id).select('playlist_id').single();
  if (error) return fail(errorCode(error));
  revalidatePath(`/wedding/playlists/${data.playlist_id}`);
  return ok(undefined);
}

export async function reorderPlaylist(playlistId: string, orderedIds: string[]): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  if (!z.array(uuid).max(500).safeParse(orderedIds).success) return fail('validation');
  const results = await Promise.all(orderedIds.map((id, i) => c.db.from('playlist_tracks').update({ position: i }).eq('id', id).eq('playlist_id', playlistId)));
  const err = results.find((r) => r.error)?.error;
  if (err) return fail(errorCode(err));
  revalidatePath(`/wedding/playlists/${playlistId}`);
  return ok(undefined);
}

// ───────────── moments ─────────────
const selectionInput = z.object({
  primary_track_id: uuid.nullable().optional(),
  backup_track_id: uuid.nullable().optional(),
  custom_song: z.string().trim().max(200).nullable().optional(),
  shortlist: z.array(uuid).max(20).optional(),
  addShortlist: uuid.optional(),
  removeShortlist: uuid.optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export async function saveSelection(momentId: string, input: unknown): Promise<ActionResult<{ status: string }>> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const p = selectionInput.safeParse(input);
  if (!p.success || !uuid.safeParse(momentId).success) return fail('validation');
  const { data: cur } = await c.db.from('moment_selections').select('*').eq('event_id', c.s.eventId).eq('moment_id', momentId).maybeSingle();
  const prev: SelectionState = cur ? { status: cur.status, primary_track_id: cur.primary_track_id, backup_track_id: cur.backup_track_id, custom_song: cur.custom_song, shortlist: cur.shortlist ?? [] } : EMPTY_SELECTION;
  const next = {
    primary_track_id: p.data.primary_track_id !== undefined ? p.data.primary_track_id : prev.primary_track_id,
    backup_track_id: p.data.backup_track_id !== undefined ? p.data.backup_track_id : prev.backup_track_id,
    custom_song: p.data.custom_song !== undefined ? (p.data.custom_song || null) : prev.custom_song,
    shortlist: (() => {
      let list = p.data.shortlist ?? prev.shortlist;
      if (p.data.addShortlist && !list.includes(p.data.addShortlist)) list = [...list, p.data.addShortlist].slice(-20);
      if (p.data.removeShortlist) list = list.filter((x) => x !== p.data.removeShortlist);
      return list;
    })(),
  };
  const status = deriveStatus(prev, next);
  const row = { ...next, status, notes: p.data.notes !== undefined ? (p.data.notes || null) : cur?.notes ?? null, updated_by: c.s.userId };
  const { error } = cur
    ? await c.db.from('moment_selections').update(row).eq('id', cur.id)
    : await c.db.from('moment_selections').insert({ ...row, event_id: c.s.eventId, moment_id: momentId });
  if (error) return fail(errorCode(error));
  revalidatePath('/wedding', 'layout'); revalidatePath('/home');
  return ok({ status });
}

export async function confirmSelection(momentId: string): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const { data: cur } = await c.db.from('moment_selections').select('id, primary_track_id, custom_song').eq('event_id', c.s.eventId).eq('moment_id', momentId).maybeSingle();
  if (!cur || (!cur.primary_track_id && !cur.custom_song)) return fail('validation');
  const { error } = await c.db.from('moment_selections').update({ status: 'confirmed', confirmed_at: new Date().toISOString(), updated_by: c.s.userId }).eq('id', cur.id);
  if (error) return fail(errorCode(error));
  revalidatePath('/wedding', 'layout'); revalidatePath('/home');
  return ok(undefined);
}

// ───────────── restrictions ─────────────
const restrictionInput = z.object({
  kind: z.enum(['must_play', 'never_play']),
  strength: z.enum(['preference', 'absolute']),
  target_type: z.enum(['track', 'artist', 'genre', 'text']),
  target_id: uuid.optional(),
  text_value: z.string().trim().max(200).optional(),
  reason: z.string().trim().max(500).optional(),
}).refine((v) => (v.target_type === 'text' ? !!v.text_value : !!v.target_id), { message: 'target required' });

export async function addRestriction(input: unknown): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const p = restrictionInput.safeParse(input);
  if (!p.success) return fail('validation');
  const v = p.data;
  const { error } = await c.db.from('music_restrictions').insert({
    event_id: c.s.eventId, kind: v.kind, strength: v.strength, target_type: v.target_type,
    track_id: v.target_type === 'track' ? v.target_id : null,
    artist_id: v.target_type === 'artist' ? v.target_id : null,
    genre_id: v.target_type === 'genre' ? v.target_id : null,
    text_value: v.target_type === 'text' ? v.text_value : null,
    reason: v.reason || null, created_by: c.s.userId,
  });
  if (error) return fail(error.code === '23505' ? 'restriction_conflict' : errorCode(error));
  revalidatePath('/wedding', 'layout'); revalidatePath('/discover'); revalidatePath('/home');
  return ok(undefined);
}

export async function removeRestriction(id: string): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const { error } = await c.db.from('music_restrictions').delete().eq('id', id).eq('event_id', c.s.eventId);
  if (error) return fail(errorCode(error));
  revalidatePath('/wedding', 'layout'); revalidatePath('/discover');
  return ok(undefined);
}

// ───────────── questionnaire ─────────────
export async function saveAnswers(partial: Record<string, unknown>): Promise<ActionResult<{ savedAt: string }>> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  if (!partial || typeof partial !== 'object') return fail('validation');
  const { data: started, error: e1 } = await c.db.rpc('start_questionnaire', { p_event: c.s.eventId });
  if (e1) return fail(errorCode(e1));
  const { data: row } = await c.db.from('questionnaire_responses')
    .select('id, answers, version:questionnaire_versions(definition)').eq('id', started.id).single();
  if (!row) return fail('not_found');
  const def = (row.version as unknown as { definition: QuestionnaireDefinition }).definition;
  const { data: genres } = await c.db.from('genres').select('id').eq('company_id', c.s.company.id);
  const clean = sanitizeAnswers(def, partial, new Set((genres ?? []).map((g) => g.id as string)));
  const merged = { ...(row.answers as object), ...clean };
  const { error } = await c.db.from('questionnaire_responses').update({ answers: merged }).eq('id', row.id);
  if (error) return fail(errorCode(error));
  revalidatePath('/wedding', 'layout'); revalidatePath('/home');
  return ok({ savedAt: new Date().toISOString() });
}

export async function submitQuestionnaire(): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const { error: e1 } = await c.db.rpc('start_questionnaire', { p_event: c.s.eventId });
  if (e1) return fail(errorCode(e1));
  const { error } = await c.db.rpc('submit_questionnaire', { p_event: c.s.eventId });
  if (error) return fail(errorCode(error));
  revalidatePath('/', 'layout');
  return ok(undefined);
}

// ───────────── recommendations ─────────────
export async function respondToRecommendation(recId: string, status: 'approved' | 'rejected' | 'saved' | 'question', comment?: string): Promise<ActionResult> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  if (!uuid.safeParse(recId).success || !['approved', 'rejected', 'saved', 'question'].includes(status)) return fail('validation');
  const text = (comment ?? '').trim().slice(0, 1000) || null;
  if (status === 'question' && !text) return fail('validation');
  const { error } = await c.db.from('recommendation_responses').upsert(
    { recommendation_id: recId, status, comment: text, responded_by: c.s.userId, responded_at: new Date().toISOString() },
    { onConflict: 'recommendation_id' });
  if (error) return fail(errorCode(error));
  if (status === 'approved') {
    const { data: rec } = await c.db.from('dj_recommendations').select('track_id').eq('id', recId).single();
    if (rec?.track_id) await c.db.from('saved_tracks').upsert({ event_id: c.s.eventId, track_id: rec.track_id, saved_by: c.s.userId }, { onConflict: 'event_id,track_id', ignoreDuplicates: true });
  }
  revalidatePath('/wedding', 'layout'); revalidatePath('/home');
  return ok(undefined);
}

// ───────────── requests ─────────────
const CATEGORIES = ['choose_song', 'israeli_balance', 'review_selections', 'change_confirmed', 'family_request', 'other'] as const;

export async function createRequest(input: unknown): Promise<ActionResult<{ id: string }>> {
  const c = await coupleCtx(); if (!c) return fail('forbidden');
  const p = z.object({ category: z.enum(CATEGORIES), title: z.string().trim().min(1).max(160), description: z.string().trim().max(4000).optional(), moment_id: uuid.optional().or(z.literal('')) }).safeParse(input);
  if (!p.success) return fail('validation');
  const { data, error } = await c.db.from('couple_requests').insert({
    event_id: c.s.eventId, category: p.data.category, title: p.data.title, description: p.data.description || null,
    moment_id: p.data.moment_id || null, created_by: c.s.userId, opened_by_staff: false,
  }).select('id').single();
  if (error) return fail(errorCode(error));
  revalidatePath('/wedding/requests');
  return ok({ id: data.id as string });
}

export async function replyToRequest(requestId: string, body: string): Promise<ActionResult> {
  const s = await getSession(); if (!s) return fail('forbidden');
  const text = (body ?? '').trim();
  if (!uuid.safeParse(requestId).success || !text || text.length > 4000) return fail('validation');
  const db = await supabaseServer();
  const { error } = await db.from('request_messages').insert({ request_id: requestId, author_id: s.userId, body: text });
  if (error) return fail(errorCode(error));
  revalidatePath('/wedding/requests', 'layout'); revalidatePath('/dj', 'layout');
  return ok(undefined);
}

export async function setRequestStatus(requestId: string, status: 'open' | 'in_progress' | 'resolved' | 'closed'): Promise<ActionResult> {
  const s = await getSession(); if (!s) return fail('forbidden');
  if (!uuid.safeParse(requestId).success || !['open', 'in_progress', 'resolved', 'closed'].includes(status)) return fail('validation');
  const db = await supabaseServer();
  const { error } = await db.from('couple_requests').update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null }).eq('id', requestId);
  if (error) return fail(errorCode(error));
  revalidatePath('/wedding/requests', 'layout'); revalidatePath('/dj', 'layout');
  return ok(undefined);
}

// ───────────── catalog lookup (for pickers) ─────────────
export async function searchCatalog(query: string, type: 'track' | 'artist'): Promise<ActionResult<{ id: string; label: string; sub?: string }[]>> {
  const s = await getSession(); if (!s?.company) return fail('forbidden');
  const q = (query ?? '').replace(/[,()*%\\]/g, ' ').trim().slice(0, 80);
  if (q.length < 1) return ok([]);
  const db = await supabaseServer();
  if (type === 'artist') {
    const { data, error } = await db.from('artists').select('id, name').eq('company_id', s.company.id).ilike('name', `%${q}%`).order('name').limit(12);
    if (error) return fail(errorCode(error));
    return ok((data ?? []).map((a) => ({ id: a.id as string, label: a.name as string })));
  }
  const { data: arts } = await db.from('artists').select('id').eq('company_id', s.company.id).ilike('name', `%${q}%`).limit(30);
  const ids = (arts ?? []).map((a) => a.id);
  const { data, error } = await db.from('music_tracks').select('id, title, artist:artists(name)').eq('company_id', s.company.id).eq('status', 'published')
    .or([`title.ilike.%${q}%`, ...(ids.length ? [`artist_id.in.(${ids.join(',')})`] : [])].join(',')).order('title').limit(12);
  if (error) return fail(errorCode(error));
  return ok((data ?? []).map((t) => ({ id: t.id as string, label: t.title as string, sub: (t.artist as unknown as { name: string } | null)?.name })));
}
