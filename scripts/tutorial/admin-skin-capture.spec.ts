// Local check of the admin desk in both skins: picks the look in Settings, then walks the main admin pages.
//   SHOTS_OUT=… npx playwright test -c scripts/tutorial/playwright.config.ts admin-skin-capture
import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { adminClient, sql, TEST_PASSWORD } from '../../tests/helpers/stack';

const OUT = process.env.SHOTS_OUT ?? 'scripts/tutorial/out/admin-skin';
mkdirSync(OUT, { recursive: true });
const PAGES = ['/admin', '/admin/couples', '/admin/djs', '/admin/playlists', '/admin/catalog', '/admin/moments', '/admin/questionnaire', '/admin/leads', '/admin/settings'];

test('admin desk in both skins', async ({ browser }) => {
  test.setTimeout(600_000);
  await adminClient();
  await sql(`update public.profiles set skin = null where id = (select id from auth.users where email = 'admin@wmc.test')`);
  for (const [vp, tag] of [[{ width: 1440, height: 900 }, 'desk'], [{ width: 390, height: 844 }, 'phone']] as const) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: 'he-IL' });
    const a = await ctx.newPage();
    const errors: string[] = []; a.on('pageerror', (e) => errors.push(e.message));
    await a.goto('/login');
    await a.locator('input[type=email]').fill('admin@wmc.test');
    await a.locator('input[type=password]').fill(TEST_PASSWORD);
    await a.locator('form button[type=submit]').click();
    await a.waitForURL((u) => !u.pathname.startsWith('/login'));
    for (const skin of ['dark', 'light'] as const) {
      await a.goto('/admin/settings'); await a.waitForLoadState('networkidle');
      await a.getByRole('radio', { name: skin === 'dark' ? /כהה/ : /בהיר/ }).click();
      await a.waitForTimeout(1500);
      for (const p of tag === 'desk' ? PAGES : ['/admin', '/admin/settings']) {
        await a.goto(p); await a.waitForLoadState('networkidle').catch(() => undefined); await a.waitForTimeout(600);
        await a.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
        await a.screenshot({ path: `${OUT}/${tag}-${skin}-${p.replaceAll('/', '_') || 'root'}.png` });
      }
      const [row] = await sql<{ skin: string | null }>(`select skin from public.profiles where id = (select id from auth.users where email = 'admin@wmc.test')`);
      console.log(tag, skin, 'saved:', row?.skin, errors.length ? errors : 'no page errors');
    }
    await ctx.close();
  }
});
