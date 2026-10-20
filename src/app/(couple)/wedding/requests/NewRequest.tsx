'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { createRequest } from '@/server/actions/couple';
import { Sheet } from '@/components/overlay';
import { Button, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui';

const CATS = ['choose_song', 'israeli_balance', 'review_selections', 'change_confirmed', 'family_request', 'other'] as const;

export function NewRequestButton({ moments }: { moments: { id: string; label: string }[] }) {
  const { m } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<(typeof CATS)[number]>('choose_song');
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>{m.requests.new}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={m.requests.new}>
        <form className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget));
          start(async () => {
            const r = await createRequest({ ...f, category: cat });
            if (!r.ok) return setError(m.common.error);
            router.push(`/wedding/requests/${r.data.id}`);
          });
        }}>
          {error && <ErrorNote>{error}</ErrorNote>}
          <fieldset>
            <legend className="text-sm font-bold mb-2">{m.requests.category}</legend>
            <div className="grid gap-2">
              {CATS.map((c) => (
                <label key={c} className={`flex items-center gap-3 rounded-[12px] border p-3 cursor-pointer ${cat === c ? 'border-ember bg-ember/10' : 'border-line'}`}>
                  <input type="radio" name="cat" value={c} checked={cat === c} onChange={() => setCat(c)} className="accent-ember" />
                  <span className="font-bold text-sm">{m.requests.categories[c]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={m.requests.titleField} htmlFor="rq-t"><Input id="rq-t" name="title" required maxLength={160} defaultValue={m.requests.categories[cat]} key={cat} dir="auto" /></Field>
          <Field label={m.requests.description} htmlFor="rq-d"><Textarea id="rq-d" name="description" maxLength={4000} dir="auto" /></Field>
          <Field label={m.requests.moment} htmlFor="rq-m"><Select id="rq-m" name="moment_id" defaultValue=""><option value="">—</option>{moments.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select></Field>
          <Button type="submit" size="lg" disabled={busy}>{busy ? m.common.saving : m.requests.send}</Button>
        </form>
      </Sheet>
    </>
  );
}
