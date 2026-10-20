// Minimal local stand-in for the Supabase API gateway.
//   /auth/v1/*      → Supabase Auth (GoTrue)   :9999
//   /rest/v1/*      → PostgREST                :3001
//   /functions/v1/* → Deno edge functions      :54323
// Only for local development and automated tests. Never deploy this.
import http from 'node:http';

const routes = [
  ['/auth/v1', 'http://127.0.0.1:9999'],
  ['/rest/v1', 'http://127.0.0.1:3001'],
  ['/functions/v1', 'http://127.0.0.1:54323'],
];
const port = Number(process.env.GATEWAY_PORT ?? 54321);

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, prefer, range, accept-profile, content-profile, x-supabase-api-version',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const match = routes.find(([prefix]) => req.url.startsWith(prefix));
  if (!match) { res.writeHead(404, cors); return res.end('not found'); }
  const [prefix, target] = match;
  const url = new URL(req.url.slice(prefix.length) || '/', target);
  const upstream = http.request(url, { method: req.method, headers: { ...req.headers, host: url.host } }, (up) => {
    res.writeHead(up.statusCode ?? 502, { ...up.headers, ...cors });
    up.pipe(res);
  });
  upstream.on('error', (e) => { res.writeHead(502, cors); res.end(String(e)); });
  req.pipe(upstream);
}).listen(port, '127.0.0.1', () => console.log(`gateway on :${port}`));
