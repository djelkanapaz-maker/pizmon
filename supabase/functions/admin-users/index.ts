// admin-users — the only place the service-role key is used.
// Creates couple / DJ accounts and returns one-time activation links.
// Every action except `bootstrap` requires the caller to be an admin of the target company.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = (Deno.env.get('APP_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
const BOOTSTRAP_SECRET = Deno.env.get('BOOTSTRAP_SECRET');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const EMAIL_FROM = Deno.env.get('EMAIL_FROM');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bootstrap-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message ?? code); }
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// ── validation helpers (deliberately tiny; inputs are also constrained by DB checks) ──
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function str(v: unknown, field: string, { required = false, max = 200 } = {}): string | null {
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpError(400, 'invalid_input', `${field} is required`);
    return null;
  }
  if (typeof v !== 'string' || v.trim().length > max) throw new HttpError(400, 'invalid_input', `${field} is invalid`);
  return v.trim();
}
function email(v: unknown, required = true): string | null {
  const e = str(v, 'email', { required, max: 254 });
  if (e && !EMAIL_RE.test(e)) throw new HttpError(400, 'invalid_input', 'email is invalid');
  return e?.toLowerCase() ?? null;
}
function uuid(v: unknown, field: string, required = true): string | null {
  const s = str(v, field, { required, max: 36 });
  if (s && !/^[0-9a-f-]{36}$/i.test(s)) throw new HttpError(400, 'invalid_input', `${field} is invalid`);
  return s;
}

async function requireAdmin(req: Request, companyId: string) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'unauthenticated');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'unauthenticated');
  const { data: m } = await admin.from('company_members').select('role')
    .eq('company_id', companyId).eq('user_id', data.user.id).maybeSingle();
  if (m?.role !== 'admin') throw new HttpError(403, 'admin_only');
  // a client acting as the caller, so RPCs keep their own permission checks
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { user: data.user, asCaller };
}

async function findUserByEmail(e: string) {
  // profiles mirrors auth.users emails (trigger on insert)
  const { data } = await admin.from('profiles').select('id').eq('email', e).maybeSingle();
  if (!data) return null;
  const { data: u } = await admin.auth.admin.getUserById(data.id);
  return u.user ?? null;
}

/** Returns an activation link for a new or existing user. */
async function activationLink(e: string, meta: Record<string, unknown>) {
  const existing = await findUserByEmail(e);
  // first contact → invite (creates the user); afterwards → recovery (sets a new password)
  const type = existing ? 'recovery' : 'invite';
  const { data, error } = await admin.auth.admin.generateLink({
    type, email: e, options: { data: meta, redirectTo: `${APP_URL}/auth/confirm` },
  } as Parameters<typeof admin.auth.admin.generateLink>[0]);
  if (error || !data?.properties?.hashed_token || !data.user) throw new HttpError(500, 'link_failed', error?.message);
  const link = `${APP_URL}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${type}&next=${encodeURIComponent('/activate')}`;
  return { userId: data.user.id, link, type, isNew: !existing };
}

async function maybeEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !EMAIL_FROM) return { sent: false, reason: 'email_not_configured' };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  });
  return r.ok ? { sent: true } : { sent: false, reason: `email_failed_${r.status}` };
}

async function ensureMembership(db: SupabaseClient, companyId: string, userId: string, role: 'admin' | 'dj' | 'couple') {
  const { data: existing } = await db.from('company_members').select('role').eq('company_id', companyId).eq('user_id', userId).maybeSingle();
  if (existing && existing.role !== role) throw new HttpError(409, 'role_conflict', `user is already a ${existing.role} in this company`);
  if (!existing) {
    const { error } = await db.from('company_members').insert({ company_id: companyId, user_id: userId, role });
    if (error) throw new HttpError(500, 'membership_failed', error.message);
  }
}

const inviteHtml = (name: string, link: string) =>
  `<p>Hi ${name.replace(/[<>&]/g, '')},</p><p>Your wedding music workspace is ready. Activate your account:</p><p><a href="${link}">${link}</a></p>`;

// ── actions ──
type Body = Record<string, unknown>;
const actions: Record<string, (req: Request, b: Body) => Promise<unknown>> = {
  async bootstrap(req, b) {
    if (!BOOTSTRAP_SECRET || req.headers.get('x-bootstrap-secret') !== BOOTSTRAP_SECRET) throw new HttpError(403, 'forbidden');
    const slug = str(b.company_slug, 'company_slug', { required: true })!;
    const e = email(b.email)!;
    const { data: company } = await admin.from('companies').select('id').eq('slug', slug).maybeSingle();
    if (!company) throw new HttpError(404, 'company_not_found');
    const { count } = await admin.from('company_members').select('*', { count: 'exact', head: true })
      .eq('company_id', company.id).eq('role', 'admin');
    if ((count ?? 0) > 0) throw new HttpError(409, 'already_bootstrapped');
    const { userId, link } = await activationLink(e, { full_name: str(b.full_name, 'full_name') });
    await ensureMembership(admin, company.id, userId, 'admin');
    return { company_id: company.id, user_id: userId, activation_link: link };
  },

  async create_couple(req, b) {
    const companyId = uuid(b.company_id, 'company_id')!;
    const { user, asCaller } = await requireAdmin(req, companyId);
    const e = email(b.email)!;
    const p1 = str(b.partner_one_name, 'partner_one_name', { required: true, max: 80 })!;
    const guest = b.guest_count === undefined || b.guest_count === null || b.guest_count === '' ? null : Number(b.guest_count);
    if (guest !== null && (!Number.isInteger(guest) || guest < 1 || guest > 5000)) throw new HttpError(400, 'invalid_input', 'guest_count is invalid');
    const date = str(b.wedding_date, 'wedding_date', { max: 10 });
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'invalid_input', 'wedding_date is invalid');

    const existing = await findUserByEmail(e);
    if (existing) {
      const { data: m } = await admin.from('company_members').select('role').eq('company_id', companyId).eq('user_id', existing.id).maybeSingle();
      if (m && m.role !== 'couple') throw new HttpError(409, 'role_conflict', `this email already belongs to a ${m.role}`);
    }
    const { data: ev, error } = await admin.from('wedding_events').insert({
      company_id: companyId, partner_one_name: p1,
      partner_two_name: str(b.partner_two_name, 'partner_two_name', { max: 80 }),
      wedding_date: date, venue_name: str(b.venue_name, 'venue_name', { max: 120 }),
      venue_city: str(b.venue_city, 'venue_city', { max: 80 }), guest_count: guest,
      invite_email: e, created_by: user.id,
    }).select('id').single();
    if (error) throw new HttpError(400, 'create_failed', error.message);

    try {
      const { userId, link } = await activationLink(e, { full_name: p1, locale: b.locale === 'en' ? 'en' : 'he' });
      await ensureMembership(admin, companyId, userId, 'couple');
      const { error: cmErr } = await admin.from('couple_members').insert({ event_id: ev.id, user_id: userId });
      if (cmErr) throw new HttpError(500, 'membership_failed', cmErr.message);

      let assignment = null;
      const djId = uuid(b.dj_id, 'dj_id', false);
      if (djId) {
        const { data, error: aErr } = await asCaller.rpc('admin_assign_dj', { p_event: ev.id, p_dj: djId, p_confirm: false });
        if (aErr) throw new HttpError(400, 'assign_failed', aErr.message);
        assignment = data;
      }
      await admin.from('activity_events').insert({ company_id: companyId, event_id: ev.id, actor_id: user.id,
        type: 'couple_created', entity_type: 'wedding_event', entity_id: ev.id, staff_only: true, payload: {} });
      const email_result = b.send_email ? await maybeEmail(e, 'Your wedding music workspace', inviteHtml(p1, link)) : { sent: false, reason: 'not_requested' };
      return { event_id: ev.id, user_id: userId, activation_link: link, assignment, email: email_result };
    } catch (err) {
      // keep the system consistent: no orphan event without a login
      await admin.from('wedding_events').delete().eq('id', ev.id);
      throw err;
    }
  },

  async add_partner(req, b) {
    const eventId = uuid(b.event_id, 'event_id')!;
    const { data: ev } = await admin.from('wedding_events').select('id, company_id, partner_two_name').eq('id', eventId).maybeSingle();
    if (!ev) throw new HttpError(404, 'event_not_found');
    await requireAdmin(req, ev.company_id);
    const e = email(b.email)!;
    const { userId, link } = await activationLink(e, { full_name: ev.partner_two_name ?? '' });
    await ensureMembership(admin, ev.company_id, userId, 'couple');
    const { data: other } = await admin.from('couple_members').select('event_id').eq('user_id', userId).neq('event_id', eventId).maybeSingle();
    if (other) throw new HttpError(409, 'already_in_other_event');
    await admin.from('couple_members').upsert({ event_id: eventId, user_id: userId }, { onConflict: 'event_id,user_id' });
    return { user_id: userId, activation_link: link };
  },

  async activation_link(req, b) {
    const eventId = uuid(b.event_id, 'event_id', false);
    const djId = uuid(b.dj_id, 'dj_id', false);
    let companyId: string; let e: string | null = null;
    if (eventId) {
      const { data: ev } = await admin.from('wedding_events').select('company_id, invite_email').eq('id', eventId).maybeSingle();
      if (!ev) throw new HttpError(404, 'event_not_found');
      companyId = ev.company_id; e = ev.invite_email;
    } else if (djId) {
      const { data: dj } = await admin.from('djs').select('company_id, user_id').eq('id', djId).maybeSingle();
      if (!dj?.user_id) throw new HttpError(404, 'dj_has_no_account');
      companyId = dj.company_id;
      const { data: u } = await admin.auth.admin.getUserById(dj.user_id);
      e = u.user?.email ?? null;
    } else throw new HttpError(400, 'invalid_input', 'event_id or dj_id required');
    await requireAdmin(req, companyId);
    if (!e) throw new HttpError(404, 'no_email');
    const { link, type } = await activationLink(e, {});
    const email_result = b.send_email ? await maybeEmail(e, 'Your account link', inviteHtml('', link)) : { sent: false, reason: 'not_requested' };
    return { activation_link: link, type, email: email_result };
  },

  async create_dj(req, b) {
    const companyId = uuid(b.company_id, 'company_id')!;
    await requireAdmin(req, companyId);
    const name = str(b.display_name, 'display_name', { required: true, max: 80 })!;
    const base = (str(b.slug, 'slug', { max: 60 }) ?? name).toLowerCase().normalize('NFKD')
      .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 50) || crypto.randomUUID().slice(0, 8);
    const { data: taken } = await admin.from('djs').select('slug').eq('company_id', companyId).like('slug', `${base}%`);
    const used = new Set((taken ?? []).map((d: { slug: string }) => d.slug));
    let slug = base;
    for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
    const specialties = Array.isArray(b.specialties) ? b.specialties.filter((s) => typeof s === 'string').slice(0, 12) : [];
    const e = email(b.email, false);
    let userId: string | null = null; let link: string | null = null;
    if (e) {
      const existing = await findUserByEmail(e);
      if (existing) {
        const { data: m } = await admin.from('company_members').select('role').eq('company_id', companyId).eq('user_id', existing.id).maybeSingle();
        if (m && m.role === 'couple') throw new HttpError(409, 'role_conflict', 'this email belongs to a couple');
      }
      const res = await activationLink(e, { full_name: name });
      userId = res.userId; link = res.link;
      await ensureMembership(admin, companyId, res.userId, 'dj');
    }
    const { data: dj, error } = await admin.from('djs').insert({
      company_id: companyId, user_id: userId, display_name: name, slug,
      bio_he: str(b.bio_he, 'bio_he', { max: 5000 }), bio_en: str(b.bio_en, 'bio_en', { max: 5000 }),
      specialties,
    }).select('id').single();
    if (error) throw new HttpError(400, 'create_failed', error.message);
    return { dj_id: dj.id, user_id: userId, activation_link: link };
  },

  async link_dj_account(req, b) {
    const djId = uuid(b.dj_id, 'dj_id')!;
    const { data: dj } = await admin.from('djs').select('company_id, user_id, display_name').eq('id', djId).maybeSingle();
    if (!dj) throw new HttpError(404, 'dj_not_found');
    await requireAdmin(req, dj.company_id);
    if (dj.user_id) throw new HttpError(409, 'already_linked');
    const e = email(b.email)!;
    const { userId, link } = await activationLink(e, { full_name: dj.display_name });
    await ensureMembership(admin, dj.company_id, userId, 'dj');
    const { error } = await admin.from('djs').update({ user_id: userId }).eq('id', djId);
    if (error) throw new HttpError(400, 'link_failed', error.message);
    return { user_id: userId, activation_link: link };
  },
};

const handler = async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const fn = actions[String(body.action ?? '')];
    if (!fn) throw new HttpError(400, 'unknown_action');
    return json(200, await fn(req, body));
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.code, message: e.message });
    console.error('admin-users failure', e instanceof Error ? e.message : 'unknown');
    return json(500, { error: 'internal_error' });
  }
};

// LOCAL_FUNCTIONS_PORT is only set by scripts/local-stack; the hosted runtime picks its own port.
const localPort = Deno.env.get('LOCAL_FUNCTIONS_PORT');
if (localPort) Deno.serve({ port: Number(localPort) }, handler);
else Deno.serve(handler);
