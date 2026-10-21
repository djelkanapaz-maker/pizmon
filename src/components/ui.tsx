import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { coverFor, initials } from '@/core/artwork';
import { IconChevron } from './icons';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
const variants: Record<Variant, string> = {
  primary: 'bg-ember text-ink shadow-[var(--shadow-hard-paper)] hover:bg-[#ffdc33] active:translate-y-px',
  secondary: 'bg-transparent text-paper border-2 border-paper hover:bg-paper hover:text-ink',
  ghost: 'bg-transparent text-paper hover:bg-ink-3',
  danger: 'bg-transparent text-danger border-2 border-danger hover:bg-danger hover:text-ink',
  gold: 'bg-gold text-ink hover:brightness-105',
};
const sizes = { sm: 'h-9 px-4 text-sm', md: 'h-11 px-5 text-[15px]', lg: 'h-14 px-7 text-base' };
const btn = (variant: Variant, size: keyof typeof sizes, full?: boolean) =>
  cx('inline-flex items-center justify-center gap-2 rounded-full font-bold transition-[background,color,transform] duration-150 select-none',
    'disabled:opacity-50 disabled:pointer-events-none', variants[variant], sizes[size], full && 'w-full');

export function Button({ variant = 'primary', size = 'md', full, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes; full?: boolean }) {
  return <button {...p} className={cx(btn(variant, size, full), className)} />;
}
export function ButtonLink({ variant = 'primary', size = 'md', full, className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes; full?: boolean }) {
  return <Link {...p} className={cx(btn(variant, size, full), className)} />;
}
/** Plain anchor styled as a button (file downloads, API routes). */
export function ButtonA({ variant = 'primary', size = 'md', full, className, ...p }: ComponentProps<'a'> & { variant?: Variant; size?: keyof typeof sizes; full?: boolean }) {
  return <a {...p} className={cx(btn(variant, size, full), className)} />;
}
export function IconButton({ label, className, active, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button {...p} aria-label={label} title={label}
      className={cx('inline-grid place-items-center size-11 rounded-full transition-colors', active ? 'bg-paper text-ink' : 'text-paper hover:bg-ink-3', 'disabled:opacity-40', className)} />
  );
}

export function Chip({ selected, className, tone = 'ember', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; tone?: 'ember' | 'danger' | 'gold' }) {
  const on = { ember: 'bg-ember text-ink border-ember', danger: 'bg-danger text-ink border-danger', gold: 'bg-gold text-ink border-gold' }[tone];
  return (
    <button type="button" aria-pressed={selected} {...p}
      className={cx('inline-flex items-center gap-1.5 h-9 px-4 rounded-full border text-sm font-medium whitespace-nowrap transition-colors',
        selected ? on : 'border-line text-paper hover:border-paper-dim', className)} />
  );
}

export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'ember' | 'gold' | 'danger' | 'ok'; children: ReactNode; className?: string }) {
  const t = { neutral: 'bg-ink-3 text-paper-dim', ember: 'bg-ember/15 text-ember', gold: 'bg-gold/15 text-gold', danger: 'bg-danger/15 text-danger', ok: 'bg-ok/15 text-ok' }[tone];
  return <span className={cx('inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-xs font-bold whitespace-nowrap', t, className)}>{children}</span>;
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-bold text-paper">{label}</label>
      {children}
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : hint ? <p className="text-sm text-paper-dim">{hint}</p> : null}
    </div>
  );
}
const inputCls = 'w-full h-12 px-4 rounded-[12px] bg-ink-3 border border-line text-paper placeholder:text-paper-dim/70 focus:border-ember focus:outline-none transition-colors aria-invalid:border-danger';
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, className)} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, 'h-auto min-h-28 py-3 leading-relaxed', className)} />;
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, 'appearance-none bg-no-repeat', className)} />;

export function Cover({ seed, label, src, size = 56, className, round }: { seed: string; label: string; src?: string | null; size?: number; className?: string; round?: boolean }) {
  const c = coverFor(seed);
  const radius = round ? '999px' : size >= 120 ? '16px' : '10px';
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className={cx('object-cover shrink-0', className)} style={{ width: size, height: size, borderRadius: radius }} />;
  }
  return (
    <div aria-hidden className={cx('relative shrink-0 overflow-hidden grid place-items-center', className)}
      style={{ width: size, height: size, borderRadius: radius, background: c.bg, color: c.fg }}>
      {c.variant === 1 && <div className="absolute inset-[18%] rounded-full border-[3px]" style={{ borderColor: c.fg, opacity: 0.25 }} />}
      {c.variant === 2 && <div className="absolute -inset-x-2 top-1/2 h-[18%]" style={{ background: c.fg, opacity: 0.18 }} />}
      {c.variant === 3 && <div className="absolute end-0 top-0 size-1/2" style={{ background: c.fg, opacity: 0.14 }} />}
      <span className="relative display" style={{ fontSize: Math.max(12, size * 0.34) }}>{initials(label)}</span>
    </div>
  );
}

export function Portrait({ name, src, size = 96, ring = true }: { name: string; src?: string | null; size?: number; ring?: boolean }) {
  return (
    <div className={cx('rounded-full shrink-0', ring && 'p-[3px] bg-paper')} style={{ width: size, height: size }}>
      <div className="rounded-full overflow-hidden size-full border-[3px] border-ink">
        <Cover seed={name} label={name} src={src} size={size - (ring ? 12 : 6)} round />
      </div>
    </div>
  );
}

export function SectionHeader({ title, href, action, kicker }: { title: string; href?: string; action?: string; kicker?: string }) {
  return (
    <div className="gutter flex items-end justify-between gap-4 mb-4">
      <div>
        {kicker && <p className="label mb-1">{kicker}</p>}
        <h2 className="display-m">{title}</h2>
      </div>
      {href && action && (
        <Link href={href} className="text-sm font-bold text-paper-dim hover:text-paper inline-flex items-center gap-1 shrink-0">
          {action}<IconChevron size={16} />
        </Link>
      )}
    </div>
  );
}

export function Progress({ value, tone = 'ember', label }: { value: number; tone?: 'ember' | 'gold'; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="h-2 rounded-full bg-ink-3 overflow-hidden">
      <div className={cx('h-full rounded-full transition-[width] duration-500', tone === 'gold' ? 'bg-gold' : 'bg-ember')} style={{ width: `${value}%` }} />
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card border-dashed px-6 py-10 text-center flex flex-col items-center gap-3">
      <div aria-hidden className="size-12 rounded-full border-2 border-line grid place-items-center text-paper-dim">♪</div>
      <p className="font-bold">{title}</p>
      {body && <p className="text-sm text-paper-dim max-w-sm">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-[12px] border border-danger/50 bg-danger/10 text-danger px-4 py-3 text-sm">{children}</p>;
}

export function PageHeader({ title, sub, back, actions, kicker }: { title: string; sub?: string; back?: { href: string; label: string }; actions?: ReactNode; kicker?: string }) {
  return (
    <header className="gutter pt-6 pb-6">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 text-sm font-bold text-paper-dim hover:text-paper mb-4 -ms-1">
          <IconChevron size={16} className="rotate-180" />{back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {kicker && <p className="label mb-2">{kicker}</p>}
          <h1 className="display-l break-words">{title}</h1>
          {sub && <p className="mt-3 text-paper-dim max-w-prose">{sub}</p>}
        </div>
        {actions && <div className="shrink-0 flex gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function DemoBadge({ label }: { label: string }) {
  return <Badge tone="neutral" className="border border-dashed border-paper-dim/40">{label}</Badge>;
}
