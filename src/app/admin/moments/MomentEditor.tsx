'use client';
import { useState } from 'react';
import { Sheet } from '@/components/overlay';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { IconPlus } from '@/components/icons';
import { adminDeleteMoment, adminSaveMoment } from '@/server/actions/admin-cms';
import { ConfirmButton, formObject, useCms, useRun } from '../_cms/client';

export type MomentRow = {
  id: string; slug: string; name_he: string; name_en: string; description_he: string | null; description_en: string | null;
  sort_order: number; is_required: boolean; is_active: boolean; has_language_collections: boolean;
};

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-3 min-h-11 text-sm font-bold">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-5 accent-[var(--color-ember)]" />{label}
    </label>
  );
}

function MomentForm({ row, onDone }: { row?: MomentRow; onDone: () => void }) {
  const { m, s } = useCms();
  const { busy, run } = useRun();
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault();
      const f = formObject(e.currentTarget);
      run(() => adminSaveMoment({
        ...f, id: row?.id ?? '', is_required: f.is_required === 'on', is_active: f.is_active === 'on', has_language_collections: f.has_language_collections === 'on',
      }), { onOk: onDone });
    }}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={m.admin.slug} htmlFor="mo-slug"><Input id="mo-slug" name="slug" defaultValue={row?.slug ?? ''} required pattern="[a-z0-9-]+" maxLength={60} dir="ltr" /></Field>
        <Field label={s.sortOrder} htmlFor="mo-ord"><Input id="mo-ord" name="sort_order" type="number" min={0} max={9999} defaultValue={row?.sort_order ?? 0} inputMode="numeric" /></Field>
        <Field label={m.admin.nameHe} htmlFor="mo-he"><Input id="mo-he" name="name_he" defaultValue={row?.name_he ?? ''} required maxLength={80} dir="rtl" /></Field>
        <Field label={m.admin.nameEn} htmlFor="mo-en"><Input id="mo-en" name="name_en" defaultValue={row?.name_en ?? ''} required maxLength={80} dir="ltr" /></Field>
      </div>
      <Field label={m.admin.descriptionHe} htmlFor="mo-dhe"><Textarea id="mo-dhe" name="description_he" defaultValue={row?.description_he ?? ''} maxLength={1000} dir="rtl" className="min-h-20" /></Field>
      <Field label={m.admin.descriptionEn} htmlFor="mo-den"><Textarea id="mo-den" name="description_en" defaultValue={row?.description_en ?? ''} maxLength={1000} dir="ltr" className="min-h-20" /></Field>
      <div className="flex flex-col">
        <Check name="is_required" label={m.admin.required} defaultChecked={row?.is_required ?? true} />
        <Check name="is_active" label={m.admin.active} defaultChecked={row?.is_active ?? true} />
        <Check name="has_language_collections" label={m.admin.languageCollections} defaultChecked={row?.has_language_collections ?? false} />
      </div>
      <Button type="submit" disabled={busy}>{busy ? m.common.saving : row ? m.common.save : m.common.create}</Button>
    </form>
  );
}

export function NewMomentButton() {
  const { m } = useCms();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><IconPlus size={16} />{m.admin.newMoment}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={m.admin.newMoment} wide><MomentForm onDone={() => setOpen(false)} /></Sheet>
    </>
  );
}

export function MomentActions({ row }: { row: MomentRow }) {
  const { m, s, locale } = useCms();
  const { busy, run } = useRun();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex gap-2 shrink-0">
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{m.common.edit}</Button>
      <ConfirmButton label={m.common.delete} confirmLabel={s.deleteConfirm} disabled={busy} onConfirm={() => run(() => adminDeleteMoment(row.id))} />
      <Sheet open={open} onClose={() => setOpen(false)} title={locale === 'he' ? row.name_he : row.name_en} wide><MomentForm row={row} onDone={() => setOpen(false)} /></Sheet>
    </div>
  );
}
