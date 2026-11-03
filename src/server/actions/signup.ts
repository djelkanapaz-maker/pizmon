'use server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { publicEnv } from '@/lib/env';
import { fail, ok, type ActionResult } from '@/server/result';

const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const signup = z.object({
  partner_one_name: z.string().trim().min(1).max(80),
  partner_two_name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/),
  wedding_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')).transform((v) => v || null),
  venue_name: optional(120),
  no_date: z.boolean().optional(),
  venue_city: optional(80),
  guest_count: z.union([z.literal(''), z.coerce.number().int().min(1).max(5000)]).optional().transform((v) => (v === '' || v === undefined ? null : v)),
  has_dj: z.enum(['yes', 'no']).transform((v) => v === 'yes'),
  other_dj_name: optional(120),
  source: z.string().max(200).optional(),
  website: z.string().max(200).optional(), // honeypot: real people leave it empty
  locale: z.enum(['he', 'en']).optional(),
}).superRefine((v, ctx) => {
  // a couple who already booked a DJ says who
  if (v.has_dj && !v.other_dj_name) ctx.addIssue({ code: 'custom', path: ['other_dj_name'], message: 'required' });
  // the date and the venue are required, unless the couple hasn't set a date yet
  if (v.no_date) return;
  if (!v.wedding_date) ctx.addIssue({ code: 'custom', path: ['wedding_date'], message: 'required' });
  if (!v.venue_name) ctx.addIssue({ code: 'custom', path: ['venue_name'], message: 'required' });
});

/**
 * Public: a couple signs up for free. The account is created by the admin-users edge function
 * (service role lives only there); the browser then signs in with the same email and password.
 */
export async function selfSignup(input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = signup.safeParse(input);
  if (!parsed.success) return fail('validation', Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.code])));
  if (parsed.data.website) return ok(undefined); // bots get a quiet success and nothing is created
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || '';
  try {
    const r = await fetch(`${publicEnv.supabaseUrl}/functions/v1/admin-users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json', apikey: publicEnv.supabaseAnonKey,
        ...(process.env.SIGNUP_SECRET ? { 'x-signup-secret': process.env.SIGNUP_SECRET, 'x-client-ip': ip } : {}),
      },
      // signing up includes being contacted about the wedding (privacy policy), so there is no separate checkbox
      body: JSON.stringify({ action: 'self_signup', ...parsed.data, no_date: undefined, contact_consent: true, source: parsed.data.source?.slice(0, 120) }),
      cache: 'no-store',
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) return fail(String(json.error ?? 'unknown'));
    return ok(undefined);
  } catch {
    return fail('network');
  }
}
