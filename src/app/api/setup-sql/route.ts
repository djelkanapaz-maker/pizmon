// TEMPORARY (one-time database setup): serves the schema migrations and seed so the new
// Supabase database can load them with pg_net. Locked by a one-time token; removed right after use.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TOKEN_SHA256 = '4dc78ec60a41a05c450328c0a843ee6eca30c91c2b88b38ee768bf28f7f0fb79';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const t = u.searchParams.get('t') ?? '';
  if (createHash('sha256').update(t).digest('hex') !== TOKEN_SHA256) return new Response('not found', { status: 404 });
  const dir = join(process.cwd(), 'supabase/migrations');
  const files = [...readdirSync(dir).filter((f) => f.endsWith('.sql')).sort(), 'seed.sql'];
  const part = u.searchParams.get('part');
  if (part === null) return Response.json(files);
  const f = files[Number(part)];
  if (!f) return new Response('no such part', { status: 404 });
  let sql = readFileSync(f === 'seed.sql' ? join(process.cwd(), 'supabase/seed.sql') : join(dir, f), 'utf8');
  if (f === 'seed.sql') sql = sql.replace(/^begin;$/m, '').replace(/^commit;$/m, '');
  return new Response(sql, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}
