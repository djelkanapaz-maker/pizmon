// A couple imports their own Spotify playlist into "our playlist".
import { describe, expect, it } from 'vitest';
import { COMPANY_ID, createCouple, sql } from '../helpers/stack';

const id = (s: string) => s.padEnd(22, '0').slice(0, 22);

async function mainPlaylist(eventId: string) {
  const [pl] = await sql<{ id: string }>(`insert into public.playlists (company_id, event_id, kind, title, status, is_main, shared_with_dj) values ($1, $2, 'couple', 'ours', 'published', true, true) returning id`, [COMPANY_ID, eventId]);
  return pl.id;
}

describe('importing a Spotify playlist', () => {
  it('adds new songs in order, skips duplicates and absolute "never" songs', async () => {
    const couple = await createCouple('Import');
    const pl = await mainPlaylist(couple.eventId);
    const sfx = Math.random().toString(36).slice(2, 8);
    // an artist on the couple's absolute never list
    const [art] = await sql<{ id: string }>(`insert into public.artists (company_id, name) values ($1, $2) returning id`, [COMPANY_ID, `Never ${sfx}`]);
    await sql(`insert into public.music_restrictions (event_id, kind, target_type, artist_id, strength, created_by)
               select $1, 'never_play', 'artist', $2, 'absolute', user_id from public.couple_members where event_id = $1 limit 1`, [couple.eventId, art.id]);
    const tracks = [
      { id: id(`Ia${sfx}`), title: `First ${sfx}`, artists: `Band ${sfx}` },
      { id: id(`Ib${sfx}`), title: `Second ${sfx}`, artists: `Band ${sfx}` },
      { id: id(`Ic${sfx}`), title: `Banned ${sfx}`, artists: `Never ${sfx}` },
      { id: 'bad', title: 'x', artists: 'y' },
    ];
    const r = await couple.client.rpc('couple_import_spotify_tracks', { p_playlist: pl, p_tracks: tracks });
    expect(r.error).toBeNull();
    expect(r.data).toEqual({ added: 2, already: 0, blocked: 1, skipped: 1 });
    const rows = await sql<{ title: string }>(`select t.title from public.playlist_tracks pt join public.music_tracks t on t.id = pt.track_id where pt.playlist_id = $1 order by pt.position`, [pl]);
    expect(rows.map((x) => x.title)).toEqual([`First ${sfx}`, `Second ${sfx}`]);

    const again = await couple.client.rpc('couple_import_spotify_tracks', { p_playlist: pl, p_tracks: tracks.slice(0, 2) });
    expect(again.data).toEqual({ added: 0, already: 2, blocked: 0, skipped: 0 });
  });

  it('only into the couple’s own main playlist', async () => {
    const a = await createCouple('ImportA');
    const b = await createCouple('ImportB');
    const plB = await mainPlaylist(b.eventId);
    const r = await a.client.rpc('couple_import_spotify_tracks', { p_playlist: plB, p_tracks: [] });
    expect(r.error?.code).toBe('42501');
  });
});
