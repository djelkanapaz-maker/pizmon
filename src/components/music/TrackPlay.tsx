'use client';
import { PlayToggle } from '@/components/audio/MiniPlayer';
import { SpotifyPlayButton } from '@/components/audio/SpotifyPlayer';
import { playableSource, type TrackLike } from './listening';

/** The right play button for a track: licensed in-app audio, or Spotify's official player. */
export function TrackPlay({ track, size = 'sm' }: { track: TrackLike & { provider?: string | null; provider_track_id?: string | null }; size?: 'sm' | 'md' | 'lg' }) {
  const src = playableSource(track);
  if (src) return <PlayToggle source={src} size={size} />;
  if (track.provider === 'spotify' && track.provider_track_id) return <SpotifyPlayButton trackId={track.provider_track_id} title={track.title} size={size} />;
  return null;
}
