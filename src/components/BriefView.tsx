import type { Brief } from '@/core/brief';
import type { Messages } from '@/i18n/en';
import { Badge, cx } from './ui';
import { IconBan, IconCheck, IconStar } from './icons';
import { STATUS_TONE } from './music/status';

const Chips = ({ items, tone = 'neutral' }: { items: string[]; tone?: 'neutral' | 'gold' | 'danger' | 'ember' }) =>
  items.length ? <div className="flex flex-wrap gap-1.5">{items.map((x) => <Badge key={x} tone={tone} className="h-7 text-[13px]">{x}</Badge>)}</div> : <span className="text-paper-dim">—</span>;

const Meter = ({ value, label }: { value: number | null; label: string }) => (
  <div>
    <div className="flex justify-between text-sm mb-1.5"><span className="text-paper-dim">{label}</span><span className="font-bold tabular">{value ?? '—'}{value !== null ? '/5' : ''}</span></div>
    <div className="flex gap-1" aria-hidden>{[1, 2, 3, 4, 5].map((n) => <span key={n} className={cx('h-2 flex-1 rounded-full', value && n <= value ? 'bg-ember' : 'bg-ink-3')} />)}</div>
  </div>
);

/** The structured musical brief. Used by couples (review) and DJs (dashboard header). */
export function BriefView({ brief, m, compact }: { brief: Brief; m: Messages; compact?: boolean }) {
  const b = m.brief;
  return (
    <div className="flex flex-col gap-4">
      {/* restrictions first: they must never be overlooked */}
      {(brief.neverPlayAbsolute.length > 0 || brief.mustPlay.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          <section className="card p-4 border-danger/60">
            <h3 className="display text-lg text-danger flex items-center gap-2 mb-3"><IconBan size={18} />{b.neverPlay}</h3>
            {brief.neverPlayAbsolute.length ? (
              <ul className="flex flex-col gap-1.5">{brief.neverPlayAbsolute.map((x, i) => (
                <li key={i} className="font-bold" dir="auto">{x.label}{x.reason && <span className="block text-sm font-normal text-paper-dim">{x.reason}</span>}</li>
              ))}</ul>
            ) : <span className="text-paper-dim">—</span>}
            {brief.neverPlayPreference.length > 0 && (
              <div className="mt-3 pt-3 border-t border-line"><p className="label mb-2">{b.neverPref}</p><Chips items={brief.neverPlayPreference.map((x) => x.label)} /></div>
            )}
          </section>
          <section className="card p-4 border-gold/60">
            <h3 className="display text-lg text-gold flex items-center gap-2 mb-3"><IconStar size={18} />{b.mustPlay}</h3>
            {brief.mustPlay.length ? (
              <ul className="flex flex-col gap-1.5">{brief.mustPlay.map((x, i) => (
                <li key={i} className="flex items-start gap-2"><span className="font-bold flex-1" dir="auto">{x.label}</span>{x.strength === 'absolute' && <Badge tone="gold">{m.restrictions.absolute}</Badge>}</li>
              ))}</ul>
            ) : <span className="text-paper-dim">—</span>}
          </section>
        </div>
      )}

      <section className="card p-4 md:p-5">
        <h3 className="display text-lg mb-4">{b.personality}</h3>
        <dl className="grid md:grid-cols-2 gap-x-6 gap-y-4">
          <div><dt className="label mb-1.5">{b.vibes}</dt><dd><Chips items={brief.vibes} tone="ember" /></dd></div>
          <div><dt className="label mb-1.5">{b.genresLove}</dt><dd><Chips items={brief.favoriteGenres} tone="gold" /></dd></div>
          <div><dt className="label mb-1.5">{b.genresAvoid}</dt><dd><Chips items={brief.dislikedGenres} /></dd></div>
          <div><dt className="label mb-1.5">{b.artists}</dt><dd><Chips items={brief.favoriteArtists} /></dd></div>
          <div><dt className="label mb-1.5">{b.eras}</dt><dd><Chips items={brief.eras} /></dd></div>
          <div><dt className="label mb-1.5">{b.traditions}</dt><dd><Chips items={brief.traditions} /></dd></div>
          <div><dt className="label mb-1.5">{b.languages}</dt><dd><Chips items={brief.languages} /></dd></div>
          <div><dt className="label mb-1.5">{b.israeli}</dt><dd className="font-bold tabular">{brief.israeliShare !== null ? `${brief.israeliShare}%` : '—'}</dd></div>
        </dl>
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="card p-4 md:p-5">
          <h3 className="display text-lg mb-4">{b.energy}</h3>
          {brief.energyCurve.some((p) => p.value) ? (
            <div className="flex items-end gap-2 h-32" role="img" aria-label={brief.energyCurve.map((p) => `${p.phase}: ${p.value || '—'}`).join(', ')}>
              {brief.energyCurve.map((p) => (
                <div key={p.phase} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                  <span className="text-xs font-bold tabular">{p.value || '—'}</span>
                  <div className="w-full rounded-t-[8px] bg-ember" style={{ height: `${(p.value / 5) * 100}%`, minHeight: p.value ? 6 : 2, opacity: p.value ? 1 : 0.2 }} />
                  <span className="text-[10px] text-paper-dim text-center leading-tight h-6">{p.phase}</span>
                </div>
              ))}
            </div>
          ) : <span className="text-paper-dim">—</span>}
        </section>
        <section className="card p-4 md:p-5 flex flex-col gap-3">
          <Meter value={brief.singalong} label={b.singalong} />
          <Meter value={brief.adventurous} label={b.adventurous} />
          <Meter value={brief.mainstream} label={b.mainstream} />
          <Meter value={brief.discovery} label={b.discovery} />
        </section>
      </div>

      {brief.pairs.length > 0 && (
        <section className="card p-4 md:p-5">
          <h3 className="display text-lg mb-3">{b.references}</h3>
          <ul className="grid sm:grid-cols-2 gap-2">{brief.pairs.map((p) => (
            <li key={p.question} className="rounded-[12px] bg-ink-3 px-3 py-2 text-sm"><span className="text-paper-dim">{p.question}</span><span className="block font-bold">→ {p.choice}</span></li>
          ))}</ul>
        </section>
      )}

      <section className="card p-4 md:p-5">
        <h3 className="display text-lg mb-3">{b.moments}</h3>
        <ul className="flex flex-col divide-y divide-line">
          {brief.moments.map((mo) => (
            <li key={mo.name} className="py-2.5 flex items-start gap-3">
              <span className={cx('mt-0.5 size-5 rounded-full grid place-items-center shrink-0', mo.status === 'confirmed' ? 'bg-gold text-ink' : 'border border-line')}>{mo.status === 'confirmed' && <IconCheck size={12} />}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold">{mo.name}{!mo.required && <span className="text-xs text-paper-dim font-normal"> · {m.moments.optional}</span>}</p>
                {mo.song && <p className="text-sm" dir="auto">{mo.song}</p>}
                {mo.backup && <p className="text-xs text-paper-dim" dir="auto">{m.moments.backup}: {mo.backup}</p>}
              </div>
              <Badge tone={STATUS_TONE[mo.status]}>{m.moments.status[mo.status]}</Badge>
            </li>
          ))}
        </ul>
      </section>

      {(brief.familyNotes || brief.djNotes) && (
        <div className="grid md:grid-cols-2 gap-4">
          {brief.familyNotes && <section className="card p-4"><h3 className="label mb-2">{b.family}</h3><p className="whitespace-pre-wrap" dir="auto">{brief.familyNotes}</p></section>}
          {brief.djNotes && <section className="card p-4"><h3 className="label mb-2">{b.djNotes}</h3><p className="whitespace-pre-wrap" dir="auto">{brief.djNotes}</p></section>}
        </div>
      )}

      {!compact && (
        <section className={cx('card p-4 md:p-5', brief.unresolved.length ? 'border-ember/60' : 'border-ok/50')}>
          <h3 className="display text-lg mb-3">{b.unresolved}</h3>
          {brief.unresolved.length ? <Chips items={brief.unresolved} tone="ember" /> : <p className="text-ok font-bold">{m.questionnaire.noUnresolved}</p>}
        </section>
      )}
    </div>
  );
}
