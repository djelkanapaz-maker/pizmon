import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { PageHeader } from '@/components/ui';
import { SettingsForm, type Settings } from './SettingsForm';

export default async function SettingsAdmin() {
  const s = await requireRole('admin');
  const { m } = await getI18n();
  const db = await supabaseServer();
  // read fresh (the session copy is per-request but may predate a save in this request chain)
  const { data } = await db.from('companies')
    .select('brand_name, brand_tagline_he, brand_tagline_en, assignment_policy, couple_selection_requires_approval, default_locale, contact_email, app_url')
    .eq('id', s.company.id).maybeSingle();
  const settings = (data ?? s.company) as Settings;
  return (
    <div className="pb-16">
      <PageHeader title={m.admin.settings} kicker={s.company.brand_name} />
      <div className="gutter max-w-3xl"><SettingsForm settings={settings} /></div>
    </div>
  );
}
