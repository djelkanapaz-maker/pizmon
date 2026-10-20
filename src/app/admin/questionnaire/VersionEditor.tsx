'use client';
import { useMemo, useState } from 'react';
import { Button, ErrorNote, Textarea } from '@/components/ui';
import { IconPlus } from '@/components/icons';
import { adminCreateQuestionnaireDraft, adminDeleteQuestionnaireDraft, adminPublishQuestionnaireVersion, adminUpdateQuestionnaireDraft } from '@/server/actions/admin-cms';
import { ConfirmButton, useCms, useErrText, useRun } from '../_cms/client';

export function NewVersionButton() {
  const { m } = useCms();
  const { busy, run } = useRun();
  return <Button size="sm" disabled={busy} onClick={() => run(() => adminCreateQuestionnaireDraft())}><IconPlus size={16} />{busy ? m.common.saving : m.admin.newVersion}</Button>;
}

/** Minimal client-side check mirroring the server: schema 1 + sections with id/kind/letter/title/intro/questions. */
function check(text: string): string | null {
  let v: unknown;
  try { v = JSON.parse(text); } catch (e) { return e instanceof Error ? e.message : 'JSON'; }
  const d = v as { schema?: unknown; sections?: unknown };
  if (!d || typeof d !== 'object' || d.schema !== 1) return 'schema must be 1';
  if (!Array.isArray(d.sections) || !d.sections.length) return 'sections must be a non-empty array';
  for (const [i, s] of (d.sections as Record<string, unknown>[]).entries()) {
    for (const k of ['id', 'kind', 'letter', 'title', 'intro', 'questions']) if (!s || !(k in s)) return `sections.${i}.${k} is missing`;
    if (!Array.isArray(s.questions)) return `sections.${i}.questions must be an array`;
  }
  return null;
}

export function DraftEditor({ versionId, initial }: { versionId: string; initial: string }) {
  const { m, s } = useCms();
  const err = useErrText();
  const { busy, run } = useRun();
  const [text, setText] = useState(initial);
  const [serverError, setServerError] = useState<string | null>(null);
  const local = useMemo(() => check(text), [text]);
  const dirty = text !== initial;
  const onFail = (r: { ok: boolean; error?: string; fields?: Record<string, string> }) => {
    if (!r.ok) setServerError([err(r.error ?? 'unknown'), r.fields?.definition].filter(Boolean).join(' — '));
  };
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`def-${versionId}`} className="text-sm font-bold">{m.admin.definition}</label>
      <Textarea id={`def-${versionId}`} value={text} onChange={(e) => { setText(e.target.value); setServerError(null); }} dir="ltr" spellCheck={false}
        aria-invalid={!!local} className="font-mono text-xs min-h-[50dvh] whitespace-pre" />
      {local ? <ErrorNote>{m.admin.jsonInvalid} {local}</ErrorNote> : <p className="text-sm text-ok">{s.valid}</p>}
      {serverError && <ErrorNote>{serverError}</ErrorNote>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || !!local || !dirty} onClick={() => { setServerError(null); run(() => adminUpdateQuestionnaireDraft(versionId, text), { silentError: true, onFail }); }}>
          {busy ? m.common.saving : m.common.save}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy || !dirty} onClick={() => setText(JSON.stringify(JSON.parse(text), null, 2))} hidden={!!local}>{'{ }'}</Button>
        <ConfirmButton size="sm" variant="gold" label={m.admin.publishVersion} confirmLabel={s.publishConfirm} disabled={busy || !!local || dirty}
          onConfirm={() => { setServerError(null); run(() => adminPublishQuestionnaireVersion(versionId), { silentError: true, onFail, success: m.common.published }); }} />
        <ConfirmButton size="sm" label={s.deleteDraft} confirmLabel={s.deleteConfirm} disabled={busy}
          onConfirm={() => run(() => adminDeleteQuestionnaireDraft(versionId))} />
      </div>
    </div>
  );
}
