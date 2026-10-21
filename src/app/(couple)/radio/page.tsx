import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { formatDateTime } from '@/i18n/format';
import { Badge, Cover, DemoBadge, EmptyState, PageHeader, SectionHeader } from '@/components/ui';
import { PlayToggle } from '@/components/audio/MiniPlayer';
import { IconExternal } from '@/components/icons';

export default async function RadioPage() {
  const s = await requireCouple();
  const { m, locale } = await getI18n();
  const db = await supabaseServer();
  const { data: station } = await db.from('radio_stations').select('id, name, description, mode, stream_url').eq('company_id', s.company.id).eq('is_primary', true).maybeSingle();
  const [{ data: schedule }, { data: content }] = await Promise.all([
    station ? db.from('radio_schedule_items').select('id, title, description, starts_at, ends_at, host:djs(display_name)').eq('station_id', station.id).gte('ends_at', new Date().toISOString()).order('starts_at').limit(10) : Promise.resolve({ data: [] }),
    db.from('content_items').select('id, kind, title, description, media_url, external_url, duration_seconds, genre_tags, is_demo, is_featured, creator:djs(display_name)').eq('company_id', s.company.id).eq('status', 'published').order('published_at', { ascending: false }).limit(40),
  ]);
  const items = (content ?? []) as unknown as { id: string; kind: string; title: string; description: string | null; media_url: string | null; external_url: string | null; duration_seconds: number | null; genre_tags: string[]; is_demo: boolean; is_featured: boolean; creator: { display_name: string } | null }[];
  const featured = items.filter((c) => c.is_featured);
  const rest = items.filter((c) => !c.is_featured);
  const shows = (schedule ?? []) as unknown as { id: string; title: string; description: string | null; starts_at: string; ends_at: string; host: { display_name: string } | null }[];
  const live = station?.mode === 'live';
  // request-time server component: comparing against the current time is intended
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div>
      <PageHeader title={m.radio.title} sub={m.radio.sub} />
      <section className="gutter">
        <div className="rounded-[22px] bg-paper text-ink p-5 md:p-8 shadow-[var(--shadow-hard)] relative overflow-hidden">
          <span aria-hidden className="absolute -end-10 -top-10 size-48 rounded-full border-[14px] border-ink/10" />
          <span aria-hidden className="absolute end-10 top-10 size-16 rounded-full bg-ember" />
          <p className="text-xs font-bold uppercase tracking-wider opacity-60">{station?.name ?? m.radio.title}</p>
          <div className="mt-2 flex items-center gap-2">
            {station && station.mode !== 'off' ? <Badge tone={live ? 'danger' : 'neutral'} className={live ? '' : 'bg-ink/10 text-ink'}>{live ? m.radio.live : m.radio.demo}</Badge> : <Badge className="bg-ink/10 text-ink">{m.radio.off}</Badge>}
          </div>
          <p className="display text-3xl md:text-5xl mt-3 max-w-md">{station?.name ?? '—'}</p>
          <p className="mt-2 text-sm opacity-70 max-w-md">{station?.mode === 'demo' ? m.radio.demoNote : station?.mode === 'off' || !station ? m.radio.offNote : station.description}</p>
          {station?.stream_url && station.mode !== 'off' && (
            <div className="mt-6 flex items-center gap-3">
              <PlayToggle source={{ id: `radio:${station.id}`, kind: live ? 'live_stream' : 'demo_stream', url: station.stream_url, title: station.name }} size="lg" className="!bg-ink !text-paper" />
              <span className="font-bold">{m.radio.listen}</span>
            </div>
          )}
          <p className="mt-4 text-xs opacity-60">{m.radio.backgroundNote}</p>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mt-10">
          <SectionHeader title={m.home.featuredMixes} />
          <div className="scroll-x pb-2">
            {featured.map((c) => (
              <div key={c.id} className="w-56 card p-3 flex flex-col gap-3">
                <Cover seed={c.id} label={c.title} size={200} className="!w-full !h-auto aspect-square" />
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm leading-tight line-clamp-2">{c.title}</p>
                    <p className="text-xs text-paper-dim mt-1">{c.creator?.display_name}</p>
                  </div>
                  {c.media_url && <PlayToggle source={{ id: `content:${c.id}`, kind: 'company_mix', url: c.media_url, title: c.title, subtitle: c.creator?.display_name }} size="sm" />}
                </div>
                {c.is_demo && <DemoBadge label={m.common.demo} />}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <SectionHeader title={m.radio.schedule} />
        {shows.length === 0 ? <p className="gutter text-paper-dim">{m.radio.noSchedule}</p> : (
          <ol className="gutter flex flex-col gap-2">
            {shows.map((sh) => {
              const onAir = new Date(sh.starts_at).getTime() <= now && new Date(sh.ends_at).getTime() > now;
              return (
                <li key={sh.id} className={`card p-4 flex items-center gap-4 ${onAir ? 'border-ember' : ''}`}>
                  <time className="text-sm font-bold tabular w-28 shrink-0" dateTime={sh.starts_at}>{formatDateTime(sh.starts_at, locale)}</time>
                  <div className="min-w-0"><p className="font-bold">{sh.title}</p><p className="text-sm text-paper-dim">{sh.host ? m.radio.hostedBy.replace('{dj}', `\u2068${sh.host.display_name}\u2069`) : sh.description}</p></div>
                  {onAir && live && <Badge tone="danger" className="ms-auto">{m.radio.live}</Badge>}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {(rest.length > 0 || featured.length === 0) && <section className="mt-10">
        <SectionHeader title={m.radio.mixes} />
        {rest.length === 0 ? <div className="gutter"><EmptyState title={m.radio.noMixes} /></div> : (
          <ul className="gutter grid sm:grid-cols-2 gap-3">
            {rest.map((c) => (
              <li key={c.id} className="card p-3 flex items-center gap-3">
                <Cover seed={c.id} label={c.title} size={72} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] label">{(m.radio.kinds as Record<string, string>)[c.kind]}</p>
                  <p className="font-bold leading-tight line-clamp-2">{c.title}</p>
                  <p className="text-xs text-paper-dim mt-0.5">{c.creator?.display_name}{c.duration_seconds ? ` · ${Math.round(c.duration_seconds / 60)}′` : ''}</p>
                  {c.is_demo && <DemoBadge label={m.common.demo} />}
                </div>
                {c.media_url ? <PlayToggle source={{ id: `content:${c.id}`, kind: 'company_mix', url: c.media_url, title: c.title, subtitle: c.creator?.display_name }} />
                  : c.external_url ? <a href={c.external_url} target="_blank" rel="noopener noreferrer" aria-label={c.title} className="size-11 grid place-items-center rounded-full border border-line"><IconExternal size={18} /></a> : null}
              </li>
            ))}
          </ul>
        )}
      </section>}
    </div>
  );
}
