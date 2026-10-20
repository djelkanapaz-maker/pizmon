import { getI18n } from '@/i18n/server';
import { signOut } from '@/server/actions/common';
import { Button } from '@/components/ui';

export default async function NoAccess() {
  const { m } = await getI18n();
  return (
    <div className="animate-rise">
      <h1 className="display-l mb-4">{m.errors.forbidden}</h1>
      <p className="text-paper-dim mb-8">{m.auth.noAccess}</p>
      <form action={signOut}><Button variant="secondary" full>{m.common.signOut}</Button></form>
    </div>
  );
}
