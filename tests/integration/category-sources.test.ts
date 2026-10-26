// Categories fed by playlists: language filter, rebuild after changes, hand-set tags untouched, admin-only.
import { describe, expect, it } from 'vitest';
import { adminClient, COMPANY_ID, sql, anonClient } from '../helpers/stack';

async function fixture() {
  const admin = await adminClient();
  const sfx = Math.random().toString(36).slice(2, 8);
  const [artHe] = await sql<{ id: string }>(`insert into public.artists (company_id, name) values ($1, $2) returning id`, [COMPANY_ID, `עומר ${sfx}`]);
  const [artEn] = await sql<{ id: string }>(`insert into public.artists (company_id, name) values ($1, $2) returning id`, [COMPANY_ID, `Artist ${sfx}`]);
  const mk = (title: string, artist: string) => sql<{ id: string }>(
    `insert into public.music_tracks (company_id, title, artist_id, rights_status, status) values ($1, $2, $3, 'metadata_only', 'published') returning id`, [COMPANY_ID, title, artist]);
  const [he] = await mk(`שיר ${sfx}`, artHe.id);
  const [heByArtist] = await mk(`Song ${sfx}`, artHe.id);
  const [en] = await mk(`Song B ${sfx}`, artEn.id);
  const [pl] = await sql<{ id: string }>(`insert into public.playlists (company_id, kind, title, status) values ($1, 'editorial', $2, 'published') returning id`, [COMPANY_ID, `pl ${sfx}`]);
  for (const [i, t] of [he, heByArtist, en].entries()) await sql(`insert into public.playlist_tracks (playlist_id, track_id, position) values ($1, $2, $3)`, [pl.id, t.id, i]);
  const [tag] = await sql<{ id: string }>(`insert into public.tags (company_id, kind, slug, name_he, name_en) values ($1, 'category', $2, 'קט', 'cat') returning id`, [COMPANY_ID, `cat-${sfx}`]);
  return { admin, he: he.id, heByArtist: heByArtist.id, en: en.id, pl: pl.id, tag: tag.id };
}
const tagged = async (tag: string) => (await sql<{ track_id: string; auto: boolean }>(`select track_id, auto from public.track_tags where tag_id = $1`, [tag]));

describe('playlist-fed categories', () => {
  it('fills a category from a playlist with a language filter, and rebuilds on change', async () => {
    const f = await fixture();
    expect((await f.admin.from('category_sources').insert({ tag_id: f.tag, playlist_id: f.pl, language: 'he' })).error).toBeNull();
    expect((await f.admin.rpc('refresh_category_tracks', { p_company: COMPANY_ID })).error).toBeNull();
    expect((await tagged(f.tag)).map((r) => r.track_id).sort()).toEqual([f.he, f.heByArtist].sort());

    await f.admin.from('category_sources').update({ language: 'intl' }).eq('tag_id', f.tag);
    await f.admin.rpc('refresh_category_tracks', { p_company: COMPANY_ID });
    expect((await tagged(f.tag)).map((r) => r.track_id)).toEqual([f.en]);

    await f.admin.from('category_sources').update({ language: 'all' }).eq('tag_id', f.tag);
    await f.admin.rpc('refresh_category_tracks', { p_company: COMPANY_ID });
    expect(await tagged(f.tag)).toHaveLength(3);
  });

  it('leaves hand-set tags alone', async () => {
    const f = await fixture();
    await sql(`insert into public.track_tags (track_id, tag_id) values ($1, $2)`, [f.en, f.tag]);
    await f.admin.from('category_sources').insert({ tag_id: f.tag, playlist_id: f.pl, language: 'he' });
    await f.admin.rpc('refresh_category_tracks', { p_company: COMPANY_ID });
    await f.admin.from('category_sources').delete().eq('tag_id', f.tag);
    await f.admin.rpc('refresh_category_tracks', { p_company: COMPANY_ID });
    expect(await tagged(f.tag)).toEqual([{ track_id: f.en, auto: false }]);
  });

  it('is admin-only', async () => {
    const r = await anonClient().rpc('refresh_category_tracks', { p_company: COMPANY_ID });
    expect(r.error).not.toBeNull();
  });
});
