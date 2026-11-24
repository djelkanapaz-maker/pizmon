'use client';
/**
 * Opening animation, once per app launch (per browser session): the פסקול logo settles in, the record inside it
 * spins for about two and a half seconds, the tagline appears, then it all lifts away. Light-toned logo in the dark skin.
 * The app renders underneath the whole time, so nothing waits on the animation.
 * A tiny inline script (SPLASH_SCRIPT, run before paint) hides it on later navigations/reloads.
 */
import { useEffect, useState } from 'react';
import { TAGLINE_HE, WORDMARK } from './pizmon-mark';

/** The logo in two layers: the record (spins) under the wordmark and horn. Made by scripts/brand/logo-layers.py. */
const LAYERS = { record: '/brand/opening/record.webp', top: '/brand/opening/top.webp', recordLight: '/brand/opening/record-light.webp', topLight: '/brand/opening/top-light.webp' };

export const SPLASH_KEY = 'pizmon-splash';
export const SPLASH_SCRIPT = `try{if(sessionStorage.getItem('${SPLASH_KEY}'))document.documentElement.dataset.splash='done'}catch(e){}`;

export function Splash() {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    // already played this session: CSS keeps it hidden
    if (document.documentElement.dataset.splash === 'done') return;
    try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch { /* private mode: show every time */ }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => { document.documentElement.dataset.splash = 'done'; setGone(true); }, reduce ? 800 : 3700);
    return () => clearTimeout(t);
  }, []);
  if (gone) return null;
  const skip = () => { document.documentElement.dataset.splash = 'done'; setGone(true); };
  return (
    <div className="splash" aria-hidden="true" onClick={skip}>
      <div className="splash-center">
        <div className="splash-logo" role="img" aria-label={WORDMARK}>
          {/* eslint-disable @next/next/no-img-element -- brand layers, shown before hydration */}
          <span className="splash-layers logo-for-light"><img className="splash-record" src={LAYERS.record} alt="" /><img className="splash-top" src={LAYERS.top} alt="" /></span>
          <span className="splash-layers logo-for-dark"><img className="splash-record" src={LAYERS.recordLight} alt="" /><img className="splash-top" src={LAYERS.topLight} alt="" /></span>
          {/* eslint-enable @next/next/no-img-element */}
        </div>
        <div className="splash-tag" dir="rtl">{TAGLINE_HE}</div>
      </div>
    </div>
  );
}
