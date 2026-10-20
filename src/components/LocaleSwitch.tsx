'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLocale } from '@/server/actions/common';
import { useI18n } from '@/i18n/client';
import { cx } from './ui';

export function LocaleSwitch({ compact }: { compact?: boolean }) {
  const { locale, m } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (l: 'he' | 'en') => start(async () => { await setLocale(l); router.refresh(); });
  return (
    <div role="group" aria-label={m.common.language} className={cx('inline-flex rounded-full border border-line p-1 gap-1', pending && 'opacity-60')}>
      {(['he', 'en'] as const).map((l) => (
        <button key={l} type="button" onClick={() => choose(l)} aria-pressed={locale === l} lang={l}
          className={cx('rounded-full font-bold transition-colors', compact ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
            locale === l ? 'bg-paper text-ink' : 'text-paper-dim hover:text-paper')}>
          {l === 'he' ? 'עב' : 'EN'}
        </button>
      ))}
    </div>
  );
}
