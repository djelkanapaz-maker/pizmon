import 'server-only';
import { cache } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import type { QuestionnaireDefinition, Answers } from '@/core/questionnaire/types';
import { sectionStatus } from '@/core/questionnaire/answers';
import type { Restriction } from '@/core/restrictions';
import type { SelectionStatus } from '@/core/moments';
import type { ProgressFacts } from '@/core/progress';

export const TRACK_SELECT =
  'id, title, artist_id, genre_id, energy, language, decade, artwork_url, preview_url, playback_url, external_url, rights_status, is_demo, artist:artists(name), genre:genres(name_he, name_en)';

export type Track = {
  id: string; title: string; artist_id: string; genre_id: string | null; energy: number | null; language: string | null;
  decade: number | null; artwork_url: string | null; preview_url: string | null; playback_url: string | null;
  external_url: string | null; rights_status: 'metadata_only' | 'preview_licensed' | 'full_licensed' | 'company_owned'; is_demo: boolean;
  artist: { name: string } | null; genre: { name_he: string; name_en: string } | null;
};

export type WeddingEvent = {
  id: string; company_id: string; partner_one_name: string; partner_two_name: string | null; wedding_date: string | null;
  venue_name: string | null; venue_city: string | null; guest_count: number | null; languages: string[]; cultural_notes: string | null;
  onboarding_step: 'welcome' | 'dj' | 'details' | 'done'; onboarding_completed_at: string | null; is_demo: boolean; created_at: string; updated_at: string;
};

export type Dj = {
  id: string; display_name: string; slug: string; bio_he: string | null; bio_en: string | null; specialties: string[];
  photo_url: string | null; is_active: boolean; accepts_new_couples: boolean; is_demo: boolean; user_id?: string | null;
  logo_url: string | null; links: Record<string, string>; kind: 'dj' | 'live';
};

export const DJ_SELECT = 'id, display_name, slug, bio_he, bio_en, specialties, photo_url, is_active, accepts_new_couples, is_demo, logo_url, links, kind';

export type Assignment = { id: string; status: 'proposed' | 'pending_approval' | 'confirmed' | 'declined' | 'ended'; source: string; created_at: string; dj: Dj | null };

export type Moment = { id: string; slug: string; name_he: string; name_en: string; description_he: string | null; description_en: string | null; sort_order: number; is_required: boolean; has_language_collections: boolean };

export type Selection = {
  id: string; moment_id: string; status: SelectionStatus; primary_track_id: string | null; backup_track_id: string | null;
  custom_song: string | null; shortlist: string[]; notes: string | null; confirmed_at: string | null; updated_at: string;
};

export const trackLabel = (t: Pick<Track, 'title' | 'artist'> | null | undefined) => (t ? `${t.title} — ${t.artist?.name ?? ''}` : '');

export const getEvent = cache(async (eventId: string) => {
  const db = await supabaseServer();
  const { data } = await db.from('wedding_events').select('*').eq('id', eventId).maybeSingle();
  return data as WeddingEvent | null;
});

export const getActiveAssignment = cache(async (eventId: string) => {
  const db = await supabaseServer();
  const { data } = await db.from('dj_assignments')
    .select(`id, status, source, created_at, dj:djs(${DJ_SELECT})`)
    .eq('event_id', eventId).in('status', ['proposed', 'pending_approval', 'confirmed']).maybeSingle();
  return data as unknown as Assignment | null;
});

export const getMoments = cache(async (companyId: string) => {
  const db = await supabaseServer();
  const { data } = await db.from('wedding_moments').select('*').eq('company_id', companyId).eq('is_active', true).order('sort_order');
  return (data ?? []) as Moment[];
});

export const getSelections = cache(async (eventId: string) => {
  const db = await supabaseServer();
  const { data } = await db.from('moment_selections').select('*').eq('event_id', eventId);
  return (data ?? []) as Selection[];
});

export const getRestrictions = cache(async (eventId: string) => {
  const db = await supabaseServer();
  const { data } = await db.from('music_restrictions')
    .select('*, track:music_tracks(title, artist:artists(name)), artist:artists(name), genre:genres(name_he, name_en)')
    .eq('event_id', eventId).order('created_at');
  return (data ?? []) as (Restriction & {
    created_at: string;
    track: { title: string; artist: { name: string } | null } | null;
    artist: { name: string } | null;
    genre: { name_he: string; name_en: string } | null;
  })[];
});

export const describeRestriction = (r: Awaited<ReturnType<typeof getRestrictions>>[number], locale: 'he' | 'en') =>
  r.target_type === 'track' ? `${r.track?.title ?? ''} — ${r.track?.artist?.name ?? ''}`
  : r.target_type === 'artist' ? r.artist?.name ?? ''
  : r.target_type === 'genre' ? (locale === 'he' ? r.genre?.name_he : r.genre?.name_en) ?? ''
  : r.text_value ?? '';

export const getQuestionnaire = cache(async (eventId: string, companyId: string) => {
  const db = await supabaseServer();
  const { data: resp } = await db.from('questionnaire_responses')
    .select('id, answers, status, submitted_at, updated_at, version:questionnaire_versions(id, version, definition)')
    .eq('event_id', eventId).maybeSingle();
  if (resp) {
    const v = resp.version as unknown as { id: string; version: number; definition: QuestionnaireDefinition };
    return { response: { id: resp.id as string, answers: (resp.answers ?? {}) as Answers, status: resp.status as 'in_progress' | 'submitted', submitted_at: resp.submitted_at as string | null, updated_at: resp.updated_at as string }, definition: v.definition, version: v.version };
  }
  // not started: show the latest published version of the active template
  const { data: v } = await db.from('questionnaire_versions')
    .select('id, version, definition, questionnaire:questionnaires!inner(company_id, is_active)')
    .eq('questionnaire.company_id', companyId).eq('questionnaire.is_active', true).not('published_at', 'is', null)
    .order('version', { ascending: false }).limit(1).maybeSingle();
  if (!v) return null;
  return { response: null, definition: v.definition as QuestionnaireDefinition, version: v.version as number };
});

export const getTracksByIds = async (ids: string[]) => {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [] as Track[];
  const db = await supabaseServer();
  const { data } = await db.from('music_tracks').select(TRACK_SELECT).in('id', unique);
  return (data ?? []) as unknown as Track[];
};

export const getGenres = cache(async (companyId: string) => {
  const db = await supabaseServer();
  const { data } = await db.from('genres').select('id, slug, name_he, name_en').eq('company_id', companyId).order('sort_order');
  return (data ?? []) as { id: string; slug: string; name_he: string; name_en: string }[];
});

/** Facts for progress & next action — every number is a count of real rows. */
export async function getProgressFacts(eventId: string, companyId: string): Promise<ProgressFacts & { djStatusRaw: Assignment | null }> {
  const db = await supabaseServer();
  const [event, assignment, moments, selections, restrictions, q, recs, clar] = await Promise.all([
    getEvent(eventId), getActiveAssignment(eventId), getMoments(companyId), getSelections(eventId), getRestrictions(eventId),
    getQuestionnaire(eventId, companyId),
    db.from('dj_recommendations').select('id, response:recommendation_responses(id)').eq('event_id', eventId),
    db.from('couple_requests').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('opened_by_staff', true).eq('status', 'awaiting_couple'),
  ]);
  const required = moments.filter((m) => m.is_required);
  const confirmedRequired = required.filter((m) => selections.some((s) => s.moment_id === m.id && s.status === 'confirmed')).length;
  const qSections = q?.definition.sections.filter((s) => s.kind === 'questions') ?? [];
  const facts = { event: event ?? undefined, restrictionsCount: restrictions.length, requiredMoments: required.length, confirmedRequiredMoments: confirmedRequired };
  const complete = q ? qSections.filter((s) => sectionStatus(s, q.response?.answers ?? {}, facts).complete).length : 0;
  const pendingRecs = ((recs.data ?? []) as { response: unknown[] | { id: string } | null }[]).filter((r) => !r.response || (Array.isArray(r.response) && r.response.length === 0)).length;
  return {
    onboardingDone: !!event?.onboarding_completed_at,
    djStatus: assignment ? (assignment.status as ProgressFacts['djStatus']) : 'none',
    questionnaireSectionsTotal: qSections.length,
    questionnaireSectionsComplete: complete,
    questionnaireSubmitted: q?.response?.status === 'submitted',
    requiredMoments: required.length,
    confirmedRequiredMoments: confirmedRequired,
    restrictionsCount: restrictions.length,
    openClarifications: clar.count ?? 0,
    pendingRecommendations: pendingRecs,
    djStatusRaw: assignment,
  };
}
