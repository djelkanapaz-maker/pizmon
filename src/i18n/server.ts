import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, dirOf, type Locale } from '@/core/i18n-text';
import { dictionaries } from './format';

export const LOCALE_COOKIE = 'wmc_locale';

/** Cookie (set when the user switches language) → Accept-Language → Hebrew. */
export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (c === 'he' || c === 'en') return c;
  const accept = (await headers()).get('accept-language') ?? '';
  if (/^en\b/i.test(accept) && !/\bhe\b/i.test(accept)) return 'en';
  return DEFAULT_LOCALE;
});

export async function getI18n() {
  const locale = await getLocale();
  return { locale, m: dictionaries[locale], dir: dirOf(locale) };
}
