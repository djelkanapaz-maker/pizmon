'use client';
import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useI18n } from '@/i18n/client';

const ALLOWED_NEXT = ['/activate', '/', '/home', '/dj', '/admin'];

/**
 * Supabase's own reset email lands here (via /auth/confirm) with the session in the URL fragment:
 * #access_token=…&refresh_token=…&type=recovery, or #error=…&error_description=… when the link expired.
 */
export default function RecoverPage() {
  const { m } = useI18n();
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const q = new URLSearchParams(window.location.search);
    const next = ALLOWED_NEXT.includes(q.get('next') ?? '') ? q.get('next')! : '/activate';
    const access_token = hash.get('access_token'), refresh_token = hash.get('refresh_token');
    const fail = () => window.location.replace('/login?error=link');
    if (!access_token || !refresh_token) { fail(); return; }
    supabaseBrowser().auth.setSession({ access_token, refresh_token })
      .then((r: { error: unknown }) => (r.error ? fail() : window.location.replace(next)), fail);
  }, []);
  return <p role="status" className="min-h-dvh grid place-items-center text-paper-dim">{m.auth.recovering}</p>;
}
