// Same title + artist from two Spotify releases → one catalog song; every reference moves to it.
import { describe, expect, it } from 'vitest';
import { adminClient, COMPANY_ID, sql, createCouple } from '../helpers/stack';

describe('duplicate songs', () => {
  it('merges copies into the oldest row and keeps couples’ choices', async () => {
    const admin = await adminClient();
    const sfx = Math.random().toString(36).slice(2, 8);
    const [art] = await sql<{ id: string }>(`insert into public.artists (company_id, name) values ($1, $2) returning id`, [COMPANY_ID, `Dup ${sfx}`]);
    const mk = (title: string, sp: string) => sql<{ id: string }>(
      `insert into public.music_tracks (company_id, title, artist_id, provider, provider_track_id, rights_status, status) values ($1, $2, $3, 'spotify', $4, 'metadata_only', 'published') returning id`,
      [COMPANY_ID, title, art.id, sp]);
    const [a] = await mk(`Song ${sfx}`, `A${sfx}`.padEnd(22, 'x'));
    const [b] = await mk(`song ${sfx} `, `B${sfx}`.padEnd(22, 'x'));
    const [acoustic] = await mk(`Song ${sfx} - Acoustic`, `C${sfx}`.padEnd(22, 'x'));
    const [p1] = await sql<{ id: string }>(`insert into public.playlists (company_id, kind, title, status) values ($1, 'editorial', $2, 'published') returning id`, [COMPANY_ID, `p1 ${sfx}`]);
    const [p2] = await sql<{ id: string }>(`insert into public.playlists (company_id, kind, title, status) values ($1, 'editorial', $2, 'published') returning id`, [COMPANY_ID, `p2 ${sfx}`]);
    await sql(`insert into public.playlist_tracks (playlist_id, track_id, position) values ($1, $2, 0), ($1, $3, 1), ($4, $3, 0)`, [p1.id, a.id, b.id, p2.id]);
    const couple = await createCouple(`dup-${sfx}`);
    await sql(`insert into public.saved_tracks (event_id, track_id) values ($1, $2)`, [couple.eventId, b.id]);

    const r = await admin.rpc('merge_duplicate_tracks', { p_company: COMPANY_ID });
    expect(r.error).toBeNull();
    expect(await sql(`select 1 from public.music_tracks where id = $1`, [b.id])).toHaveLength(0);
    expect(await sql(`select 1 from public.music_tracks where id = $1`, [acoustic.id])).toHaveLength(1);
    expect((await sql<{ track_id: string }>(`select track_id from public.playlist_tracks where playlist_id = $1`, [p1.id])).map((x) => x.track_id)).toEqual([a.id]);
    expect((await sql<{ track_id: string }>(`select track_id from public.playlist_tracks where playlist_id = $1`, [p2.id])).map((x) => x.track_id)).toEqual([a.id]);
    expect(await sql(`select 1 from public.saved_tracks where event_id = $1 and track_id = $2`, [couple.eventId, a.id])).toHaveLength(1);
  });
});
