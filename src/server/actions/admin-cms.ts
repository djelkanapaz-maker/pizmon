'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminCtx } from '@/server/admin-ctx';
import { errorCode, fail, ok, type ActionResult } from '@/server/result';
import { definitionLatest } from '@/core/questionnaire/definition-v2';

// ─────────────────────────── shared helpers ───────────────────────────
type Ctx = NonNullable<Awaited<ReturnType<typeof adminCtx>>>;
type DbError = { message?: string; code?: string } | null | undefined;

const uuid = z.guid();
const slug = z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/);
const opt = (max: number) => z.string().trim().max(max).optional().default('');
const bool = z.boolean().default(false);
const sortOrder = z.coerce.number().int().min(0).max(9999).default(0);
const publication = z.enum(['draft', 'published', 'archived']);
/** Playable/linkable URL: absolute https:// or a bundled demo asset under /demo-audio/. */
const urlish = z.string().trim().max(1000).refine((v) => v === '' || /^https:\/\/[^\s]+$/i.test(v) || /^\/demo-audio\/[A-Za-z0-9._/-]+$/.test(v), 'url')
  .optional().default('');
const nul = (v: string | undefined | null) => (v && v.length ? v : null);

/** DB error → stable code. Check-constraint violations (e.g. rights vs URL) are validation errors. */
function dbFail(e: DbError): ActionResult<never> {
  if (e?.code === '23514') return fail('validation');
  if (e?.code === '23505') return fail('duplicate');
  if (e?.code === '23503') return fail('in_use');
  return fail(errorCode(e));
}
const invalid = (err: z.ZodError) => fail('validation', Object.fromEntries(err.issues.map((i) => [String(i.path[0] ?? '_'), i.message || i.code])));

async function ownsRow(c: Ctx, table: string, id: string) {
  if (!uuid.safeParse(id).success) return false;
  const { data } = await c.db.from(table).select('id').eq('id', id).eq('company_id', c.s.company.id).maybeSingle();
  return !!data;
}

// ─────────────────────────── tracks ───────────────────────────
const trackInput = z.object({
  title: z.string().trim().min(1).max(200),
  artist_name: z.string().trim().min(1).max(200),
  album: opt(200),
  genre_id: uuid.optional().or(z.literal('')),
  energy: z.string().regex(/^[1-5]?$/).optional().default(''),
  language: z.enum(['he', 'en', 'ar', 'fr', 'es', 'instrumental', 'other']).optional().or(z.literal('')),
  decade: z.string().regex(/^(19|20|21)\d0$|^$/).optional().default(''),
  artwork_url: urlish,
  provider: z.enum(['spotify', 'apple_music', 'youtube', 'soundcloud', 'company']).optional().or(z.literal('')),
  provider_track_id: opt(200),
  preview_url: urlish,
  playback_url: urlish,
  external_url: urlish,
  rights_status: z.enum(['metadata_only', 'preview_licensed', 'full_licensed', 'company_owned']).default('metadata_only'),
  rights_notes: opt(2000),
  status: publication.default('draft'),
});

async function artistId(c: Ctx, name: string): Promise<{ id: string } | { error: DbError }> {
  const company = c.s.company.id;
  const find = () => c.db.from('artists').select('id').eq('company_id', company).eq('name', name).maybeSingle();
  const { data: found } = await find();
  if (found) return { id: found.id as string };
  const { data, error } = await c.db.from('artists').insert({ company_id: company, name }).select('id').single();
  if (data) return { id: data.id as string };
  if (error?.code === '23505') { const { data: again } = await find(); if (again) return { id: again.id as string }; }
  return { error };
}

function trackRow(d: z.infer<typeof trackInput>, artist: string) {
  return {
    title: d.title, artist_id: artist, album: nul(d.album), genre_id: nul(d.genre_id), energy: d.energy ? Number(d.energy) : null,
    language: nul(d.language), decade: d.decade ? Number(d.decade) : null, artwork_url: nul(d.artwork_url), provider: nul(d.provider),
    provider_track_id: nul(d.provider_track_id), preview_url: nul(d.preview_url), playback_url: nul(d.playback_url),
    external_url: nul(d.external_url), rights_status: d.rights_status, rights_notes: nul(d.rights_notes), status: d.status,
  };
}

/** Mirrors the DB constraints so the admin gets a field-level message before the round trip. */
function rightsFields(d: z.infer<typeof trackInput>) {
  const f: Record<string, string> = {};
  if (d.preview_url && d.rights_status === 'metadata_only') f.preview_url = 'rights';
  if (d.playback_url && !['full_licensed', 'company_owned'].includes(d.rights_status)) f.playback_url = 'rights';
  return f;
}

export async function adminCreateTrack(input: unknown): Promise<ActionResult<{ id: string }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = trackInput.safeParse(input);
  if (!p.success) return invalid(p.error);
  const rf = rightsFields(p.data); if (Object.keys(rf).length) return fail('validation', rf);
  if (p.data.genre_id && !(await ownsRow(c, 'genres', p.data.genre_id))) return fail('validation', { genre_id: 'invalid' });
  const a = await artistId(c, p.data.artist_name); if ('error' in a) return dbFail(a.error);
  const { data, error } = await c.db.from('music_tracks').insert({ ...trackRow(p.data, a.id), company_id: c.s.company.id }).select('id').single();
  if (error || !data) return dbFail(error);
  revalidatePath('/admin/catalog');
  return ok({ id: data.id as string });
}

export async function adminUpdateTrack(trackId: string, input: unknown): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = trackInput.safeParse(input);
  if (!p.success || !uuid.safeParse(trackId).success) return p.success ? fail('validation') : invalid(p.error);
  const rf = rightsFields(p.data); if (Object.keys(rf).length) return fail('validation', rf);
  if (p.data.genre_id && !(await ownsRow(c, 'genres', p.data.genre_id))) return fail('validation', { genre_id: 'invalid' });
  const a = await artistId(c, p.data.artist_name); if ('error' in a) return dbFail(a.error);
  const { data, error } = await c.db.from('music_tracks').update(trackRow(p.data, a.id)).eq('id', trackId).eq('company_id', c.s.company.id).select('id');
  if (error) return dbFail(error);
  if (!data?.length) return fail('not_found');
  revalidatePath('/admin/catalog'); revalidatePath(`/admin/catalog/${trackId}`);
  return ok(undefined);
}

export async function adminDeleteTrack(trackId: string): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  if (!uuid.safeParse(trackId).success) return fail('validation');
  const { data, error } = await c.db.from('music_tracks').delete().eq('id', trackId).eq('company_id', c.s.company.id).select('id');
  if (error) return dbFail(error);
  if (!data?.length) return fail('not_found');
  revalidatePath('/admin/catalog');
  return ok(undefined);
}

export async function adminSetTrackStatus(trackId: string, status: string): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const s = publication.safeParse(status);
  if (!s.success || !uuid.safeParse(trackId).success) return fail('validation');
  const { data, error } = await c.db.from('music_tracks').update({ status: s.data }).eq('id', trackId).eq('company_id', c.s.company.id).select('id');
  if (error) return dbFail(error);
  if (!data?.length) return fail('not_found');
  revalidatePath('/admin/catalog'); revalidatePath(`/admin/catalog/${trackId}`);
  return ok(undefined);
}

/** Replaces the track's category + mood tags. */
export async function adminSetTrackTags(trackId: string, tagIds: unknown): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = z.array(uuid).max(100).safeParse(tagIds);
  if (!p.success || !(await ownsRow(c, 'music_tracks', trackId))) return fail('validation');
  const ids = [...new Set(p.data)];
  if (ids.length) {
    const { data: tags } = await c.db.from('tags').select('id').eq('company_id', c.s.company.id).in('id', ids);
    if ((tags ?? []).length !== ids.length) return fail('validation');
  }
  const del = await c.db.from('track_tags').delete().eq('track_id', trackId);
  if (del.error) return dbFail(del.error);
  if (ids.length) {
    const { error } = await c.db.from('track_tags').insert(ids.map((tag_id) => ({ track_id: trackId, tag_id })));
    if (error) return dbFail(error);
  }
  revalidatePath(`/admin/catalog/${trackId}`);
  return ok(undefined);
}

/** Replaces the moments a track is curated for (optional he / intl collection per moment). */
export async function adminSetTrackMoments(trackId: string, moments: unknown): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = z.array(z.object({ moment_id: uuid, collection: z.enum(['he', 'intl']).nullable().optional() })).max(100).safeParse(moments);
  if (!p.success || !(await ownsRow(c, 'music_tracks', trackId))) return fail('validation');
  const rows = [...new Map(p.data.map((x) => [x.moment_id, x])).values()];
  if (rows.length) {
    const { data: ms } = await c.db.from('wedding_moments').select('id').eq('company_id', c.s.company.id).in('id', rows.map((r) => r.moment_id));
    if ((ms ?? []).length !== rows.length) return fail('validation');
  }
  const del = await c.db.from('moment_tracks').delete().eq('track_id', trackId);
  if (del.error) return dbFail(del.error);
  if (rows.length) {
    const { error } = await c.db.from('moment_tracks').insert(rows.map((r) => ({ moment_id: r.moment_id, track_id: trackId, collection: r.collection ?? null })));
    if (error) return dbFail(error);
  }
  revalidatePath(`/admin/catalog/${trackId}`); revalidatePath('/admin/moments');
  return ok(undefined);
}

// ─────────────────────────── genres & tags ───────────────────────────
const namedInput = z.object({ id: uuid.optional().or(z.literal('')), slug, name_he: z.string().trim().min(1).max(80), name_en: z.string().trim().min(1).max(80), sort_order: sortOrder });

async function saveNamed(table: 'genres' | 'tags', input: unknown, extra: Record<string, unknown> = {}): Promise<ActionResult<{ id: string }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = namedInput.safeParse(input);
  if (!p.success) return invalid(p.error);
  const { id, ...row } = p.data;
  const q = id
    ? c.db.from(table).update(row).eq('id', id).eq('company_id', c.s.company.id).select('id')
    : c.db.from(table).insert({ ...row, ...extra, company_id: c.s.company.id }).select('id');
  const { data, error } = await q;
  if (error) return dbFail(error);
  if (!data?.length) return fail('not_found');
  revalidatePath('/admin/taxonomy');
  return ok({ id: data[0].id as string });
}

async function deleteNamed(table: 'genres' | 'tags', id: string): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  if (!uuid.safeParse(id).success) return fail('validation');
  const { data, error } = await c.db.from(table).delete().eq('id', id).eq('company_id', c.s.company.id).select('id');
  if (error) return dbFail(error);
  if (!data?.length) return fail('not_found');
  revalidatePath('/admin/taxonomy');
  return ok(undefined);
}

export async function adminSaveGenre(input: unknown) { return saveNamed('genres', input); }
export async function adminDeleteGenre(id: string) { return deleteNamed('genres', id); }
export async function adminSaveTag(kind: 'category' | 'mood', input: unknown): Promise<ActionResult<{ id: string }>> {
  if (kind !== 'category' && kind !== 'mood') return fail('validation');
  return saveNamed('tags', input, { kind });
}
export async function adminDeleteTag(id: string) { return deleteNamed('tags', id); }

// ─────────────────────────── wedding moments ───────────────────────────
const momentInput = z.object({
  id: uuid.optional().or(z.literal('')), slug, name_he: z.string().trim().min(1).max(80), name_en: z.string().trim().min(1).max(80),
  description_he: opt(1000), description_en: opt(1000), sort_order: sortOrder,
  is_required: bool, is_active: z.boolean().default(true), has_language_collections: bool,
});

export async function adminSaveMoment(input: unknown): Promise<ActionResult<{ id: string }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = momentInput.safeParse(input);
  if (!p.success) return invalid(p.error);
  const { id, ...d } = p.data;
  const row = { ...d, description_he: nul(d.description_he), description_en: nul(d.description_en) };
  const { data, error } = id
    ? await c.db.from('wedding_moments').update(row).eq('id', id).eq('company_id', c.s.company.id).select('id')
    : await c.db.from('wedding_moments').insert({ ...row, company_id: c.s.company.id }).select('id');
  if (error) return dbFail(error);
  if (!data?.length) return fail('not_found');
  revalidatePath('/admin/moments');
  return ok({ id: data[0].id as string });
}

export async function adminDeleteMoment(id: string): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  if (!uuid.safeParse(id).success) return fail('validation');
  const { data, error } = await c.db.from('wedding_moments').delete().eq('id', id).eq('company_id', c.s.company.id).select('id');
  if (error) return dbFail(error);
  if (!data?.length) return fail('not_found');
  revalidatePath('/admin/moments');
  return ok(undefined);
}

// ─────────────────────────── editorial playlists ───────────────────────────
const playlistInput = z.object({
  id: uuid.optional().or(z.literal('')), title: z.string().trim().min(1).max(120), description: opt(2000),
  purpose: z.enum(['reception', 'ceremony', 'dancefloor', 'late_night', 'family', 'inspiration', 'other']).optional().or(z.literal('')),
  status: publication.default('draft'), is_featured: bool,
});

async function ownsEditorial(c: Ctx, playlistId: string) {
  if (!uuid.safeParse(playlistId).success) return false;
  const { data } = await c.db.from('playlists').select('id').eq('id', playlistId).eq('company_id', c.s.company.id).eq('kind', 'editorial').maybeSingle();
  return !!data;
}

export async function adminSavePlaylist(input: unknown): Promise<ActionResult<{ id: string }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = playlistInput.safeParse(input);
  if (!p.success) return invalid(p.error);
  const { id, ...d } = p.data;
  const row = { ...d, description: nul(d.description), purpose: nul(d.purpose) };
  const { data, error } = id
    ? await c.db.from('playlists').update(row).eq('id', id).eq('company_id', c.s.company.id).eq('kind', 'editorial').select('id')
    : await c.db.from('playlists').insert({ ...row, company_id: c.s.company.id, kind: 'editorial', created_by: c.s.userId }).select('id');
  if (error) return dbFail(error);
  if (!data?.length) return fail('not_found');
  revalidatePath('/admin/playlists'); revalidatePath(`/admin/playlists/${data[0].id}`);
  return ok({ id: data[0].id as string });
}

export async function adminSetPlaylistFlags(playlistId: string, flags: unknown): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = z.object({ status: publication.optional(), is_featured: z.boolean().optional() }).safeParse(flags);
  if (!p.success || !(await ownsEditorial(c, playlistId))) return fail('validation');
  const { error } = await c.db.from('playlists').update(p.data).eq('id', playlistId).eq('company_id', c.s.company.id);
  if (error) return dbFail(error);
  revalidatePath('/admin/playlists'); revalidatePath(`/admin/playlists/${playlistId}`);
  return ok(undefined);
}

export async function adminDeletePlaylist(playlistId: string): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  if (!(await ownsEditorial(c, playlistId))) return fail('not_found');
  const { error } = await c.db.from('playlists').delete().eq('id', playlistId).eq('company_id', c.s.company.id).eq('kind', 'editorial');
  if (error) return dbFail(error);
  revalidatePath('/admin/playlists');
  return ok(undefined);
}

export async function adminAddPlaylistTrack(playlistId: string, trackId: string): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  if (!(await ownsEditorial(c, playlistId)) || !(await ownsRow(c, 'music_tracks', trackId))) return fail('validation');
  const { data: last } = await c.db.from('playlist_tracks').select('position').eq('playlist_id', playlistId).order('position', { ascending: false }).limit(1).maybeSingle();
  const { error } = await c.db.from('playlist_tracks').insert({ playlist_id: playlistId, track_id: trackId, position: ((last?.position as number | undefined) ?? -1) + 1, added_by: c.s.userId });
  if (error) return dbFail(error);
  revalidatePath(`/admin/playlists/${playlistId}`); revalidatePath('/admin/playlists');
  return ok(undefined);
}

export async function adminRemovePlaylistTrack(playlistId: string, trackId: string): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  if (!(await ownsEditorial(c, playlistId)) || !uuid.safeParse(trackId).success) return fail('validation');
  const { error } = await c.db.from('playlist_tracks').delete().eq('playlist_id', playlistId).eq('track_id', trackId);
  if (error) return dbFail(error);
  revalidatePath(`/admin/playlists/${playlistId}`); revalidatePath('/admin/playlists');
  return ok(undefined);
}

/** Persists a full ordering (track ids, first → last). */
export async function adminReorderPlaylist(playlistId: string, trackIds: unknown): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = z.array(uuid).max(1000).safeParse(trackIds);
  if (!p.success || !(await ownsEditorial(c, playlistId))) return fail('validation');
  const { data: rows, error: readErr } = await c.db.from('playlist_tracks').select('track_id').eq('playlist_id', playlistId);
  if (readErr) return dbFail(readErr);
  const current = new Set((rows ?? []).map((r) => r.track_id as string));
  if (current.size !== p.data.length || !p.data.every((id) => current.has(id))) return fail('validation');
  const results = await Promise.all(p.data.map((track_id, position) =>
    c.db.from('playlist_tracks').update({ position }).eq('playlist_id', playlistId).eq('track_id', track_id)));
  const err = results.find((r) => r.error)?.error;
  if (err) return dbFail(err);
  revalidatePath(`/admin/playlists/${playlistId}`);
  return ok(undefined);
}

// ─────────────────────────── content items ───────────────────────────
const contentInput = z.object({
  id: uuid.optional().or(z.literal('')),
  kind: z.enum(['mix', 'training_set', 'genre_set', 'editorial', 'new_music', 'behind_the_scenes', 'release', 'seasonal', 'wedding_collection', 'video']),
  title: z.string().trim().min(1).max(200), description: opt(4000), creator_dj_id: uuid.optional().or(z.literal('')),
  artwork_url: urlish, media_url: urlish, external_url: urlish,
  duration_minutes: z.string().regex(/^(\d{1,4}(\.\d{1,2})?)?$/).optional().default(''),
  genre_tags: z.string().max(400).optional().default(''),
  status: publication.default('draft'), visibility: z.enum(['company', 'event']).default('company'),
  visible_event_id: uuid.optional().or(z.literal('')), is_featured: bool,
});

export async function adminSaveContent(input: unknown): Promise<ActionResult<{ id: string }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = contentInput.safeParse(input);
  if (!p.success) return invalid(p.error);
  const d = p.data;
  if (d.visibility === 'event' && !d.visible_event_id) return fail('validation', { visible_event_id: 'required' });
  if (d.visibility === 'event' && d.visible_event_id && !(await ownsRow(c, 'wedding_events', d.visible_event_id))) return fail('validation', { visible_event_id: 'invalid' });
  if (d.creator_dj_id && !(await ownsRow(c, 'djs', d.creator_dj_id))) return fail('validation', { creator_dj_id: 'invalid' });
  const minutes = d.duration_minutes ? Number(d.duration_minutes) : null;
  if (minutes !== null && minutes <= 0) return fail('validation', { duration_minutes: 'positive' });

  let publishedAt: string | null | undefined;
  if (d.id) {
    const { data: prev } = await c.db.from('content_items').select('status, published_at').eq('id', d.id).eq('company_id', c.s.company.id).maybeSingle();
    if (!prev) return fail('not_found');
    if (d.status === 'published' && (prev.status !== 'published' || !prev.published_at)) publishedAt = new Date().toISOString();
  } else if (d.status === 'published') publishedAt = new Date().toISOString();

  const row: Record<string, unknown> = {
    kind: d.kind, title: d.title, description: nul(d.description), creator_dj_id: nul(d.creator_dj_id),
    artwork_url: nul(d.artwork_url), media_url: nul(d.media_url), external_url: nul(d.external_url),
    duration_seconds: minutes ? Math.round(minutes * 60) : null,
    genre_tags: d.genre_tags.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20),
    status: d.status, visibility: d.visibility, visible_event_id: d.visibility === 'event' ? d.visible_event_id : null, is_featured: d.is_featured,
  };
  if (publishedAt !== undefined) row.published_at = publishedAt;
  const { data, error } = d.id
    ? await c.db.from('content_items').update(row).eq('id', d.id).eq('company_id', c.s.company.id).select('id')
    : await c.db.from('content_items').insert({ ...row, company_id: c.s.company.id }).select('id');
  if (error) return dbFail(error);
  if (!data?.length) return fail('not_found');
  revalidatePath('/admin/content');
  return ok({ id: data[0].id as string });
}

export async function adminDeleteContent(id: string): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  if (!uuid.safeParse(id).success) return fail('validation');
  const { data, error } = await c.db.from('content_items').delete().eq('id', id).eq('company_id', c.s.company.id).select('id');
  if (error) return dbFail(error);
  if (!data?.length) return fail('not_found');
  revalidatePath('/admin/content');
  return ok(undefined);
}

// ─────────────────────────── radio ───────────────────────────
const stationInput = z.object({
  name: z.string().trim().min(1).max(120), description: opt(1000), mode: z.enum(['off', 'demo', 'live']),
  stream_url: urlish, metadata_url: urlish,
});

async function primaryStation(c: Ctx) {
  const { data } = await c.db.from('radio_stations').select('id').eq('company_id', c.s.company.id).eq('is_primary', true).order('created_at').limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function adminSaveStation(input: unknown): Promise<ActionResult<{ id: string }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = stationInput.safeParse(input);
  if (!p.success) return invalid(p.error);
  const d = p.data;
  if (d.mode !== 'off' && !d.stream_url) return fail('validation', { stream_url: 'required' });
  const row = { name: d.name, description: nul(d.description), mode: d.mode, stream_url: nul(d.stream_url), metadata_url: nul(d.metadata_url) };
  const existing = await primaryStation(c);
  const { data, error } = existing
    ? await c.db.from('radio_stations').update(row).eq('id', existing).eq('company_id', c.s.company.id).select('id')
    : await c.db.from('radio_stations').insert({ ...row, company_id: c.s.company.id, is_primary: true }).select('id');
  if (error) return dbFail(error);
  if (!data?.length) return fail('not_found');
  revalidatePath('/admin/radio'); revalidatePath('/radio'); revalidatePath('/home');
  return ok({ id: data[0].id as string });
}

const showInput = z.object({
  id: uuid.optional().or(z.literal('')), title: z.string().trim().min(1).max(160), description: opt(1000),
  host_dj_id: uuid.optional().or(z.literal('')),
  // the client converts its datetime-local values to ISO (with the browser's offset) before calling
  starts_at: z.iso.datetime({ offset: true }), ends_at: z.iso.datetime({ offset: true }),
});

export async function adminSaveShow(input: unknown): Promise<ActionResult<{ id: string }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = showInput.safeParse(input);
  if (!p.success) return invalid(p.error);
  const d = p.data;
  const starts = new Date(d.starts_at), ends = new Date(d.ends_at);
  if (!(ends > starts)) return fail('validation', { ends_at: 'order' });
  if (d.host_dj_id && !(await ownsRow(c, 'djs', d.host_dj_id))) return fail('validation', { host_dj_id: 'invalid' });
  const station = await primaryStation(c);
  if (!station) return fail('no_station');
  const row = { title: d.title, description: nul(d.description), host_dj_id: nul(d.host_dj_id), starts_at: starts.toISOString(), ends_at: ends.toISOString() };
  const { data, error } = d.id
    ? await c.db.from('radio_schedule_items').update(row).eq('id', d.id).eq('station_id', station).select('id')
    : await c.db.from('radio_schedule_items').insert({ ...row, station_id: station }).select('id');
  if (error) return dbFail(error);
  if (!data?.length) return fail('not_found');
  revalidatePath('/admin/radio'); revalidatePath('/radio');
  return ok({ id: data[0].id as string });
}

export async function adminDeleteShow(id: string): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  if (!uuid.safeParse(id).success) return fail('validation');
  const station = await primaryStation(c);
  if (!station) return fail('not_found');
  const { data, error } = await c.db.from('radio_schedule_items').delete().eq('id', id).eq('station_id', station).select('id');
  if (error) return dbFail(error);
  if (!data?.length) return fail('not_found');
  revalidatePath('/admin/radio'); revalidatePath('/radio');
  return ok(undefined);
}

// ─────────────────────────── questionnaire versions ───────────────────────────
const ltext = z.object({ he: z.string(), en: z.string() });
const definitionSchema = z.object({
  schema: z.literal(1),
  sections: z.array(z.object({
    id: z.string().min(1), kind: z.enum(['questions', 'restrictions', 'moments', 'brief']), letter: z.string().min(1).max(3),
    title: ltext, intro: ltext,
    questions: z.array(z.looseObject({ id: z.string().min(1), type: z.string().min(1), label: ltext })),
  }).loose()).min(1),
}).loose();

/** Parses + minimally validates a definition. Returns a human-readable path on failure. */
function parseDefinition(json: string): { ok: true; value: unknown } | { ok: false; where: string } {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch (e) { return { ok: false, where: e instanceof Error ? e.message : 'JSON' }; }
  const p = definitionSchema.safeParse(raw);
  if (!p.success) { const i = p.error.issues[0]; return { ok: false, where: `${i.path.join('.') || '(root)'}: ${i.message}` }; }
  const ids = new Set<string>();
  for (const s of p.data.sections) {
    if (ids.has(s.id)) return { ok: false, where: `sections: duplicate id "${s.id}"` };
    ids.add(s.id);
    const q = new Set<string>();
    for (const x of s.questions) {
      if (q.has(x.id)) return { ok: false, where: `sections.${s.id}.questions: duplicate id "${x.id}"` };
      q.add(x.id);
    }
  }
  return { ok: true, value: raw };
}

async function ownVersion(c: Ctx, versionId: string) {
  if (!uuid.safeParse(versionId).success) return null;
  const { data } = await c.db.from('questionnaire_versions').select('id, published_at, questionnaire:questionnaires!inner(company_id)')
    .eq('id', versionId).eq('questionnaire.company_id', c.s.company.id).maybeSingle();
  return data as { id: string; published_at: string | null } | null;
}

/** New draft = copy of the latest version (any state), version = max + 1. Seeds v1 when nothing exists. */
export async function adminCreateQuestionnaireDraft(): Promise<ActionResult<{ id: string; version: number }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  let { data: q } = await c.db.from('questionnaires').select('id').eq('company_id', c.s.company.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!q) {
    const r = await c.db.from('questionnaires').insert({ company_id: c.s.company.id, name: 'Music questionnaire', is_active: true }).select('id').single();
    if (r.error || !r.data) return dbFail(r.error);
    q = r.data;
  }
  const { data: latest } = await c.db.from('questionnaire_versions').select('version, definition').eq('questionnaire_id', q.id).order('version', { ascending: false }).limit(1).maybeSingle();
  const version = ((latest?.version as number | undefined) ?? 0) + 1;
  const { data, error } = await c.db.from('questionnaire_versions')
    .insert({ questionnaire_id: q.id, version, definition: latest?.definition ?? definitionLatest, published_at: null }).select('id').single();
  if (error || !data) return dbFail(error);
  revalidatePath('/admin/questionnaire');
  return ok({ id: data.id as string, version });
}

export async function adminUpdateQuestionnaireDraft(versionId: string, json: string): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  if (typeof json !== 'string' || json.length > 500_000) return fail('validation');
  const v = await ownVersion(c, versionId);
  if (!v) return fail('not_found');
  if (v.published_at) return fail('published_version_immutable');
  const parsed = parseDefinition(json);
  if (!parsed.ok) return fail('validation', { definition: parsed.where });
  const { error } = await c.db.from('questionnaire_versions').update({ definition: parsed.value }).eq('id', versionId).is('published_at', null);
  if (error) return dbFail(error);
  revalidatePath('/admin/questionnaire');
  return ok(undefined);
}

export async function adminPublishQuestionnaireVersion(versionId: string): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const v = await ownVersion(c, versionId);
  if (!v) return fail('not_found');
  if (v.published_at) return fail('published_version_immutable');
  const { data: row } = await c.db.from('questionnaire_versions').select('definition').eq('id', versionId).single();
  const parsed = parseDefinition(JSON.stringify(row?.definition ?? null));
  if (!parsed.ok) return fail('validation', { definition: parsed.where });
  const { error } = await c.db.from('questionnaire_versions').update({ published_at: new Date().toISOString() }).eq('id', versionId).is('published_at', null);
  if (error) return dbFail(error);
  revalidatePath('/admin/questionnaire');
  return ok(undefined);
}

export async function adminDeleteQuestionnaireDraft(versionId: string): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const v = await ownVersion(c, versionId);
  if (!v) return fail('not_found');
  if (v.published_at) return fail('published_version_immutable');
  const { error } = await c.db.from('questionnaire_versions').delete().eq('id', versionId).is('published_at', null);
  if (error) return dbFail(error);
  revalidatePath('/admin/questionnaire');
  return ok(undefined);
}

// ─────────────────────────── media uploads ───────────────────────────
const IMAGE: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const AUDIO: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav' };
const IMAGE_MAX = 5 * 1024 * 1024;
const AUDIO_MAX = 200 * 1024 * 1024;
const SIGNED_TTL = 60 * 60 * 24 * 7;

type Plan = { bucket: 'artwork' | 'media'; kind: 'image' | 'audio'; ext: string; mime: string };
function plan(mime: string, size: number): Plan | 'file_type' | 'file_too_large' {
  if (IMAGE[mime]) return size > IMAGE_MAX ? 'file_too_large' : { bucket: 'artwork', kind: 'image', ext: IMAGE[mime], mime };
  // storage bucket only allows the canonical audio/wav type
  if (AUDIO[mime]) return size > AUDIO_MAX ? 'file_too_large' : { bucket: 'media', kind: 'audio', ext: AUDIO[mime], mime: AUDIO[mime] === 'wav' ? 'audio/wav' : mime };
  return 'file_type';
}

async function urlFor(c: Ctx, bucket: Plan['bucket'], path: string): Promise<string | null> {
  if (bucket === 'artwork') return c.db.storage.from(bucket).getPublicUrl(path).data.publicUrl || null;
  const { data } = await c.db.storage.from(bucket).createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl ?? null;
}

async function recordAsset(c: Ctx, pl: Plan, path: string, size: number): Promise<ActionResult<{ url: string; bucket: string; path: string; kind: string }>> {
  const { error } = await c.db.from('media_assets').insert({ company_id: c.s.company.id, bucket: pl.bucket, path, mime_type: pl.mime, size_bytes: size, kind: pl.kind, uploaded_by: c.s.userId });
  if (error) { await c.db.storage.from(pl.bucket).remove([path]); return fail('upload_failed'); }
  const url = await urlFor(c, pl.bucket, path);
  if (!url) return fail('upload_failed');
  revalidatePath('/admin/content');
  return ok({ url, bucket: pl.bucket, path, kind: pl.kind });
}

/** Direct upload through the server action. Subject to the Server Action body limit (1 MB by default),
 *  so the admin UI uses the signed-upload flow below for anything larger. */
export async function uploadMedia(formData: FormData): Promise<ActionResult<{ url: string; bucket: string; path: string; kind: string }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size <= 0) return fail('validation');
  const pl = plan(file.type, file.size);
  if (typeof pl === 'string') return fail(pl);
  const path = `${c.s.company.id}/${pl.kind}/${crypto.randomUUID()}.${pl.ext}`;
  try {
    const { error } = await c.db.storage.from(pl.bucket).upload(path, file, { contentType: pl.mime, upsert: false });
    if (error) return fail('upload_failed');
  } catch {
    return fail('upload_failed');
  }
  return recordAsset(c, pl, path, file.size);
}

/** Step 1 of a large upload: validate and mint a signed upload URL scoped to the company folder. */
export async function adminPrepareUpload(input: unknown): Promise<ActionResult<{ bucket: string; path: string; token: string; contentType: string }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = z.object({ mime: z.string().max(100), size: z.number().int().positive() }).safeParse(input);
  if (!p.success) return fail('validation');
  const pl = plan(p.data.mime, p.data.size);
  if (typeof pl === 'string') return fail(pl);
  const path = `${c.s.company.id}/${pl.kind}/${crypto.randomUUID()}.${pl.ext}`;
  try {
    const { data, error } = await c.db.storage.from(pl.bucket).createSignedUploadUrl(path);
    if (error || !data?.token) return fail('upload_failed');
    return ok({ bucket: pl.bucket, path, token: data.token, contentType: pl.mime });
  } catch {
    return fail('upload_failed');
  }
}

/** Step 2: confirm the object really landed, then record it and return a usable URL. */
export async function adminFinalizeUpload(input: unknown): Promise<ActionResult<{ url: string; bucket: string; path: string; kind: string }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = z.object({ path: z.string().max(300), mime: z.string().max(100), size: z.number().int().positive() }).safeParse(input);
  if (!p.success) return fail('validation');
  const pl = plan(p.data.mime, p.data.size);
  if (typeof pl === 'string') return fail(pl);
  const re = new RegExp(`^${c.s.company.id}/${pl.kind}/[0-9a-f-]{36}\\.${pl.ext}$`);
  if (!re.test(p.data.path)) return fail('validation');
  const [folder, name] = [p.data.path.slice(0, p.data.path.lastIndexOf('/')), p.data.path.slice(p.data.path.lastIndexOf('/') + 1)];
  try {
    const { data, error } = await c.db.storage.from(pl.bucket).list(folder, { search: name, limit: 1 });
    if (error || !data?.some((o) => o.name === name)) return fail('upload_failed');
  } catch {
    return fail('upload_failed');
  }
  return recordAsset(c, pl, p.data.path, p.data.size);
}

// ─────────────────────────── catalog search (admin pickers) ───────────────────────────
export type AdminTrackHit = { id: string; title: string; artist: string | null; status: string; is_demo: boolean };

/** Title ilike search within the company, drafts included. */
export async function adminSearchTracks(q: string): Promise<ActionResult<AdminTrackHit[]>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const term = typeof q === 'string' ? q.replace(/[%_\\]/g, ' ').trim().slice(0, 100) : '';
  if (term.length < 1) return ok([]);
  const { data, error } = await c.db.from('music_tracks').select('id, title, status, is_demo, artist:artists(name)')
    .eq('company_id', c.s.company.id).ilike('title', `%${term}%`).order('title').limit(20);
  if (error) return dbFail(error);
  return ok((data ?? []).map((r) => ({
    id: r.id as string, title: r.title as string, status: r.status as string, is_demo: !!r.is_demo,
    artist: (r.artist as unknown as { name: string } | null)?.name ?? null,
  })));
}
