import type { QuestionnaireDefinition } from './types';

/** Questionnaire template v1 — seeded into questionnaire_versions. Never edit a published
 *  version in place: copy it, bump the version, and publish the copy. */
export const definitionV1: QuestionnaireDefinition = {
  schema: 1,
  sections: [
    {
      id: 'identity', kind: 'questions', letter: 'A',
      title: { he: 'הזהות של החתונה', en: 'Wedding identity' },
      intro: { he: 'כמה פרטים שיעזרו לנו להבין את הקהל, המקום והמסורת.', en: 'A few details about your crowd, place and traditions.' },
      questions: [
        { id: 'event', type: 'event_details', label: { he: 'פרטי האירוע', en: 'Event details' } },
        {
          id: 'languages', type: 'multi', label: { he: 'באילו שפות המוזיקה צריכה לדבר?', en: 'Which languages should the music speak?' },
          options: [
            { value: 'he', label: { he: 'עברית', en: 'Hebrew' } },
            { value: 'en', label: { he: 'אנגלית', en: 'English' } },
            { value: 'ar', label: { he: 'ערבית / ים תיכוני', en: 'Arabic / Mediterranean' } },
            { value: 'fr', label: { he: 'צרפתית', en: 'French' } },
            { value: 'es', label: { he: 'ספרדית / לטינית', en: 'Spanish / Latin' } },
            { value: 'ru', label: { he: 'רוסית', en: 'Russian' } },
          ],
        },
        {
          id: 'traditions', type: 'multi', label: { he: 'מסורות מוזיקליות שחשוב לכלול', en: 'Musical traditions to include' },
          options: [
            { value: 'mizrahi', label: { he: 'מזרחית', en: 'Mizrahi' } },
            { value: 'moroccan', label: { he: 'מרוקאית', en: 'Moroccan' } },
            { value: 'yemenite', label: { he: 'תימנית', en: 'Yemenite' } },
            { value: 'persian', label: { he: 'פרסית', en: 'Persian' } },
            { value: 'ashkenazi', label: { he: 'אשכנזית / כליזמר', en: 'Ashkenazi / Klezmer' } },
            { value: 'hassidic', label: { he: 'חסידית', en: 'Hassidic' } },
            { value: 'ethiopian', label: { he: 'אתיופית', en: 'Ethiopian' } },
            { value: 'russian', label: { he: 'רוסית', en: 'Russian' } },
            { value: 'greek', label: { he: 'יוונית', en: 'Greek' } },
            { value: 'none', label: { he: 'בלי מסורת מיוחדת', en: 'No specific tradition' } },
          ],
        },
        {
          id: 'family_notes', type: 'text', multiline: true, maxLength: 1500,
          label: { he: 'שיקולים משפחתיים חשובים', en: 'Important family considerations' },
          help: { he: 'למשל: סבתא שחייבת לשמוע שיר מסוים, אורחים דתיים, רגישויות.', en: 'e.g. a grandparent’s song, religious guests, sensitivities.' },
        },
      ],
    },
    {
      id: 'personality', kind: 'questions', letter: 'B',
      title: { he: 'האישיות המוזיקלית שלכם', en: 'Your musical personality' },
      intro: { he: 'מה אתם באמת שומעים כשאף אחד לא מסתכל?', en: 'What do you actually listen to when no one is watching?' },
      questions: [
        { id: 'favorite_genres', type: 'genres', max: 6, label: { he: 'ז׳אנרים אהובים', en: 'Favourite genres' } },
        { id: 'disliked_genres', type: 'genres', max: 6, label: { he: 'ז׳אנרים שפחות מתאימים לכם', en: 'Genres you’d rather avoid' },
          help: { he: 'זו העדפה. לאיסור מוחלט השתמשו ב״לעולם לא״.', en: 'A preference. For an absolute ban use “Never play”.' } },
        { id: 'favorite_artists', type: 'tags', max: 15, label: { he: 'אמנים שאתם אוהבים', en: 'Artists you love' },
          placeholder: { he: 'הקלידו שם ולחצו Enter', en: 'Type a name and press Enter' } },
        {
          id: 'eras', type: 'multi', label: { he: 'אילו עשורים מרגישים הכי ״אתם״?', en: 'Which eras feel most like you?' },
          options: ['1960', '1970', '1980', '1990', '2000', '2010', '2020'].map((d) => ({ value: d, label: { he: `שנות ה־${d.slice(2)}`, en: `${d}s` } })),
        },
        { id: 'mainstream', type: 'scale', min: 1, max: 5, label: { he: 'מיינסטרים או אלטרנטיבי?', en: 'Mainstream or alternative?' },
          minLabel: { he: 'להיטים של כולם', en: 'Everybody’s hits' }, maxLabel: { he: 'מחוץ לקופסה', en: 'Off the beaten path' } },
        { id: 'discovery', type: 'scale', min: 1, max: 5, label: { he: 'שירים מוכרים או הפתעות?', en: 'Familiar songs or discoveries?' },
          minLabel: { he: 'רק מה שכולם מכירים', en: 'Only what everyone knows' }, maxLabel: { he: 'תפתיעו אותנו', en: 'Surprise us' } },
      ],
    },
    {
      id: 'energy', kind: 'questions', letter: 'C',
      title: { he: 'האנרגיה ברחבה', en: 'Dancefloor energy' },
      intro: { he: 'כל שלב בערב מרגיש אחרת. בואו נבנה את העקומה.', en: 'Every part of the night feels different. Let’s shape the curve.' },
      questions: [
        {
          id: 'vibe', type: 'visual', max: 3, label: { he: 'בחרו עד 3 אווירות', en: 'Pick up to 3 vibes' },
          options: [
            { value: 'elegant', label: { he: 'אלגנטי ומתוחכם', en: 'Elegant & sophisticated' } },
            { value: 'groovy', label: { he: 'חם וגרובי', en: 'Warm & groovy' } },
            { value: 'disco', label: { he: 'דיסקו ופאנק', en: 'Disco & funky' } },
            { value: 'party', label: { he: 'מסיבה באנרגיה גבוהה', en: 'High-energy party' } },
            { value: 'singalong', label: { he: 'שירה בציבור מסחרית', en: 'Commercial sing-alongs' } },
            { value: 'house', label: { he: 'האוס ואלקטרוני', en: 'House & electronic' } },
            { value: 'israeli', label: { he: 'קלאסיקות מסיבה ישראליות', en: 'Israeli party classics' } },
            { value: 'balanced', label: { he: 'שילוב מאוזן', en: 'A balanced mix' } },
          ],
        },
        {
          id: 'energy_curve', type: 'energy_curve',
          label: { he: 'כמה אנרגיה בכל שלב?', en: 'How much energy at each stage?' },
          help: { he: '1 = רגוע, 5 = שיא', en: '1 = laid-back, 5 = peak' },
          phases: [
            { value: 'reception', label: { he: 'קבלת פנים', en: 'Reception' } },
            { value: 'after_ceremony', label: { he: 'אחרי החופה', en: 'After the ceremony' } },
            { value: 'first_set', label: { he: 'סט ריקודים ראשון', en: 'First dance set' } },
            { value: 'peak', label: { he: 'שיא הערב', en: 'Peak of the night' } },
            { value: 'late_night', label: { he: 'סוף הלילה', en: 'Late night' } },
          ],
        },
        { id: 'israeli_share', type: 'percent', step: 10, label: { he: 'כמה מוזיקה ישראלית?', en: 'How much Israeli music?' } },
        { id: 'singalong', type: 'scale', min: 1, max: 5, label: { he: 'כמה חשובים רגעי שירה בציבור?', en: 'How important are sing-along moments?' },
          minLabel: { he: 'לא חשוב', en: 'Not important' }, maxLabel: { he: 'חובה', en: 'Essential' } },
      ],
    },
    {
      id: 'references', kind: 'questions', letter: 'D',
      title: { he: 'רפרנסים מוזיקליים', en: 'Musical references' },
      intro: { he: 'בחירות מהירות — אינטואיציה ולא מחשבה.', en: 'Quick choices — instinct, not deliberation.' },
      questions: [
        {
          id: 'pairs', type: 'pairwise', label: { he: 'מה מייצג יותר את החתונה שלכם?', en: 'Which represents your wedding better?' },
          pairs: [
            { id: 'disco_vs_house', a: { value: 'disco', label: { he: 'דיסקו קלאסי של שנות ה־70', en: '70s disco classics' } }, b: { value: 'house', label: { he: 'האוס עכשווי', en: 'Contemporary house' } } },
            { id: 'mizrahi_vs_intl', a: { value: 'mizrahi', label: { he: 'מזרחית ישראלית', en: 'Israeli Mizrahi' } }, b: { value: 'intl_pop', label: { he: 'פופ בינלאומי', en: 'International pop' } } },
            { id: 'throwback_vs_now', a: { value: 'throwback', label: { he: 'נוסטלגיה של שנות ה־90', en: '90s nostalgia' } }, b: { value: 'current', label: { he: 'הלהיטים של עכשיו', en: 'Today’s hits' } } },
            { id: 'rock_vs_rnb', a: { value: 'rock', label: { he: 'רוק לשירה בציבור', en: 'Sing-along rock' } }, b: { value: 'rnb', label: { he: 'R&B והיפ־הופ', en: 'R&B & hip-hop' } } },
            { id: 'live_vs_electronic', a: { value: 'organic', label: { he: 'צליל אורגני וחי', en: 'Organic, live sound' } }, b: { value: 'electronic', label: { he: 'צליל אלקטרוני מודרני', en: 'Modern electronic sound' } } },
          ],
        },
        { id: 'adventurous', type: 'scale', min: 1, max: 5, label: { he: 'כמה הדיג׳יי יכול להיות הרפתקן?', en: 'How adventurous can the DJ be?' },
          minLabel: { he: 'צמוד לבקשות', en: 'Stick to our list' }, maxLabel: { he: 'חופש מלא', en: 'Full freedom' } },
        { id: 'dj_notes', type: 'text', multiline: true, maxLength: 2000, label: { he: 'עוד משהו שהדיג׳יי צריך לדעת?', en: 'Anything else your DJ should know?' } },
      ],
    },
    {
      id: 'restrictions', kind: 'restrictions', letter: 'E',
      title: { he: 'חובה / לעולם לא', en: 'Must play / Never play' },
      intro: { he: 'מה חייב להתנגן — ומה אסור שיתנגן, בשום מצב.', en: 'What must be played — and what must never be played.' },
      questions: [],
    },
    {
      id: 'moments', kind: 'moments', letter: 'F',
      title: { he: 'הרגעים המיוחדים', en: 'Special moments' },
      intro: { he: 'כניסות, שבירת הכוס, ריקוד ראשון ועוד.', en: 'Entrances, breaking the glass, first dance and more.' },
      questions: [],
    },
    {
      id: 'brief', kind: 'brief', letter: 'G',
      title: { he: 'התקציר המוזיקלי', en: 'Your musical brief' },
      intro: { he: 'כך הדיג׳יי שלכם יראה את החתונה. בדקו ושלחו.', en: 'This is how your DJ will see your wedding. Review and send.' },
      questions: [],
    },
  ],
};
