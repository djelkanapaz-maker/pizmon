'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { submitQuestionnaire } from '@/server/actions/couple';
import { useToast } from '@/components/overlay';
import { Button } from '@/components/ui';

export function SubmitBrief({ submitted }: { submitted: boolean }) {
  const { m } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  return (
    <Button size="lg" variant={submitted ? 'secondary' : 'primary'} disabled={busy} onClick={() => start(async () => {
      const r = await submitQuestionnaire();
      if (!r.ok) return toast((m.errors as Record<string, string>)[r.error] ?? m.common.error, 'error');
      toast(m.common.saved); router.refresh();
    })}>{busy ? m.common.saving : submitted ? m.questionnaire.resubmit : m.questionnaire.submit}</Button>
  );
}
