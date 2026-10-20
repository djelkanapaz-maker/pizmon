'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { Sheet } from '@/components/overlay';
import { Button, Chip, Field, Input, Select, cx } from '@/components/ui';
import { IconDiscover, IconFilter } from '@/components/icons';

type Opt = { id: string; label: string };
type Params = Record<string, string | undefined>;
const LANGS = ['he', 'en', 'instrumental', 'other'] as const;

export function DiscoverFilters({ initial, genres, moods, categories, moments }: { initial: Params; genres: Opt[]; moods: Opt[]; categories: Opt[]; moments: Opt[] }) {
  const { m } = useI18n();
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState(initial.q ?? '');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Params>(initial);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (p: Params) => {
    const usp = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => { if (v) usp.set(k, v); });
    start(() => router.replace(`${path}${usp.size ? `?${usp}` : ''}`, { scroll: false }));
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onSearch = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push({ ...initial, q: v.trim() || undefined }), 300);
  };
  const activeCount = ['genre', 'mood', 'lang', 'energy', 'moment'].filter((k) => initial[k]).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="gutter flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">{m.common.search}</span>
          <IconDiscover size={18} className="absolute top-1/2 -translate-y-1/2 start-4 text-paper-dim pointer-events-none" />
          <Input type="search" value={q} onChange={(e) => onSearch(e.target.value)} placeholder={m.discover.searchPlaceholder} className="ps-11" enterKeyHint="search" />
        </label>
        <Button variant={activeCount ? 'gold' : 'secondary'} onClick={() => { setDraft(initial); setOpen(true); }} aria-label={m.common.filters} className="!px-4">
          <IconFilter size={18} />{activeCount > 0 && <span className="tabular">{activeCount}</span>}
        </Button>
      </div>
      <div className={cx('scroll-x pb-1', pending && 'opacity-70')} role="group" aria-label={m.discover.category}>
        <Chip selected={!initial.cat} onClick={() => push({ ...initial, cat: undefined })}>{m.common.all}</Chip>
        {categories.map((c) => <Chip key={c.id} selected={initial.cat === c.id} onClick={() => push({ ...initial, cat: initial.cat === c.id ? undefined : c.id })}>{c.label}</Chip>)}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={m.common.filters}>
        <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); setOpen(false); push({ ...draft, q: q.trim() || undefined }); }}>
          <Field label={m.discover.genre} htmlFor="f-genre">
            <Select id="f-genre" value={draft.genre ?? ''} onChange={(e) => setDraft({ ...draft, genre: e.target.value || undefined })}>
              <option value="">{m.common.all}</option>{genres.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </Select>
          </Field>
          <Field label={m.discover.moment} htmlFor="f-moment">
            <Select id="f-moment" value={draft.moment ?? ''} onChange={(e) => setDraft({ ...draft, moment: e.target.value || undefined })}>
              <option value="">{m.common.all}</option>{moments.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </Select>
          </Field>
          <fieldset>
            <legend className="text-sm font-bold mb-2">{m.discover.mood}</legend>
            <div className="flex flex-wrap gap-2">{moods.map((x) => <Chip key={x.id} selected={draft.mood === x.id} onClick={() => setDraft({ ...draft, mood: draft.mood === x.id ? undefined : x.id })}>{x.label}</Chip>)}</div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-bold mb-2">{m.discover.language}</legend>
            <div className="flex flex-wrap gap-2">{LANGS.map((l) => <Chip key={l} selected={draft.lang === l} onClick={() => setDraft({ ...draft, lang: draft.lang === l ? undefined : l })}>{m.discover.languages[l]}</Chip>)}</div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-bold mb-2">{m.discover.energy}</legend>
            <div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5].map((n) => <Chip key={n} selected={draft.energy === String(n)} onClick={() => setDraft({ ...draft, energy: draft.energy === String(n) ? undefined : String(n) })}>{m.discover.energyLevels[n]}</Chip>)}</div>
          </fieldset>
          <label className="flex items-center gap-3 text-sm font-bold">
            <input type="checkbox" className="size-5 accent-ember" checked={draft.hidden === '1'} onChange={(e) => setDraft({ ...draft, hidden: e.target.checked ? '1' : undefined })} />
            {m.discover.showHidden}
          </label>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => { setDraft({}); setOpen(false); setQ(''); push({}); }}>{m.common.clear}</Button>
            <Button type="submit" full>{m.common.done}</Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
