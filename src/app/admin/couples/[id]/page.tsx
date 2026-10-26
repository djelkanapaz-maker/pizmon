import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { formatDateTime } from '@/i18n/format';
import { getEvent } from '@/server/queries';
import { Badge } from '@/components/ui';
import { IconChevron } from '@/components/icons';
import { CoupleWorkspace, WORKSPACE_TABS, type WorkspaceTab } from '@/components/staff/CoupleWorkspace';
import { AssignmentPanel, DeleteCouplePanel, LoginPanel } from './AdminCouplePanels';

export default async function AdminCouple({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requireRole('admin');
  const event = await getEvent(id);
  if (!event || event.company_id !== s.company.id) notFound();
  const { m, locale } = await getI18n();
  const db = await supabaseServer();
  const [{ data: history }, { data: djs }, { data: members }] = await Promise.all([
    db.from('dj_assignments').select('id, status, source, created_at, decided_at, note, dj:djs(id, display_name)').eq('event_id', id).order('created_at', { ascending: false }),
    db.from('djs').select('id, display_name, is_active').eq('company_id', s.company.id).eq('is_active', true).order('sort_order'),
    db.from('couple_members').select('user_id, created_at').eq('event_id', id),
  ]);
  const userIds = (members ?? []).map((x) => x.user_id as string);
  const { data: profiles } = userIds.length ? await db.from('profiles').select('id, email, full_name').in('id', userIds) : { data: [] };
  const tab = (WORKSPACE_TABS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as WorkspaceTab) : 'brief';
  type H = { id: string; status: string; source: string; created_at: string; decided_at: string | null; note: string | null; dj: { id: string; display_name: string } | null };
  const rows = (history ?? []) as unknown as H[];
  const active = rows.find((r) => ['proposed', 'pending_approval', 'confirmed'].includes(r.status)) ?? null;

  return (
    <div>
      <div className="gutter pt-4"><Link href="/admin/couples" className="inline-flex items-center gap-1 text-sm font-bold text-paper-dim hover:text-paper"><IconChevron size={16} className="rotate-180" />{m.admin.couples}</Link></div>
      <section className="gutter pt-4 grid lg:grid-cols-2 gap-4">
        <AssignmentPanel eventId={id} active={active ? { id: active.id, status: active.status, djName: active.dj?.display_name ?? '', djId: active.dj?.id ?? '' } : null} djs={(djs ?? []) as { id: string; display_name: string }[]} />
        <LoginPanel eventId={id} logins={(profiles ?? []).map((p) => ({ userId: p.id as string, email: p.email as string, name: p.full_name as string | null }))} />
      </section>
      {rows.length > 0 && (
        <details className="gutter mt-4">
          <summary className="label cursor-pointer">{m.admin.history} ({rows.length})</summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {rows.map((r) => <li key={r.id} className="flex gap-2 flex-wrap"><Badge>{r.status}</Badge><span>{r.dj?.display_name}</span><span className="text-paper-dim">{r.source} · {formatDateTime(r.created_at, locale)}{r.note ? ` · ${r.note}` : ''}</span></li>)}
          </ul>
        </details>
      )}
      <CoupleWorkspace eventId={id} companyId={s.company.id} tab={tab} basePath={`/admin/couples/${id}`} viewer={{ userId: s.userId, djId: null, isAdmin: true }} />
      <section className="gutter py-8">
        <DeleteCouplePanel eventId={id} names={[event.partner_one_name, event.partner_two_name].filter(Boolean).join(' & ')} />
      </section>
    </div>
  );
}
