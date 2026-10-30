import { describe, expect, it } from 'vitest';
import { toAppleHit } from './apple';
import { normSong } from './spotify';

describe('Apple catalog results', () => {
  it('keeps songs with safe artwork and Apple Music links', () => {
    const h = toAppleHit({ kind: 'song', trackId: 1440841766, trackName: 'תותים', artistName: 'חנן בן ארי',
      artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/ab/cd/100x100bb.jpg',
      trackViewUrl: 'https://music.apple.com/il/album/x/1440841760?i=1440841766&uo=4' });
    expect(h).toEqual({ id: '1440841766', title: 'תותים', artists: 'חנן בן ארי',
      artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/ab/cd/200x200bb.jpg',
      url: 'https://music.apple.com/il/album/x/1440841760?i=1440841766' });
  });
  it('drops non-songs and unsafe urls', () => {
    expect(toAppleHit({ kind: 'music-video', trackId: 1, trackName: 'x' })).toBeNull();
    const h = toAppleHit({ kind: 'song', trackId: 2, trackName: 'x', artworkUrl100: 'https://evil.example/a.jpg', trackViewUrl: 'javascript:alert(1)' });
    expect(h?.artworkUrl).toBeNull(); expect(h?.url).toBeNull();
  });
});

describe('song matching', () => {
  it('ignores version suffixes, brackets and punctuation', () => {
    expect(normSong('Don’t Stop Me Now - Remastered 2011')).toBe(normSong("Don't Stop Me Now"));
    expect(normSong('Everybody (Backstreet’s Back) [Radio Edit]')).toBe('everybody');
    expect(normSong('תותים')).toBe('תותים');
  });
});
