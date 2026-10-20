export type Locale = 'he' | 'en';
export const LOCALES: Locale[] = ['he', 'en'];
export const DEFAULT_LOCALE: Locale = 'he';

/** Localized string stored in data (questionnaire templates, catalog). */
export type LText = { he: string; en: string };

export const lt = (text: LText | null | undefined, locale: Locale): string =>
  text ? text[locale] || text.he || text.en : '';

export const dirOf = (locale: Locale): 'rtl' | 'ltr' => (locale === 'he' ? 'rtl' : 'ltr');

/** Pick a `<field>_he` / `<field>_en` column pair from a row. */
export function col<T extends Record<string, unknown>>(row: T, field: string, locale: Locale): string {
  const v = row[`${field}_${locale}`] ?? row[`${field}_he`] ?? row[`${field}_en`];
  return typeof v === 'string' ? v : '';
}
