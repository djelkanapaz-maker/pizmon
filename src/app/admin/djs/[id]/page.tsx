import { notFound } from 'next/navigation';
import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { PageHeader } from '@/components/ui';
import { DjEditForm } from '../DjForms';
import { CalendarSettings } from '@/components/meeting/CalendarSettings';
import { parseHours } from '@/core/slots';
import { googleConfigured } from '@/server/google';

export default async function AdminDj({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ google?: string }> }) {
  const { id } = await params;
  const status = (await searchParams).google;
  const s = await requireRole('admin');
  const { m } = await getI18n();
  const db = await supabaseServer();
  const { data: dj } = await db.from('djs').select('id, display_name, bio_he, bio_en, specialties, photo_url, logo_url, links, is_active, accepts_new_couples, sort_order, user_id, meeting_hours').eq('id', id).eq('company_id', s.company.id).maybeSingle();
  if (!dj) notFound();
  const { data: conn } = await db.rpc('google_connection_status', { p_dj: id });
  const email = ((conn ?? []) as { google_email: string }[])[0]?.google_email ?? null;
  return (
    <div>
      <PageHeader back={{ href: '/admin/djs', label: m.admin.djs }} title={dj.display_name} />
      <div className="gutter max-w-2xl flex flex-col gap-6">
        <CalendarSettings djId={dj.id} connectedEmail={email} hours={parseHours(dj.meeting_hours)} configured={googleConfigured()}
          status={status && /^[a-z_]{1,20}$/.test(status) ? status : undefined} connectHref={`/api/google/connect?dj=${dj.id}`} />
        <DjEditForm dj={dj} />
      </div>
    </div>
  );
}
