import type { Dj } from '@/server/queries';
import { IconExternal } from './icons';

/** Bio in the UI language, falling back to whichever language exists . */
export function djBio(dj: Pick<Dj, 'bio_he' | 'bio_en'>, locale: 'he' | 'en') {
  const text = (locale === 'he' ? dj.bio_he || dj.bio_en : dj.bio_en || dj.bio_he) ?? '';
  const lang = locale === 'he' && dj.bio_he ? 'he' : dj.bio_en ? 'en' : 'he';
  return { text, lang };
}

export function DjBio({ dj, locale, clamp }: { dj: Pick<Dj, 'bio_he' | 'bio_en'>; locale: 'he' | 'en'; clamp?: boolean }) {
  const b = djBio(dj, locale);
  if (!b.text) return null;
  return (
    <div lang={b.lang} dir={b.lang === 'he' ? 'rtl' : 'ltr'} className={`text-paper-dim whitespace-pre-line text-start ${clamp ? 'line-clamp-4' : ''}`}>
      {b.text}
    </div>
  );
}

const LINK_LABELS: Record<string, string> = { instagram: 'Instagram', soundcloud: 'SoundCloud', spotify: 'Spotify', youtube: 'YouTube', facebook: 'Facebook', tiktok: 'TikTok', beatport: 'Beatport', website: 'elkanapaz.com' };

export function DjLinks({ links }: { links: Record<string, string> | null | undefined }) {
  const entries = Object.entries(links ?? {}).filter(([, url]) => /^https:\/\//.test(url));
  if (!entries.length) return null;
  return (
    <ul className="flex flex-wrap gap-2 justify-center">
      {entries.map(([k, url]) => (
        <li key={k}>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-line text-sm font-bold hover:border-ember hover:text-ember">
            <IconExternal size={14} />{LINK_LABELS[k] ?? k}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function DjLogo({ dj, className }: { dj: Pick<Dj, 'logo_url' | 'display_name'>; className?: string }) {
  if (!dj.logo_url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dj.logo_url} alt={dj.display_name} className={className ?? 'h-10 w-auto max-w-[220px]'} loading="lazy" />;
}
