'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminCtx } from '@/server/admin-ctx';
import { callAdminFn } from '@/server/admin-fn';
import { errorCode, fail, ok, type ActionResult } from '@/server/result';

const uuid = z.guid();


const coupleInput = z.object({
  partner_one_name: z.string().trim().min(1).max(80),
  partner_two_name: z.string().trim().max(80).optional(),
  email: z.email().max(254),
  wedding_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  venue_name: z.string().trim().max(120).optional(),
  venue_city: z.string().trim().max(80).optional(),
  guest_count: z.string().regex(/^\d{0,4}$/).optional(),
  locale: z.enum(['he', 'en']).default('he'),
  dj_id: uuid.optional().or(z.literal('')),
  send_email: z.boolean().default(false),
});

export async function adminCreateCouple(input: unknown): Promise<ActionResult<{ eventId: string; link: string; emailSent: boolean }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = coupleInput.safeParse(input);
  if (!p.success) return fail('validation', Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.code])));
  const r = await callAdminFn<{ event_id: string; activation_link: string; email: { sent: boolean } }>('create_couple', {
    ...p.data, company_id: c.s.company.id, wedding_date: p.data.wedding_date || null, guest_count: p.data.guest_count || null, dj_id: p.data.dj_id || null,
  });
  if (!r.ok) return fail(r.error);
  revalidatePath('/admin', 'layout');
  return ok({ eventId: r.data.event_id, link: r.data.activation_link, emailSent: !!r.data.email?.sent });
}

export async function adminActivationLink(target: { eventId?: string; djId?: string }, sendEmail = false): Promise<ActionResult<{ link: string; emailSent: boolean }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const r = await callAdminFn<{ activation_link: string; email: { sent: boolean } }>('activation_link', { event_id: target.eventId, dj_id: target.djId, send_email: sendEmail });
  if (!r.ok) return fail(r.error);
  return ok({ link: r.data.activation_link, emailSent: !!r.data.email?.sent });
}

export async function adminAddPartner(eventId: string, email: string): Promise<ActionResult<{ link: string }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  if (!z.email().safeParse(email).success) return fail('validation');
  const r = await callAdminFn<{ activation_link: string }>('add_partner', { event_id: eventId, email });
  if (!r.ok) return fail(r.error);
  revalidatePath(`/admin/couples/${eventId}`);
  return ok({ link: r.data.activation_link });
}

export async function adminAssignDj(eventId: string, djId: string, confirm: boolean): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  if (!uuid.safeParse(eventId).success || !uuid.safeParse(djId).success) return fail('validation');
  const { error } = await c.db.rpc('admin_assign_dj', { p_event: eventId, p_dj: djId, p_confirm: confirm });
  if (error) return fail(errorCode(error));
  revalidatePath('/admin', 'layout');
  return ok(undefined);
}

export async function adminDecideAssignment(assignmentId: string, approve: boolean, note?: string): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const { error } = await c.db.rpc('admin_decide_assignment', { p_assignment: assignmentId, p_approve: approve, p_note: note?.slice(0, 500) || null });
  if (error) return fail(errorCode(error));
  revalidatePath('/admin', 'layout');
  return ok(undefined);
}

export async function adminGrantAccess(eventId: string, userId: string, grant: boolean): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const { error } = grant
    ? await c.db.from('event_access_grants').upsert({ event_id: eventId, user_id: userId, granted_by: c.s.userId }, { onConflict: 'event_id,user_id' })
    : await c.db.from('event_access_grants').delete().eq('event_id', eventId).eq('user_id', userId);
  if (error) return fail(errorCode(error));
  revalidatePath(`/admin/couples/${eventId}`);
  return ok(undefined);
}

const djInput = z.object({
  display_name: z.string().trim().min(1).max(80),
  email: z.email().max(254).optional().or(z.literal('')),
  bio_he: z.string().trim().max(2000).optional(),
  bio_en: z.string().trim().max(2000).optional(),
  specialties: z.string().max(400).optional(),
});

export async function adminCreateDj(input: unknown): Promise<ActionResult<{ djId: string; link: string | null }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = djInput.safeParse(input);
  if (!p.success) return fail('validation');
  const r = await callAdminFn<{ dj_id: string; activation_link: string | null }>('create_dj', {
    company_id: c.s.company.id, display_name: p.data.display_name, email: p.data.email || undefined,
    bio_he: p.data.bio_he, bio_en: p.data.bio_en,
    specialties: (p.data.specialties ?? '').split(',').map((x) => x.trim()).filter(Boolean),
  });
  if (!r.ok) return fail(r.error);
  revalidatePath('/admin/djs');
  return ok({ djId: r.data.dj_id, link: r.data.activation_link });
}

export async function adminUpdateDj(djId: string, input: unknown): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = z.object({
    display_name: z.string().trim().min(1).max(80), bio_he: z.string().trim().max(2000).optional(), bio_en: z.string().trim().max(2000).optional(),
    specialties: z.string().max(400).optional(), photo_url: z.url().max(1000).optional().or(z.literal('')),
    is_active: z.boolean(), accepts_new_couples: z.boolean(), sort_order: z.coerce.number().int().min(0).max(999).default(0),
  }).safeParse(input);
  if (!p.success || !uuid.safeParse(djId).success) return fail('validation');
  const { error } = await c.db.from('djs').update({
    ...p.data, photo_url: p.data.photo_url || null, bio_he: p.data.bio_he || null, bio_en: p.data.bio_en || null,
    specialties: (p.data.specialties ?? '').split(',').map((x) => x.trim()).filter(Boolean),
  }).eq('id', djId).eq('company_id', c.s.company.id);
  if (error) return fail(errorCode(error));
  revalidatePath('/admin/djs'); revalidatePath(`/admin/djs/${djId}`);
  return ok(undefined);
}

export async function adminLinkDjAccount(djId: string, email: string): Promise<ActionResult<{ link: string }>> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  if (!z.email().safeParse(email).success) return fail('validation');
  const r = await callAdminFn<{ activation_link: string }>('link_dj_account', { dj_id: djId, email });
  if (!r.ok) return fail(r.error);
  revalidatePath(`/admin/djs/${djId}`);
  return ok({ link: r.data.activation_link });
}

export async function adminUpdateSettings(input: unknown): Promise<ActionResult> {
  const c = await adminCtx(); if (!c) return fail('admin_only');
  const p = z.object({
    brand_name: z.string().trim().min(1).max(60), brand_tagline_he: z.string().trim().max(160).optional(), brand_tagline_en: z.string().trim().max(160).optional(),
    assignment_policy: z.enum(['couple_selects', 'company_assigned']), couple_selection_requires_approval: z.boolean(),
    default_locale: z.enum(['he', 'en']), contact_email: z.email().optional().or(z.literal('')),
  }).safeParse(input);
  if (!p.success) return fail('validation');
  const { error } = await c.db.from('companies').update({ ...p.data, contact_email: p.data.contact_email || null }).eq('id', c.s.company.id);
  if (error) return fail(errorCode(error));
  revalidatePath('/', 'layout');
  return ok(undefined);
}
