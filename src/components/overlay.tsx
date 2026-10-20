'use client';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from './icons';
import { cx } from './ui';
import { useHydrated } from './useHydrated';

/** Bottom sheet on phones, centered dialog on wider screens. Escape / backdrop close, focus moves in and back. */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const mounted = useHydrated();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not([data-close])')?.focus() ?? ref.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input,select,textarea,[tabindex="0"]')];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 animate-fade" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={cx('relative w-full bg-ink-2 border border-line rounded-t-[22px] md:rounded-[22px] max-h-[88dvh] flex flex-col animate-sheet md:animate-rise',
          wide ? 'md:max-w-2xl' : 'md:max-w-lg')}>
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
          <h2 id={titleId} className="display text-xl">{title}</h2>
          <button data-close type="button" onClick={onClose} aria-label="×" className="size-10 grid place-items-center rounded-full hover:bg-ink-3"><IconX /></button>
        </div>
        <div className="overflow-y-auto px-5 py-5 pb-[calc(20px+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

type Toast = { id: number; text: string; tone: 'ok' | 'error' };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), tone === 'error' ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx value={push}>
      {children}
      <div aria-live="polite" className="fixed z-[60] inset-x-0 top-[max(12px,env(safe-area-inset-top))] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {items.map((t) => (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'}
            className={cx('pointer-events-auto max-w-md w-full rounded-[14px] px-4 py-3 text-sm font-bold border animate-rise',
              t.tone === 'error' ? 'bg-ink-2 border-danger text-danger' : 'bg-paper text-ink border-paper')}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx>
  );
}
