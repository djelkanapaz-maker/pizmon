import type { QuestionnaireDefinition } from './types';
import { definitionV2 } from './definition-v2';

/** v3: energy, references and must/never-play sections removed from the questionnaire flow
 *  (must/never play stays available on its own page). Letters re-assigned A–D. */
const DROP = new Set(['energy', 'references', 'restrictions']);
export const definitionV3: QuestionnaireDefinition = {
  ...definitionV2,
  sections: definitionV2.sections.filter((s) => !DROP.has(s.id)).map((s, i) => ({ ...s, letter: 'ABCDEFG'[i] })),
};
