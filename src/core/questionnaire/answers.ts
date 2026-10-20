import type { AnswerValue, Answers, Question, QuestionnaireDefinition, Section } from './types';

export type EventDetails = {
  partner_one_name: string | null;
  partner_two_name: string | null;
  wedding_date: string | null;
  venue_name: string | null;
  guest_count: number | null;
};

/** A question counts as answered only when it carries real information. */
export function isAnswered(q: Question, v: AnswerValue | undefined, event?: EventDetails): boolean {
  switch (q.type) {
    case 'event_details':
      return !!(event?.partner_one_name && event.wedding_date && event.venue_name);
    case 'text':
    case 'single':
      return typeof v === 'string' && v.trim().length > 0;
    case 'tags':
    case 'multi':
    case 'visual':
    case 'genres':
      return Array.isArray(v) && v.length > 0;
    case 'scale':
    case 'percent':
      return typeof v === 'number' && Number.isFinite(v);
    case 'energy_curve':
      return !!v && typeof v === 'object' && !Array.isArray(v) && q.phases.every((p) => typeof (v as Record<string, number>)[p.value] === 'number');
    case 'pairwise':
      return !!v && typeof v === 'object' && !Array.isArray(v) && q.pairs.every((p) => ['a', 'b'].includes((v as Record<string, string>)[p.id]));
  }
}

export type SectionFacts = {
  event?: EventDetails;
  restrictionsCount: number;
  requiredMoments: number;
  confirmedRequiredMoments: number;
};

export function sectionStatus(section: Section, answers: Answers, facts: SectionFacts) {
  if (section.kind === 'restrictions') {
    return { answered: facts.restrictionsCount > 0 ? 1 : 0, total: 1, complete: facts.restrictionsCount > 0 };
  }
  if (section.kind === 'moments') {
    return {
      answered: facts.confirmedRequiredMoments,
      total: facts.requiredMoments,
      complete: facts.requiredMoments > 0 && facts.confirmedRequiredMoments >= facts.requiredMoments,
    };
  }
  if (section.kind === 'brief') return { answered: 0, total: 0, complete: false };
  const total = section.questions.length;
  const answered = section.questions.filter((q) => isAnswered(q, answers[q.id], facts.event)).length;
  return { answered, total, complete: total > 0 && answered === total };
}

export function nextIncompleteSection(def: QuestionnaireDefinition, answers: Answers, facts: SectionFacts) {
  return def.sections.find((s) => s.kind !== 'brief' && !sectionStatus(s, answers, facts).complete) ?? null;
}

/** Strip anything not described by the template and coerce shapes; used before every save. */
export function sanitizeAnswers(def: QuestionnaireDefinition, input: Record<string, unknown>, allowedGenreIds?: Set<string>): Answers {
  const out: Answers = {};
  const questions = def.sections.flatMap((s) => s.questions);
  for (const q of questions) {
    if (!(q.id in input)) continue;
    const v = input[q.id];
    if (v === null) { out[q.id] = null; continue; }
    switch (q.type) {
      case 'event_details':
        break;
      case 'text': {
        if (typeof v === 'string') out[q.id] = v.slice(0, q.maxLength ?? 2000);
        break;
      }
      case 'single': {
        if (typeof v === 'string' && q.options.some((o) => o.value === v)) out[q.id] = v;
        break;
      }
      case 'multi':
      case 'visual': {
        if (Array.isArray(v)) {
          const valid = [...new Set(v.filter((x): x is string => typeof x === 'string' && q.options.some((o) => o.value === x)))];
          out[q.id] = q.max ? valid.slice(0, q.max) : valid;
        }
        break;
      }
      case 'genres': {
        if (Array.isArray(v)) {
          const valid = [...new Set(v.filter((x): x is string => typeof x === 'string' && (!allowedGenreIds || allowedGenreIds.has(x))))];
          out[q.id] = q.max ? valid.slice(0, q.max) : valid;
        }
        break;
      }
      case 'tags': {
        if (Array.isArray(v)) {
          const clean = [...new Set(v.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 80)).filter(Boolean))];
          out[q.id] = clean.slice(0, q.max ?? 20);
        }
        break;
      }
      case 'scale': {
        const n = Number(v);
        if (Number.isInteger(n) && n >= q.min && n <= q.max) out[q.id] = n;
        break;
      }
      case 'percent': {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0 && n <= 100) out[q.id] = Math.round(n / q.step) * q.step;
        break;
      }
      case 'energy_curve': {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const curve: Record<string, number> = {};
          for (const p of q.phases) {
            const n = Number((v as Record<string, unknown>)[p.value]);
            if (Number.isInteger(n) && n >= 1 && n <= 5) curve[p.value] = n;
          }
          out[q.id] = curve;
        }
        break;
      }
      case 'pairwise': {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const picks: Record<string, 'a' | 'b'> = {};
          for (const p of q.pairs) {
            const c = (v as Record<string, unknown>)[p.id];
            if (c === 'a' || c === 'b') picks[p.id] = c;
          }
          out[q.id] = picks;
        }
        break;
      }
    }
  }
  return out;
}
