import type { Locale } from '@/core/i18n-text';
import { en, type Messages } from './en';
import { he } from './he';

/** Wrap a value in Unicode isolates so a Latin name inside a Hebrew sentence keeps the right order. */
export const isolate = (v: string) => `\u2068${v}\u2069`;

export const dictionaries: Record<Locale, Messages> = { he, en };

/** "{name} likes {thing}" → fills placeholders. */
export function fmt(template: string, vars: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

const intlLocale = (l: Locale) => (l === 'he' ? 'he-IL' : 'en-GB');

export function formatDate(value: string | Date | null | undefined, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value.length === 10 ? `${value}T00:00:00` : value) : value;
  return new Intl.DateTimeFormat(intlLocale(locale), opts).format(d);
}

export function formatDateTime(value: string | Date | null | undefined, locale: Locale) {
  // times are shown in Israel time on the server and in the browser alike
  return formatDate(value, locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
}

export function relativeTime(value: string | Date, locale: Locale, now = Date.now()) {
  const d = typeof value === 'string' ? new Date(value) : value;
  const diff = (d.getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return formatDate(d, locale, { day: 'numeric', month: 'short' });
}

export const formatNumber = (n: number, locale: Locale) => new Intl.NumberFormat(intlLocale(locale)).format(n);
