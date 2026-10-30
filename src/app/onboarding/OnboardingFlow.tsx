'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { isolate } from '@/i18n/format';
import { confirmAssignedDj, saveEventDetails, selectDj, setOnboardingStep } from '@/server/actions/couple';
import { Sheet, useToast } from '@/components/overlay';
import { Badge, Button, cx, DemoBadge, ErrorNote, Field, Input, Portrait, Textarea } from '@/components/ui';
import { PlayToggle } from '@/components/audio/MiniPlayer';
import { BrandMark, FlowLines } from '@/components/brand';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import { IconCheck, IconLock } from '@/components/icons';
import type { Assignment, Dj, WeddingEvent } from '@/server/queries';
import { DjBio, DjLinks, DjLogo } from '@/components/DjProfile';

type Step = 'welcome' | 'dj' | 'details';
type Mix = { id: string; title: string; kind: string; media_url: string; creator_dj_id: string; is_demo: boolean };

export function OnboardingFlow({ initialStep, event, assignment, djs, mixes, policy, brand }: {
  initialStep: Step; event: WeddingEvent; assignment: Assignment | null; djs: Dj[]; mixes: Mix[]; policy: 'company_assigned' | 'couple_selects'; brand: string;
}) {
  const { m, fmt } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>(initialStep);
  const [busy, start] = useTransition();
  const steps: Step[] = ['welcome', 'dj', 'details'];
  const idx = steps.indexOf(step);
  const errMsg = (code: string) => (m.errors as Record<string, string>)[code] ?? m.common.error;

  const go = (next: Step | 'done') => start(async () => {
    const r = await setOnboardingStep(next);
    if (!r.ok) return toast(errMsg(r.error), 'error');
    if (next === 'done') { router.replace('/home'); return; }
    setStep(next);
    window.scrollTo({ top: 0 });
  });

  return (
    <main id="main" className="min-h-dvh flex flex-col">
      <div className="gutter pt-[max(16px,env(safe-area-inset-top))] pb-2 flex items-center justify-between">
        <BrandMark name={brand} href="/onboarding" />
        <LocaleSwitch compact />
      </div>
      <div className="gutter mt-4 flex items-center gap-2" aria-label={fmt(m.onboarding.step, { n: idx + 1, total: steps.length })}>
        {steps.map((s, i) => <span key={s} className={cx('h-1.5 flex-1 rounded-full', i <= idx ? 'bg-ember' : 'bg-ink-3')} />)}
      </div>
      <p className="gutter mt-2 label">{fmt(m.onboarding.step, { n: idx + 1, total: steps.length })}</p>

      <div className="flex-1 mx-auto w-full max-w-3xl pb-16">
        {step === 'welcome' && (
          <section className="relative gutter pt-10 animate-rise">
            <FlowLines className="pointer-events-none absolute -z-10 inset-x-0 top-40 h-56 w-full opacity-80" />
            <p className="label mb-4 text-ember">{m.onboarding.welcomeKicker}</p>
            <h1 className="display-xl poster-shadow mb-6">{m.onboarding.welcomeTitle}</h1>
            <p className="text-lg text-paper-dim max-w-prose mb-10">{m.onboarding.welcomeBody}</p>
            <Button size="lg" onClick={() => go('dj')} disabled={busy}>{m.onboarding.start}</Button>
          </section>
        )}
        {step === 'dj' && <DjStep assignment={assignment} djs={djs} mixes={mixes} policy={policy} onNext={() => go('details')} busy={busy} />}
        {step === 'details' && <DetailsStep event={event} onDone={() => go('done')} onBack={() => setStep('dj')} />}
      </div>
    </main>
  );
}

function DjStep({ assignment, djs, mixes, policy, onNext, busy }: { assignment: Assignment | null; djs: Dj[]; mixes: Mix[]; policy: string; onNext: () => void; busy: boolean }) {
  const { m, fmt } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<Dj | null>(null);
  const [pending, start] = useTransition();
  const errMsg = (code: string) => (m.errors as Record<string, string>)[code] ?? m.common.error;
  const eligible = djs.filter((d) => d.accepts_new_couples);
  const status = assignment?.status;

  const choose = (dj: Dj) => start(async () => {
    const r = await selectDj(dj.id);
    if (!r.ok) return toast(errMsg(r.error), 'error');
    setOpen(null); toast(m.common.saved); router.refresh();
  });
  const confirm = () => start(async () => {
    const r = await confirmAssignedDj();
    if (!r.ok) return toast(errMsg(r.error), 'error');
    toast(m.common.saved); router.refresh();
  });

  const djCard = (dj: Dj, action?: React.ReactNode) => (
    <div className="card p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-center text-center sm:text-start max-w-2xl">
      <Portrait name={dj.display_name} src={dj.photo_url} size={140} />
      <div className="flex-1 min-w-0 flex flex-col items-center sm:items-start gap-5">
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
          <h3 className="display text-3xl">{dj.display_name}</h3>{dj.is_demo && <DemoBadge label={m.common.demo} />}
        </div>
        {action}
      </div>
    </div>
  );

  // Company-assigned model, or anything already decided
  if (status === 'confirmed' || status === 'proposed' || status === 'pending_approval' || policy === 'company_assigned') {
    return (
      <section className="gutter pt-8 animate-rise">
        <h1 className="display-l mb-3">{status === 'proposed' ? m.onboarding.djConfirmTitle : status === 'confirmed' ? m.onboarding.djYoursTitle : m.onboarding.djTitle}</h1>
        {status === 'proposed' && <p className="text-paper-dim mb-8">{m.onboarding.djConfirmSub}</p>}
        {assignment?.dj ? djCard(assignment.dj,
          status === 'proposed' ? <Button onClick={confirm} disabled={pending}><IconCheck size={18} />{m.onboarding.djConfirm}</Button>
          : status === 'pending_approval' ? <p role="status" className="text-gold font-bold">{m.onboarding.djPending}</p>
          : <p className="text-gold font-bold inline-flex items-center gap-2"><IconLock size={16} />{m.onboarding.djLocked}</p>)
          : <p className="card p-5 text-paper-dim" role="status">{m.onboarding.djAwaitAssign}</p>}
        {status === 'pending_approval' && policy === 'couple_selects' && (
          <div className="mt-8">
            <p className="label mb-3">{m.onboarding.djTitle}</p>
            <DjGrid djs={eligible.filter((d) => d.id !== assignment?.dj?.id)} onOpen={setOpen} />
          </div>
        )}
        <div className="mt-10"><Button size="lg" onClick={onNext} disabled={busy}>{m.common.continue}</Button></div>
        <DjSheet dj={open} mixes={mixes} onClose={() => setOpen(null)} onChoose={choose} pending={pending} />
      </section>
    );
  }

  return (
    <section className="pt-8 animate-rise">
      <div className="gutter mb-8">
        <h1 className="display-l mb-3">{m.onboarding.djTitle}</h1>
        <p className="text-paper-dim">{m.onboarding.djSub}</p>
      </div>
      {eligible.length === 0 ? (
        <div className="gutter"><p className="card p-5 text-paper-dim" role="status">{m.onboarding.djNone}</p>
          <div className="mt-8"><Button size="lg" onClick={onNext} disabled={busy}>{m.common.continue}</Button></div></div>
      ) : <div className="gutter"><DjGrid djs={eligible} onOpen={setOpen} /></div>}
      <DjSheet dj={open} mixes={mixes} onClose={() => setOpen(null)} onChoose={choose} pending={pending} />
      <p className="sr-only">{fmt(m.onboarding.step, { n: 2, total: 3 })}</p>
    </section>
  );
}

function DjGrid({ djs, onOpen }: { djs: Dj[]; onOpen: (d: Dj) => void }) {
  const { m } = useI18n();
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-8">
      {djs.map((dj, i) => (
        <li key={dj.id} className={cx(i % 2 === 1 && 'max-sm:translate-y-6', i % 3 === 1 && 'sm:translate-y-10')}>
          <button type="button" onClick={() => onOpen(dj)} className="w-full flex flex-col items-center gap-3 group" aria-haspopup="dialog">
            <span className="transition-transform duration-200 group-hover:-rotate-3"><Portrait name={dj.display_name} src={dj.photo_url} size={120} /></span>
            <span className="display text-lg text-center leading-tight">{dj.display_name}</span>
            {dj.is_demo && <DemoBadge label={m.common.demo} />}
          </button>
        </li>
      ))}
    </ul>
  );
}

function DjSheet({ dj, mixes, onClose, onChoose, pending }: { dj: Dj | null; mixes: Mix[]; onClose: () => void; onChoose: (d: Dj) => void; pending: boolean }) {
  const { m, locale, fmt } = useI18n();
  if (!dj) return null;
  const own = mixes.filter((x) => x.creator_dj_id === dj.id);
  return (
    <Sheet open onClose={onClose} title={dj.display_name}>
      <div className="flex flex-col items-center text-center gap-4">
        <Portrait name={dj.display_name} src={dj.photo_url} size={140} />
        <DjLogo dj={dj} />
        {dj.is_demo && <DemoBadge label={m.common.demo} />}
        <DjBio dj={dj} locale={locale} />
        <DjLinks links={dj.links} />
        <div className="flex flex-wrap gap-1.5 justify-center">{dj.specialties.map((s) => <Badge key={s}>{s}</Badge>)}</div>
      </div>
      {own.length > 0 && (
        <div className="mt-6">
          <p className="label mb-3">{m.onboarding.mixes}</p>
          <ul className="flex flex-col gap-2">
            {own.map((x) => (
              <li key={x.id} className="card p-3 flex items-center gap-3">
                <PlayToggle source={{ id: `content:${x.id}`, kind: 'company_mix', url: x.media_url, title: x.title, subtitle: dj.display_name }} size="sm" />
                <span className="font-bold text-sm flex-1 min-w-0 truncate">{x.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button size="lg" full className="mt-8" onClick={() => onChoose(dj)} disabled={pending}>{fmt(m.onboarding.djSelect, { name: isolate(dj.display_name) })}</Button>
    </Sheet>
  );
}

function DetailsStep({ event, onDone, onBack }: { event: WeddingEvent; onDone: () => void; onBack: () => void }) {
  const { m } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, start] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    start(async () => {
      const r = await saveEventDetails(f);
      if (!r.ok) { setFields(r.fields ?? {}); setError((m.errors as Record<string, string>)[r.error] ?? m.common.error); return; }
      onDone();
    });
  };
  const inv = (k: string) => (fields[k] ? true : undefined);

  return (
    <section className="gutter pt-8 animate-rise">
      <h1 className="display-l mb-3">{m.onboarding.detailsTitle}</h1>
      <p className="text-paper-dim mb-8">{m.onboarding.detailsSub}</p>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label={m.onboarding.partnerOne} htmlFor="p1"><Input id="p1" name="partner_one_name" defaultValue={event.partner_one_name} required maxLength={80} aria-invalid={inv('partner_one_name')} /></Field>
          <Field label={m.onboarding.partnerTwo} htmlFor="p2"><Input id="p2" name="partner_two_name" defaultValue={event.partner_two_name ?? ''} maxLength={80} /></Field>
          <Field label={m.onboarding.date} htmlFor="date"><Input id="date" name="wedding_date" type="date" defaultValue={event.wedding_date ?? ''} aria-invalid={inv('wedding_date')} /></Field>
          <Field label={m.onboarding.startTime} htmlFor="start"><Input id="start" name="start_time" type="time" defaultValue={event.start_time?.slice(0, 5) ?? ''} aria-invalid={inv('start_time')} /></Field>
          <Field label={m.onboarding.guests} htmlFor="guests"><Input id="guests" name="guest_count" type="number" inputMode="numeric" min={1} max={5000} defaultValue={event.guest_count ?? ''} aria-invalid={inv('guest_count')} /></Field>
          <Field label={m.onboarding.venue} htmlFor="venue"><Input id="venue" name="venue_name" defaultValue={event.venue_name ?? ''} maxLength={120} /></Field>
          <Field label={m.onboarding.city} htmlFor="city"><Input id="city" name="venue_city" defaultValue={event.venue_city ?? ''} maxLength={80} /></Field>
        </div>
        <Field label={m.onboarding.cultural} htmlFor="cultural">
          <Textarea id="cultural" name="cultural_notes" defaultValue={event.cultural_notes ?? ''} maxLength={1500} />
        </Field>
        <div className="flex gap-3 mt-4">
          <Button type="button" variant="ghost" onClick={onBack}>{m.common.back}</Button>
          <Button type="submit" size="lg" disabled={busy} className="flex-1 sm:flex-none">{busy ? m.common.saving : m.onboarding.finish}</Button>
        </div>
      </form>
    </section>
  );
}
