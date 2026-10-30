// send-push — delivers a new in-app notification to the user's phones.
// Called by the notifications trigger (pg_net) with x-push-secret. Android via FCM HTTP v1,
// iOS via APNs (token-based auth). Credentials are edge-function secrets:
//   PUSH_SECRET, FCM_SERVICE_ACCOUNT (JSON), APNS_KEY (.p8 contents), APNS_KEY_ID, APNS_TEAM_ID,
//   APNS_BUNDLE_ID (default com.elkanapaz.pizmon), APNS_SANDBOX ("true" for development builds)
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const SECRET = Deno.env.get('PUSH_SECRET') ?? '';
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://app.elkanapaz.com').replace(/\/$/, '');

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = ''; bytes.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const pemBody = (pem: string) => Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));

async function signJwt(header: object, claims: object, key: CryptoKey, alg: 'RS256' | 'ES256') {
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = await crypto.subtle.sign(alg === 'RS256' ? { name: 'RSASSA-PKCS1-v1_5' } : { name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(input));
  return `${input}.${b64url(sig)}`;
}

// ── FCM (Android) ──
let fcm: { token: string; exp: number; project: string } | null = null;
async function fcmAuth() {
  if (fcm && fcm.exp > Date.now() + 60_000) return fcm;
  const sa = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? 'null');
  if (!sa) return null;
  const key = await crypto.subtle.importKey('pkcs8', pemBody(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJwt({ alg: 'RS256', typ: 'JWT' }, { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }, key, 'RS256');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}` });
  if (!r.ok) return null;
  const j = await r.json();
  fcm = { token: j.access_token, exp: Date.now() + j.expires_in * 1000, project: sa.project_id };
  return fcm;
}
async function sendAndroid(token: string, title: string, link: string) {
  const a = await fcmAuth(); if (!a) return 'unconfigured';
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project}/messages:send`, {
    method: 'POST', headers: { authorization: `Bearer ${a.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ message: { token, notification: { title: 'פסקול', body: title }, data: { link }, android: { priority: 'high', notification: { color: '#6f5cff', sound: 'default' } } } }),
  });
  if (r.ok) return 'sent';
  const t = await r.text();
  return /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/.test(t) ? 'gone' : 'failed';
}

// ── APNs (iOS) ──
let apns: { jwt: string; iat: number } | null = null;
async function apnsJwt() {
  const p8 = Deno.env.get('APNS_KEY'), kid = Deno.env.get('APNS_KEY_ID'), team = Deno.env.get('APNS_TEAM_ID');
  if (!p8 || !kid || !team) return null;
  const now = Math.floor(Date.now() / 1000);
  if (apns && now - apns.iat < 50 * 60) return apns.jwt;
  const key = await crypto.subtle.importKey('pkcs8', pemBody(p8), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  apns = { jwt: await signJwt({ alg: 'ES256', kid }, { iss: team, iat: now }, key, 'ES256'), iat: now };
  return apns.jwt;
}
async function sendIos(token: string, title: string, link: string) {
  const jwt = await apnsJwt(); if (!jwt) return 'unconfigured';
  const host = Deno.env.get('APNS_SANDBOX') === 'true' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const r = await fetch(`https://${host}/3/device/${token}`, {
    method: 'POST',
    headers: { authorization: `bearer ${jwt}`, 'apns-topic': Deno.env.get('APNS_BUNDLE_ID') ?? 'com.elkanapaz.pizmon', 'apns-push-type': 'alert', 'apns-priority': '10' },
    body: JSON.stringify({ aps: { alert: { title: 'פסקול', body: title }, sound: 'default' }, link }),
  });
  if (r.ok) return 'sent';
  return r.status === 410 || r.status === 400 ? 'gone' : 'failed';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' || !SECRET || req.headers.get('x-push-secret') !== SECRET) return new Response('forbidden', { status: 403 });
  const { notification_id } = await req.json().catch(() => ({}));
  if (typeof notification_id !== 'string') return new Response('bad request', { status: 400 });
  const { data, error } = await db.rpc('push_payload', { p_notification: notification_id, p_secret: SECRET });
  if (error) return new Response('error', { status: 500 });
  const results: string[] = [];
  for (const d of (data ?? []) as { platform: 'ios' | 'android'; token: string; title: string; link: string | null }[]) {
    const link = d.link?.startsWith('/') ? `${APP_URL}${d.link}` : APP_URL;
    const res = d.platform === 'ios' ? await sendIos(d.token, d.title, link) : await sendAndroid(d.token, d.title, link);
    if (res === 'gone') await db.rpc('forget_push_token', { p_token: d.token, p_secret: SECRET });
    results.push(res);
  }
  return new Response(JSON.stringify({ results }), { headers: { 'content-type': 'application/json' } });
});
