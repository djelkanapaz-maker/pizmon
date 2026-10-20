import { notFound } from 'next/navigation';
import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { PageHeader } from '@/components/ui';
import { DjEditForm } from '../DjForms';

export default async function AdminDj({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireRole('admin');
  const { m } = await getI18n();
  const db = await supabaseServer();
  const { data: dj } = await db.from('djs').select('id, display_name, bio_he, bio_en, specialties, photo_url, is_active, accepts_new_couples, sort_order, user_id').eq('id', id).eq('company_id', s.company.id).maybeSingle();
  if (!dj) notFound();
  return (
    <div>
      <PageHeader back={{ href: '/admin/djs', label: m.admin.djs }} title={dj.display_name} />
      <div className="gutter max-w-2xl"><DjEditForm dj={dj} /></div>
    </div>
  );
}
