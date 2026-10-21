'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { registerPushDevice } from '@/server/actions/push';

type Listener = { remove: () => void };
type Plugins = {
  PushNotifications?: {
    checkPermissions: () => Promise<{ receive: string }>;
    requestPermissions: () => Promise<{ receive: string }>;
    register: () => Promise<void>;
    addListener: (e: string, cb: (x: { value?: string; notification?: { data?: Record<string, unknown> } }) => void) => Promise<Listener>;
  };
  App?: { addListener: (e: string, cb: (x: { canGoBack: boolean }) => void) => Promise<Listener>; exitApp: () => void };
};
type Cap = { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: Plugins };

/**
 * Only does anything inside the iOS/Android app (Capacitor injects window.Capacitor).
 * Registers the phone for push notifications, opens the right screen when one is tapped,
 * and maps Android's back button to in-app navigation. Mounted for signed-in users.
 */
export function NativeBridge() {
  const router = useRouter();
  const { locale } = useI18n();
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: Cap }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    document.documentElement.dataset.native = cap.getPlatform?.() ?? 'native';
    const platform = cap.getPlatform?.() === 'ios' ? 'ios' : 'android';
    const { PushNotifications: push, App: app } = cap.Plugins ?? {};
    const subs: Promise<Listener>[] = [];
    if (push) {
      subs.push(push.addListener('registration', (t) => { if (t.value) void registerPushDevice({ platform, token: t.value, locale }); }));
      subs.push(push.addListener('pushNotificationActionPerformed', (a) => {
        const link = a.notification?.data?.link;
        if (typeof link === 'string') {
          try { const u = new URL(link, location.origin); if (u.origin === location.origin) router.push(u.pathname + u.search); } catch { /* ignore */ }
        }
      }));
      void (async () => {
        let perm = await push.checkPermissions();
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await push.requestPermissions();
        if (perm.receive === 'granted') await push.register();
      })().catch(() => undefined);
    }
    if (app) subs.push(app.addListener('backButton', ({ canGoBack }) => (canGoBack ? history.back() : app.exitApp())));
    return () => { subs.forEach((p) => p.then((l) => l.remove()).catch(() => undefined)); };
  }, [router, locale]);
  return null;
}
