import Link from 'next/link';
import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { Badge, DemoBadge, PageHeader, Portrait } from '@/components/ui';
import { NewDjButton } from './DjForms';

export default async function AdminDjs() {
  const s = await requireRole('admin');
  const { m } = await getI18n();
  const db = await supabaseServer();
  const { data } = await db.from('djs').select('id, display_name, specialties, photo_url, is_active, accepts_new_couples, user_id, is_demo, dj_assignments(status)').eq('company_id', s.company.id).order('sort_order');
  type Row = { id: string; display_name: string; specialties: string[]; photo_url: string | null; is_active: boolean; accepts_new_couples: boolean; user_id: string | null; is_demo: boolean; dj_assignments: { status: string }[] };
  return (
    <div>
      <PageHeader title={m.admin.djs} actions={<NewDjButton />} />
      <ul className="gutter grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {((data ?? []) as unknown as Row[]).map((d) => (
          <li key={d.id}>
            <Link href={`/admin/djs/${d.id}`} className="card p-4 flex items-center gap-4 hover:border-paper-dim h-full">
              <Portrait name={d.display_name} src={d.photo_url} size={64} />
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{d.display_name}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {!d.is_active && <Badge tone="danger">{m.admin.active}: ✕</Badge>}
                  {!d.accepts_new_couples && <Badge>{m.admin.acceptsNew}: ✕</Badge>}
                  {!d.user_id && <Badge tone="ember">{m.admin.linkAccount}</Badge>}
                  <Badge>{m.admin.couples}: {d.dj_assignments.filter((a) => a.status === 'confirmed').length}</Badge>
                  {d.is_demo && <DemoBadge label={m.common.demo} />}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
