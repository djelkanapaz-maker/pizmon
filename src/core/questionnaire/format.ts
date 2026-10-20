import { lt, type Locale } from '../i18n-text';
import type { AnswerValue, Question } from './types';

/** Human-readable rendering of a stored answer (DJ answers tab, exports). */
export function formatAnswer(q: Question, v: AnswerValue | undefined, locale: Locale, genreName: (id: string) => string): string {
  if (v === undefined || v === null || (Array.isArray(v) && v.length === 0) || v === '') return '—';
  switch (q.type) {
    case 'event_details': return '';
    case 'text': return String(v);
    case 'single': return lt(q.options.find((o) => o.value === v)?.label, locale) || String(v);
    case 'multi':
    case 'visual': return (v as string[]).map((x) => lt(q.options.find((o) => o.value === x)?.label, locale) || x).join(', ');
    case 'genres': return (v as string[]).map(genreName).join(', ');
    case 'tags': return (v as string[]).join(', ');
    case 'scale': return `${v} / ${q.max}`;
    case 'percent': return `${v}%`;
    case 'energy_curve': return q.phases.map((p) => `${lt(p.label, locale)}: ${(v as Record<string, number>)[p.value] ?? '—'}`).join(' · ');
    case 'pairwise': return q.pairs.filter((p) => (v as Record<string, string>)[p.id]).map((p) => lt((v as Record<string, 'a' | 'b'>)[p.id] === 'a' ? p.a.label : p.b.label, locale)).join(' · ');
  }
}
