/**
 * Planning progress is derived only from real, completed tasks — never estimated.
 * Each task is binary and the percentage is completed / total.
 */
export type ProgressFacts = {
  onboardingDone: boolean;
  djStatus: 'none' | 'proposed' | 'pending_approval' | 'confirmed';
  questionnaireSectionsTotal: number;      // question-type sections only
  questionnaireSectionsComplete: number;
  questionnaireSubmitted: boolean;
  requiredMoments: number;
  confirmedRequiredMoments: number;
  restrictionsCount: number;
  openClarifications: number;              // DJ asked something, couple hasn't answered
  pendingRecommendations: number;
};

export type TaskId = 'onboarding' | 'dj' | 'questionnaire' | 'moments' | 'restrictions' | 'submit';
export type Task = { id: TaskId; done: boolean; detail?: { done: number; total: number } };

export function planningTasks(f: ProgressFacts): Task[] {
  return [
    { id: 'onboarding', done: f.onboardingDone },
    { id: 'dj', done: f.djStatus === 'confirmed' },
    {
      id: 'questionnaire',
      done: f.questionnaireSectionsTotal > 0 && f.questionnaireSectionsComplete >= f.questionnaireSectionsTotal,
      detail: { done: f.questionnaireSectionsComplete, total: f.questionnaireSectionsTotal },
    },
    {
      id: 'moments',
      done: f.requiredMoments > 0 && f.confirmedRequiredMoments >= f.requiredMoments,
      detail: { done: f.confirmedRequiredMoments, total: f.requiredMoments },
    },
    { id: 'restrictions', done: f.restrictionsCount > 0 },
    { id: 'submit', done: f.questionnaireSubmitted },
  ];
}

export function progressPercent(tasks: Task[]) {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
}

export type NextAction =
  | { kind: 'answer_clarification' }
  | { kind: 'finish_onboarding' }
  | { kind: 'choose_dj' }
  | { kind: 'await_dj_approval' }
  | { kind: 'confirm_dj' }
  | { kind: 'review_recommendations'; count: number }
  | { kind: 'start_questionnaire' }
  | { kind: 'continue_questionnaire' }
  | { kind: 'choose_moments'; remaining: number }
  | { kind: 'add_restrictions' }
  | { kind: 'submit_brief' }
  | { kind: 'all_done' };

/** One clear next step for the home screen, in priority order. */
export function nextAction(f: ProgressFacts): NextAction {
  if (f.openClarifications > 0) return { kind: 'answer_clarification' };
  if (!f.onboardingDone) return { kind: 'finish_onboarding' };
  if (f.djStatus === 'none') return { kind: 'choose_dj' };
  if (f.djStatus === 'proposed') return { kind: 'confirm_dj' };
  if (f.pendingRecommendations > 0) return { kind: 'review_recommendations', count: f.pendingRecommendations };
  if (f.questionnaireSectionsComplete === 0) return { kind: 'start_questionnaire' };
  if (f.questionnaireSectionsComplete < f.questionnaireSectionsTotal) return { kind: 'continue_questionnaire' };
  if (f.confirmedRequiredMoments < f.requiredMoments) return { kind: 'choose_moments', remaining: f.requiredMoments - f.confirmedRequiredMoments };
  if (f.restrictionsCount === 0) return { kind: 'add_restrictions' };
  if (!f.questionnaireSubmitted) return { kind: 'submit_brief' };
  if (f.djStatus === 'pending_approval') return { kind: 'await_dj_approval' };
  return { kind: 'all_done' };
}

export function daysUntil(date: string | null, today = new Date()): number | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}
