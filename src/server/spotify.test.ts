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
