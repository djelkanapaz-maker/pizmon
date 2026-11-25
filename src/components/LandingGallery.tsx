'use client';
import { useState } from 'react';
import { cx } from '@/components/ui';
import { applySkin } from '@/components/SkinPicker';
import type { Skin } from '@/core/skin';

type Item = { t: string; b: string; img: string };

/**
 * "A look inside" on the landing page: real app screens, with a light / dark switch that changes both the
 * screenshots and the page itself (saved on this device, like the in-app choice).
 */
export function LandingGallery({ items, initial, labels }: { items: Item[]; initial: Skin; labels: { pick: string; light: string; dark: string; hint: string } }) {
  const [skin, setSkin] = useState<Skin>(initial);
  const choose = (s: Skin) => { setSkin(s); applySkin(s); };
  return (
    <>
      <div className="gutter mt-6">
        <h3 id="skin-pick" className="font-bold text-lg">{labels.pick}</h3>
        <div role="radiogroup" aria-labelledby="skin-pick" className="mt-3 inline-flex rounded-full border border-line p-1 gap-1">
          {(['dark', 'light'] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={skin === s} onClick={() => choose(s)}
              className={cx('h-11 px-6 rounded-full font-bold transition-colors', skin === s ? 'bg-paper text-ink' : 'text-paper-dim hover:text-paper')}>
              {labels[s]}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-8 flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-px-5 px-5 pb-4 [scrollbar-width:thin]" aria-describedby="gallery-hint">
        {items.map((g, i) => (
          <li key={g.t} className="snap-start shrink-0 w-[min(62vw,240px)]">
            <div className={cx('rounded-[34px] p-[7px] transition-colors', skin === 'dark' ? 'bg-[linear-gradient(160deg,#4a4258,#121014_40%,#322b40)] shadow-[0_24px_60px_-24px_rgba(122,96,220,.7)]' : 'bg-[#1d1b19] shadow-[0_24px_50px_-24px_rgba(31,31,31,.55)]')}>
              {(['light', 'dark'] as const).map((s) => (
                // eslint-disable-next-line @next/next/no-img-element -- pre-sized screenshots in /public/landing
                <img key={s} src={`/landing/${g.img}-${s}.webp`} alt={`${g.t}: ${g.b}`} width={585} height={1266}
                  loading={i < 2 && s === skin ? 'eager' : 'lazy'} decoding="async" hidden={s !== skin} aria-hidden={s !== skin}
                  className="block w-full h-auto rounded-[28px]" />
              ))}
            </div>
            <h4 className="mt-4 font-bold text-lg">{g.t}</h4>
            <p className="mt-1 text-sm text-paper-dim leading-relaxed">{g.b}</p>
          </li>
        ))}
      </ul>
      <p id="gallery-hint" className="gutter mt-2 text-xs text-paper-dim">{labels.hint}</p>
    </>
  );
}
