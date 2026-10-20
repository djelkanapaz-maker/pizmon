'use client';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/client';
import { searchCatalog } from '@/server/actions/couple';
import { Input, cx } from './ui';
import { IconCheck } from './icons';

export type Picked = { id: string; label: string; sub?: string };

/** Accessible type-ahead over the company catalog (tracks or artists). */
export function CatalogPicker({ type, value, onPick, label, search = searchCatalog }: {
  type: 'track' | 'artist'; value: Picked | null; onPick: (p: Picked | null) => void; label: string;
  search?: (q: string, t: 'track' | 'artist') => ReturnType<typeof searchCatalog>;
}) {
  const { m } = useI18n();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Picked[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = `picker-${type}`;

  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    if (!q.trim()) return;
    t.current = setTimeout(async () => {
      setLoading(true);
      const r = await search(q, type);
      setLoading(false);
      setItems(r.ok ? r.data : []);
      setActiveIdx(-1);
    }, 250);
  }, [q, type, search]);

  const shown = q.trim() ? items : [];
  if (value) {
    return (
      <div className="flex items-center gap-3 h-12 px-4 rounded-[12px] bg-ink-3 border border-ember">
        <IconCheck size={16} className="text-ember" />
        <span className="flex-1 min-w-0 truncate font-bold" dir="auto">{value.label}{value.sub ? ` — ${value.sub}` : ''}</span>
        <button type="button" className="text-sm font-bold text-paper-dim hover:text-paper" onClick={() => onPick(null)}>{m.common.clear}</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Input role="combobox" aria-expanded={shown.length > 0} aria-controls={listId} aria-autocomplete="list" aria-label={label}
        value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.restrictions.searchTrack} dir="auto"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(shown.length - 1, i + 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
          if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); onPick(shown[activeIdx]); setQ(''); }
        }}
        aria-activedescendant={activeIdx >= 0 ? `${listId}-${activeIdx}` : undefined} />
      {loading && <span className="absolute end-4 top-1/2 -translate-y-1/2 size-4 rounded-full border-2 border-paper-dim border-t-transparent animate-spin" />}
      {shown.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-10 mt-1 inset-x-0 card max-h-64 overflow-y-auto py-1">
          {shown.map((it, i) => (
            <li key={it.id} id={`${listId}-${i}`} role="option" aria-selected={i === activeIdx}>
              <button type="button" onClick={() => { onPick(it); setQ(''); }} className={cx('w-full text-start px-4 py-2.5 hover:bg-ink-3', i === activeIdx && 'bg-ink-3')}>
                <span className="block font-bold truncate" dir="auto">{it.label}</span>
                {it.sub && <span className="block text-sm text-paper-dim truncate" dir="auto">{it.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
