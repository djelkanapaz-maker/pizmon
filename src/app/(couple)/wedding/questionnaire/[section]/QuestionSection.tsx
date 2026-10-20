'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { lt } from '@/core/i18n-text';
import type { AnswerValue, Answers, Question, Section } from '@/core/questionnaire/types';
import { isAnswered } from '@/core/questionnaire/answers';
import { saveAnswers } from '@/server/actions/couple';
import { Chip, Input, Textarea, cx } from '@/components/ui';
import { EventDetailsForm } from '@/components/EventDetailsForm';
import { IconCheck, IconX } from '@/components/icons';
import { coverFor } from '@/core/artwork';
import type { WeddingEvent } from '@/server/queries';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function QuestionSection({ section, answers: initial, event, genres }: { section: Section; answers: Answers; event: WeddingEvent; genres: { id: string; label: string }[] }) {
  const { m } = useI18n();
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(initial);
  const [state, setState] = useState<SaveState>('idle');
  const queue = useRef<Answers>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const batch = queue.current; queue.current = {};
    if (!Object.keys(batch).length) return;
    setState('saving');
    const r = await saveAnswers(batch).catch(() => ({ ok: false as const, error: 'network' }));
    if (r.ok) { setState('saved'); router.refresh(); }
    else { queue.current = { ...batch, ...queue.current }; setState('error'); }
  }, [router]);

  const set = (id: string, v: AnswerValue, delay = 500) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    queue.current[id] = v;
    setState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
  };
  // flush pending changes when leaving the page
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); void flush(); } }, [flush]);

  return (
    <div className="flex flex-col gap-10">
      <p aria-live="polite" className={cx('gutter text-sm font-bold -mt-4 h-5', state === 'error' ? 'text-danger' : 'text-paper-dim')}>
        {state === 'saving' ? m.questionnaire.saving : state === 'saved' ? <span className="inline-flex items-center gap-1"><IconCheck size={14} />{m.questionnaire.autosaved}</span>
          : state === 'error' ? <button type="button" onClick={flush} className="underline">{m.questionnaire.saveFailed} {m.common.retry}</button> : ''}
      </p>
      {section.questions.map((q) => (
        <QuestionBlock key={q.id} q={q} value={answers[q.id]} onChange={(v, d) => set(q.id, v, d)} event={event} genres={genres} />
      ))}
    </div>
  );
}

function QuestionBlock({ q, value, onChange, event, genres }: { q: Question; value: AnswerValue | undefined; onChange: (v: AnswerValue, delay?: number) => void; event: WeddingEvent; genres: { id: string; label: string }[] }) {
  const { m, locale, fmt } = useI18n();
  const done = isAnswered(q, value, event);
  const help = 'help' in q && q.help ? lt(q.help, locale) : null;
  const max = 'max' in q ? q.max : undefined;
  const arr = Array.isArray(value) ? (value as string[]) : [];
  const toggle = (v: string) => onChange(arr.includes(v) ? arr.filter((x) => x !== v) : max && arr.length >= max ? arr : [...arr, v], 250);

  return (
    <fieldset className="gutter">
      <legend className="w-full mb-4">
        <span className="flex items-start gap-3">
          <span className={cx('mt-1 size-5 rounded-full shrink-0 grid place-items-center', done ? 'bg-gold text-ink' : 'border border-line')}>{done && <IconCheck size={12} />}</span>
          <span>
            <span className="block display text-xl md:text-2xl normal-case leading-tight">{lt(q.label, locale)}</span>
            {help && <span className="block text-sm text-paper-dim mt-1.5 font-sans normal-case">{help}</span>}
            {max && q.type !== 'tags' && <span className="block text-xs text-paper-dim mt-1">{fmt(m.questionnaire.pickUpTo, { max })}</span>}
          </span>
        </span>
      </legend>

      {q.type === 'event_details' && <div className="card p-4"><EventDetailsForm event={event} /></div>}

      {q.type === 'text' && (q.multiline
        ? <Textarea defaultValue={(value as string) ?? ''} maxLength={q.maxLength} onChange={(e) => onChange(e.target.value, 900)} dir="auto" />
        : <Input defaultValue={(value as string) ?? ''} maxLength={q.maxLength} onChange={(e) => onChange(e.target.value, 900)} dir="auto" />)}

      {(q.type === 'multi' || q.type === 'single') && (
        <div className="flex flex-wrap gap-2">
          {q.options.map((o) => {
            const sel = q.type === 'single' ? value === o.value : arr.includes(o.value);
            return <Chip key={o.value} selected={sel} onClick={() => (q.type === 'single' ? onChange(o.value, 200) : toggle(o.value))}>{lt(o.label, locale)}</Chip>;
          })}
        </div>
      )}

      {q.type === 'genres' && (
        <div className="flex flex-wrap gap-2">{genres.map((g) => <Chip key={g.id} selected={arr.includes(g.id)} onClick={() => toggle(g.id)}>{g.label}</Chip>)}</div>
      )}

      {q.type === 'visual' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {q.options.map((o) => {
            const sel = arr.includes(o.value);
            const c = coverFor(`vibe:${o.value}`);
            return (
              <button key={o.value} type="button" aria-pressed={sel} onClick={() => toggle(o.value)}
                className={cx('relative aspect-[4/5] rounded-[16px] p-3 flex flex-col justify-end text-start overflow-hidden border-2 transition-transform', sel ? 'border-paper -translate-y-0.5 shadow-[var(--shadow-hard)]' : 'border-transparent hover:-translate-y-0.5')}
                style={{ background: c.bg, color: c.fg }}>
                <span aria-hidden className="absolute -top-6 -end-6 size-24 rounded-full border-[6px] opacity-25" style={{ borderColor: c.fg }} />
                {sel && <span className="absolute top-3 start-3 size-7 rounded-full bg-paper text-ink grid place-items-center"><IconCheck size={14} /></span>}
                <span className="display text-lg leading-[1]">{lt(o.label, locale)}</span>
              </button>
            );
          })}
        </div>
      )}

      {q.type === 'tags' && <TagInput value={arr} max={q.max ?? 20} placeholder={q.placeholder ? lt(q.placeholder, locale) : ''} onChange={(v) => onChange(v, 300)} />}

      {q.type === 'scale' && (
        <div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${q.max - q.min + 1}, minmax(0,1fr))` }}>
            {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map((n) => (
              <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(n, 200)}
                className={cx('h-12 rounded-[12px] font-bold tabular border transition-colors', value === n ? 'bg-ember text-ink border-ember' : 'border-line hover:border-paper-dim')}>{n}</button>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-paper-dim gap-4"><span>{lt(q.minLabel, locale)}</span><span className="text-end">{lt(q.maxLabel, locale)}</span></div>
        </div>
      )}

      {q.type === 'percent' && (
        <div>
          <p className="display text-3xl tabular mb-3">{typeof value === 'number' ? fmt(m.questionnaire.percentLabel, { value }) : '—'}</p>
          <input type="range" min={0} max={100} step={q.step} defaultValue={typeof value === 'number' ? value : 50}
            onChange={(e) => onChange(Number(e.target.value), 500)} className="w-full accent-ember h-2" aria-label={lt(q.label, locale)} />
        </div>
      )}

      {q.type === 'energy_curve' && <EnergyCurve phases={q.phases.map((p) => ({ id: p.value, label: lt(p.label, locale) }))} value={(value as Record<string, number>) ?? {}} onChange={(v) => onChange(v, 300)} />}

      {q.type === 'pairwise' && (
        <div className="flex flex-col gap-3">
          {q.pairs.map((p) => {
            const picks = (value as Record<string, 'a' | 'b'>) ?? {};
            return (
              <div key={p.id} className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
                {(['a', 'b'] as const).map((side, i) => (
                  <button key={side} type="button" aria-pressed={picks[p.id] === side} onClick={() => onChange({ ...picks, [p.id]: side }, 200)}
                    className={cx('min-h-16 rounded-[14px] px-3 py-3 font-bold text-sm border-2 transition-colors', i === 1 && 'order-3',
                      picks[p.id] === side ? 'bg-paper text-ink border-paper' : 'border-line hover:border-paper-dim')}>
                    {lt(p[side].label, locale)}
                  </button>
                ))}
                <span className="order-2 self-center display text-paper-dim text-sm" aria-hidden>/</span>
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function TagInput({ value, max, placeholder, onChange }: { value: string[]; max: number; placeholder: string; onChange: (v: string[]) => void }) {
  const { m } = useI18n();
  const [text, setText] = useState('');
  const add = () => { const t = text.trim(); if (t && !value.includes(t) && value.length < max) onChange([...value, t]); setText(''); };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder={placeholder} maxLength={80} dir="auto" />
        <button type="button" onClick={add} className="h-12 px-5 rounded-full border-2 border-paper font-bold shrink-0">{m.questionnaire.addTag}</button>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 h-9 ps-4 pe-1 rounded-full bg-ink-3 text-sm font-bold" dir="auto">
              {v}<button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`${m.common.remove}: ${v}`} className="size-7 grid place-items-center rounded-full hover:bg-line"><IconX size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EnergyCurve({ phases, value, onChange }: { phases: { id: string; label: string }[]; value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  const { m } = useI18n();
  return (
    <div className="card p-4">
      {/* the couple's own curve, drawn from their answers */}
      <div className="flex items-end gap-2 h-28 mb-4" aria-hidden>
        {phases.map((p) => (
          <div key={p.id} className="flex-1 flex flex-col justify-end h-full">
            <div className={cx('rounded-t-[8px] transition-[height] duration-300', value[p.id] ? 'bg-ember' : 'bg-ink-3')} style={{ height: `${((value[p.id] ?? 0) / 5) * 100}%`, minHeight: 4 }} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {phases.map((p) => (
          <div key={p.id} className="flex items-center gap-3" role="radiogroup" aria-label={p.label}>
            <span className="w-32 sm:w-40 text-sm font-bold shrink-0">{p.label}</span>
            <div className="flex-1 grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={value[p.id] === n} aria-label={`${p.label}: ${m.discover.energyLevels[n]}`}
                  onClick={() => onChange({ ...value, [p.id]: n })}
                  className={cx('h-10 rounded-[10px] text-sm font-bold tabular border', value[p.id] === n ? 'bg-ember text-ink border-ember' : value[p.id] && n < value[p.id] ? 'bg-ember/20 border-transparent' : 'border-line')}>{n}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
