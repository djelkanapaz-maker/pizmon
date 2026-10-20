import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import { getMoments, getRestrictions } from './queries';
import type { TrackContext } from '@/components/music/TrackList';

export async function getTrackContext(eventId: string, companyId: string): Promise<TrackContext> {
  const db = await supabaseServer();
  const [saved, rejected, playlists, restrictions, moments] = await Promise.all([
    db.from('saved_tracks').select('track_id').eq('event_id', eventId),
    db.from('rejected_tracks').select('track_id').eq('event_id', eventId),
    db.from('playlists').select('id, title').eq('event_id', eventId).eq('kind', 'couple').order('created_at'),
    getRestrictions(eventId),
    getMoments(companyId),
  ]);
  return {
    saved: (saved.data ?? []).map((r) => r.track_id as string),
    rejected: (rejected.data ?? []).map((r) => r.track_id as string),
    playlists: (playlists.data ?? []) as { id: string; title: string }[],
    restrictions: restrictions.map(({ id, kind, strength, target_type, track_id, artist_id, genre_id, text_value }) => ({ id, kind, strength, target_type, track_id, artist_id, genre_id, text_value })),
    moments: moments.map(({ id, name_he, name_en }) => ({ id, name_he, name_en })),
  };
}
