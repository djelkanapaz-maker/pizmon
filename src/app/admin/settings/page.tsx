import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { PageHeader } from '@/components/ui';
import { SettingsForm, type Settings } from './SettingsForm';
import { SkinPicker } from '@/components/SkinPicker';

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
      <div className="gutter max-w-3xl flex flex-col gap-6">
        <section className="card p-5 sm:p-6" aria-labelledby="skin-title">
          <h2 id="skin-title" className="text-lg font-bold">{m.skin.staffTitle}</h2>
          <p className="text-sm text-paper-dim mt-1 mb-4">{m.skin.staffHint}</p>
          <div className="max-w-md"><SkinPicker value={s.skin ?? 'light'} /></div>
        </section>
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
