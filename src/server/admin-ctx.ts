import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import { getSession } from '@/server/session';

/** Admin session + RLS-bound client, or null. Every admin action starts here. */
export async function adminCtx() {
  const s = await getSession();
  if (!s || s.role !== 'admin' || !s.company) return null;
  return { s: s as typeof s & { company: NonNullable<typeof s.company> }, db: await supabaseServer() };
}
