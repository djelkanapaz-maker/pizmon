// Local check of the skin choice: onboarding welcome, choosing dark, home + profile in dark, back to light.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { adminClient, COMPANY_ID, fn, sql, token, TEST_PASSWORD } from '../../tests/helpers/stack';
const OUT = process.env.SHOTS_OUT ?? 'scripts/tutorial/out/skin';
mkdirSync(OUT, { recursive: true });
test('skin', async ({ browser }) => {
  test.setTimeout(300_000);
  const admin = await adminClient();
  const [elkana] = await sql<{ id: string }>(`select id from public.djs where company_id = $1 and display_name = 'Elkana Paz'`, [COMPANY_ID]);
  const created = await fn('create_couple', { company_id: COMPANY_ID, partner_one_name: 'מאיה', partner_two_name: 'יונתן', email: `skin-${Date.now() % 100000}@pizmon.test`,
    wedding_date: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10), venue_name: 'גן', venue_city: 'חיפה', guest_count: 200, locale: 'he', dj_id: elkana.id }, await token(admin));
  expect(created.status).toBe(200);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, locale: 'he-IL' });
  const c = await ctx.newPage();
  const shot = (n: string) => c.screenshot({ path: `${OUT}/${n}.png` });
  await c.goto(created.body.activation_link); await c.waitForURL('**/activate/start?**');
  await c.getByRole('button', { name: 'המשך לבחירת סיסמה' }).click(); await c.waitForURL('**/activate');
  await c.locator('#password').fill(TEST_PASSWORD); await c.locator('#confirm').fill(TEST_PASSWORD);
  await c.locator('form button[type=submit]').click(); await c.waitForURL((u) => !u.pathname.startsWith('/activate'));
  await c.waitForTimeout(1500); await shot('1-welcome');
  await c.getByRole('radio', { name: /כהה/ }).click(); await c.waitForTimeout(1200); await shot('2-welcome-dark');
  expect(await c.evaluate(() => document.documentElement.dataset.skin)).toBe('dark');
  await c.getByRole('button', { name: 'מתחילים' }).click(); await c.waitForTimeout(1500);
  const dj = c.getByRole('button', { name: /אישור הדיג/ }); if (await dj.isVisible().catch(() => false)) await dj.click();
  await c.getByRole('button', { name: 'המשך', exact: true }).click(); await c.waitForTimeout(800);
  await c.getByRole('button', { name: 'כניסה לסביבה שלנו' }).click(); await c.waitForURL('**/home'); await c.waitForTimeout(1500);
  await shot('3-home-dark');
  expect(await c.getByRole('dialog').isVisible().catch(() => false)).toBe(false);
  await c.goto('/profile'); await c.waitForTimeout(1500); await shot('4-profile-dark');
  // a fresh device: the account's skin comes back
  const ctx2 = await browser.newContext({ storageState: await ctx.storageState(), viewport: { width: 390, height: 844 } });
  await ctx2.clearCookies({ name: 'paskol_skin' });
  const d = await ctx2.newPage(); await d.goto('/home'); await d.waitForTimeout(2000);
  expect(await d.evaluate(() => document.documentElement.dataset.skin)).toBe('dark');
  await c.getByRole('radio', { name: /בהיר/ }).click(); await c.waitForTimeout(1500); await shot('5-profile-light');
  const [p] = await sql<{ skin: string }>(`select p.skin from public.profiles p join auth.users u on u.id = p.id where u.email like 'skin-%' order by u.created_at desc limit 1`);
  expect(p.skin).toBe('light');
});
