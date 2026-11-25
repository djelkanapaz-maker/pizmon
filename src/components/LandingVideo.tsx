'use client';
import { useRef, useState } from 'react';

/** The Paskol promo (the Instagram reel, web-sized) in a phone frame: poster first, plays with sound on tap. */
export function LandingVideo({ label, cta }: { label: string; cta: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const play = () => { setStarted(true); void ref.current?.play(); };
  return (
    <figure className="relative w-[min(78vw,300px)] mx-auto">
      <div className="rounded-[38px] bg-[#1d1b19] p-[8px] shadow-[0_30px_70px_-28px_rgba(31,31,31,.6)]">
        <video ref={ref} className="block w-full h-auto rounded-[30px] bg-black" width={720} height={1280}
          poster="/landing/paskol-reel-poster.webp" preload="none" playsInline controls={started} aria-label={label}
          onPlay={() => setStarted(true)}>
          <source src="/landing/paskol-reel.webm?v=4" type="video/webm" />
          <source src="/landing/paskol-reel.mp4?v=4" type="video/mp4" />
        </video>
      </div>
      {!started && (
        <button type="button" onClick={play} aria-label={cta}
          className="absolute left-1/2 top-[74%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 whitespace-nowrap rounded-full bg-paper text-ink px-6 h-14 font-bold shadow-[0_12px_30px_-10px_rgba(0,0,0,.6)] hover:brightness-110 transition">
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
          {cta}
        </button>
      )}
    </figure>
  );
}
