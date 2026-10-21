import { describe, expect, it } from 'vitest';
import { parseEmbedHtml, parsePlaylistIds } from './spotify';

describe('parsePlaylistIds', () => {
  it('finds ids in links, URIs and bare ids, without duplicates', () => {
    const text = `https://open.spotify.com/playlist/4ylDUKmogCJsLcFAWHROaw?si=abc
      https://open.spotify.com/intl-he/playlist/3NSFElDCyaNmcMoGWn6iuW
      spotify:playlist:0eMV78gGLXzPxqZ8oeFgnb  4ylDUKmogCJsLcFAWHROaw
      https://open.spotify.com/track/08OZnm0Qj4JEJrew10DXpv`;
    expect(parsePlaylistIds(text)).toEqual(['4ylDUKmogCJsLcFAWHROaw', '3NSFElDCyaNmcMoGWn6iuW', '0eMV78gGLXzPxqZ8oeFgnb']);
  });
});

describe('parseEmbedHtml', () => {
  const page = (trackList: unknown[]) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { state: { data: { entity: { name: 'Hupa songs', coverArt: { sources: [{ url: 'https://image-cdn-ak.spotifycdn.com/image/x' }] }, trackList } } } } },
  })}</script></html>`;
  it('reads tracks and skips non-track items', () => {
    const pl = parseEmbedHtml('4ylDUKmogCJsLcFAWHROaw', page([
      { uri: 'spotify:track:08OZnm0Qj4JEJrew10DXpv', title: 'Sweet Child O’ Mine', subtitle: 'Avihu Pinhasov', duration: 238800 },
      { uri: 'spotify:episode:5Xt5DXGzch68nYYamXrNxZ', title: 'A podcast', subtitle: 'Show' },
      { uri: 'spotify:local:::x:1', title: 'Local file' },
    ]));
    expect(pl.name).toBe('Hupa songs');
    expect(pl.artworkUrl).toBe('https://image-cdn-ak.spotifycdn.com/image/x');
    expect(pl.tracks).toEqual([{ id: '08OZnm0Qj4JEJrew10DXpv', title: 'Sweet Child O’ Mine', artists: 'Avihu Pinhasov', durationMs: 238800, artworkUrl: null }]);
    expect(pl.truncated).toBe(false);
  });
  it('flags the 100-track embed limit', () => {
    const list = Array.from({ length: 100 }, (_, i) => ({ uri: `spotify:track:${String(i).padStart(22, 'A')}`, title: `T${i}`, subtitle: 'X' }));
    expect(parseEmbedHtml('4ylDUKmogCJsLcFAWHROaw', page(list)).truncated).toBe(true);
  });
  it('rejects pages without data', () => {
    expect(() => parseEmbedHtml('4ylDUKmogCJsLcFAWHROaw', '<html></html>')).toThrow('spotify_unreadable');
  });
});
