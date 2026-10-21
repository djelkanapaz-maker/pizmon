// Helpers for integration tests against the LOCAL stack (scripts/local-stack/start.sh).
// All accounts created here are throwaway test users on 127.0.0.1.
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';

const envFile = new URL('../../.env.test.local', import.meta.url);
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
export const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  bootstrap: process.env.LOCAL_BOOTSTRAP_SECRET!,
  db: process.env.LOCAL_DATABASE_URL!,
};
if (!env.url?.includes('127.0.0.1')) throw new Error('Integration tests only run against the local stack');

export const COMPANY_ID = '00000000-0000-4000-8000-000000000001';
export const TEST_PASSWORD = `test-${randomUUID()}`;   // generated per run, local only

export const anonClient = () => createClient(env.url, env.anon, { auth: { persistSession: false, autoRefreshToken: false } });

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: env.db });
  await c.connect();
  try { return (await c.query(text, params)).rows as T[]; } finally { await c.end(); }
}

export async function fn(action: string, body: Record<string, unknown>, token?: string, headers: Record<string, string> = {}) {
  const r = await fetch(`${env.url}/functions/v1/admin-users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: env.anon, ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: JSON.stringify({ action, ...body }),
  });
  return { status: r.status, body: await r.json() };
}

/** Follow an activation link the way /auth/confirm + /activate do, and set a password. */
export async function activate(link: string, password = TEST_PASSWORD): Promise<SupabaseClient> {
  const u = new URL(link);
  const client = anonClient();
  const { error } = await client.auth.verifyOtp({ token_hash: u.searchParams.get('token_hash')!, type: u.searchParams.get('type') as 'invite' });
  if (error) throw error;
  const { error: e2 } = await client.auth.updateUser({ password });
  if (e2) throw e2;
  return client;
}

export async function signIn(email: string, password = TEST_PASSWORD) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

export const token = async (c: SupabaseClient) => (await c.auth.getSession()).data.session!.access_token;
export const uniq = (p: string) => `${p}-${randomUUID().slice(0, 8)}@wmc.test`;

let adminCache: SupabaseClient | null = null;
/** The company admin (bootstrapped once per database). */
export async function adminClient() {
  if (adminCache) return adminCache;
  const email = 'admin@wmc.test';
  const boot = await fn('bootstrap', { company_slug: 'atisuto', email, full_name: 'Test Admin' }, undefined, { 'x-bootstrap-secret': env.bootstrap });
  if (boot.status === 200) {
    adminCache = await activate(boot.body.activation_link);
  } else {
    // already bootstrapped by an earlier run of this local database: set a fresh local test password
    await sql(`update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')), email_confirmed_at = coalesce(email_confirmed_at, now()) where email = $1`, [email, TEST_PASSWORD]);
    adminCache = await signIn(email);
  }
  return adminCache!;
}

export async function createDj(name: string) {
  const admin = await adminClient();
  const email = uniq('dj');
  const r = await fn('create_dj', { company_id: COMPANY_ID, display_name: name, email }, await token(admin));
  if (r.status !== 200) throw new Error(JSON.stringify(r.body));
  const client = await activate(r.body.activation_link);
  return { client, djId: r.body.dj_id as string, email };
}

export async function createCouple(name: string, extra: Record<string, unknown> = {}) {
  const admin = await adminClient();
  const email = uniq('couple');
  const r = await fn('create_couple', { company_id: COMPANY_ID, partner_one_name: name, partner_two_name: 'Partner', email, ...extra }, await token(admin));
  if (r.status !== 200) throw new Error(JSON.stringify(r.body));
  const client = await activate(r.body.activation_link);
  return { client, eventId: r.body.event_id as string, email };
}

export async function anyTrack(where = 'true') {
  const [t] = await sql<{ id: string; artist_id: string; genre_id: string }>(
    `select id, artist_id, genre_id from public.music_tracks where company_id = $1 and ${where} order by title limit 1`, [COMPANY_ID]);
  return t;
}
