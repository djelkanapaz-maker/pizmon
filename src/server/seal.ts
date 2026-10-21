import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** AES-256-GCM sealing of third-party refresh tokens with a key derived from a server-only secret. */
const keyFor = (secret: string | undefined, purpose: string) => {
  if (!secret) throw new Error('seal_key_missing');
  return createHash('sha256').update(`${purpose}:${secret}`).digest();
};

export function sealWith(secret: string | undefined, purpose: string, plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', keyFor(secret, purpose), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${body.toString('base64url')}`;
}

export function openWith(secret: string | undefined, purpose: string, sealed: string) {
  const [v, iv, tag, body] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !body) throw new Error('seal_invalid');
  const d = createDecipheriv('aes-256-gcm', keyFor(secret, purpose), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
}
