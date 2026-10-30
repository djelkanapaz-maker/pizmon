'use client';
/**
 * Opening animation, once per app launch (per browser session): flow lines draw across the ivory,
 * a sound wave rises and the פזמון wordmark with its tagline settles in, then it lifts away.
 * The app renders underneath the whole time, so nothing waits on the animation.
 * A tiny inline script (SPLASH_SCRIPT, run before paint) hides it on later navigations/reloads.
 */
import { useEffect, useState } from 'react';
import { FLOW_LINES, TAGLINE_HE, WAVE, WORDMARK } from './pizmon-mark';

export const SPLASH_KEY = 'pizmon-splash';
export const SPLASH_SCRIPT = `try{if(sessionStorage.getItem('${SPLASH_KEY}'))document.documentElement.dataset.splash='done'}catch(e){}`;

export function Splash() {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    // already played this session: CSS keeps it hidden
    if (document.documentElement.dataset.splash === 'done') return;
    try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch { /* private mode: show every time */ }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => { document.documentElement.dataset.splash = 'done'; setGone(true); }, reduce ? 700 : 3000);
    return () => clearTimeout(t);
  }, []);
  if (gone) return null;
  const skip = () => { document.documentElement.dataset.splash = 'done'; setGone(true); };
  return (
    <div className="splash" aria-hidden="true" onClick={skip}>
      <svg className="splash-lines" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
        {FLOW_LINES.map((d, i) => <path key={i} d={d} />)}
      </svg>
      <div className="splash-center">
        <div className="splash-wave">
          {WAVE.map((h, i) => <i key={i} style={{ height: h, animationDelay: `${180 + Math.abs(i - 6) * 55}ms` }} />)}
        </div>
        <div className="splash-word" dir="rtl">{WORDMARK}</div>
        <div className="splash-latin">PIZMON</div>
        <div className="splash-tag" dir="rtl">{TAGLINE_HE}</div>
      </div>
    </div>
  );
}
