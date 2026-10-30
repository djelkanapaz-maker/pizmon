import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchSpotifyTracks, spotifyBlocked } from './spotify';

afterEach(() => vi.unstubAllGlobals());

describe('Spotify search', () => {
  it('backs off after a quota error instead of hammering Spotify', async () => {
    const fetchMock = vi.fn(async () => new Response('{"error":{"status":429}}', { status: 429, headers: { 'retry-after': '120' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(searchSpotifyTracks('omer adam', 't', 30)).rejects.toThrow('spotify_quota');
    expect(spotifyBlocked()).toBe(true);
    const calls = fetchMock.mock.calls.length;
    await expect(searchSpotifyTracks('another', 't', 30)).rejects.toThrow('spotify_quota');
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
});

describe('finding a song on Spotify', () => {
  it('matches title and lead artist, not a cover', async () => {
    const { findSpotifyTrack } = await import('./spotify');
    vi.resetModules();
    const items = [
      { id: 'A'.repeat(22), name: 'Tutim - Live', artists: [{ name: 'Someone Else' }] },
      { id: 'B'.repeat(22), name: 'Tutim (2019)', artists: [{ name: 'Hanan Ben Ari' }, { name: 'X' }] },
    ];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ tracks: { items } }), { status: 200 })));
    // a fresh module so the quota block from the previous test doesn't apply
    const fresh = await import('./spotify');
    const h = await fresh.findSpotifyTrack('Tutim', 'Hanan Ben Ari & Friend', 't');
    expect(h?.id).toBe('B'.repeat(22));
    expect(findSpotifyTrack).toBeTypeOf('function');
  });
});
