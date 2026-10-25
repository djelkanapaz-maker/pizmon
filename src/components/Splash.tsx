'use client';
/**
 * Opening animation, once per app launch (per browser session): the Pizmon mark flies
 * toward the viewer, spins, then bursts into notes and scatters in every direction before the app shows.
 * The app renders underneath the whole time, so nothing waits on the animation.
 * A tiny inline script (SPLASH_SCRIPT, run before paint) hides it on later navigations/reloads.
 */
import { useEffect, useState } from 'react';
import { PizmonMark } from './brand';

export const SPLASH_KEY = 'pizmon-splash';
export const SPLASH_SCRIPT = `try{if(sessionStorage.getItem('${SPLASH_KEY}'))document.documentElement.dataset.splash='done'}catch(e){}`;

// an eighth note, drawn in a 60×60 box
const NOTE = 'M38,6v31.5a9.5,9.5,0,1,1-5-8.4V6Zm0,0c5,3,12,6,12,15-3-4-7-5-12-5Z';
const COLORS = ['#8b7bff', '#3fa9ff', '#e04cc4', '#ffffff'];

// fixed (not random) so server and client markup match
const PIECES = Array.from({ length: 36 }, (_, i) => {
  const angle = (i / 36) * Math.PI * 2 + (i % 3) * 0.17;
  const dist = 38 + ((i * 37) % 30); // vmax
  return {
    dx: `${(Math.cos(angle) * dist).toFixed(1)}vmax`,
    dy: `${(Math.sin(angle) * dist).toFixed(1)}vmax`,
    rot: `${((i * 97) % 540) - 270}deg`,
    size: 16 + ((i * 13) % 30),
    color: COLORS[i % COLORS.length],
    note: i % 2 === 0,
    delay: `${(i % 5) * 18}ms`,
  };
});

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
      <div className="splash-glow" />
      <div className="splash-ring" />
      <div className="splash-pieces">
        {PIECES.map((p, i) => (
          <svg key={i} viewBox="0 0 60.2 60.2" className="splash-piece"
            style={{ '--dx': p.dx, '--dy': p.dy, '--rot': p.rot, '--d': p.delay, width: p.size, height: p.size } as React.CSSProperties}>
            {p.note ? <path d={NOTE} fill={p.color} /> : <circle cx="30.1" cy="30.1" r="16" fill={p.color} />}
          </svg>
        ))}
      </div>
      <div className="splash-badge">
        <PizmonMark size={180} />
      </div>
    </div>
  );
}
