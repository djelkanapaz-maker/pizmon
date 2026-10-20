'use client';
import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { IconPlus } from '@/components/icons';
import { adminDeleteGenre, adminDeleteTag, adminSaveGenre, adminSaveTag } from '@/server/actions/admin-cms';
import { ConfirmButton, formObject, useCms, useRun } from '../_cms/client';

export type NamedRow = { id: string; slug: string; name_he: string; name_en: string; sort_order: number };
type Kind = 'genre' | 'category' | 'mood';

function save(kind: Kind, f: Record<string, string>) {
  return kind === 'genre' ? adminSaveGenre(f) : adminSaveTag(kind, f);
}
function remove(kind: Kind, id: string) {
  return kind === 'genre' ? adminDeleteGenre(id) : adminDeleteTag(id);
}

function RowForm({ kind, row, onDone }: { kind: Kind; row?: NamedRow; onDone: () => void }) {
  const { m, s } = useCms();
  const { busy, run } = useRun();
  const p = `${kind}-${row?.id ?? 'new'}`;
  return (
    <form noValidate className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_5rem_auto] gap-2 items-end" onSubmit={(e) => {
      e.preventDefault();
      const f = formObject(e.currentTarget);
      run(() => save(kind, { ...f, id: row?.id ?? '' }), { onOk: onDone });
    }}>
      <label className="flex flex-col gap-1 text-xs font-bold text-paper-dim" htmlFor={`${p}-slug`}>{m.admin.slug}
        <Input id={`${p}-slug`} name="slug" defaultValue={row?.slug ?? ''} required pattern="[a-z0-9-]+" maxLength={60} dir="ltr" className="h-10" placeholder="e.g. mizrahi" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-bold text-paper-dim" htmlFor={`${p}-he`}>{m.admin.nameHe}
        <Input id={`${p}-he`} name="name_he" defaultValue={row?.name_he ?? ''} required maxLength={80} dir="rtl" className="h-10" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-bold text-paper-dim" htmlFor={`${p}-en`}>{m.admin.nameEn}
        <Input id={`${p}-en`} name="name_en" defaultValue={row?.name_en ?? ''} required maxLength={80} dir="ltr" className="h-10" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-bold text-paper-dim" htmlFor={`${p}-ord`}>{s.sortOrder}
        <Input id={`${p}-ord`} name="sort_order" type="number" min={0} max={9999} defaultValue={row?.sort_order ?? 0} className="h-10" inputMode="numeric" />
      </label>
      <div className="flex gap-2 col-span-2 sm:col-span-1">
        <Button type="submit" size="sm" disabled={busy}>{busy ? m.common.saving : m.common.save}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>{m.common.cancel}</Button>
      </div>
    </form>
  );
}

export function NamedList({ kind, title, addLabel, rows }: { kind: Kind; title: string; addLabel: string; rows: NamedRow[] }) {
  const { m, s, locale } = useCms();
  const { busy, run } = useRun();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <section className="card p-5" aria-labelledby={`h-${kind}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 id={`h-${kind}`} className="display text-xl">{title}</h2>
        <Button size="sm" variant="secondary" onClick={() => setEditing('new')} disabled={editing === 'new'}><IconPlus size={16} />{addLabel}</Button>
      </div>
      {editing === 'new' && <div className="mb-4 p-3 rounded-[12px] bg-ink-3/40 border border-line"><RowForm kind={kind} onDone={() => setEditing(null)} /></div>}
      {rows.length === 0 && editing !== 'new' ? <p className="text-sm text-paper-dim">{s.emptyList}</p> : (
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              {editing === r.id ? <RowForm kind={kind} row={r} onDone={() => setEditing(null)} /> : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-40">
                    <p className="font-bold">{locale === 'he' ? r.name_he : r.name_en}</p>
                    <p className="text-xs text-paper-dim" dir="ltr">{r.slug} · {locale === 'he' ? r.name_en : r.name_he} · #{r.sort_order}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(r.id)}>{m.common.edit}</Button>
                  <ConfirmButton label={m.common.delete} confirmLabel={s.deleteConfirm} disabled={busy} onConfirm={() => run(() => remove(kind, r.id))} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
