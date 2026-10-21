import { describe, expect, it } from 'vitest';
import { applyRestrictions, isHardBlocked, restrictionFor, type Restriction } from './restrictions';
import { canConfirm, deriveStatus, EMPTY_SELECTION } from './moments';
import { nextAction, planningTasks, progressPercent, daysUntil, type ProgressFacts } from './progress';
import { isAnswered, sanitizeAnswers, sectionStatus } from './questionnaire/answers';
import { definitionV1 } from './questionnaire/definition-v1';
import { buildBrief } from './brief';
import { formatAnswer } from './questionnaire/format';

const r = (p: Partial<Restriction>): Restriction => ({ id: Math.random().toString(), kind: 'never_play', strength: 'absolute', target_type: 'track', track_id: null, artist_id: null, genre_id: null, text_value: null, ...p });
const track = { id: 't1', artist_id: 'a1', genre_id: 'g1' };

describe('restrictions', () => {
  it('absolute never-play wins over must-play preference', () => {
    const list = [r({ kind: 'must_play', strength: 'preference', target_type: 'track', track_id: 't1' }), r({ target_type: 'artist', artist_id: 'a1' })];
    expect(restrictionFor(track, list)?.kind).toBe('never_play');
    expect(isHardBlocked(track, list)).toBe(true);
  });
  it('genre bans block tracks of that genre; preference only flags', () => {
    expect(isHardBlocked(track, [r({ target_type: 'genre', genre_id: 'g1' })])).toBe(true);
    const out = applyRestrictions([track, { id: 't2', artist_id: 'a2', genre_id: 'g2' }], [r({ strength: 'preference', target_type: 'artist', artist_id: 'a1' })]);
    expect(out).toHaveLength(2);
    expect(out[0].restriction?.strength).toBe('preference');
  });
  it('generated suggestion lists never contain absolute bans', () => {
    const out = applyRestrictions([track], [r({ target_type: 'track', track_id: 't1' })]);
    expect(out).toHaveLength(0);
  });
  it('free-text restrictions do not match tracks', () => {
    expect(restrictionFor(track, [r({ target_type: 'text', text_value: 'no line dances' })])).toBeNull();
  });
});

describe('moment selection states', () => {
  it('liking is not selecting: shortlist ≠ awaiting confirmation', () => {
    expect(deriveStatus(EMPTY_SELECTION, { ...EMPTY_SELECTION, shortlist: ['x'] })).toBe('shortlisted');
    expect(deriveStatus(EMPTY_SELECTION, { ...EMPTY_SELECTION, primary_track_id: 'x' })).toBe('awaiting_confirmation');
  });
  it('never becomes confirmed implicitly; changing a confirmed song needs reconfirmation', () => {
    const confirmed = { ...EMPTY_SELECTION, status: 'confirmed' as const, primary_track_id: 'x' };
    expect(deriveStatus(confirmed, { ...confirmed, primary_track_id: 'y' })).toBe('change_requested');
    expect(deriveStatus(confirmed, { ...confirmed, shortlist: ['z'] })).toBe('confirmed');
    expect(canConfirm(confirmed)).toBe(false);
    expect(canConfirm({ ...EMPTY_SELECTION, custom_song: 'Our song' })).toBe(true);
    expect(canConfirm(EMPTY_SELECTION)).toBe(false);
  });
});

const facts = (p: Partial<ProgressFacts> = {}): ProgressFacts => ({
  onboardingDone: true, djStatus: 'confirmed', questionnaireSectionsTotal: 4, questionnaireSectionsComplete: 4, questionnaireSubmitted: true,
  requiredMoments: 7, confirmedRequiredMoments: 7, restrictionsCount: 2, openClarifications: 0, pendingRecommendations: 0, ...p,
});

describe('progress', () => {
  it('percentage is derived only from completed tasks', () => {
    expect(progressPercent(planningTasks(facts()))).toBe(100);
    expect(progressPercent(planningTasks(facts({ questionnaireSubmitted: false, restrictionsCount: 0, confirmedRequiredMoments: 6 })))).toBe(50);
    expect(progressPercent(planningTasks(facts({ requiredMoments: 0, confirmedRequiredMoments: 0 })))).toBe(83);
  });
  it('next action follows priorities', () => {
    expect(nextAction(facts({ openClarifications: 1, onboardingDone: false })).kind).toBe('answer_clarification');
    expect(nextAction(facts({ djStatus: 'none' })).kind).toBe('choose_dj');
    expect(nextAction(facts({ djStatus: 'proposed' })).kind).toBe('confirm_dj');
    expect(nextAction(facts({ questionnaireSectionsComplete: 0 })).kind).toBe('start_questionnaire');
    expect(nextAction(facts({ confirmedRequiredMoments: 5 }))).toEqual({ kind: 'choose_moments', remaining: 2 });
    expect(nextAction(facts({ questionnaireSubmitted: false })).kind).toBe('submit_brief');
    expect(nextAction(facts()).kind).toBe('all_done');
  });
  it('counts days to the wedding', () => {
    expect(daysUntil('2026-10-25', new Date(2026, 9, 20))).toBe(5);
    expect(daysUntil(null)).toBeNull();
  });
});

describe('questionnaire', () => {
  const qs = definitionV1.sections.flatMap((s) => s.questions);
  it('template ids are unique and sections are lettered A–G', () => {
    expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
    expect(definitionV1.sections.map((s) => s.letter).join('')).toBe('ABCDEFG');
  });
  it('sanitizes answers to the template shape', () => {
    const clean = sanitizeAnswers(definitionV1, {
      vibe: ['party', 'house', 'groovy', 'elegant', 'bogus'], mainstream: 9, discovery: 3, israeli_share: 47,
      energy_curve: { reception: 2, peak: 7, nope: 3 }, pairs: { disco_vs_house: 'a', mizrahi_vs_intl: 'c' }, hacker: 'x',
      favorite_genres: ['g1', 'evil'], favorite_artists: ['  Dua Lipa ', 'Dua Lipa', ''],
    }, new Set(['g1']));
    expect(clean.vibe).toEqual(['party', 'house', 'groovy']);
    expect(clean).not.toHaveProperty('mainstream');
    expect(clean.discovery).toBe(3);
    expect(clean.israeli_share).toBe(50);
    expect(clean.energy_curve).toEqual({ reception: 2 });
    expect(clean.pairs).toEqual({ disco_vs_house: 'a' });
    expect(clean).not.toHaveProperty('hacker');
    expect(clean.favorite_genres).toEqual(['g1']);
    expect(clean.favorite_artists).toEqual(['Dua Lipa']);
  });
  it('section completion requires every question', () => {
    const energy = definitionV1.sections.find((s) => s.id === 'energy')!;
    const f = { restrictionsCount: 0, requiredMoments: 7, confirmedRequiredMoments: 0 };
    expect(sectionStatus(energy, {}, f).complete).toBe(false);
    const full = { vibe: ['party'], energy_curve: { reception: 1, after_ceremony: 2, first_set: 3, peak: 5, late_night: 4 }, israeli_share: 30, singalong: 4 };
    expect(sectionStatus(energy, full, f)).toEqual({ answered: 4, total: 4, complete: true });
    const curve = energy.questions.find((q) => q.id === 'energy_curve')!;
    expect(isAnswered(curve, { reception: 1 })).toBe(false);
  });
  it('builds a brief with unresolved decisions and readable answers', () => {
    const brief = buildBrief({
      definition: definitionV1, answers: { vibe: ['disco'], favorite_genres: ['g1'], singalong: 5 },
      restrictions: [r({ target_type: 'artist', artist_id: 'a1' }), r({ kind: 'must_play', strength: 'preference', target_type: 'text', text_value: 'Hava Nagila' })],
      genres: [{ id: 'g1', name_he: 'האוס', name_en: 'House' }],
      moments: [{ id: 'm1', slug: 'first-dance', name_he: 'ריקוד ראשון', name_en: 'First dance', is_required: true }],
      selections: [], describe: (x) => x.text_value ?? 'ABBA',
    }, 'en');
    expect(brief.vibes).toEqual(['Disco & funky']);
    expect(brief.favoriteGenres).toEqual(['House']);
    expect(brief.neverPlayAbsolute.map((x) => x.label)).toEqual(['ABBA']);
    expect(brief.mustPlay.map((x) => x.label)).toEqual(['Hava Nagila']);
    expect(brief.unresolved).toContain('First dance');
    const pairs = qs.find((q) => q.id === 'pairs')!;
    expect(formatAnswer(pairs, { disco_vs_house: 'b' }, 'en', (x) => x)).toBe('Contemporary house');
  });
});

describe('two-song moments (groom + bride)', () => {
  it('needs both songs before it can be confirmed', async () => {
    const { canConfirm, deriveStatus, songText, EMPTY_SELECTION: E } = await import('./moments');
    const one = { ...E, split: true, custom_song: 'Groom song' };
    expect(canConfirm({ ...one, status: deriveStatus(E, one) })).toBe(false);
    expect(deriveStatus(E, one)).toBe('shortlisted');
    const both = { ...one, second_custom_song: 'Bride song' };
    expect(deriveStatus(E, both)).toBe('awaiting_confirmation');
    expect(canConfirm({ ...both, status: 'awaiting_confirmation' })).toBe(true);
    expect(deriveStatus({ ...both, status: 'confirmed' }, { ...both, split: false })).toBe('change_requested');
    expect(songText({ ...both, status: 'confirmed' }, () => null, { first: 'Groom', second: 'Bride' })).toBe('Groom: Groom song · Bride: Bride song');
    expect(songText({ ...E, custom_song: 'Ours' }, () => null, { first: 'Groom', second: 'Bride' })).toBe('Ours');
  });
});
