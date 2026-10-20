'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { dirOf, type Locale } from '@/core/i18n-text';
import { dictionaries, fmt } from './format';
import type { Messages } from './en';

const Ctx = createContext<{ locale: Locale; m: Messages } | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Ctx value={{ locale, m: dictionaries[locale] }}>{children}</Ctx>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return { ...v, fmt, dir: dirOf(v.locale) };
}
