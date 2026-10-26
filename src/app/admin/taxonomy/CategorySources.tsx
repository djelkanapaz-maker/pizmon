'use client';
import { useState } from 'react';
import { Badge, Button } from '@/components/ui';
import { adminSetCategorySources } from '@/server/actions/admin-cms';
import { useCms, useRun } from '../_cms/client';

type Lang = 'all' | 'he' | 'intl';
type Source = { playlist_id: string; language: Lang };
type Category = { id: string; name: string; hidden: boolean; tracks: number; sources: Source[] };
type Playlist = { id: string; title: string; tracks: number };

const T = {
  he: {
    title: 'קטגוריות לפי פלייליסטים', sub: 'כל קטגוריה מתמלאת אוטומטית מהפלייליסטים שבחרתם בספוטיפיי, ומתעדכנת אחרי כל סנכרון.',
    noSources: 'לא מחוברת לפלייליסט', hidden: 'מוסתרת מהזוגות', visible: 'מוצגת לזוגות', songs: '{n} שירים',
    hide: 'הסתרה מהזוגות', lang: { all: 'הכל', he: 'רק עברית', intl: 'רק לועזית' }, use: 'לשימוש',
    noPlaylists: 'עוד אין פלייליסטים מספוטיפיי. ייבאו אותם ב״פלייליסטים נבחרים״.', saved: 'הקטגוריה עודכנה: {n} שירים',
  },
  en: {
    title: 'Categories from playlists', sub: 'Each category fills itself from the Spotify playlists you pick, and follows every sync.',
    noSources: 'No playlist linked', hidden: 'Hidden from couples', visible: 'Shown to couples', songs: '{n} songs',
    hide: 'Hide from couples', lang: { all: 'All', he: 'Hebrew only', intl: 'Non-Hebrew only' }, use: 'Use',
    noPlaylists: 'No Spotify playlists yet. Import them under “Featured playlists”.', saved: 'Category updated: {n} songs',
  },
};

function Editor({ cat, playlists, onDone }: { cat: Category; playlists: Playlist[]; onDone: () => void }) {
  const { m, locale } = useCms();
  const t = T[locale === 'he' ? 'he' : 'en'];
  const { busy, run } = useRun();
  const [sel, setSel] = useState<Record<string, Lang | undefined>>(Object.fromEntries(cat.sources.map((s) => [s.playlist_id, s.language])));
  const [hidden, setHidden] = useState(cat.hidden);
  const sources = Object.entries(sel).filter(([, l]) => l).map(([playlist_id, language]) => ({ playlist_id, language: language! }));
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-[12px] border border-line p-3">
      <ul className="flex flex-col gap-2">
        {playlists.map((p) => {
          const on = !!sel[p.id];
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <label className="flex flex-1 min-w-48 items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-ember" checked={on}
                  onChange={(e) => setSel((x) => ({ ...x, [p.id]: e.target.checked ? 'all' : undefined }))} />
                <span className="font-bold" dir="auto">{p.title}</span>
                <span className="text-paper-dim">· {t.songs.replace('{n}', String(p.tracks))}</span>
              </label>
              {on && (
                <div className="flex gap-1" role="radiogroup" aria-label={p.title}>
                  {(['all', 'he', 'intl'] as const).map((l) => (
                    <button key={l} type="button" role="radio" aria-checked={sel[p.id] === l}
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${sel[p.id] === l ? 'bg-paper text-ink border-paper' : 'border-line text-paper-dim'}`}
                      onClick={() => setSel((x) => ({ ...x, [p.id]: l }))}>{t.lang[l]}</button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-ember" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />{t.hide}</label>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => run(() => adminSetCategorySources(cat.id, { hidden, sources }), { success: false, onOk: onDone })}>{busy ? m.common.saving : m.common.save}</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>{m.common.cancel}</Button>
      </div>
    </div>
  );
}

export function CategorySources({ categories, playlists }: { categories: Category[]; playlists: Playlist[] }) {
  const { m, locale } = useCms();
  const t = T[locale === 'he' ? 'he' : 'en'];
  const [editing, setEditing] = useState<string | null>(null);
  const title = (id: string) => playlists.find((p) => p.id === id)?.title ?? '—';
  return (
    <section className="card p-5" aria-labelledby="h-cat-sources">
      <h2 id="h-cat-sources" className="display text-xl">{t.title}</h2>
      <p className="text-sm text-paper-dim mt-1 mb-4">{t.sub}</p>
      {playlists.length === 0 && <p className="text-sm text-paper-dim mb-3">{t.noPlaylists}</p>}
      <ul className="flex flex-col divide-y divide-line">
        {categories.map((c) => (
          <li key={c.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold flex-1 min-w-40">{c.name}</p>
              <Badge tone={c.hidden ? 'neutral' : 'ok'}>{c.hidden ? t.hidden : t.visible}</Badge>
              <span className="text-xs text-paper-dim">{t.songs.replace('{n}', String(c.tracks))}</span>
              {playlists.length > 0 && <Button size="sm" variant="ghost" onClick={() => setEditing(editing === c.id ? null : c.id)}>{m.common.edit}</Button>}
            </div>
            <p className="text-xs text-paper-dim mt-1" dir="auto">
              {c.sources.length ? c.sources.map((s) => `${title(s.playlist_id)} (${t.lang[s.language]})`).join(' · ') : t.noSources}
            </p>
            {editing === c.id && <Editor cat={c} playlists={playlists} onDone={() => setEditing(null)} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
