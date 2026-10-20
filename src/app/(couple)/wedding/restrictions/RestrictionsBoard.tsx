'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { addRestriction, removeRestriction } from '@/server/actions/couple';
import { Sheet, useToast } from '@/components/overlay';
import { Badge, Button, Chip, ErrorNote, Field, Input, Select, cx } from '@/components/ui';
import { CatalogPicker, type Picked } from '@/components/CatalogPicker';
import { IconBan, IconPlus, IconStar, IconTrash } from '@/components/icons';

type Item = { id: string; kind: 'must_play' | 'never_play'; strength: 'absolute' | 'preference'; target_type: 'track' | 'artist' | 'genre' | 'text'; label: string; reason: string | null };

export function RestrictionsBoard({ items, genres }: { items: Item[]; genres: { id: string; label: string }[] }) {
  const { m } = useI18n();
  const [adding, setAdding] = useState<null | 'must_play' | 'never_play'>(null);
  const must = items.filter((i) => i.kind === 'must_play');
  const never = items.filter((i) => i.kind === 'never_play');
  return (
    <div className="gutter grid md:grid-cols-2 gap-6">
      <Column kind="must_play" title={m.restrictions.must} items={must} empty={m.restrictions.emptyMust} onAdd={() => setAdding('must_play')} />
      <Column kind="never_play" title={m.restrictions.never} items={never} empty={m.restrictions.emptyNever} onAdd={() => setAdding('never_play')} />
      {adding && <AddSheet kind={adding} genres={genres} onClose={() => setAdding(null)} />}
    </div>
  );
}

function Column({ kind, title, items, empty, onAdd }: { kind: Item['kind']; title: string; items: Item[]; empty: string; onAdd: () => void }) {
  const { m } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const never = kind === 'never_play';
  return (
    <section aria-labelledby={`col-${kind}`} className={cx('card p-4 md:p-5', never ? 'border-danger/40' : 'border-gold/40')}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 id={`col-${kind}`} className={cx('display text-2xl flex items-center gap-2', never ? 'text-danger' : 'text-gold')}>
          {never ? <IconBan /> : <IconStar />}{title}
        </h2>
        <Button size="sm" variant={never ? 'danger' : 'gold'} onClick={onAdd}><IconPlus size={16} />{m.restrictions.add}</Button>
      </div>
      {items.length === 0 ? <p className="text-paper-dim text-sm py-4">{empty}</p> : (
        <ul className="flex flex-col gap-2">
          {items.map((r) => (
            <li key={r.id} className="rounded-[12px] bg-ink-3 p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold" dir="auto">{r.label}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  <Badge>{m.restrictions.types[r.target_type]}</Badge>
                  <Badge tone={r.strength === 'absolute' ? (never ? 'danger' : 'gold') : 'neutral'}>{r.strength === 'absolute' ? m.restrictions.absolute : m.restrictions.preference}</Badge>
                </div>
                {r.reason && <p className="text-sm text-paper-dim mt-1.5" dir="auto">{r.reason}</p>}
              </div>
              <button type="button" disabled={busy} aria-label={`${m.common.remove}: ${r.label}`} className="size-10 grid place-items-center rounded-full hover:bg-line shrink-0"
                onClick={() => start(async () => { const res = await removeRestriction(r.id); if (!res.ok) toast(m.common.error, 'error'); else router.refresh(); })}>
                <IconTrash size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddSheet({ kind, genres, onClose }: { kind: Item['kind']; genres: { id: string; label: string }[]; onClose: () => void }) {
  const { m } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [type, setType] = useState<Item['target_type']>('track');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [genre, setGenre] = useState('');
  const [text, setText] = useState('');
  const [strength, setStrength] = useState<Item['strength']>('absolute');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const never = kind === 'never_play';
  const target = type === 'genre' ? genre : type === 'text' ? '' : picked?.id ?? '';
  const valid = type === 'text' ? text.trim().length > 0 : !!target;

  const submit = () => start(async () => {
    const r = await addRestriction({ kind, strength, target_type: type, target_id: target || undefined, text_value: type === 'text' ? text : undefined, reason: reason || undefined });
    if (!r.ok) return setError((m.errors as Record<string, string>)[r.error] ?? m.common.error);
    toast(m.common.saved); router.refresh(); onClose();
  });

  return (
    <Sheet open onClose={onClose} title={never ? m.restrictions.never : m.restrictions.must}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); if (valid) submit(); }}>
        {error && <ErrorNote>{error}</ErrorNote>}
        <fieldset>
          <legend className="text-sm font-bold mb-2">{m.restrictions.type}</legend>
          <div className="flex flex-wrap gap-2">
            {(['track', 'artist', 'genre', 'text'] as const).map((t) => <Chip key={t} selected={type === t} onClick={() => { setType(t); setPicked(null); }}>{m.restrictions.types[t]}</Chip>)}
          </div>
        </fieldset>
        {(type === 'track' || type === 'artist') && <CatalogPicker type={type} value={picked} onPick={setPicked} label={m.restrictions.types[type]} />}
        {type === 'genre' && (
          <Select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label={m.restrictions.types.genre}>
            <option value="">—</option>{genres.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </Select>
        )}
        {type === 'text' && <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={m.restrictions.textPlaceholder} maxLength={200} aria-label={m.restrictions.types.text} dir="auto" />}
        <fieldset>
          <legend className="text-sm font-bold mb-2">{m.restrictions.strength}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['absolute', 'preference'] as const).map((st) => (
              <button key={st} type="button" aria-pressed={strength === st} onClick={() => setStrength(st)}
                className={cx('rounded-[14px] border-2 p-3 text-start', strength === st ? (never ? 'border-danger bg-danger/10' : 'border-gold bg-gold/10') : 'border-line')}>
                <span className="block font-bold">{st === 'absolute' ? m.restrictions.absolute : m.restrictions.preference}</span>
                <span className="block text-xs text-paper-dim mt-1">{never ? (st === 'absolute' ? m.restrictions.absoluteHint : m.restrictions.preferenceHint) : (st === 'absolute' ? m.restrictions.mustAbsoluteHint : m.restrictions.mustPreferenceHint)}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <Field label={m.restrictions.reason} htmlFor="reason"><Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} dir="auto" /></Field>
        <Button type="submit" size="lg" variant={never ? 'danger' : 'gold'} disabled={!valid || busy}>{busy ? m.common.saving : m.restrictions.add}</Button>
      </form>
    </Sheet>
  );
}
