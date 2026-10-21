'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { saveEventDetails } from '@/server/actions/couple';
import { Sheet, useToast } from '@/components/overlay';
import { Button, ErrorNote, Field, Input, Textarea } from '@/components/ui';
import type { WeddingEvent } from '@/server/queries';

export function EventDetailsButton({ event, label }: { event: WeddingEvent; label: string }) {
  const [open, setOpen] = useState(false);
  const { m } = useI18n();
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{label}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={m.wedding.details}>
        <EventDetailsForm event={event} onSaved={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

export function EventDetailsForm({ event, onSaved }: { event: WeddingEvent; onSaved?: () => void }) {
  const { m } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      start(async () => {
        const r = await saveEventDetails(f);
        if (!r.ok) return setError((m.errors as Record<string, string>)[r.error] ?? m.common.error);
        toast(m.common.saved); router.refresh(); onSaved?.();
      });
    }}>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={m.onboarding.partnerOne} htmlFor="e-p1"><Input id="e-p1" name="partner_one_name" defaultValue={event.partner_one_name} required maxLength={80} /></Field>
        <Field label={m.onboarding.partnerTwo} htmlFor="e-p2"><Input id="e-p2" name="partner_two_name" defaultValue={event.partner_two_name ?? ''} maxLength={80} /></Field>
        <Field label={m.onboarding.date} htmlFor="e-date"><Input id="e-date" name="wedding_date" type="date" defaultValue={event.wedding_date ?? ''} /></Field>
        <Field label={m.onboarding.guests} htmlFor="e-guests"><Input id="e-guests" name="guest_count" type="number" min={1} max={5000} inputMode="numeric" defaultValue={event.guest_count ?? ''} /></Field>
        <Field label={m.onboarding.venue} htmlFor="e-venue"><Input id="e-venue" name="venue_name" defaultValue={event.venue_name ?? ''} maxLength={120} /></Field>
        <Field label={m.onboarding.city} htmlFor="e-city"><Input id="e-city" name="venue_city" defaultValue={event.venue_city ?? ''} maxLength={80} /></Field>
      </div>
      <Field label={m.onboarding.cultural} htmlFor="e-cult"><Textarea id="e-cult" name="cultural_notes" defaultValue={event.cultural_notes ?? ''} maxLength={1500} /></Field>
      <Button type="submit" disabled={busy}>{busy ? m.common.saving : m.common.save}</Button>
    </form>
  );
}
