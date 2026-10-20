import type { LText } from '../i18n-text';

export type Option = { value: string; label: LText; hint?: LText };

export type Question =
  | { id: string; type: 'event_details'; label: LText }
  | { id: string; type: 'text'; label: LText; help?: LText; multiline?: boolean; maxLength?: number }
  | { id: string; type: 'tags'; label: LText; help?: LText; max?: number; placeholder?: LText }
  | { id: string; type: 'single'; label: LText; help?: LText; options: Option[] }
  | { id: string; type: 'multi'; label: LText; help?: LText; options: Option[]; max?: number }
  | { id: string; type: 'visual'; label: LText; help?: LText; options: Option[]; max?: number }
  | { id: string; type: 'genres'; label: LText; help?: LText; max?: number }
  | { id: string; type: 'scale'; label: LText; help?: LText; min: number; max: number; minLabel: LText; maxLabel: LText }
  | { id: string; type: 'percent'; label: LText; help?: LText; step: number }
  | { id: string; type: 'energy_curve'; label: LText; help?: LText; phases: Option[] }
  | { id: string; type: 'pairwise'; label: LText; help?: LText; pairs: { id: string; a: Option; b: Option }[] };

export type SectionKind = 'questions' | 'restrictions' | 'moments' | 'brief';

export type Section = {
  id: string;
  kind: SectionKind;
  letter: string;
  title: LText;
  intro: LText;
  questions: Question[];
};

export type QuestionnaireDefinition = {
  schema: 1;
  sections: Section[];
};

/** Answer values keyed by question id. */
export type AnswerValue =
  | string
  | string[]
  | number
  | Record<string, number>   // energy_curve: phase → 1..5
  | Record<string, 'a' | 'b'> // pairwise: pair → choice
  | null;

export type Answers = Record<string, AnswerValue>;
