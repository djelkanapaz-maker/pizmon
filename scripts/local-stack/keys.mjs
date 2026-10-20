// Mints the anon / service_role JWTs for the local stack (HS256, same secret as Auth & PostgREST).
import { createHmac } from 'node:crypto';
const secret = process.argv[2];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (role) => {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ iss: 'supabase-local', role, iat: 1700000000, exp: 4900000000 });
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
};
console.log(`LOCAL_ANON_KEY=${sign('anon')}`);
console.log(`LOCAL_SERVICE_KEY=${sign('service_role')}`);
