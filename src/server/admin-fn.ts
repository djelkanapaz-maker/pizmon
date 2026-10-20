import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';

/** Calls the `admin-users` edge function as the signed-in admin (their JWT is verified there). */
export async function callAdminFn<T>(action: string, body: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const db = await supabaseServer();
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: 'forbidden' };
  try {
    const r = await fetch(`${publicEnv.supabaseUrl}/functions/v1/admin-users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, apikey: publicEnv.supabaseAnonKey },
      body: JSON.stringify({ action, ...body }),
      cache: 'no-store',
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: String(json.error ?? 'unknown') };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: 'network' };
  }
}
