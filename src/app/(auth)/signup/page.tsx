import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getI18n } from '@/i18n/server';
import { getSession, homeFor } from '@/server/session';
import { SignupForm } from './SignupForm';

export const metadata = { title: 'הרשמה חינם', description: 'בונים יחד את הפסקול של החתונה. חינם לזוגות מתחתנים.' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  const { m, locale } = await getI18n();
  // where the visitor came from (a Facebook group post, a QR code…), kept with the lead
  const source = [sp.ref, sp.utm_source, sp.utm_campaign].filter(Boolean).join(' / ').slice(0, 120) || undefined;
  return (
    <div className="animate-rise">
      <p className="label mb-3 text-ember">{m.landing.free}</p>
      <h1 className="display-xl poster-shadow mb-3">{m.signup.title}</h1>
      <p className="text-paper-dim mb-8">{m.signup.sub}</p>
      <SignupForm source={source} locale={locale} />
      <p className="mt-6 text-center text-sm text-paper-dim">
        {m.signup.haveAccount} <Link href="/login" className="font-bold text-paper underline underline-offset-4">{m.signup.signIn}</Link>
      </p>
    </div>
  );
}
