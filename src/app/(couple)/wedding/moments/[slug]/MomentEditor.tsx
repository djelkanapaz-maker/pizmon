'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { canConfirm, type SelectionState } from '@/core/moments';
import { restrictionFor, type Restriction } from '@/core/restrictions';
import { confirmSelection, saveSelection } from '@/server/actions/couple';
import { useToast } from '@/components/overlay';
import { Badge, Button, Chip, Cover, Field, Input, Textarea, cx } from '@/components/ui';
import { PlayToggle } from '@/components/audio/MiniPlayer';
import { IconCheck, IconDiscover, IconPlus, IconX, IconBan } from '@/components/icons';
import { STATUS_TONE } from '@/components/music/status';
import { playableSource } from '@/components/music/listening';
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
  const [custom, setCustom] = useState(selection?.custom_song ?? '');
  const [notes, setNotes] = useState(selection?.notes ?? '');
  const state: SelectionState = selection
    ? { status: selection.status, primary_track_id: selection.primary_track_id, backup_track_id: selection.backup_track_id, custom_song: selection.custom_song, shortlist: selection.shortlist }
    : { status: 'not_started', primary_track_id: null, backup_track_id: null, custom_song: null, shortlist: [] };
  const all = new Map<string, Track>([...known, ...suggestions.map((s) => s.track)].map((t) => [t.id, t]));
  const primary = state.primary_track_id ? all.get(state.primary_track_id) : null;
  const backup = state.backup_track_id ? all.get(state.backup_track_id) : null;
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

  const slot = (label: string, t: Track | null | undefined, field: 'primary_track_id' | 'backup_track_id') => (
    <div className="flex items-center gap-3 min-h-14">
      {t ? (
        <>
          <Cover seed={t.id} label={t.title} src={t.artwork_url} size={48} />
          <div className="min-w-0 flex-1">
            <p className="label">{label}</p>
            <p className="font-bold truncate" dir="auto">{t.title}</p>
            <p className="text-sm text-paper-dim truncate" dir="auto">{t.artist?.name}</p>
          </div>
          {playableSource(t) && <PlayToggle source={playableSource(t)!} size="sm" />}
          <button type="button" disabled={busy} onClick={() => save({ [field]: null })} aria-label={`${m.common.remove}: ${t.title}`} className="size-10 grid place-items-center rounded-full hover:bg-ink-3"><IconX size={18} /></button>
        </>
      ) : (
        <div className="flex-1 rounded-[12px] border border-dashed border-line h-14 px-4 flex items-center text-paper-dim text-sm">{label} — {m.common.notSet}</div>
      )}
    </div>
  );

  const row = (t: Track) => {
    const r = restrictionFor(t, ctx.restrictions as Restriction[]);
    const blocked = r?.kind === 'never_play' && r.strength === 'absolute';
    const inShort = state.shortlist.includes(t.id);
    const src = playableSource(t);
    return (
      <li key={t.id} className="flex items-center gap-3 py-2.5 border-b border-line/50 last:border-0">
        <Cover seed={t.id} label={t.title} src={t.artwork_url} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-bold truncate" dir="auto">{t.title}</p>
          <p className="text-sm text-paper-dim truncate" dir="auto">{t.artist?.name}</p>
          {blocked && <Badge tone="danger" className="mt-1"><IconBan size={12} />{m.discover.neverBlocked}</Badge>}
        </div>
        {src && <PlayToggle source={src} size="sm" />}
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" variant={state.primary_track_id === t.id ? 'gold' : 'secondary'} disabled={busy || blocked || state.primary_track_id === t.id} onClick={() => save({ primary_track_id: t.id })}>
            {state.primary_track_id === t.id ? <IconCheck size={14} /> : null}{m.moments.primary}
          </Button>
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
          {slot(m.moments.primary, primary, 'primary_track_id')}
          {slot(m.moments.backup, backup, 'backup_track_id')}
          <form className="flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); save({ custom_song: custom }); }}>
            <Field label={m.moments.custom} htmlFor="custom"><Input id="custom" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={m.moments.customHint} maxLength={200} dir="auto" /></Field>
            <Button type="submit" variant="secondary" disabled={busy || custom === (selection?.custom_song ?? '')}>{m.common.save}</Button>
          </form>
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
          <div className="flex gap-2 mt-3 flex-wrap">
            {shortlist.filter((t) => t.id !== state.primary_track_id).slice(0, 3).map((t) => (
              <Chip key={t.id} onClick={() => save({ backup_track_id: t.id })} selected={state.backup_track_id === t.id}>{m.moments.setBackup}: {t.title}</Chip>
            ))}
          </div>
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
