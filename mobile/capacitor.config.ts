import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The native app is a thin shell around the live web app: every screen, rule and
 * permission comes from the same server and database, so updates ship without a
 * store release. Native adds push notifications, the splash screen and status bar.
 */
const config: CapacitorConfig = {
  appId: 'com.atisuto.weddingmusic',
  appName: 'ATISUTO',
  webDir: 'www',
  server: {
    url: process.env.CAP_SERVER_URL ?? 'https://atisuto-wedding-music.vercel.app',
    // links to other sites (Spotify, YouTube, Google sign-in…) open in the system browser
    allowNavigation: ['atisuto-wedding-music.vercel.app'],
    errorPath: 'offline.html',
  },
  backgroundColor: '#0b0909',
  ios: { contentInset: 'never', scheme: 'ATISUTO', limitsNavigationsToAppBoundDomains: false },
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 900, backgroundColor: '#0b0909', showSpinner: false, androidScaleType: 'CENTER_INSIDE' },
    StatusBar: { style: 'DARK', backgroundColor: '#c01f22', overlaysWebView: false },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
