// Uniform server-action results. Errors carry a stable code that the UI translates
// (src/i18n errors.*). Database messages are never shown raw to users.
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

const KNOWN = ['not_your_event', 'dj_not_eligible', 'assignment_locked', 'selection_not_allowed', 'violates_never_play',
  'restriction_conflict', 'admin_only', 'role_conflict', 'no_published_questionnaire', 'published_version_immutable', 'forbidden', 'not_found'] as const;
export type ErrorCode = (typeof KNOWN)[number] | 'validation' | 'network' | 'unknown';

export function errorCode(e: { message?: string; code?: string } | null | undefined): ErrorCode {
  const msg = e?.message ?? '';
  const k = KNOWN.find((c) => msg.includes(c));
  if (k) return k;
  if (e?.code === '42501') return 'forbidden';
  if (e?.code === '23505') return 'restriction_conflict';
  return 'unknown';
}

export const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: ErrorCode | string, fields?: Record<string, string>): ActionResult<never> => ({ ok: false, error, fields });
