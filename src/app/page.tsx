import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, homeFor } from '@/server/session';
import { getI18n } from '@/i18n/server';
import { BrandMark, FlowLines, SoundWave } from '@/components/brand';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { ButtonLink } from '@/components/ui';

const TITLE = 'פסקול · הפסקול של החתונה שלכם';
// screens for "a look inside", in the order of m.landing.gallery (made from the capture spec's shots, light and dark)
const GALLERY = ['home-light', 'library-dark', 'moments-light', 'choose-dark', 'stages-light', 'brief-dark'];
const DESCRIPTION = 'בוחרים שיר לכל רגע, מסמנים מה לא לשמוע לעולם ומקבלים סיכום מוזיקלי לדיג׳יי. חינם לזוגות מתחתנים.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website', locale: 'he_IL', siteName: 'פסקול', images: [{ url: '/brand/og.png', width: 1200, height: 630, alt: 'פסקול' }] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/brand/og.png'] },
};

/** Signed-out visitors get the public landing page (paskol.app); everyone else goes to their home. */
export default async function Root({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await getSession();
  if (s) redirect(homeFor(s.role));
  const sp = await searchParams;
  const { m } = await getI18n();
  const L = m.landing;
  // keep campaign tags (?ref=, ?utm_source=) on the way to sign-up
  const keep = new URLSearchParams(Object.entries(sp).filter(([k, v]) => ['ref', 'utm_source', 'utm_campaign'].includes(k) && v) as [string, string][]).toString();
  const signupHref = `/signup${keep ? `?${keep}` : ''}`;

  return (
    <main id="main" className="relative min-h-dvh overflow-hidden bg-ink">
      <header className="relative gutter pt-[max(22px,env(safe-area-inset-top))] flex items-start justify-between max-w-6xl mx-auto">
        <BrandMark tagline size={34} />
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden sm:inline text-sm font-bold underline underline-offset-4">{m.signup.signIn}</Link>
          <LocaleSwitch compact />
        </div>
      </header>

      {/* hero */}
      <section className="relative gutter pt-14 md:pt-24 pb-16 max-w-6xl mx-auto animate-rise">
        <SoundWave height={34} className="absolute end-5 top-6 text-taupe opacity-80" />
        <p className="label mb-4">{L.kicker}</p>
        <h1 className="display-xl poster-shadow max-w-3xl">{L.title}</h1>
        <p className="mt-6 text-lg text-paper-dim max-w-2xl leading-relaxed">{L.sub}</p>
        <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4">
          <ButtonLink href={signupHref} size="lg">{L.cta}</ButtonLink>
          <Link href="/login" className="text-sm font-bold underline underline-offset-4 text-paper-dim hover:text-paper">{L.signIn}</Link>
        </div>
        <p className="mt-4 text-sm text-paper-dim">{L.free}</p>
      </section>

      {/* a look inside: real screens, light and dark */}
      <section className="relative py-14 max-w-6xl mx-auto" aria-labelledby="gallery-title">
        <div className="gutter">
          <h2 id="gallery-title" className="display-m">{L.galleryTitle}</h2>
          <p className="mt-3 text-paper-dim">{L.gallerySub}</p>
        </div>
        <ul className="mt-8 flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-px-5 px-5 pb-4 [scrollbar-width:thin]" aria-describedby="gallery-hint">
          {L.gallery.map((g, i) => (
            <li key={g.t} className="snap-start shrink-0 w-[min(62vw,240px)]">
              <div className="rounded-[34px] bg-[#1d1b19] p-[7px] shadow-[0_24px_50px_-24px_rgba(31,31,31,.55)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized screenshots in /public/landing */}
                <img src={`/landing/${GALLERY[i]}.webp`} alt={`${g.t}: ${g.b}`} width={585} height={1266} loading={i < 2 ? 'eager' : 'lazy'} decoding="async"
                  className="block w-full h-auto rounded-[28px]" />
              </div>
              <h3 className="mt-4 font-bold text-lg">{g.t}</h3>
              <p className="mt-1 text-sm text-paper-dim leading-relaxed">{g.b}</p>
            </li>
          ))}
        </ul>
        <p id="gallery-hint" className="gutter mt-2 text-xs text-paper-dim">{L.galleryHint}</p>
      </section>

      {/* features */}
      <section className="relative gutter py-14 max-w-6xl mx-auto">
        <h2 className="display-m mb-8">{L.featuresTitle}</h2>
        <ul className="grid sm:grid-cols-2 gap-4">
          {L.features.map((f, i) => (
            <li key={f.t} className="card p-6">
              <p className="numeral text-[32px] leading-none text-champagne">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="display-s mt-3">{f.t}</h3>
              <p className="mt-2 text-paper-dim leading-relaxed">{f.b}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* how it works */}
      <section className="relative gutter py-14 max-w-6xl mx-auto">
        <h2 className="display-m mb-8">{L.stepsTitle}</h2>
        <ol className="grid md:grid-cols-3 gap-4">
          {L.steps.map((t, i) => (
            <li key={t} className="flex items-center gap-4 rounded-[20px] bg-champagne/35 p-5">
              <span className="numeral text-[40px] leading-none">{i + 1}</span>
              <span className="font-bold text-lg">{t}</span>
            </li>
          ))}
        </ol>
        <div className="mt-10"><ButtonLink href={signupHref} size="lg">{L.cta}</ButtonLink></div>
      </section>

      {/* about Elkana */}
      <section className="relative gutter py-14 max-w-6xl mx-auto">
        <div className="rounded-[24px] bg-paper text-ink p-7 md:p-10">
          <p className="label !text-champagne mb-3">{L.aboutKicker}</p>
          <h2 className="display-l">{L.aboutTitle}</h2>
          {L.aboutBody.map((t) => <p key={t} className="mt-4 max-w-2xl leading-relaxed opacity-85">{t}</p>)}
          <a href="https://www.elkanapaz.com" target="_blank" rel="noopener" className="mt-6 inline-flex h-11 items-center rounded-full bg-champagne px-6 font-bold text-paper">{L.aboutCta}</a>
        </div>
      </section>

      <footer className="relative gutter pt-10 pb-[max(28px,env(safe-area-inset-bottom))] max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm text-paper-dim">
        <span>{L.footer}</span>
        <Link href="/privacy" className="underline underline-offset-4">{L.privacy}</Link>
      </footer>
      <FlowLines className="pointer-events-none absolute inset-x-0 bottom-0 h-[22vh] w-full -z-0 opacity-70" />
    </main>
  );
}
