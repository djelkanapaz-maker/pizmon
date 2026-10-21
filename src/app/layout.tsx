import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { getI18n } from '@/i18n/server';
import { I18nProvider } from '@/i18n/client';
import { AudioProvider } from '@/components/audio/AudioProvider';
import { SpotifyPlayerProvider } from '@/components/audio/SpotifyPlayer';
import { ToastProvider } from '@/components/overlay';
import { Splash, SPLASH_SCRIPT } from '@/components/Splash';

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'ATISUTO';

export const metadata: Metadata = {
  title: { default: BRAND, template: `%s · ${BRAND}` },
  description: 'The digital home of your wedding’s music.',
  applicationName: BRAND,
  appleWebApp: { capable: true, title: BRAND, statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#c01f22',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, dir, m } = await getI18n();
  return (
    <html lang={locale} dir={dir} data-player="off">
      <body className="min-h-dvh">
        {/* before the splash is parsed: skip it if it already played in this session */}
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
        <Splash />
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[70] focus:bg-paper focus:text-ink focus:px-4 focus:py-2 focus:rounded-full">{m.nav.skip}</a>
        <I18nProvider locale={locale}>
          <ToastProvider>
            <AudioProvider><SpotifyPlayerProvider>{children}</SpotifyPlayerProvider></AudioProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
