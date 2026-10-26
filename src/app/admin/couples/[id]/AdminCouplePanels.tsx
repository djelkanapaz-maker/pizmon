'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { adminActivationLink, adminAddPartner, adminAssignDj, adminDecideAssignment, adminDeleteCouple, adminRemoveCoupleLogin } from '@/server/actions/admin-people';
import { useToast } from '@/components/overlay';
import { Badge, Button, Input, Select } from '@/components/ui';
import { ActivationLinkBox } from '@/components/ActivationLinkBox';

const useRun = () => {
  const { m } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [busy, start] = useTransition();
  return { m, busy, run: <T,>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, onOk?: (d: T) => void) => start(async () => {
    const r = await fn();
    if (!r.ok) return toast((m.errors as Record<string, string>)[r.error] ?? m.common.error, 'error');
    toast(m.common.saved); onOk?.(r.data); router.refresh();
  }) };
};

export function AssignmentPanel({ eventId, active, djs }: { eventId: string; active: { id: string; status: string; djName: string; djId: string } | null; djs: { id: string; display_name: string }[] }) {
  const { m, busy, run } = useRun();
  const [dj, setDj] = useState(active?.djId ?? '');
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="card p-4 flex flex-col gap-3">
      <p className="label">{m.admin.assignment}</p>
      {active ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="display text-xl">{active.djName}</span>
          <Badge tone={active.status === 'confirmed' ? 'gold' : 'ember'}>{active.status === 'confirmed' ? m.admin.assignmentConfirmed : active.status === 'pending_approval' ? m.home.djPending : m.home.djProposed}</Badge>
        </div>
      ) : <p className="text-paper-dim">{m.admin.unassigned}</p>}
      {active?.status === 'pending_approval' && (
        <div className="rounded-[12px] border border-ember/50 p-3 flex flex-col gap-2">
          <p className="text-sm font-bold">{m.admin.pendingApproval.replace('{dj}', `\u2068${active.djName}\u2069`)}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="gold" disabled={busy} onClick={() => run(() => adminDecideAssignment(active.id, true))}>{m.admin.approve}</Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => run(() => adminDecideAssignment(active.id, false))}>{m.admin.decline}</Button>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Select value={dj} onChange={(e) => setDj(e.target.value)} aria-label={m.admin.assignDj}>
          <option value="">—</option>{djs.map((d) => <option key={d.id} value={d.id}>{d.display_name}</option>)}
        </Select>
        <Button disabled={busy || !dj} onClick={() => run(() => adminAssignDj(eventId, dj, confirm))}>{m.admin.assignNow}</Button>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-ember" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />{m.admin.confirmDirectly}</label>
    </div>
  );
}

export function LoginPanel({ eventId, logins }: { eventId: string; logins: { userId: string; email: string; name: string | null }[] }) {
  const { m, busy, run } = useRun();
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [link, setLink] = useState<{ link: string; emailSent?: boolean } | null>(null);
  const [partner, setPartner] = useState('');
  return (
    <div className="card p-4 flex flex-col gap-3">
      <p className="label">{m.profile.account}</p>
      <ul className="text-sm flex flex-col gap-2">
        {logins.map((l) => (
          <li key={l.userId} className="flex items-center justify-between gap-2 flex-wrap">
            <span dir="ltr" className="font-bold">{l.email}</span>
            {confirmRemove === l.userId ? (
              <span className="flex items-center gap-2">
                <span className="text-paper-dim">{m.admin.removeLoginConfirm}</span>
                <Button size="sm" variant="danger" disabled={busy} onClick={() => run(() => adminRemoveCoupleLogin(eventId, l.userId), () => setConfirmRemove(null))}>{m.common.remove}</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRemove(null)}>{m.common.cancel}</Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" className="border border-line" disabled={busy} onClick={() => setConfirmRemove(l.userId)}>{m.admin.removeLogin}</Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => adminActivationLink({ eventId }), (d) => setLink(d))}>{m.admin.newLink}</Button>
      </div>
      {link && <ActivationLinkBox link={link.link} emailSent={link.emailSent} />}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => adminAddPartner(eventId, partner), (d) => { setLink({ link: d.link }); setPartner(''); }); }}>
        <Input type="email" value={partner} onChange={(e) => setPartner(e.target.value)} placeholder={m.admin.addPartner} aria-label={m.admin.addPartner} dir="ltr" />
        <Button type="submit" size="md" variant="ghost" className="border border-line" disabled={busy || !partner}>{m.common.add}</Button>
      </form>
    </div>
  );
}

export function DeleteCouplePanel({ eventId, names }: { eventId: string; names: string }) {
  const { m } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [typed, setTyped] = useState('');
  const [open, setOpen] = useState(false);
  const word = m.admin.deleteCoupleWord;
  return (
    <div className="card p-4 flex flex-col gap-3 border border-ember/50">
      <p className="label">{m.admin.deleteCouple}</p>
      <p className="text-sm text-paper-dim">{m.admin.deleteCoupleHint.replace('{names}', `\u2068${names}\u2069`)}</p>
      {!open ? (
        <div><Button size="sm" variant="danger" onClick={() => setOpen(true)}>{m.admin.deleteCouple}</Button></div>
      ) : (
        <form className="flex flex-col gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim() !== word) return;
          start(async () => {
            const r = await adminDeleteCouple(eventId);
            if (!r.ok) return toast((m.errors as Record<string, string>)[r.error] ?? m.common.error, 'error');
            toast(m.admin.coupleDeleted);
            router.push('/admin/couples');
            router.refresh();
          });
        }}>
          <label htmlFor="delete-confirm" className="text-sm font-bold">{m.admin.deleteCoupleType.replace('{word}', word)}</label>
          <div className="flex gap-2 flex-wrap">
            <Input id="delete-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            <Button type="submit" size="md" variant="danger" disabled={busy || typed.trim() !== word}>{busy ? m.common.saving : m.admin.deleteForever}</Button>
            <Button type="button" size="md" variant="ghost" disabled={busy} onClick={() => { setOpen(false); setTyped(''); }}>{m.common.cancel}</Button>
          </div>
        </form>
      )}
    </div>
  );
}
