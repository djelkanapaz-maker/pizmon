import { redirect } from 'next/navigation';
import { getI18n } from '@/i18n/server';
import { Button } from '@/components/ui';

export const metadata = { title: 'Activate' };

type SP = { token_hash?: string; type?: string; next?: string };

/**
 * Landing page for activation / password links. It does NOT spend the one-time token:
 * link previews load this page harmlessly, and the token is verified only when the
 * person taps the button (POST /auth/confirm).
 */
export default async function ActivateStartPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  if (!sp.token_hash || !sp.type) redirect('/login?error=link');
  const { m } = await getI18n();
  return (
    <div className="animate-rise">
      <h1 className="display-xl poster-shadow mb-3">{m.auth.activateTitle}</h1>
      <p className="text-paper-dim mb-8">{m.auth.activateStartSub}</p>
      <form method="post" action="/auth/confirm">
        <input type="hidden" name="token_hash" value={sp.token_hash} />
        <input type="hidden" name="type" value={sp.type} />
        <input type="hidden" name="next" value={sp.next ?? '/activate'} />
        <Button type="submit" size="lg" full arrow>{m.auth.activateStartCta}</Button>
      </form>
    </div>
  );
}
