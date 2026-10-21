import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export type Role = 'admin' | 'dj' | 'couple';

export type Company = {
  id: string; slug: string; brand_name: string; brand_tagline_he: string | null; brand_tagline_en: string | null;
  assignment_policy: 'company_assigned' | 'couple_selects'; couple_selection_requires_approval: boolean;
  default_locale: 'he' | 'en'; contact_email: string | null;
};

export type SessionContext = {
  userId: string;
  email: string;
  fullName: string | null;
  locale: 'he' | 'en';
  role: Role | null;
  company: Company | null;
  eventId: string | null;   // couples
  djId: string | null;      // DJs
};

/** Data Access Layer entry point: one verified user lookup per request. */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const db = await supabaseServer();
  // verified locally from the session token; falls back to the Auth server when needed
  const { data: auth } = await db.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return null;
  // all lookups at once instead of one after another
  const [{ data: profile }, { data: members }, { data: couple }, { data: dj }] = await Promise.all([
    db.from('profiles').select('full_name, locale').eq('id', uid).maybeSingle(),
    db.from('company_members').select('role, company:companies(*)').eq('user_id', uid).order('created_at'),
    db.from('couple_members').select('event_id').eq('user_id', uid).order('created_at').limit(1).maybeSingle(),
    db.from('djs').select('id').eq('user_id', uid).maybeSingle(),
  ]);
  const member = (members ?? [])[0] as unknown as { role: Role; company: Company } | undefined;
  const eventId: string | null = member?.role === 'couple' ? couple?.event_id ?? null : null;
  const djId: string | null = member?.role === 'dj' ? dj?.id ?? null : null;
  return {
    userId: uid,
    email: typeof auth.claims.email === 'string' ? auth.claims.email : '',
    fullName: profile?.full_name ?? null,
    locale: profile?.locale === 'en' ? 'en' : 'he',
    role: member?.role ?? null,
    company: member?.company ?? null,
    eventId,
    djId,
  };
});

export const homeFor = (role: Role | null) =>
  role === 'admin' ? '/admin' : role === 'dj' ? '/dj' : role === 'couple' ? '/home' : '/no-access';

export async function requireSession() {
  const s = await getSession();
  if (!s) redirect('/login');
  return s;
}

export async function requireRole<R extends Role>(...roles: R[]) {
  const s = await requireSession();
  if (!s.role || !roles.includes(s.role as R) || !s.company) redirect(homeFor(s.role));
  return s as SessionContext & { role: R; company: Company };
}

export async function requireCouple() {
  const s = await requireRole('couple');
  if (!s.eventId) redirect('/no-access');
  return s as typeof s & { eventId: string };
}

export async function requireDj() {
  const s = await requireRole('dj');
  if (!s.djId) redirect('/no-access');
  return s as typeof s & { djId: string };
}
