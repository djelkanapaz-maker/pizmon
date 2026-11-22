'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { fmt } from '@/i18n/format';
import type { SelectionState } from '@/core/moments';
import { restrictionFor, type Restriction } from '@/core/restrictions';
import { ensureExternalTrack, saveSelection, searchLibraryTracks, type MomentSearchResult } from '@/server/actions/couple';
import { Sheet, useToast } from '@/components/overlay';
import { Badge, Button, Chip, Cover, Field, Input, Textarea, cx } from '@/components/ui';
import { TrackPlay } from '@/components/music/TrackPlay';
import { IconCheck, IconDiscover, IconPlus, IconX, IconBan } from '@/components/icons';
import type { TrackContext } from '@/components/music/TrackList';
import type { Moment, Selection, Track } from '@/server/queries';

export function MomentEditor({ moment, selection, suggestions, known, ctx }: {
  moment: Moment; selection: Selection | null; suggestions: { collection: 'he' | 'intl' | null; track: Track }[]; known: Track[]; ctx: TrackContext;
}) {
  const { m } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const [collection, setCollection] = useState<'he' | 'intl'>('he');
  // the suggestion lists are whole playlists (hundreds of songs): shown 30 at a time
  const [limit, setLimit] = useState(30);
  const [notes, setNotes] = useState(selection?.notes ?? '');
  // a song waiting for "groom or bride?" (two-song mode); resolve() gives its catalog id
  const [pick, setPick] = useState<{ title: string; resolve: () => Promise<string | null> } | null>(null);
  // search the whole music library from inside the moment
  const [q, setQ] = useState('');
  const [found, setFound] = useState<MomentSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearch = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    const term = v.trim();
    const n = ++seq.current;
    if (term.length < 2) { setFound(null); setSearching(false); return; }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const r = await searchLibraryTracks(term);
      if (n !== seq.current) return;
      setSearching(false);
      setFound(r.ok ? r.data : { library: [], spotify: [], apple: [] });
    }, 300);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const state: SelectionState = selection
    ? { status: selection.status, primary_track_id: selection.primary_track_id, backup_track_id: selection.backup_track_id, custom_song: selection.custom_song, shortlist: selection.shortlist,
        split: !!selection.split, second_track_id: selection.second_track_id ?? null, second_custom_song: selection.second_custom_song ?? null }
    : { status: 'not_started', primary_track_id: null, backup_track_id: null, custom_song: null, shortlist: [], split: false, second_track_id: null, second_custom_song: null };
  const split = !!moment.allows_split && !!state.split;
  const all = new Map<string, Track>([...known, ...suggestions.map((s) => s.track), ...(found?.library ?? [])].map((t) => [t.id, t]));
  const errMsg = (code: string) => (m.errors as Record<string, string>)[code] ?? m.common.error;

  const save = (patch: Record<string, unknown>) => start(async () => {
    const r = await saveSelection(moment.id, patch);
    if (!r.ok) return toast(errMsg(r.error), 'error');
    toast(m.common.saved); router.refresh();
  });

  // choosing a song: one-song mode saves it at once; two-song mode asks "groom or bride?" first
  const choose = (title: string, resolve: () => Promise<string | null>) => {
    if (split) { setPick({ title, resolve }); return; }
    start(async () => {
      const id = await resolve();
      if (!id) return;
      const r = await saveSelection(moment.id, { primary_track_id: id });
      if (!r.ok) return toast(errMsg(r.error), 'error');
      toast(m.common.saved); router.refresh();
    });
  };
  const assign = (field: 'primary_track_id' | 'second_track_id') => {
    const p = pick; if (!p) return;
    setPick(null);
    start(async () => {
      const id = await p.resolve();
      if (!id) return;
      const r = await saveSelection(moment.id, { [field]: id });
      if (!r.ok) return toast(errMsg(r.error), 'error');
      toast(m.common.saved); router.refresh();
    });
  };
  const external = (source: 'spotify' | 'apple', h: { id: string; title: string; artists: string; artworkUrl: string | null }) => async () => {
    const r = await ensureExternalTrack(source, h.id, { title: h.title, artists: h.artists, artworkUrl: h.artworkUrl });
    if (!r.ok) { toast(errMsg(r.error), 'error'); return null; }
    return r.data.trackId;
  };

  const visible = moment.has_language_collections ? suggestions.filter((s) => s.collection === collection || s.collection === null) : suggestions;
  const shortlist = state.shortlist.map((id) => all.get(id)).filter(Boolean) as Track[];

  type SlotKey = 'first' | 'second';
  const slotFields = { first: { track: 'primary_track_id', text: 'custom_song' }, second: { track: 'second_track_id', text: 'second_custom_song' } } as const;
  const slot = (key: SlotKey, label: string) => {
    const f = slotFields[key];
    const t = state[f.track] ? all.get(state[f.track]!) : null;
    const text = state[f.text] ?? '';
    return (
      <div className="flex flex-col gap-2">
        <p className="label">{label}</p>
        {t && (
          <div className="flex items-center gap-3">
            <Cover seed={t.id} label={t.title} src={t.artwork_url} size={48} />
            <div className="min-w-0 flex-1">
              <p className="font-bold truncate" dir="auto">{t.title}</p>
              <p className="text-sm text-paper-dim truncate" dir="auto">{t.artist?.name}</p>
            </div>
            <TrackPlay track={t} />
            <button type="button" disabled={busy} onClick={() => save({ [f.track]: null })} aria-label={`${m.common.remove}: ${t.title}`} className="size-10 grid place-items-center rounded-full hover:bg-ink-3"><IconX size={18} /></button>
          </div>
        )}
        <SongText key={`${key}-${text}`} id={`song-${key}`} label={label} initial={text} placeholder={m.moments.typeSong} disabled={busy} onSave={(v) => save({ [f.text]: v })} saveLabel={m.common.save} />
      </div>
    );
  };

  // a song row: the full title and artist are always readable; one "choose" button
  // (two-song mode: it asks groom or bride). The shortlist "+" only in one-song mode, never for glass breaking.
  const showShortlist = false; // the shortlist "+" is off in every moment: one clear "choose" button
  const row = (t: Track, key: string) => {
    const r = restrictionFor(t, ctx.restrictions as Restriction[]);
    const blocked = r?.kind === 'never_play' && r.strength === 'absolute';
    const inShort = state.shortlist.includes(t.id);
    const forGroom = split && state.primary_track_id === t.id;
    const forBride = split && state.second_track_id === t.id;
    const chosenOne = !split && state.primary_track_id === t.id;
    return (
      <li key={key} className="py-3 border-b border-line/50 last:border-0 flex items-center gap-3">
        <Cover seed={t.id} label={t.title} src={t.artwork_url} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-bold break-words leading-snug" dir="auto">{t.title}</p>
          <p className="text-sm text-paper-dim break-words leading-snug" dir="auto">{t.artist?.name}</p>
          {(blocked || forGroom || forBride) && (
            <span className="flex flex-wrap gap-1.5 mt-1">
              {blocked && <Badge tone="danger"><IconBan size={12} />{m.discover.neverBlocked}</Badge>}
              {forGroom && <Badge tone="gold"><IconCheck size={12} />{m.moments.forGroom}</Badge>}
              {forBride && <Badge tone="gold"><IconCheck size={12} />{m.moments.forBride}</Badge>}
            </span>
          )}
        </div>
        <TrackPlay track={t} />
        <Button size="sm" variant={chosenOne ? 'gold' : 'secondary'} disabled={busy || blocked || chosenOne} className="shrink-0"
          onClick={() => choose(t.title, async () => t.id)}>
          {chosenOne ? <IconCheck size={14} /> : null}{chosenOne ? m.moments.chosen : m.moments.choose}
        </Button>
        {showShortlist && (
          <button type="button" disabled={busy || blocked} onClick={() => save(inShort ? { removeShortlist: t.id } : { addShortlist: t.id })}
            aria-pressed={inShort} aria-label={`${inShort ? m.moments.removeShortlist : m.moments.addShortlist}: ${t.title}`}
            className={cx('size-9 shrink-0 grid place-items-center rounded-full border', inShort ? 'bg-paper text-ink border-paper' : 'border-line hover:border-paper-dim')}>
            {inShort ? <IconCheck size={16} /> : <IconPlus size={16} />}
          </button>
        )}
      </li>
    );
  };
  // a song from Spotify / Apple search (not in the library yet): choosing it adds it to the catalog
  const extRow = (source: 'spotify' | 'apple', h: { id: string; title: string; artists: string; artworkUrl: string | null }) => (
    <li key={`${source}-${h.id}`} className="py-3 border-b border-line/50 last:border-0 flex items-center gap-3">
      <Cover seed={h.id} label={h.title} src={h.artworkUrl} size={44} />
      <div className="min-w-0 flex-1">
        <p className="font-bold break-words leading-snug" dir="auto">{h.title}</p>
        <p className="text-sm text-paper-dim break-words leading-snug" dir="auto">{h.artists}</p>
      </div>
      <Button size="sm" variant="secondary" disabled={busy} className="shrink-0" onClick={() => choose(h.title, external(source, h))}>{m.moments.choose}</Button>
    </li>
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="gutter">
        <div className={cx('card p-4 md:p-5 flex flex-col gap-4', state.status === 'confirmed' && 'border-gold shadow-[var(--shadow-hard-gold)]')}>
          {moment.allows_split && (
            <div className="flex flex-col gap-2">
              <p className="label">{m.moments.modeLabel}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={m.moments.modeLabel}>
                <Chip selected={!split} onClick={() => split && save({ split: false })}>{m.moments.modeOne}</Chip>
                <Chip selected={split} onClick={() => !split && save({ split: true })}>{m.moments.modeTwo}</Chip>
              </div>
            </div>
          )}
          {split ? <>{slot('first', m.moments.groomSong)}{slot('second', m.moments.brideSong)}</> : slot('first', m.moments.yourSong)}
          <Field label={m.moments.notes} htmlFor="notes">
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (selection?.notes ?? '') && save({ notes })} maxLength={1000} className="min-h-20" />
          </Field>
        </div>
      </section>

      {shortlist.length > 0 && (
        <section className="gutter">
          <h2 className="display-m mb-3">{m.moments.shortlist}</h2>
          <ul className="card px-4">{shortlist.map((t) => row(t, `s-${t.id}`))}</ul>
        </section>
      )}

      <section className="gutter">
        <h2 className="display-m mb-3">{m.moments.searchTitle}</h2>
        <label className="relative block">
          <span className="sr-only">{m.moments.searchTitle}</span>
          <IconDiscover size={18} className="absolute top-1/2 -translate-y-1/2 start-4 text-paper-dim pointer-events-none" />
          <Input type="search" value={q} onChange={(e) => onSearch(e.target.value)} placeholder={m.moments.searchPlaceholder} className="ps-11" enterKeyHint="search" />
        </label>
        {q.trim().length >= 2 && (
          <div className="mt-3" aria-live="polite">
            {searching && !found ? <p className="text-paper-dim text-sm">{m.moments.searching}</p>
              : found && (found.library.length || found.spotify.length || found.apple.length) ? (
                <div className="flex flex-col gap-4">
                  {found.library.length > 0 && <ul className="card px-4">{found.library.map((t) => row(t, `f-${t.id}`))}</ul>}
                  {(found.spotify.length > 0 || found.apple.length > 0) && (
                    <div>
                      <p className="label mb-2">{found.spotify.length ? m.discover.fromSpotify : m.discover.fromApple}</p>
                      <ul className="card px-4">{found.spotify.map((h) => extRow('spotify', h))}{found.apple.map((h) => extRow('apple', h))}</ul>
                    </div>
                  )}
                </div>
              )
              : found ? <p className="text-paper-dim text-sm">{m.moments.searchEmpty}</p> : null}
          </div>
        )}
      </section>

      <section className="gutter">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="display-m">{m.moments.curated}</h2>
          {moment.has_language_collections && (
            <div className="flex gap-2" role="group">
              <Chip selected={collection === 'he'} onClick={() => { setCollection('he'); setLimit(30); }}>{m.moments.he}</Chip>
              <Chip selected={collection === 'intl'} onClick={() => { setCollection('intl'); setLimit(30); }}>{m.moments.intl}</Chip>
            </div>
          )}
        </div>
        {visible.length ? <ul className="card px-4">{visible.slice(0, limit).map((s) => row(s.track, `c-${s.track.id}`))}</ul> : <p className="text-paper-dim">{m.discover.noResults}</p>}
        {visible.length > limit && <Button variant="secondary" className="mt-3 w-full" onClick={() => setLimit((n) => n + 30)}>{fmt(m.moments.showMore, { count: visible.length - limit })}</Button>}
        <Link href={`/discover?moment=${moment.id}`} className="mt-4 inline-flex items-center gap-2 font-bold text-sm text-paper-dim hover:text-paper"><IconDiscover size={16} />{m.discover.title}</Link>
      </section>

      <Sheet open={!!pick} onClose={() => setPick(null)} title={m.moments.pickFor}>
        <p className="font-bold mb-4 break-words" dir="auto">{pick?.title}</p>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="gold" disabled={busy} onClick={() => assign('primary_track_id')}>{m.moments.forGroom}</Button>
          <Button variant="gold" disabled={busy} onClick={() => assign('second_track_id')}>{m.moments.forBride}</Button>
        </div>
      </Sheet>
    </div>
  );
}

/** Large free-text box for a song the couple types themselves (saved on blur or with the button). */
function SongText({ id, label, initial, placeholder, disabled, onSave, saveLabel }: { id: string; label: string; initial: string; placeholder: string; disabled: boolean; onSave: (v: string) => void; saveLabel: string }) {
  const [v, setV] = useState(initial);
  const dirty = v.trim() !== initial.trim();
  return (
    <div className="flex flex-col gap-2">
      <Textarea id={id} aria-label={label} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => dirty && onSave(v)} placeholder={placeholder} maxLength={500} dir="auto" className="min-h-28 text-base" />
      {dirty && <Button size="sm" variant="secondary" className="self-start" disabled={disabled} onClick={() => onSave(v)}>{saveLabel}</Button>}
    </div>
  );
}
