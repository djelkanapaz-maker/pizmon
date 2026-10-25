// Spotify playlist mirroring (as the admin, through RLS) and the couple's single main playlist.
import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient, COMPANY_ID, createCouple, createDj, sql } from '../helpers/stack';
import { syncSpotifyPlaylist } from '../../src/server/spotify-sync';
import type { SpotifyPlaylist } from '../../src/core/spotify';

let admin: SupabaseClient;
let adminId: string;
const tid = (n: number) => `Tr${String(n).padStart(20, '0')}`;
const fixture = (order: number[]): SpotifyPlaylist => ({
  id: 'Pl0000000000000000test', name: 'Israeli Hupa songs כניסה לחופה', description: null, artworkUrl: 'https://image-cdn-ak.spotifycdn.com/image/test',
  truncated: false, tracks: order.map((n) => ({ id: tid(n), title: `Song ${n}`, artists: n % 2 ? 'Artist A' : 'Artist A, Artist B', durationMs: 200000, artworkUrl: null })),
});

beforeAll(async () => {
  admin = await adminClient();
  adminId = (await admin.auth.getUser()).data.user!.id;
}, 60_000);

describe('spotify sync', () => {
  it('creates a published editorial playlist with tracks in Spotify order', async () => {
    const r = await syncSpotifyPlaylist(admin, COMPANY_ID, adminId, fixture([1, 2, 3]));
    expect(r.tracks).toBe(3);
    const [pl] = await sql<{ kind: string; status: string; purpose: string; artwork_url: string }>(`select kind, status, purpose, artwork_url from public.playlists where id = $1`, [r.playlistId]);
    expect(pl).toMatchObject({ kind: 'editorial', status: 'published', purpose: 'ceremony' });
    const rows = await sql<{ pid: string }>(`select t.provider_track_id pid from public.playlist_tracks pt join public.music_tracks t on t.id = pt.track_id where pt.playlist_id = $1 order by pt.position`, [r.playlistId]);
    expect(rows.map((x) => x.pid)).toEqual([tid(1), tid(2), tid(3)]);
  });

  it('re-sync is idempotent, follows the new order and keeps admin edits', async () => {
    await sql(`update public.playlists set title = 'Renamed by admin' where spotify_playlist_id = 'Pl0000000000000000test'`);
    const r = await syncSpotifyPlaylist(admin, COMPANY_ID, adminId, fixture([3, 1, 4]));
    const [pl] = await sql<{ title: string; n: string }>(`select title, (select count(*) from public.playlists where spotify_playlist_id = 'Pl0000000000000000test') n from public.playlists where id = $1`, [r.playlistId]);
    expect(pl).toEqual({ title: 'Renamed by admin', n: '1' });
    const rows = await sql<{ pid: string }>(`select t.provider_track_id pid from public.playlist_tracks pt join public.music_tracks t on t.id = pt.track_id where pt.playlist_id = $1 order by pt.position`, [r.playlistId]);
    expect(rows.map((x) => x.pid)).toEqual([tid(3), tid(1), tid(4)]);
    const [count] = await sql<{ n: string }>(`select count(*) n from public.music_tracks where provider = 'spotify' and provider_track_id like 'Tr%'`);
    expect(count.n).toBe('4');
  });

  it('a couple cannot sync or link Spotify playlists', async () => {
    const { client } = await createCouple('SpotifyCouple');
    const { data: u } = await client.auth.getUser();
    await expect(syncSpotifyPlaylist(client, COMPANY_ID, u.user!.id, { ...fixture([9]), id: 'Pl0000000000000000tst2' })).rejects.toBeTruthy();
    const [n] = await sql<{ n: string }>(`select count(*) n from public.playlists where spotify_playlist_id = 'Pl0000000000000000tst2'`);
    expect(n.n).toBe('0');
  });
});

describe('main couple playlist', () => {
  it('is one per wedding and visible to the assigned DJ when shared', async () => {
    const couple = await createCouple('MainList');
    const dj = await createDj('Main List DJ');
    const { error: ae } = await admin.rpc('admin_assign_dj', { p_event: couple.eventId, p_dj: dj.djId, p_confirm: true });
    expect(ae).toBeNull();
    const ins = (title: string) => couple.client.from('playlists').insert({ company_id: COMPANY_ID, kind: 'couple', event_id: couple.eventId, title, is_main: true, shared_with_dj: true }).select('id').single();
    const first = await ins('Ours');
    expect(first.error).toBeNull();
    const second = await ins('Ours again');
    expect(second.error?.code).toBe('23505');
    const { data: seen } = await dj.client.from('playlists').select('id').eq('event_id', couple.eventId).eq('is_main', true);
    expect(seen?.map((x) => x.id)).toEqual([first.data!.id]);
  });
});

describe('spotify connection storage', () => {
  it('only company admins can save or read the sealed token', async () => {
    process.env.SPOTIFY_CLIENT_SECRET = 'test-secret';
    const { sealToken, openToken } = await import('../../src/server/spotify-auth');
    const sealed = sealToken('refresh-token-value');
    expect(sealed).not.toContain('refresh-token-value');
    expect(openToken(sealed)).toBe('refresh-token-value');
    const { error } = await admin.rpc('admin_save_spotify_connection', { p_company: COMPANY_ID, p_cipher: sealed, p_user: 'pizmon', p_name: 'Pizmon' });
    expect(error).toBeNull();
    const { data } = await admin.rpc('admin_spotify_connection', { p_company: COMPANY_ID });
    expect((data as { spotify_user_id: string }[])[0].spotify_user_id).toBe('pizmon');
    const couple = await createCouple('NoSpotify');
    const r = await couple.client.rpc('admin_spotify_connection', { p_company: COMPANY_ID });
    expect(r.error?.code).toBe('42501');
    const w = await couple.client.rpc('admin_save_spotify_connection', { p_company: COMPANY_ID, p_cipher: 'x', p_user: 'evil', p_name: 'x' });
    expect(w.error?.code).toBe('42501');
    await admin.rpc('admin_clear_spotify_connection', { p_company: COMPANY_ID });
  });
});

describe('couples adding songs from Spotify', () => {
  it('adds a validated Spotify song once, scoped to the wedding that added it', async () => {
    const couple = await createCouple('SpotifySearch');
    const id1 = await couple.client.rpc('couple_add_spotify_track', { p_spotify: 'Sx0000000000000000add1', p_title: 'Found on Spotify', p_artists: 'Some Artist', p_artwork: 'https://i.scdn.co/image/ab67616d00004851abc' });
    expect(id1.error).toBeNull();
    const again = await couple.client.rpc('couple_add_spotify_track', { p_spotify: 'Sx0000000000000000add1', p_title: 'Renamed', p_artists: 'X', p_artwork: null });
    expect(again.data).toBe(id1.data);
    const [row] = await sql<{ title: string; added_by_event: string; status: string }>(`select title, added_by_event, status from public.music_tracks where id = $1`, [id1.data]);
    expect(row).toEqual({ title: 'Found on Spotify', added_by_event: couple.eventId, status: 'published' });
    const bad = await couple.client.rpc('couple_add_spotify_track', { p_spotify: 'Sx0000000000000000add2', p_title: 'x', p_artists: 'y', p_artwork: 'https://evil.example/x.png' });
    expect(bad.error?.code).toBe('22023');
    const notCouple = await admin.rpc('couple_add_spotify_track', { p_spotify: 'Sx0000000000000000add3', p_title: 'x', p_artists: 'y', p_artwork: null });
    expect(notCouple.error?.code).toBe('42501');
  });
});
