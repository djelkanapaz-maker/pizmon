'use server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { getSession } from '@/server/session';
import { errorCode, fail, ok, type ActionResult } from '@/server/result';

/** The native app registers this phone for push notifications of the signed-in user. */
export async function registerPushDevice(input: unknown): Promise<ActionResult> {
  const s = await getSession(); if (!s) return fail('forbidden');
  const p = z.object({ platform: z.enum(['ios', 'android']), token: z.string().min(20).max(4096), locale: z.enum(['he', 'en']).default('he') }).safeParse(input);
  if (!p.success) return fail('validation');
  const db = await supabaseServer();
  const { error } = await db.rpc('register_push_device', { p_platform: p.data.platform, p_token: p.data.token, p_locale: p.data.locale });
  return error ? fail(errorCode(error)) : ok(undefined);
}

/** Starts account deletion: company admins are notified and remove the account. */
export async function requestAccountDeletion(): Promise<ActionResult> {
  const s = await getSession(); if (!s) return fail('forbidden');
  const db = await supabaseServer();
  const { error } = await db.rpc('request_account_deletion');
  return error ? fail(errorCode(error)) : ok(undefined);
}
