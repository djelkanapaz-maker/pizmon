import type { AudioSource } from '@/components/audio/AudioProvider';

export type TrackLike = {
  id: string; title: string; artist?: { name: string } | null; preview_url?: string | null; playback_url?: string | null;
  external_url?: string | null; rights_status?: string;
};

/** In-app audio only when the catalog declares the matching rights (also enforced by DB constraints). */
export function playableSource(t: TrackLike): AudioSource | null {
  if (t.playback_url && (t.rights_status === 'full_licensed' || t.rights_status === 'company_owned')) {
    return { id: `track:${t.id}`, kind: 'licensed_full', url: t.playback_url, title: t.title, subtitle: t.artist?.name };
  }
  if (t.preview_url && t.rights_status !== 'metadata_only') {
    return { id: `preview:${t.id}`, kind: 'licensed_preview', url: t.preview_url, title: t.title, subtitle: t.artist?.name };
  }
  return null;
}

/** External listening: a configured link, otherwise clearly-labelled searches (never a fake deep link). */
export function externalOptions(t: TrackLike) {
  const q = encodeURIComponent(`${t.title} ${t.artist?.name ?? ''}`.trim());
  const opts: { service: string; url: string; isSearch: boolean }[] = [];
  if (t.external_url) opts.push({ service: hostLabel(t.external_url), url: t.external_url, isSearch: false });
  opts.push({ service: 'Spotify', url: `https://open.spotify.com/search/${q}`, isSearch: true });
  opts.push({ service: 'YouTube', url: `https://www.youtube.com/results?search_query=${q}`, isSearch: true });
  return opts;
}

function hostLabel(url: string) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (h.includes('spotify')) return 'Spotify';
    if (h.includes('youtube') || h.includes('youtu.be')) return 'YouTube';
    if (h.includes('apple')) return 'Apple Music';
    if (h.includes('soundcloud')) return 'SoundCloud';
    return h;
  } catch { return 'Link'; }
}
