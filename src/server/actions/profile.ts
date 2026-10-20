'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { getSession } from '@/server/session';
import { errorCode, fail, ok, type ActionResult } from '@/server/result';

export async function updateMyName(name: string): Promise<ActionResult> {
  const s = await getSession(); if (!s) return fail('forbidden');
  const v = z.string().trim().max(80).safeParse(name);
  if (!v.success) return fail('validation');
  const db = await supabaseServer();
  const { error } = await db.from('profiles').update({ full_name: v.data || null }).eq('id', s.userId);
  if (error) return fail(errorCode(error));
  revalidatePath('/', 'layout');
  return ok(undefined);
}

/** DJs edit their own public profile (RLS: djs_self_update + column grants). */
export async function updateMyDjProfile(input: unknown): Promise<ActionResult> {
  const s = await getSession(); if (!s || s.role !== 'dj' || !s.djId) return fail('forbidden');
  const p = z.object({
    display_name: z.string().trim().min(1).max(80), bio_he: z.string().trim().max(2000).optional(), bio_en: z.string().trim().max(2000).optional(),
    specialties: z.string().max(400).optional(), photo_url: z.url().max(1000).optional().or(z.literal('')), accepts_new_couples: z.boolean(),
  }).safeParse(input);
  if (!p.success) return fail('validation');
  const db = await supabaseServer();
  const { error } = await db.from('djs').update({
    display_name: p.data.display_name, bio_he: p.data.bio_he || null, bio_en: p.data.bio_en || null, photo_url: p.data.photo_url || null,
    accepts_new_couples: p.data.accepts_new_couples, specialties: (p.data.specialties ?? '').split(',').map((x) => x.trim()).filter(Boolean),
  }).eq('id', s.djId);
  if (error) return fail(errorCode(error));
  revalidatePath('/dj/profile');
  return ok(undefined);
}
