import { requireDj } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { PageHeader, Portrait } from '@/components/ui';
import { parseHours } from '@/core/slots';
import { googleConfigured } from '@/server/google';
import { CalendarSettings } from '@/components/meeting/CalendarSettings';
import { DjProfileForm } from './DjProfileForm';
import { AccountDeletion } from '@/components/AccountDeletion';

export default async function DjProfilePage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const s = await requireDj();
  const { m } = await getI18n();
  const db = await supabaseServer();
  const status = (await searchParams).google;
  const [{ data: dj }, { data: conn }] = await Promise.all([
    db.from('djs').select('display_name, bio_he, bio_en, specialties, photo_url, accepts_new_couples, meeting_hours').eq('id', s.djId).single(),
    db.rpc('google_connection_status', { p_dj: s.djId }),
  ]);
  const email = ((conn ?? []) as { google_email: string }[])[0]?.google_email ?? null;
  return (
    <div>
      <PageHeader title={m.profile.title} sub={s.email} />
      <div className="gutter max-w-2xl flex flex-col gap-6">
        <Portrait name={dj?.display_name ?? ''} src={dj?.photo_url} size={120} />
        <CalendarSettings djId={s.djId!} connectedEmail={email} hours={parseHours(dj?.meeting_hours)} configured={googleConfigured()}
          status={status && /^[a-z_]{1,20}$/.test(status) ? status : undefined} connectHref="/api/google/connect" />
        {dj && <DjProfileForm dj={dj} />}
        <AccountDeletion />
      </div>
    </div>
  );
}
