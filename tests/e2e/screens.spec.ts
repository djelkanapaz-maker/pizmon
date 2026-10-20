// Opens every admin screen and checks it renders without a server error, in both languages.
import { test, expect } from '@playwright/test';
import { adminClient, TEST_PASSWORD } from '../helpers/stack';

const ADMIN = ['/admin', '/admin/couples', '/admin/djs', '/admin/catalog', '/admin/taxonomy', '/admin/moments', '/admin/playlists', '/admin/content', '/admin/radio', '/admin/questionnaire', '/admin/settings', '/admin/notifications'];

for (const locale of ['he', 'en'] as const) {
  test(`admin screens render (${locale})`, async ({ browser }) => {
    await adminClient();
    const ctx = await browser.newContext({ ...test.info().project.use, locale: locale === 'he' ? 'he-IL' : 'en-US' });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/login'); await page.waitForLoadState('networkidle');
    await page.locator('#email').fill('admin@wmc.test');
    await page.locator('#password').fill(TEST_PASSWORD);
    await page.locator('form button[type=submit]').click();
    await page.waitForURL('**/admin');
    for (const path of ADMIN) {
      const res = await page.goto(path); await page.waitForLoadState('networkidle');
      expect(res?.status(), path).toBe(200);
      await expect(page.locator('h1').first(), path).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
      await page.screenshot({ path: `test-results/screens/admin-${locale}${path.replaceAll('/', '-')}.png`, fullPage: true });
    }
    // one catalog detail page
    await page.goto('/admin/catalog'); await page.waitForLoadState('networkidle');
    await page.locator('a[href^="/admin/catalog/"]').first().click();
    await page.waitForURL(/\/admin\/catalog\/[0-9a-f-]{36}/); await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').first()).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
