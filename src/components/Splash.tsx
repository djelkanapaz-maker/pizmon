'use client';
/**
 * Opening animation, once per app launch (per browser session): the star badge flies
 * toward the viewer, spins, then bursts open and scatters in every direction before the app shows.
 * The app renders underneath the whole time, so nothing waits on the animation.
 * A tiny inline script (SPLASH_SCRIPT, run before paint) hides it on later navigations/reloads.
 */
import { useEffect, useState } from 'react';

export const SPLASH_KEY = 'atisuto-splash';
export const SPLASH_SCRIPT = `try{if(sessionStorage.getItem('${SPLASH_KEY}'))document.documentElement.dataset.splash='done'}catch(e){}`;

const STAR = 'M30.1,0A30.1,30.1,0,1,0,60.2,30.1,30.13,30.13,0,0,0,30.1,0ZM43.9,49.8,30.1,39.7,16.2,49.8l5.3-16.3L7.7,23.4H24.8L30.1,7.1l5.3,16.3H52.5L38.7,33.5Z';
const STAR_SHAPE = 'M30.1,7.1l5.3,16.3H52.5L38.7,33.5l5.2,16.3L30.1,39.7,16.2,49.8l5.3-16.3L7.7,23.4H24.8Z';
const COLORS = ['#fbd100', '#fbd100', '#c01f22', '#fff4c2'];

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
    star: i % 2 === 0,
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
            {p.star ? <path d={STAR_SHAPE} fill={p.color} /> : <circle cx="30.1" cy="30.1" r="18" fill={p.color} />}
          </svg>
        ))}
      </div>
      <div className="splash-badge">
        <svg viewBox="0 0 60.2 60.2"><circle cx="30.1" cy="30.1" r="30.1" fill="#c01f22" /><path d={STAR} fill="#fbd100" fillRule="evenodd" /></svg>
      </div>
    </div>
  );
}
