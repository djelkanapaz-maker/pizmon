import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { supabaseServer } from '@/lib/supabase/server';
import { formatDate, formatDateTime } from '@/i18n/format';
import { loadBrief } from '../brief';
import { getActiveAssignment, getEvent, TRACK_SELECT, type Track } from '../queries';
import type { BriefAssets, BriefDoc } from './template';

/** Everything the one-page brief shows, read with the caller's own permissions (RLS). */
export async function loadBriefDoc(eventId: string, companyId: string, locale: 'he' | 'en'): Promise<BriefDoc | null> {
  const db = await supabaseServer();
  const [data, event, assignment, { data: meeting }, { data: main }] = await Promise.all([
    loadBrief(eventId, companyId, locale),
    getEvent(eventId),
    getActiveAssignment(eventId),
    db.from('dj_meetings').select('starts_at, mode').eq('event_id', eventId).eq('status', 'booked').maybeSingle(),
    db.from('playlists').select(`playlist_tracks(position, status, note, track:music_tracks(${TRACK_SELECT}))`)
      .eq('event_id', eventId).eq('kind', 'couple').eq('is_main', true).maybeSingle(),
  ]);
  if (!data || !event) return null;
  const b = data.brief;
  type Item = { position: number; status: string | null; note: string | null; track: Track | null };
  const items = ((main?.playlist_tracks ?? []) as unknown as Item[]).filter((x) => x.track).sort((x, y) => x.position - y.position);
  const he = locale === 'he';
  const where = [event.venue_name, event.venue_city].filter(Boolean).join(he ? ', ' : ', ');
  const mode = meeting?.mode === 'zoom' ? (he ? 'בזום' : 'Zoom') : (he ? 'במשרד' : 'at the office');
  return {
    locale,
    couple: [event.partner_one_name, event.partner_two_name].filter(Boolean).join(' & '),
    date: event.wedding_date ? formatDate(event.wedding_date, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '',
    venue: where,
    guests: event.guest_count,
    djName: assignment?.dj?.display_name ?? null,
    meeting: meeting ? `${formatDateTime(meeting.starts_at as string, locale)} · ${mode}` : null,
    generatedAt: formatDate(new Date(), locale, { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Asia/Jerusalem' }),
    submitted: data.response?.status === 'submitted',
    moments: b.moments.filter((m) => m.required || m.song).map((m) => ({ name: m.name, song: m.song, backup: m.backup, status: m.status })),
    favoriteGenres: b.favoriteGenres,
    dislikedGenres: b.dislikedGenres,
    dislikedSpecific: b.dislikedSpecific,
    favoriteArtists: b.favoriteArtists,
    vibes: b.vibes,
    eras: b.eras,
    languages: b.languages,
    traditions: b.traditions,
    israeliShare: b.israeliShare,
    mustPlay: b.mustPlay.map((x) => (x.reason ? `${x.label} (${x.reason})` : x.label)),
    neverAbsolute: b.neverPlayAbsolute.map((x) => (x.reason ? `${x.label} (${x.reason})` : x.label)),
    neverPreference: b.neverPlayPreference.map((x) => (x.reason ? `${x.label} (${x.reason})` : x.label)),
    playlist: items.map((x) => ({ title: x.track!.title, artist: x.track!.artist?.name ?? '', status: x.status, note: x.note })),
    playlistTotal: items.length,
    familyNotes: b.familyNotes ?? (event.cultural_notes?.trim() || null),
    djNotes: b.djNotes,
  };
}

let assets: BriefAssets | null = null;
/** Hebrew + Latin fonts and the logo, inlined so the PDF renderer needs no network or system fonts. */
export function briefAssets(): BriefAssets {
  if (assets) return assets;
  const fs = join(process.cwd(), 'src/server/brief-pdf/fonts');
  const font = (family: string, file: string, weight: number) => ({ family, weight, base64: readFileSync(join(fs, file)).toString('base64') });
  assets = {
    fonts: [
      ...[400, 500, 700].flatMap((w) => [font('Heebo', `heebo-hebrew-${w}.woff2`, w), font('Heebo', `heebo-latin-${w}.woff2`, w)]),
      ...[800].flatMap((w) => [font('Rubik', `rubik-hebrew-${w}.woff2`, w), font('Rubik', `rubik-latin-${w}.woff2`, w)]),
    ],
    logoSvg: readFileSync(join(process.cwd(), 'public/brand/atisuto-slick.svg'), 'utf8').replace(/<\?xml[^>]*\?>/, ''),
  };
  return assets;
}
