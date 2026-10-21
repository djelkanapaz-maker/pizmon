import type { QuestionnaireDefinition, Question } from './types';
import { definitionV1 } from './definition-v1';

/** v2: no limit on genre picks; reworded "rather avoid" help; free-text field for
 *  specific artists/songs the couple likes less. Derived from v1 so the rest stays identical. */
const dislikedSpecific: Question = {
  id: 'disliked_specific', type: 'text', multiline: true, maxLength: 2000,
  label: { he: 'אמנים או שירים ספציפיים שאתם פחות אוהבים', en: 'Specific artists or songs you like less' },
};

export const definitionV2: QuestionnaireDefinition = {
  ...definitionV1,
  sections: definitionV1.sections.map((s) => s.id !== 'personality' ? s : {
    ...s,
    questions: s.questions.flatMap((q): Question[] => {
      if (q.id === 'favorite_genres' && q.type === 'genres') return [{ id: q.id, type: 'genres', label: q.label }];
      if (q.id === 'disliked_genres' && q.type === 'genres') return [{
        id: q.id, type: 'genres', label: q.label,
        help: { he: 'זה המקום להיות ספציפיים מאוד לגבי שירים/סגנונות שלא הייתם רוצים לשמוע בחתונה שלכם', en: 'This is the place to be very specific about songs/styles you would not want to hear at your wedding' },
      }, dislikedSpecific];
      return [q];
    }),
  }),
};
