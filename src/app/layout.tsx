import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { getI18n } from '@/i18n/server';
import { I18nProvider } from '@/i18n/client';
import { AudioProvider } from '@/components/audio/AudioProvider';
import { SpotifyPlayerProvider } from '@/components/audio/SpotifyPlayer';
import { ToastProvider } from '@/components/overlay';
import { Splash, SPLASH_SCRIPT } from '@/components/Splash';
import { cookies } from 'next/headers';
import { isSkin, SKIN_COOKIE, SKIN_THEME_COLOR } from '@/core/skin';

const skinOf = async () => { const v = (await cookies()).get(SKIN_COOKIE)?.value; return isSkin(v) ? v : 'light'; };

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'פסקול';

export const metadata: Metadata = {
  // absolute URLs for share previews (Facebook, WhatsApp): the public address of the app
  metadataBase: new URL(process.env.NEXT_PUBLIC_PUBLIC_URL ?? 'https://www.paskol.app'),
  title: { default: BRAND, template: `%s · ${BRAND}` },
  description: 'The digital home of your wedding’s music.',
  applicationName: BRAND,
  appleWebApp: { capable: true, title: BRAND, statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: SKIN_THEME_COLOR[await skinOf()], width: 'device-width', initialScale: 1, viewportFit: 'cover' };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, dir, m } = await getI18n();
  const skin = await skinOf();
  return (
    <html lang={locale} dir={dir} data-player="off" data-skin={skin}>
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
