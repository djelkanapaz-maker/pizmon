import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The native app is a thin shell around the live web app: every screen, rule and
 * permission comes from the same server and database, so updates ship without a
 * store release. Native adds push notifications, the splash screen and status bar.
 */
const config: CapacitorConfig = {
  appId: 'app.paskol',
  appName: 'פסקול',
  webDir: 'www',
  server: {
    url: process.env.CAP_SERVER_URL ?? 'https://www.paskol.app',
    // links to other sites (Spotify, YouTube, Google sign-in…) open in the system browser
    allowNavigation: ['www.paskol.app', 'paskol.app'],
    errorPath: 'offline.html',
  },
  backgroundColor: '#F8F4ED',
  ios: { contentInset: 'never', scheme: 'Paskol', limitsNavigationsToAppBoundDomains: false },
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 900, backgroundColor: '#F8F4ED', showSpinner: false, androidScaleType: 'CENTER_INSIDE' },
    // dark text on the ivory background
    StatusBar: { style: 'LIGHT', backgroundColor: '#F8F4ED', overlaysWebView: false },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
