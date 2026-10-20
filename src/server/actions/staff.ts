'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { getSession } from '@/server/session';
import { errorCode, fail, ok, type ActionResult } from '@/server/result';

const uuid = z.guid();

async function staffCtx() {
  const s = await getSession();
  if (!s || (s.role !== 'dj' && s.role !== 'admin') || !s.company) return null;
  return { s, db: await supabaseServer() };
}
const refresh = (eventId: string) => { revalidatePath(`/dj/couples/${eventId}`); revalidatePath(`/admin/couples/${eventId}`); revalidatePath('/dj'); };

export async function recommend(eventId: string, input: unknown): Promise<ActionResult> {
  const c = await staffCtx(); if (!c) return fail('forbidden');
  const p = z.object({ track_id: uuid.optional(), playlist_id: uuid.optional(), moment_id: uuid.optional().or(z.literal('')), message: z.string().trim().max(1000).optional() })
    .refine((v) => v.track_id || v.playlist_id || v.message, 'empty').safeParse(input);
  if (!p.success || !uuid.safeParse(eventId).success) return fail('validation');
  const { error } = await c.db.from('dj_recommendations').insert({
    event_id: eventId, dj_id: c.s.djId, track_id: p.data.track_id ?? null, playlist_id: p.data.playlist_id ?? null,
    moment_id: p.data.moment_id || null, message: p.data.message || null, created_by: c.s.userId, is_ai_suggestion: false,
  });
  if (error) return fail(errorCode(error));
  refresh(eventId);
  return ok(undefined);
}

export async function askCouple(eventId: string, input: unknown): Promise<ActionResult> {
  const c = await staffCtx(); if (!c) return fail('forbidden');
  const p = z.object({ title: z.string().trim().min(1).max(160), description: z.string().trim().max(4000).optional(), moment_id: uuid.optional().or(z.literal('')) }).safeParse(input);
  if (!p.success || !uuid.safeParse(eventId).success) return fail('validation');
  const { error } = await c.db.from('couple_requests').insert({
    event_id: eventId, category: 'clarification', title: p.data.title, description: p.data.description || null,
    moment_id: p.data.moment_id || null, status: 'awaiting_couple', opened_by_staff: true, created_by: c.s.userId,
  });
  if (error) return fail(errorCode(error));
  refresh(eventId);
  return ok(undefined);
}

export async function addInternalNote(eventId: string, body: string): Promise<ActionResult> {
  const c = await staffCtx(); if (!c) return fail('forbidden');
  const text = (body ?? '').trim();
  if (!text || text.length > 8000 || !uuid.safeParse(eventId).success) return fail('validation');
  const { error } = await c.db.from('internal_notes').insert({ event_id: eventId, author_id: c.s.userId, body: text });
  if (error) return fail(errorCode(error));
  refresh(eventId);
  return ok(undefined);
}

export async function deleteInternalNote(noteId: string, eventId: string): Promise<ActionResult> {
  const c = await staffCtx(); if (!c) return fail('forbidden');
  const { error } = await c.db.from('internal_notes').delete().eq('id', noteId).eq('author_id', c.s.userId);
  if (error) return fail(errorCode(error));
  refresh(eventId);
  return ok(undefined);
}

export async function markReviewed(eventId: string): Promise<ActionResult> {
  const c = await staffCtx(); if (!c) return fail('forbidden');
  const { error } = await c.db.rpc('mark_event_reviewed', { p_event: eventId });
  if (error) return fail(errorCode(error));
  refresh(eventId);
  return ok(undefined);
}

export async function deleteRecommendation(recId: string, eventId: string): Promise<ActionResult> {
  const c = await staffCtx(); if (!c) return fail('forbidden');
  const { error } = await c.db.from('dj_recommendations').delete().eq('id', recId).eq('created_by', c.s.userId);
  if (error) return fail(errorCode(error));
  refresh(eventId);
  return ok(undefined);
}
