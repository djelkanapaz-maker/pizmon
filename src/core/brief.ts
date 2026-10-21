import { lt, type Locale } from './i18n-text';
import type { Answers, QuestionnaireDefinition, Question } from './questionnaire/types';
import { splitRestrictions, type Restriction } from './restrictions';
import type { SelectionStatus } from './moments';

export type BriefInput = {
  definition: QuestionnaireDefinition;
  answers: Answers;
  restrictions: Restriction[];
  genres: { id: string; name_he: string; name_en: string }[];
  moments: { id: string; slug: string; name_he: string; name_en: string; is_required: boolean }[];
  selections: { moment_id: string; status: SelectionStatus; song: string | null; backup: string | null }[];
  describe: (r: Restriction) => string;      // human label for a restriction target
};

export type Brief = {
  vibes: string[];
  favoriteGenres: string[];
  dislikedGenres: string[];
  dislikedSpecific: string | null;
  favoriteArtists: string[];
  eras: string[];
  traditions: string[];
  languages: string[];
  energyCurve: { phase: string; value: number }[];
  israeliShare: number | null;
  singalong: number | null;
  adventurous: number | null;
  mainstream: number | null;
  discovery: number | null;
  pairs: { question: string; choice: string }[];
  mustPlay: { label: string; strength: string; reason?: string | null }[];
  neverPlayAbsolute: { label: string; reason?: string | null }[];
  neverPlayPreference: { label: string; reason?: string | null }[];
  moments: { name: string; status: SelectionStatus; song: string | null; backup: string | null; required: boolean }[];
  familyNotes: string | null;
  djNotes: string | null;
  unresolved: string[];
};

function q<T extends Question['type']>(def: QuestionnaireDefinition, id: string, type: T) {
  const found = def.sections.flatMap((s) => s.questions).find((x) => x.id === id);
  return found && found.type === type ? (found as Extract<Question, { type: T }>) : null;
}
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

export function buildBrief(input: BriefInput, locale: Locale): Brief {
  const { definition: def, answers } = input;
  const optLabels = (id: string, type: 'multi' | 'visual') => {
    const question = q(def, id, type);
    return arr(answers[id]).map((v) => lt(question?.options.find((o) => o.value === v)?.label, locale) || v);
  };
  const genreName = (id: string) => {
    const g = input.genres.find((x) => x.id === id);
    return g ? (locale === 'he' ? g.name_he : g.name_en) : id;
  };
  const curveQ = q(def, 'energy_curve', 'energy_curve');
  const curve = (answers.energy_curve ?? {}) as Record<string, number>;
  const pairsQ = q(def, 'pairs', 'pairwise');
  const picks = (answers.pairs ?? {}) as Record<string, 'a' | 'b'>;
  const r = splitRestrictions(input.restrictions);

  const moments = input.moments.map((m) => {
    const s = input.selections.find((x) => x.moment_id === m.id);
    return {
      name: locale === 'he' ? m.name_he : m.name_en,
      status: s?.status ?? ('not_started' as SelectionStatus),
      song: s?.song ?? null,
      backup: s?.backup ?? null,
      required: m.is_required,
    };
  });

  const unresolved: string[] = [];
  for (const m of moments) if (m.required && m.status !== 'confirmed') unresolved.push(m.name);
  for (const s of def.sections) {
    if (s.kind !== 'questions') continue;
    for (const question of s.questions) {
      if (question.type === 'event_details' || question.type === 'text' || question.type === 'tags') continue;
      const v = answers[question.id];
      const empty = v === undefined || v === null || (Array.isArray(v) && v.length === 0);
      if (empty) unresolved.push(lt(question.label, locale));
    }
  }

  return {
    vibes: optLabels('vibe', 'visual'),
    favoriteGenres: arr(answers.favorite_genres).map(genreName),
    dislikedGenres: arr(answers.disliked_genres).map(genreName),
    dislikedSpecific: typeof answers.disliked_specific === 'string' && answers.disliked_specific.trim() ? answers.disliked_specific : null,
    favoriteArtists: arr(answers.favorite_artists),
    eras: optLabels('eras', 'multi'),
    traditions: optLabels('traditions', 'multi'),
    languages: optLabels('languages', 'multi'),
    energyCurve: (curveQ?.phases ?? []).map((p) => ({ phase: lt(p.label, locale), value: curve[p.value] ?? 0 })),
    israeliShare: num(answers.israeli_share),
    singalong: num(answers.singalong),
    adventurous: num(answers.adventurous),
    mainstream: num(answers.mainstream),
    discovery: num(answers.discovery),
    pairs: (pairsQ?.pairs ?? []).filter((p) => picks[p.id]).map((p) => ({
      question: `${lt(p.a.label, locale)} / ${lt(p.b.label, locale)}`,
      choice: lt(picks[p.id] === 'a' ? p.a.label : p.b.label, locale),
    })),
    mustPlay: r.mustPlay.map((x) => ({ label: input.describe(x), strength: x.strength, reason: x.reason })),
    neverPlayAbsolute: r.neverAbsolute.map((x) => ({ label: input.describe(x), reason: x.reason })),
    neverPlayPreference: r.neverPreference.map((x) => ({ label: input.describe(x), reason: x.reason })),
    moments,
    familyNotes: typeof answers.family_notes === 'string' && answers.family_notes.trim() ? answers.family_notes : null,
    djNotes: typeof answers.dj_notes === 'string' && answers.dj_notes.trim() ? answers.dj_notes : null,
    unresolved,
  };
}
