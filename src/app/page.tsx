import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, homeFor } from '@/server/session';
import { getI18n } from '@/i18n/server';
import { BrandMark, FlowLines, SoundWave } from '@/components/brand';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { ButtonLink } from '@/components/ui';
import { LandingGallery } from '@/components/LandingGallery';
import { StoreBadges } from '@/components/StoreBadges';
import { cookies } from 'next/headers';
import { SKIN_COOKIE, isSkin } from '@/core/skin';

const TITLE = 'פסקול · הפסקול של החתונה שלכם';
// screens for "a look inside", in the order of m.landing.gallery (made from the capture spec's shots, light and dark)
const GALLERY = ['home', 'library', 'moments', 'choose', 'stages', 'brief'];   // each in -light and -dark
// one screen per "What you get" card (m.landing.features), from scripts/tutorial/landing-capture.spec.ts;
// the app screens come in both skins and follow the page's look, the brief is the PDF itself (never: 585×585)
const FEATURE_SHOTS = ['feat-moment', 'feat-hits', 'feat-never', 'feat-brief'];
const FeatureShot = ({ img, alt }: { img: string; alt: string }) => {
  const pdf = img === 'feat-brief';
  const frame = pdf ? 'rounded-[14px] bg-white p-0 shadow-[0_18px_40px_-20px_rgba(31,31,31,.5)] ring-1 ring-black/5' : 'rounded-t-[30px] bg-[#1d1b19] px-[6px] pt-[6px]';
  const inner = pdf ? 'rounded-[14px]' : 'rounded-t-[24px]';
  return (
    <div className="mt-6 -mb-6 flex justify-center overflow-hidden">
      <div className={`w-[min(78%,300px)] ${frame}`}>
        {/* eslint-disable @next/next/no-img-element -- pre-sized screenshots in /public/landing */}
        {pdf
          ? <img src="/landing/feat-brief.webp" alt={alt} width={585} height={780} loading="lazy" decoding="async" className={`block w-full h-auto ${inner}`} />
          : (['light', 'dark'] as const).map((s) => (
            <img key={s} src={`/landing/${img}-${s}.webp`} alt={alt} width={585} height={img === 'feat-never' ? 585 : 780} loading="lazy" decoding="async"
              className={`block w-full h-auto ${inner} logo-for-${s}`} />
          ))}
        {/* eslint-enable @next/next/no-img-element */}
      </div>
    </div>
  );
};
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
  const sk = (await cookies()).get(SKIN_COOKIE)?.value;
  const skin = isSkin(sk) ? sk : 'light';
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
        <div className="mt-8 flex flex-col gap-3">
          <p className="text-sm font-bold">{L.getApp}</p>
          <StoreBadges labels={{ appStore: L.appStoreLabel, googlePlay: L.googlePlayLabel }} className="justify-end" />
        </div>
      </section>

      {/* a look inside: real screens, light and dark */}
      <section className="relative py-14 max-w-6xl mx-auto" aria-labelledby="gallery-title">
        <div className="gutter">
          <h2 id="gallery-title" className="display-m">{L.galleryTitle}</h2>
          <p className="mt-3 text-paper-dim">{L.gallerySub}</p>
        </div>
        <LandingGallery initial={skin} items={L.gallery.map((g, i) => ({ ...g, img: GALLERY[i] }))}
          labels={{ pick: L.skinPick, light: m.skin.light, dark: m.skin.dark, hint: L.galleryHint }} />
      </section>

      {/* features */}
      <section className="relative gutter py-14 max-w-6xl mx-auto">
        <h2 className="display-m mb-8">{L.featuresTitle}</h2>
        <ul className="grid sm:grid-cols-2 gap-4">
          {L.features.map((f, i) => (
            <li key={f.t} className="card p-6 flex flex-col">
              <p className="numeral text-[32px] leading-none text-champagne">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="display-s mt-3">{f.t}</h3>
              <p className="mt-2 text-paper-dim leading-relaxed">{f.b}</p>
              <FeatureShot img={FEATURE_SHOTS[i]} alt={f.t} />
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
        <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-5">
          <ButtonLink href={signupHref} size="lg">{L.cta}</ButtonLink>
          <StoreBadges labels={{ appStore: L.appStoreLabel, googlePlay: L.googlePlayLabel }} className="justify-end sm:justify-start" />
        </div>
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
        <nav aria-label={L.terms} className="flex items-center gap-4">
          <Link href="/terms" className="underline underline-offset-4">{L.terms}</Link>
          <Link href="/privacy" className="underline underline-offset-4">{L.privacy}</Link>
        </nav>
        <p className="w-full text-xs">{L.rights.replace('{year}', String(new Date().getFullYear()))}</p>
      </footer>
      <FlowLines className="pointer-events-none absolute inset-x-0 bottom-0 h-[22vh] w-full -z-0 opacity-70" />
    </main>
  );
}
