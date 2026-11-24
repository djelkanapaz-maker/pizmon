'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { LOCALE_COOKIE } from '@/i18n/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getSession } from '@/server/session';
import { isSkin, SKIN_COOKIE, type Skin } from '@/core/skin';

export async function setLocale(locale: 'he' | 'en') {
  if (locale !== 'he' && locale !== 'en') return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  const s = await getSession();
  if (s) {
    const db = await supabaseServer();
    await db.from('profiles').update({ locale }).eq('id', s.userId);
  }
  revalidatePath('/', 'layout');
}

/** Saves the chosen skin on this device (cookie, read before the first paint) and on the account. */
export async function setSkin(skin: Skin) {
  if (!isSkin(skin)) return { ok: false as const };
  (await cookies()).set(SKIN_COOKIE, skin, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  const s = await getSession();
  if (s) {
    const db = await supabaseServer();
    await db.from('profiles').update({ skin }).eq('id', s.userId);
  }
  return { ok: true as const };
}

export async function signOut() {
  const db = await supabaseServer();
  await db.auth.signOut();
  redirect('/login');
}

export async function markNotificationsRead(ids?: string[]) {
  const s = await getSession();
  if (!s) return { ok: false as const };
  const db = await supabaseServer();
  let q = db.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', s.userId).is('read_at', null);
  if (ids?.length) q = q.in('id', ids);
  const { error } = await q;
  revalidatePath('/', 'layout');
  return { ok: !error };
}
