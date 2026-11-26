'use server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { publicEnv } from '@/lib/env';
import { fail, ok, type ActionResult } from '@/server/result';

/**
 * Public: "forgot password". The admin-users edge function emails our own reset link.
 * `fallback` means it can't send email right now and the browser should ask Supabase Auth to send one.
 */
export async function requestPasswordReset(email: string): Promise<ActionResult<{ fallback: boolean }>> {
  const parsed = z.string().trim().toLowerCase().email().max(254).safeParse(email);
  if (!parsed.success) return fail('validation');
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || '';
  try {
    const r = await fetch(`${publicEnv.supabaseUrl}/functions/v1/admin-users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json', apikey: publicEnv.supabaseAnonKey,
        ...(process.env.SIGNUP_SECRET ? { 'x-signup-secret': process.env.SIGNUP_SECRET, 'x-client-ip': ip } : {}),
      },
      body: JSON.stringify({ action: 'password_reset', email: parsed.data }),
      cache: 'no-store',
    });
    const json = await r.json().catch(() => ({}));
    if (r.status === 429) return fail('rate_limited');
    if (!r.ok) return ok({ fallback: true });
    return ok({ fallback: json.fallback === true });
  } catch {
    return ok({ fallback: true });
  }
}
