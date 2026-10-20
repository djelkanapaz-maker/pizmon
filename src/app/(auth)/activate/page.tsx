import { redirect } from 'next/navigation';
import { getI18n } from '@/i18n/server';
import { getSession } from '@/server/session';
import { ActivateForm } from './ActivateForm';

export const metadata = { title: 'Activate' };

export default async function ActivatePage() {
  const session = await getSession();
  if (!session) redirect('/login?error=link');
  const { m } = await getI18n();
  return (
    <div className="animate-rise">
      <h1 className="display-xl poster-shadow mb-3">{m.auth.activateTitle}</h1>
      <p className="text-paper-dim mb-2">{m.auth.activateSub}</p>
      <p className="text-sm text-paper-dim mb-8" dir="ltr">{session.email}</p>
      <ActivateForm />
    </div>
  );
}
