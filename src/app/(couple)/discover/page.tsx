import Link from 'next/link';
import { requireCouple } from '@/server/session';
import { supabaseServer } from '@/lib/supabase/server';
import { getI18n } from '@/i18n/server';
import { fmt } from '@/i18n/format';
import { getGenres, getMoments, TRACK_SELECT, type Track } from '@/server/queries';
import { getTrackContext } from '@/server/track-context';
import { PageHeader, SectionHeader, Cover, EmptyState } from '@/components/ui';
import { TrackList } from '@/components/music/TrackList';
import { DiscoverFilters } from './DiscoverFilters';

type SP = { q?: string; genre?: string; mood?: string; cat?: string; lang?: string; energy?: string; moment?: string; hidden?: string };
const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await requireCouple();
  const sp = await searchParams;
  const { m, locale } = await getI18n();
  const db = await supabaseServer();
  const [ctx, genres, moments, { data: tags }, { data: collections }] = await Promise.all([
    getTrackContext(s.eventId, s.company.id),
    getGenres(s.company.id),
    getMoments(s.company.id),
    db.from('tags').select('id, kind, slug, name_he, name_en').eq('company_id', s.company.id).order('sort_order'),
    db.from('playlists').select('id, title, description, purpose, artwork_url, playlist_tracks(count)').eq('company_id', s.company.id).in('kind', ['editorial', 'dj']).eq('status', 'published').order('is_featured', { ascending: false }).order('created_at'),
  ]);
  const categories = (tags ?? []).filter((t) => t.kind === 'category');
  const moods = (tags ?? []).filter((t) => t.kind === 'mood');
  const q = (sp.q ?? '').replace(/[,()*%\\]/g, ' ').trim().slice(0, 80);
  const filtering = !!(q || sp.genre || sp.mood || sp.cat || sp.lang || sp.energy || sp.moment);

  let results: Track[] = [];
  if (filtering) {
    const tagFilter = [sp.mood, sp.cat].filter(isUuid) as string[];
    let query = db.from('music_tracks')
      .select(`${TRACK_SELECT}${tagFilter.length ? ', track_tags!inner(tag_id)' : ''}${isUuid(sp.moment) ? ', moment_tracks!inner(moment_id)' : ''}`)
      .eq('company_id', s.company.id).eq('status', 'published').order('title').limit(120);
    if (isUuid(sp.genre)) query = query.eq('genre_id', sp.genre!);
    if (sp.lang && /^[a-z]{2,12}$/.test(sp.lang)) query = query.eq('language', sp.lang);
    if (sp.energy && /^[1-5]$/.test(sp.energy)) query = query.eq('energy', Number(sp.energy));
    if (isUuid(sp.moment)) query = query.eq('moment_tracks.moment_id', sp.moment!);
    if (tagFilter.length) query = query.in('track_tags.tag_id', tagFilter);
    if (q) {
      const { data: arts } = await db.from('artists').select('id').eq('company_id', s.company.id).ilike('name', `%${q}%`).limit(50);
      const ids = (arts ?? []).map((a) => a.id);
      query = query.or([`title.ilike.%${q}%`, ...(ids.length ? [`artist_id.in.(${ids.join(',')})`] : [])].join(','));
    }
    const { data } = await query;
    const seen = new Set<string>();
    results = ((data ?? []) as unknown as Track[]).filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
    // a mood + category combination must match both tags
    if (tagFilter.length === 2) {
      const { data: both } = await db.from('track_tags').select('track_id, tag_id').in('tag_id', tagFilter).in('track_id', results.map((r) => r.id));
      const counts = new Map<string, number>();
      (both ?? []).forEach((r) => counts.set(r.track_id, (counts.get(r.track_id) ?? 0) + 1));
      results = results.filter((r) => counts.get(r.id) === 2);
    }
    if (sp.hidden !== '1') results = results.filter((t) => !ctx.rejected.includes(t.id));
  }

  // browse mode: a few shelves by category
  const shelves = filtering ? [] : await Promise.all(categories.slice(0, 6).map(async (c) => {
    const { data } = await db.from('music_tracks').select(`${TRACK_SELECT}, track_tags!inner(tag_id)`)
      .eq('company_id', s.company.id).eq('status', 'published').eq('track_tags.tag_id', c.id).order('title').limit(8);
    return { tag: c, tracks: ((data ?? []) as unknown as Track[]).filter((t) => !ctx.rejected.includes(t.id)) };
  }));

  const label = (x: { name_he: string; name_en: string }) => (locale === 'he' ? x.name_he : x.name_en);

  return (
    <div>
      <PageHeader title={m.discover.title} sub={m.discover.sub} />
      <DiscoverFilters
        initial={sp}
        genres={genres.map((g) => ({ id: g.id, label: label(g) }))}
        moods={moods.map((g) => ({ id: g.id, label: label(g) }))}
        categories={categories.map((g) => ({ id: g.id, label: label(g) }))}
        moments={moments.map((g) => ({ id: g.id, label: label(g) }))}
      />

      {filtering ? (
        <section className="mt-6" aria-live="polite">
          <p className="gutter label mb-2">{fmt(m.discover.results, { count: results.length })}</p>
          {results.length ? <TrackList tracks={results} ctx={ctx} /> : <div className="gutter"><EmptyState title={m.discover.noResults} /></div>}
        </section>
      ) : (
        <>
          {[
            { key: 'ceremony', title: m.discover.chuppahIdeas, items: (collections ?? []).filter((p) => p.purpose === 'ceremony') },
            { key: 'all', title: m.discover.collections, items: (collections ?? []).filter((p) => p.purpose !== 'ceremony') },
          ].filter((g) => g.items.length > 0).map((g) => (
            <section key={g.key} className="mt-8">
              <SectionHeader title={g.title} />
              <div className="scroll-x pb-2">
                {g.items.map((p) => (
                  <Link key={p.id} href={`/discover/collection/${p.id}`} className="w-40 group">
                    <Cover seed={p.id} label={p.title} src={p.artwork_url} size={160} className="group-hover:-translate-y-1 transition-transform" />
                    <p className="font-bold mt-2 leading-tight" dir="auto">{p.title}</p>
                    <p className="text-xs text-paper-dim">{fmt(m.playlists.tracks, { count: (p.playlist_tracks as unknown as { count: number }[])[0]?.count ?? 0 })}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
          {shelves.filter((x) => x.tracks.length).map((sh) => (
            <section key={sh.tag.id} className="mt-10">
              <SectionHeader title={label(sh.tag)} href={`/discover?cat=${sh.tag.id}`} action={m.common.seeAll} />
              <TrackList tracks={sh.tracks.slice(0, 4)} ctx={ctx} compare={false} />
            </section>
          ))}
        </>
      )}
    </div>
  );
}
