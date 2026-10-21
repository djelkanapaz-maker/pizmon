'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { getSession } from '@/server/session';
import { errorCode, fail, ok, type ActionResult } from '@/server/result';

/** The DJ themself, or a company admin, manages a DJ's meeting hours and calendar link (RLS + RPC checks). */
async function staff(djId: string) {
  const s = await getSession();
  if (!s || !s.company || !(s.role === 'admin' || (s.role === 'dj' && s.djId === djId))) return null;
  return { s, db: await supabaseServer() };
}

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export async function saveMeetingHours(djId: string, input: unknown): Promise<ActionResult> {
  if (!z.guid().safeParse(djId).success) return fail('validation');
  const c = await staff(djId); if (!c) return fail('forbidden');
  const p = z.object({ days: z.array(z.number().int().min(0).max(6)).max(7), start: hm, end: hm }).refine((v) => v.end > v.start).safeParse(input);
  if (!p.success) return fail('validation');
  const { error } = await c.db.from('djs').update({ meeting_hours: { ...p.data, days: [...new Set(p.data.days)].sort() } }).eq('id', djId);
  if (error) return fail(errorCode(error));
  revalidatePath('/dj/profile'); revalidatePath(`/admin/djs/${djId}`);
  return ok(undefined);
}

export async function disconnectGoogle(djId: string): Promise<ActionResult> {
  if (!z.guid().safeParse(djId).success) return fail('validation');
  const c = await staff(djId); if (!c) return fail('forbidden');
  const { error } = await c.db.rpc('clear_google_connection', { p_dj: djId });
  if (error) return fail(errorCode(error));
  revalidatePath('/dj/profile'); revalidatePath(`/admin/djs/${djId}`);
  return ok(undefined);
}
