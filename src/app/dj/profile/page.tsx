import { requireDj } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { PageHeader, Portrait } from '@/components/ui';
import { DjProfileForm } from './DjProfileForm';

export default async function DjProfilePage() {
  const s = await requireDj();
  const { m } = await getI18n();
  const db = await supabaseServer();
  const { data: dj } = await db.from('djs').select('display_name, bio_he, bio_en, specialties, photo_url, accepts_new_couples').eq('id', s.djId).single();
  return (
    <div>
      <PageHeader title={m.profile.title} sub={s.email} />
      <div className="gutter max-w-2xl flex flex-col gap-6">
        <Portrait name={dj?.display_name ?? ''} src={dj?.photo_url} size={120} />
        {dj && <DjProfileForm dj={dj} />}
      </div>
    </div>
  );
}
