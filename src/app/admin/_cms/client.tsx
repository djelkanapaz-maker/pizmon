'use client';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { useToast } from '@/components/overlay';
import { Button } from '@/components/ui';
import type { ActionResult } from '@/server/result';
import { cmsStrings } from './strings';

/** Translate an action error code (shared i18n first, then CMS-local strings). */
export function useErrText() {
  const { m, locale } = useI18n();
  const s = cmsStrings(locale);
  return useCallback((code: string) => (m.errors as Record<string, string>)[code] ?? (s.errors as Record<string, string>)[code] ?? m.common.error, [m, s]);
}

export function useCms() {
  const { m, locale } = useI18n();
  return { m, locale, s: cmsStrings(locale) };
}

/** Field-level messages from an ActionResult (rights / url / server-reported validation details). */
export function fieldErrors(r: ActionResult<unknown>, s: ReturnType<typeof cmsStrings>): Record<string, string> {
  if (r.ok || !r.fields) return {};
  return Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [k, v === 'rights' ? s.errors.rights : v === 'url' ? s.errors.url : s.errors.invalid]));
}

/**
 * Runs a server action in a transition. On failure: error toast, returns the result (never shows success).
 * On success: optional success toast + router.refresh().
 */
export function useRun() {
  const router = useRouter();
  const toast = useToast();
  const err = useErrText();
  const { m } = useI18n();
  const [busy, start] = useTransition();
  const run = useCallback(<T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string | false; onOk?: (data: T) => void; onFail?: (r: ActionResult<T>) => void; silentError?: boolean } = {}) => {
    start(async () => {
      let r: ActionResult<T>;
      try { r = await fn(); } catch { r = { ok: false, error: 'network' }; }
      if (!r.ok) {
        if (!opts.silentError) toast(err(r.error), 'error');
        opts.onFail?.(r);
        return;
      }
      if (opts.success !== false) toast(opts.success ?? m.common.saved);
      opts.onOk?.(r.data);
      router.refresh();
    });
  }, [router, toast, err, m]);
  return { busy, run };
}

/** Two-tap destructive button: the first tap arms it for a few seconds. */
export function ConfirmButton({ label, confirmLabel, onConfirm, disabled, size = 'sm', variant = 'danger' }: {
  label: string; confirmLabel: string; onConfirm: () => void; disabled?: boolean; size?: 'sm' | 'md'; variant?: 'danger' | 'primary' | 'gold';
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button type="button" size={size} variant={armed ? 'danger' : variant} disabled={disabled} aria-live="polite"
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? confirmLabel : label}
    </Button>
  );
}

/** ISO → value for <input type="datetime-local"> in the browser's zone. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** datetime-local value (browser zone) → ISO, or '' when empty/invalid. */
export function fromLocalInput(v: string) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

export const formObject = (form: HTMLFormElement) => Object.fromEntries(new FormData(form)) as Record<string, string>;
