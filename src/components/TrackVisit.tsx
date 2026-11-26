'use client';
import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

type Page = 'landing' | 'signup' | 'get_app';
const KEY = 'paskol_vid';

/** A random id this browser keeps, so a visitor is counted once (no personal data). */
function visitorId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(KEY, id); }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Counts a visit (or the start of the sign-up form) for the admin's funnel. Never blocks or throws. */
export function trackVisit(page: Page, event: 'view' | 'form_start' = 'view') {
  try {
    if (typeof window === 'undefined' || navigator.webdriver) return;
    const q = new URLSearchParams(window.location.search);
    const source = [q.get('ref'), q.get('utm_source'), q.get('utm_campaign')].filter(Boolean).join(' / ')
      || (document.referrer && !document.referrer.includes(window.location.host) ? new URL(document.referrer).hostname : '');
    // the query only runs once it's awaited / then'd
    supabaseBrowser().rpc('track_visit', { p_page: page, p_event: event, p_visitor: visitorId(), p_source: source.slice(0, 120) }).then(() => {}, () => {});
  } catch { /* counting is best-effort */ }
}

export function TrackVisit({ page }: { page: Page }) {
  useEffect(() => { trackVisit(page); }, [page]);
  return null;
}
