'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setSkin } from '@/server/actions/common';
import { useI18n } from '@/i18n/client';
import { Sheet } from '@/components/overlay';
import { Button, cx } from '@/components/ui';
import { IconCheck } from '@/components/icons';
import { SKIN_COOKIE, SKIN_THEME_COLOR, type Skin } from '@/core/skin';

/** Switches the page at once (no reload), then saves the choice on the device and the account. */
export function applySkin(skin: Skin) {
  document.documentElement.dataset.skin = skin;
  document.cookie = `${SKIN_COOKIE}=${skin}; path=/; max-age=31536000; samesite=lax`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', SKIN_THEME_COLOR[skin]);
}

/** A miniature of each look, drawn with fixed colors so it shows the same whichever skin is on. */
function Preview({ skin }: { skin: Skin }) {
  const dark = skin === 'dark';
  const bg = dark ? '#000' : '#f8f4ed', card = dark ? '#16151b' : '#ffffff', ink = dark ? '#fff' : '#1f1f1f', dim = dark ? '#5d5a6c' : '#d9cfc0';
  const pill = dark ? 'linear-gradient(180deg,#8f79dc,#6a54ad 48%,#4f3c8a)' : '#1f1f1f';
  return (
    <div aria-hidden style={{ background: bg, borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, height: 150 }}>
      <div style={{ height: 10, width: '55%', borderRadius: 4, background: ink }} />
      <div style={{ height: 6, width: '80%', borderRadius: 3, background: dim }} />
      <div style={{ background: card, borderRadius: 10, padding: 8, display: 'flex', flexDirection: 'column', gap: 6, border: dark ? '1px solid #2b2934' : '1px solid #e4dacb' }}>
        <div style={{ height: 6, width: '70%', borderRadius: 3, background: dim }} />
        <div style={{ height: 18, width: '58%', borderRadius: 999, background: pill, boxShadow: dark ? 'inset 0 1px 0 rgba(255,255,255,.38), 0 6px 12px -6px rgba(122,96,220,.8)' : 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ height: 14, flex: 1, borderRadius: 999, background: dark ? (i === 0 ? pill : 'linear-gradient(180deg,#34295a,#251d42)') : (i === 0 ? '#1f1f1f' : '#f0e9de') }} />)}
      </div>
    </div>
  );
}

export function SkinPicker({ value, onPicked }: { value: Skin | null; onPicked?: (s: Skin) => void }) {
  const { m } = useI18n();
  const router = useRouter();
  const [current, setCurrent] = useState<Skin | null>(value);
  const [, start] = useTransition();
  const choose = (s: Skin) => {
    setCurrent(s);
    applySkin(s);
    onPicked?.(s);
    start(async () => { await setSkin(s); router.refresh(); });
  };
  return (
    <div role="radiogroup" aria-label={m.skin.title} className="grid grid-cols-2 gap-3">
      {(['light', 'dark'] as const).map((s) => {
        const on = current === s;
        return (
          <button key={s} type="button" role="radio" aria-checked={on} onClick={() => choose(s)}
            className={cx('text-start rounded-2xl border-2 p-2 transition-colors', on ? 'border-ember' : 'border-line hover:border-taupe')}>
            <Preview skin={s} />
            <span className="flex items-center justify-between gap-2 px-1 pt-2 pb-1">
              <span className="font-bold">{m.skin[s]}</span>
              {on && <IconCheck size={18} className="text-ember" />}
            </span>
            <span className="block px-1 pb-1 text-xs text-paper-dim">{m.skin[`${s}Hint`]}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * In the couple area: keeps this device on the skin saved on the account (a new phone, a cleared browser),
 * and asks once when no skin was chosen yet.
 */
export function SkinSync({ skin }: { skin: Skin | null }) {
  const { m } = useI18n();
  const [ask, setAsk] = useState(false);
  const [picked, setPicked] = useState(false);
  // closed without choosing: stay on the original look, and don't ask again
  const close = () => { setAsk(false); if (!picked) void setSkin('light'); };
  useEffect(() => {
    if (skin && document.documentElement.dataset.skin !== skin) applySkin(skin);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shown once, after the first paint
    if (!skin) setAsk(true);
  }, [skin]);
  if (!ask) return null;
  return (
    <Sheet open onClose={close} title={m.skin.askTitle}>
      <p className="text-paper-dim mb-5">{m.skin.askBody}</p>
      <SkinPicker value={null} onPicked={() => setPicked(true)} />
      <Button size="lg" full className="mt-6" onClick={close}>{m.common.continue}</Button>
    </Sheet>
  );
}

/**
 * Compact light/dark switch for the admin and DJ desks. Keeps this device on the account's skin (a new browser)
 * and never asks: staff keep the light look until they switch.
 */
export function SkinToggle({ skin }: { skin: Skin | null }) {
  const { m } = useI18n();
  const router = useRouter();
  const [current, setCurrent] = useState<Skin>(skin ?? 'light');
  const [pending, start] = useTransition();
  useEffect(() => {
    if (skin && document.documentElement.dataset.skin !== skin) applySkin(skin);
  }, [skin]);
  const choose = (s: Skin) => {
    if (s === current) return;
    setCurrent(s);
    applySkin(s);
    start(async () => { await setSkin(s); router.refresh(); });
  };
  return (
    <div role="group" aria-label={m.skin.title} className={cx('inline-flex rounded-full border border-line p-1 gap-1', pending && 'opacity-60')}>
      {(['light', 'dark'] as const).map((s) => (
        <button key={s} type="button" onClick={() => choose(s)} aria-pressed={current === s}
          className={cx('h-8 px-3 rounded-full text-xs font-bold transition-colors', current === s ? 'bg-paper text-ink' : 'text-paper-dim hover:text-paper')}>
          {m.skin[s]}
        </button>
      ))}
    </div>
  );
}
