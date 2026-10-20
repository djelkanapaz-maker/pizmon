import { requireRole } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt, formatDateTime } from '@/i18n/format';
import { Badge, PageHeader } from '@/components/ui';
import { cmsStrings } from '../_cms/strings';
import { AddShowForm, DeleteShow, StationForm, type Station } from './RadioForms';

/** Request-time clock for a server component (kept outside render for the purity lint). */
const requestNow = () => Date.now();

export default async function RadioAdmin() {
  const now = requestNow();
  const s = await requireRole('admin');
  const { m, locale } = await getI18n();
  const t = cmsStrings(locale);
  const db = await supabaseServer();
  const [{ data: station }, { data: djs }] = await Promise.all([
    db.from('radio_stations').select('id, name, description, mode, stream_url, metadata_url').eq('company_id', s.company.id).eq('is_primary', true)
      .order('created_at').limit(1).maybeSingle(),
    db.from('djs').select('id, display_name').eq('company_id', s.company.id).order('sort_order').order('display_name'),
  ]);
  const { data: shows } = station
    ? await db.from('radio_schedule_items').select('id, title, description, starts_at, ends_at, host:djs(display_name)').eq('station_id', station.id)
      .gte('ends_at', new Date(now - 7 * 86400_000).toISOString()).order('starts_at').limit(200)
    : { data: [] };
  type Show = { id: string; title: string; description: string | null; starts_at: string; ends_at: string; host: { display_name: string } | null };
  const rows = (shows ?? []) as unknown as Show[];
  const modeTone = { off: 'neutral', demo: 'gold', live: 'ember' } as const;
  const st = station as Station;

  return (
    <div className="pb-16">
      <PageHeader title={m.admin.radio} />
      <div className="gutter grid lg:grid-cols-2 gap-6 items-start">
        <section className="card p-5" aria-labelledby="radio-station">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 id="radio-station" className="display text-xl">{m.admin.station}</h2>
            {st && <Badge tone={modeTone[st.mode]}>{st.mode === 'live' ? m.radio.live : st.mode === 'demo' ? m.radio.demo : m.radio.off}</Badge>}
          </div>
          {st?.mode === 'demo' && <p className="text-sm text-paper-dim mb-4">{m.radio.demoNote}</p>}
          <StationForm station={st} />
        </section>
        <div className="flex flex-col gap-6">
          <section className="card p-5" aria-labelledby="radio-schedule">
            <h2 id="radio-schedule" className="display text-xl mb-4">{m.radio.schedule}</h2>
            {rows.length === 0 ? <p className="text-sm text-paper-dim">{t.emptySchedule}</p> : (
              <ul className="flex flex-col divide-y divide-line">
                {rows.map((r) => {
                  const live = new Date(r.starts_at).getTime() <= now && new Date(r.ends_at).getTime() > now;
                  return (
                    <li key={r.id} className="py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold flex items-center gap-2" dir="auto">{r.title}{live && <Badge tone="ember">{m.radio.live}</Badge>}</p>
                        <p className="text-sm text-paper-dim tabular">{formatDateTime(r.starts_at, locale)} – {formatDateTime(r.ends_at, locale)}</p>
                        {r.host && <p className="text-sm text-paper-dim">{fmt(m.radio.hostedBy, { dj: r.host.display_name })}</p>}
                      </div>
                      <DeleteShow id={r.id} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="card p-5" aria-labelledby="radio-new">
            <h2 id="radio-new" className="display text-xl mb-4">{m.admin.newShow}</h2>
            {st ? <AddShowForm djs={(djs ?? []).map((d) => ({ id: d.id as string, label: d.display_name as string }))} />
              : <p className="text-sm text-paper-dim">{t.errors.no_station}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
