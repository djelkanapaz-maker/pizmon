import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getI18n } from '@/i18n/server';
import { getSession, homeFor } from '@/server/session';
import { ErrorNote } from '@/components/ui';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  const { m } = await getI18n();
  const next = sp.next?.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/';
  return (
    <div className="animate-rise">
      <p className="label mb-3">{m.onboarding.welcomeKicker}</p>
      <h1 className="display-xl poster-shadow mb-3">{m.auth.signInTitle}</h1>
      <p className="text-paper-dim mb-8">{m.auth.signInSub}</p>
      {sp.error === 'link' && <div className="mb-6"><ErrorNote>{m.auth.linkInvalid}</ErrorNote></div>}
      <LoginForm next={next} />
      <p className="mt-6 text-center">
        <Link href="/forgot-password" className="text-sm font-bold text-paper-dim underline underline-offset-4 hover:text-paper">{m.auth.forgot}</Link>
      </p>
    </div>
  );
}
