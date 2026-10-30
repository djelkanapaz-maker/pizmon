// Songs added from Apple's catalog while Spotify is busy, and their later link to Spotify.
import { describe, expect, it } from 'vitest';
import { adminClient, COMPANY_ID, createCouple, sql } from '../helpers/stack';

const ART = 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/ab/200x200bb.jpg';

describe('Apple fallback', () => {
  it('a couple adds a validated Apple song; bad metadata is refused', async () => {
    const couple = await createCouple('Apple');
    const sfx = String(Date.now()).slice(-9);
    const r = await couple.client.rpc('couple_add_apple_track', { p_apple: sfx, p_title: `Apple song ${sfx}`, p_artists: 'Apple Artist', p_artwork: ART, p_url: `https://music.apple.com/il/album/x/1?i=${sfx}` });
    expect(r.error).toBeNull();
    const [row] = await sql<{ provider: string; added_by_event: string }>(`select provider, added_by_event from public.music_tracks where id = $1`, [r.data]);
    expect(row).toEqual({ provider: 'apple_music', added_by_event: couple.eventId });
    const again = await couple.client.rpc('couple_add_apple_track', { p_apple: sfx, p_title: 'x', p_artists: 'y', p_artwork: null, p_url: null });
    expect(again.data).toBe(r.data);
    const bad = await couple.client.rpc('couple_add_apple_track', { p_apple: '12', p_title: 'x', p_artists: 'y', p_artwork: 'https://evil.example/a.jpg', p_url: null });
    expect(bad.error?.code).toBe('22023');
  });

  it('becomes a Spotify song once matched', async () => {
    const admin = await adminClient();
    const couple = await createCouple('AppleLink');
    const sfx = String(Date.now() + 1).slice(-9);
    const { data: id } = await couple.client.rpc('couple_add_apple_track', { p_apple: sfx, p_title: `Link ${sfx}`, p_artists: 'Link Artist', p_artwork: null, p_url: null });
    const sp = `Ln${sfx}`.padEnd(22, '0');
    const r = await admin.rpc('admin_link_spotify', { p_track: id, p_spotify: sp, p_artwork: null });
    expect(r.error).toBeNull();
    expect(r.data).toBe(id);
    const [row] = await sql<{ provider: string; provider_track_id: string; external_url: string }>(`select provider, provider_track_id, external_url from public.music_tracks where id = $1`, [id]);
    expect(row).toEqual({ provider: 'spotify', provider_track_id: sp, external_url: `https://open.spotify.com/track/${sp}` });
  });

  it('merges into the Spotify song already in the catalog, keeping the couple’s playlist', async () => {
    const admin = await adminClient();
    const couple = await createCouple('AppleMerge');
    const sfx = String(Date.now() + 2).slice(-9);
    const sp = `Mg${sfx}`.padEnd(22, '0');
    const [art] = await sql<{ id: string }>(`insert into public.artists (company_id, name) values ($1, $2) returning id`, [COMPANY_ID, `Merge ${sfx}`]);
    const [existing] = await sql<{ id: string }>(`insert into public.music_tracks (company_id, title, artist_id, provider, provider_track_id, rights_status, status) values ($1, $2, $3, 'spotify', $4, 'metadata_only', 'published') returning id`, [COMPANY_ID, `Other name ${sfx}`, art.id, sp]);
    const { data: appleId } = await couple.client.rpc('couple_add_apple_track', { p_apple: sfx, p_title: `Merge song ${sfx}`, p_artists: 'Someone', p_artwork: null, p_url: null });
    const [pl] = await sql<{ id: string }>(`insert into public.playlists (company_id, event_id, kind, title, status) values ($1, $2, 'couple', 'ours', 'published') returning id`, [COMPANY_ID, couple.eventId]);
    await sql(`insert into public.playlist_tracks (playlist_id, track_id, position) values ($1, $2, 0)`, [pl.id, appleId]);

    const r = await admin.rpc('admin_link_spotify', { p_track: appleId, p_spotify: sp, p_artwork: null });
    expect(r.data).toBe(existing.id);
    expect(await sql(`select 1 from public.music_tracks where id = $1`, [appleId])).toHaveLength(0);
    expect((await sql<{ track_id: string }>(`select track_id from public.playlist_tracks where playlist_id = $1`, [pl.id])).map((x) => x.track_id)).toEqual([existing.id]);
  });

  it('linking is admin-only', async () => {
    const couple = await createCouple('AppleNoLink');
    const sfx = String(Date.now() + 3).slice(-9);
    const { data: id } = await couple.client.rpc('couple_add_apple_track', { p_apple: sfx, p_title: `N ${sfx}`, p_artists: 'N', p_artwork: null, p_url: null });
    const r = await couple.client.rpc('admin_link_spotify', { p_track: id, p_spotify: 'A'.repeat(22), p_artwork: null });
    expect(r.error?.code).toBe('42501');
  });
});
