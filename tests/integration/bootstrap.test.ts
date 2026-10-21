import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { fn, sql, uniq } from '../helpers/stack';

describe('one-time bootstrap token', () => {
  it('creates the first admin once, then refuses', async () => {
    const slug = `co-${randomBytes(3).toString('hex')}`;
    const [c] = await sql<{ id: string }>(`insert into public.companies (slug, brand_name, app_url) values ($1, 'Token Co', 'https://app.example.com') returning id`, [slug]);
    const token = randomBytes(24).toString('hex');
    await sql(`insert into private.bootstrap_tokens (token_hash, company_id) values (encode(extensions.digest($1, 'sha256'), 'hex'), $2)`, [token, c.id]);

    const wrong = await fn('bootstrap', { company_slug: slug, email: uniq('boot') }, undefined, { 'x-bootstrap-secret': 'nope' });
    expect(wrong.status).toBe(403);
    const ok = await fn('bootstrap', { company_slug: slug, email: uniq('boot') }, undefined, { 'x-bootstrap-secret': token });
    expect(ok.status).toBe(200);
    expect(ok.body.activation_link).toMatch(/^https:\/\/app\.example\.com\/auth\/confirm\?token_hash=/);
    const again = await fn('bootstrap', { company_slug: slug, email: uniq('boot') }, undefined, { 'x-bootstrap-secret': token });
    expect(again.status).toBe(403);
    const left = await sql(`select 1 from private.bootstrap_tokens where company_id = $1`, [c.id]);
    expect(left).toHaveLength(0);
  });
  it('API users cannot read tokens or call the consume function', async () => {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/consume_bootstrap_token`, {
      method: 'POST', headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 'content-type': 'application/json' },
      body: JSON.stringify({ p_token: 'x', p_company: '00000000-0000-4000-8000-000000000001' }),
    });
    expect([401, 403, 404]).toContain(r.status);
  });
});
