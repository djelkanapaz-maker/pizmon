'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { canConfirm, type SelectionState } from '@/core/moments';
import { restrictionFor, type Restriction } from '@/core/restrictions';
import { confirmSelection, saveSelection } from '@/server/actions/couple';
import { useToast } from '@/components/overlay';
import { Badge, Button, Chip, Cover, Field, Textarea, cx } from '@/components/ui';
import { TrackPlay } from '@/components/music/TrackPlay';
import { IconCheck, IconDiscover, IconPlus, IconX, IconBan } from '@/components/icons';
import { STATUS_TONE } from '@/components/music/status';
import type { TrackContext } from '@/components/music/TrackList';
import { relativeTime } from '@/i18n/format';
import type { Moment, Selection, Track } from '@/server/queries';

export function MomentEditor({ moment, selection, suggestions, known, ctx }: {
  moment: Moment; selection: Selection | null; suggestions: { collection: 'he' | 'intl' | null; track: Track }[]; known: Track[]; ctx: TrackContext;
}) {
  const { m, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const [collection, setCollection] = useState<'he' | 'intl'>('he');
  const [notes, setNotes] = useState(selection?.notes ?? '');
  const state: SelectionState = selection
    ? { status: selection.status, primary_track_id: selection.primary_track_id, backup_track_id: selection.backup_track_id, custom_song: selection.custom_song, shortlist: selection.shortlist,
        split: !!selection.split, second_track_id: selection.second_track_id ?? null, second_custom_song: selection.second_custom_song ?? null }
    : { status: 'not_started', primary_track_id: null, backup_track_id: null, custom_song: null, shortlist: [], split: false, second_track_id: null, second_custom_song: null };
  const split = !!moment.allows_split && !!state.split;
  const all = new Map<string, Track>([...known, ...suggestions.map((s) => s.track)].map((t) => [t.id, t]));
  const errMsg = (code: string) => (m.errors as Record<string, string>)[code] ?? m.common.error;

  const save = (patch: Record<string, unknown>) => start(async () => {
    const r = await saveSelection(moment.id, patch);
    if (!r.ok) return toast(errMsg(r.error), 'error');
    toast(m.common.saved); router.refresh();
  });
  const confirm = () => start(async () => {
    const r = await confirmSelection(moment.id);
    if (!r.ok) return toast(errMsg(r.error), 'error');
    toast(m.moments.status.confirmed); router.refresh();
  });

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

  const row = (t: Track) => {
    const r = restrictionFor(t, ctx.restrictions as Restriction[]);
    const blocked = r?.kind === 'never_play' && r.strength === 'absolute';
    const inShort = state.shortlist.includes(t.id);
    return (
      <li key={t.id} className="flex items-center gap-3 py-2.5 border-b border-line/50 last:border-0">
        <Cover seed={t.id} label={t.title} src={t.artwork_url} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-bold truncate" dir="auto">{t.title}</p>
          <p className="text-sm text-paper-dim truncate" dir="auto">{t.artist?.name}</p>
          {blocked && <Badge tone="danger" className="mt-1"><IconBan size={12} />{m.discover.neverBlocked}</Badge>}
        </div>
        <TrackPlay track={t} />
        <div className="flex gap-1.5 shrink-0">
          {(split ? [['primary_track_id', m.moments.forGroom], ['second_track_id', m.moments.forBride]] as const : [['primary_track_id', m.moments.choose]] as const).map(([field, lbl]) => {
            const on = state[field] === t.id;
            return (
              <Button key={field} size="sm" variant={on ? 'gold' : 'secondary'} disabled={busy || blocked || on} onClick={() => save({ [field]: t.id })}>
                {on ? <IconCheck size={14} /> : null}{lbl}
              </Button>
            );
          })}
          <button type="button" disabled={busy || blocked} onClick={() => save(inShort ? { removeShortlist: t.id } : { addShortlist: t.id })}
            aria-pressed={inShort} aria-label={`${inShort ? m.moments.removeShortlist : m.moments.addShortlist}: ${t.title}`}
            className={cx('size-9 grid place-items-center rounded-full border', inShort ? 'bg-paper text-ink border-paper' : 'border-line hover:border-paper-dim')}>
            {inShort ? <IconCheck size={16} /> : <IconPlus size={16} />}
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="gutter">
        <div className={cx('card p-4 md:p-5 flex flex-col gap-4', state.status === 'confirmed' && 'border-gold shadow-[var(--shadow-hard-gold)]')}>
          <div className="flex items-center justify-between gap-3">
            <Badge tone={STATUS_TONE[state.status]}>{m.moments.status[state.status]}</Badge>
            {selection?.confirmed_at && state.status === 'confirmed' && <span className="text-xs text-paper-dim">{m.moments.confirmedAt.replace('{time}', relativeTime(selection.confirmed_at, locale))}</span>}
          </div>
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
          {state.status === 'confirmed' && <p className="text-sm text-gold">{m.moments.changeWarning}</p>}
          {canConfirm(state) && (
            <Button size="lg" variant="gold" onClick={confirm} disabled={busy}><IconCheck size={18} />{m.moments.confirm}</Button>
          )}
        </div>
      </section>

      {shortlist.length > 0 && (
        <section className="gutter">
          <h2 className="display-m mb-3">{m.moments.shortlist}</h2>
          <ul className="card px-4">{shortlist.map(row)}</ul>
        </section>
      )}

      <section className="gutter">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="display-m">{m.moments.curated}</h2>
          {moment.has_language_collections && (
            <div className="flex gap-2" role="group">
              <Chip selected={collection === 'he'} onClick={() => setCollection('he')}>{m.moments.he}</Chip>
              <Chip selected={collection === 'intl'} onClick={() => setCollection('intl')}>{m.moments.intl}</Chip>
            </div>
          )}
        </div>
        {visible.length ? <ul className="card px-4">{visible.map((s) => row(s.track))}</ul> : <p className="text-paper-dim">{m.discover.noResults}</p>}
        <Link href={`/discover?moment=${moment.id}`} className="mt-4 inline-flex items-center gap-2 font-bold text-sm text-paper-dim hover:text-paper"><IconDiscover size={16} />{m.discover.title}</Link>
      </section>
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
