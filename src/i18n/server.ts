import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, dirOf, type Locale } from '@/core/i18n-text';
import { dictionaries } from './format';

export const LOCALE_COOKIE = 'wmc_locale';

/**
 * Cookie (set when the user switches language) → Hebrew. The browser language is deliberately ignored:
 * many Israeli couples' phones are set to English, and the app is for Israeli weddings.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (c === 'he' || c === 'en') return c;
  return DEFAULT_LOCALE;
});

export async function getI18n() {
  const locale = await getLocale();
  return { locale, m: dictionaries[locale], dir: dirOf(locale) };
}
