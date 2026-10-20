'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { addInternalNote, askCouple, deleteInternalNote, markReviewed, recommend, deleteRecommendation } from '@/server/actions/staff';
import { replyToRequest, setRequestStatus } from '@/server/actions/couple';
import { useToast } from '@/components/overlay';
import { Button, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui';
import { CatalogPicker, type Picked } from '@/components/CatalogPicker';
import { IconCheck, IconTrash } from '@/components/icons';

const useAct = () => {
  const { m } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string, after?: () => void) => start(async () => {
    const r = await fn();
    if (!r.ok) return toast((m.errors as Record<string, string>)[(r as { error: string }).error] ?? m.common.error, 'error');
    if (okMsg) toast(okMsg);
    after?.(); router.refresh();
  });
  return { busy, run, m };
};

export function MarkReviewedButton({ eventId }: { eventId: string }) {
  const { busy, run, m } = useAct();
  return <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => markReviewed(eventId), m.common.saved)}><IconCheck size={16} />{m.dj.markReviewed}</Button>;
}

export function RecommendForm({ eventId, moments, blockedTrackIds }: { eventId: string; moments: { id: string; label: string }[]; blockedTrackIds: string[] }) {
  const { busy, run, m } = useAct();
  const [track, setTrack] = useState<Picked | null>(null);
  const [moment, setMoment] = useState('');
  const [message, setMessage] = useState('');
  const blocked = !!track && blockedTrackIds.includes(track.id);
  return (
    <form className="card p-4 flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault();
      run(() => recommend(eventId, { track_id: track?.id, moment_id: moment, message }), m.dj.recommendSent, () => { setTrack(null); setMessage(''); setMoment(''); });
    }}>
      <h3 className="display text-lg">{m.dj.recommend}</h3>
      <CatalogPicker type="track" value={track} onPick={setTrack} label={m.dj.recommend} />
      {blocked && <ErrorNote>{m.dj.blockedTrack}</ErrorNote>}
      <Field label={m.dj.recommendForMoment} htmlFor="rec-m">
        <Select id="rec-m" value={moment} onChange={(e) => setMoment(e.target.value)}><option value="">—</option>{moments.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select>
      </Field>
      <Field label={m.dj.recommendMessage} htmlFor="rec-msg"><Textarea id="rec-msg" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} className="min-h-20" dir="auto" /></Field>
      <Button type="submit" disabled={busy || blocked || (!track && !message.trim())}>{m.common.send}</Button>
    </form>
  );
}

export function DeleteRecButton({ recId, eventId }: { recId: string; eventId: string }) {
  const { busy, run, m } = useAct();
  return <button type="button" disabled={busy} onClick={() => run(() => deleteRecommendation(recId, eventId))} aria-label={m.common.delete} className="size-9 grid place-items-center rounded-full hover:bg-ink-3 text-paper-dim"><IconTrash size={16} /></button>;
}

export function AskCoupleForm({ eventId, moments }: { eventId: string; moments: { id: string; label: string }[] }) {
  const { busy, run, m } = useAct();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [moment, setMoment] = useState('');
  return (
    <form className="card p-4 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); run(() => askCouple(eventId, { title, description: body, moment_id: moment }), m.common.saved, () => { setTitle(''); setBody(''); }); }}>
      <h3 className="display text-lg">{m.dj.clarify}</h3>
      <Field label={m.dj.clarifyTitle} htmlFor="ask-t"><Input id="ask-t" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required dir="auto" /></Field>
      <Field label={m.dj.clarifyBody} htmlFor="ask-b"><Textarea id="ask-b" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} className="min-h-20" dir="auto" /></Field>
      <Field label={m.requests.moment} htmlFor="ask-m"><Select id="ask-m" value={moment} onChange={(e) => setMoment(e.target.value)}><option value="">—</option>{moments.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select></Field>
      <Button type="submit" disabled={busy || !title.trim()}>{m.common.send}</Button>
    </form>
  );
}

export function NoteForm({ eventId }: { eventId: string }) {
  const { busy, run, m } = useAct();
  const [body, setBody] = useState('');
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); run(() => addInternalNote(eventId, body), m.common.saved, () => setBody('')); }}>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={m.dj.notePlaceholder} aria-label={m.dj.addNote} maxLength={8000} dir="auto" />
      <Button type="submit" disabled={busy || !body.trim()} className="self-start">{m.dj.addNote}</Button>
    </form>
  );
}

export function DeleteNoteButton({ noteId, eventId }: { noteId: string; eventId: string }) {
  const { busy, run, m } = useAct();
  return <button type="button" disabled={busy} onClick={() => run(() => deleteInternalNote(noteId, eventId))} aria-label={m.common.delete} className="size-9 grid place-items-center rounded-full hover:bg-ink-3 text-paper-dim"><IconTrash size={16} /></button>;
}

export function RequestReply({ requestId, status }: { requestId: string; status: string }) {
  const { busy, run, m } = useAct();
  const [body, setBody] = useState('');
  const closed = status === 'resolved' || status === 'closed';
  return (
    <div className="flex flex-col gap-2 mt-3">
      {!closed && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => replyToRequest(requestId, body), undefined, () => setBody('')); }}>
          <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder={m.requests.replyPlaceholder} aria-label={m.requests.reply} maxLength={4000} dir="auto" />
          <Button type="submit" disabled={busy || !body.trim()}>{m.requests.reply}</Button>
        </form>
      )}
      <div>
        <Button size="sm" variant="ghost" className="border border-line" disabled={busy} onClick={() => run(() => setRequestStatus(requestId, closed ? 'open' : 'resolved'))}>
          {closed ? m.requests.reopen : m.requests.markResolved}
        </Button>
      </div>
    </div>
  );
}
