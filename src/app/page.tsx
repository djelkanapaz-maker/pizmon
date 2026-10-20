import { redirect } from 'next/navigation';
import { getSession, homeFor } from '@/server/session';

export default async function Root() {
  const s = await getSession();
  redirect(s ? homeFor(s.role) : '/login');
}
