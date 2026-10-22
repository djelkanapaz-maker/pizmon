// Captures the company admin screens for the admin tutorial video (desktop), from the LOCAL stack.
// Run after capture.spec.ts (it seeds the demo wedding and DJ). Adds a* shots to out/shots.json.
import { test, type Page, type Locator } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { adminClient, TEST_PASSWORD } from '../../tests/helpers/stack';

const OUT = 'scripts/tutorial/out/shots';
const INDEX = 'scripts/tutorial/out/shots.json';
mkdirSync(OUT, { recursive: true });
type Shot = { id: string; file: string; kind: 'mobile' | 'desktop'; box?: { x: number; y: number; w: number; h: number }; vw: number; vh: number };
const shots: Shot[] = [];
const settle = (p: Page) => p.waitForLoadState('networkidle').catch(() => undefined);

async function snap(page: Page, id: string, focus?: Locator) {
  await page.waitForTimeout(450);
  await page.addStyleTag({ content: '.splash{display:none!important} div[aria-live="polite"].fixed{display:none!important}' }).catch(() => undefined);
  let box: Shot['box'];
  if (focus) {
    await focus.first().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(250);
    const b = await focus.first().boundingBox({ timeout: 3000 }).catch(() => null);
    if (b) box = { x: b.x, y: b.y, w: b.width, h: b.height };
  }
  const file = `${OUT}/${id}.png`;
  await page.screenshot({ path: file });
  const vp = page.viewportSize()!;
  shots.push({ id, file, kind: 'desktop', box, vw: vp.width, vh: vp.height });
}

test.setTimeout(600_000);

test('admin tutorial capture', async ({ browser }) => {
  await adminClient();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, locale: 'he-IL' });
  const a = await ctx.newPage();
  const go = async (path: string) => { await a.goto(path); await settle(a); };

  await go('/login');
  await a.locator('#email').fill('admin@wmc.test');
  await a.locator('#password').fill(TEST_PASSWORD);
  await snap(a, 'a01-login', a.locator('form button[type=submit]'));
  await a.locator('form button[type=submit]').click();
  await a.waitForURL('**/admin'); await settle(a);
  await snap(a, 'a02-overview', a.getByText('תקצירים שנשלחו').first());
  await a.mouse.wheel(0, 500); await a.waitForTimeout(300);
  await snap(a, 'a03-overview-djs', a.getByRole('heading', { name: 'דיג׳ייז' }).first());

  await go('/admin/couples');
  await snap(a, 'a04-couples', a.getByRole('link', { name: /דניאל & נועה/ }).first());
  await a.getByRole('button', { name: 'הוספת זוג' }).first().click();
  await a.locator('#n-p1').fill('יונתן');
  await a.locator('#n-p2').fill('שירה');
  await a.locator('#n-email').fill(`shira-yonatan-${Date.now() % 100000}@atisuto.test`);
  const d = new Date(Date.now() + 120 * 86_400_000).toISOString().slice(0, 10);
  await a.locator('#n-date').fill(d);
  await a.locator('#n-g').fill('280');
  await a.locator('#n-v').fill('גן אירועים לדוגמה');
  await a.locator('#n-c').fill('ראשון לציון');
  const dj = a.locator('#n-dj');
  const opt = await dj.locator('option', { hasText: 'Noam Kochav' }).first().getAttribute('value').catch(() => null);
  if (opt) await dj.selectOption(opt);
  await snap(a, 'a05-new-couple', a.locator('#n-email'));
  await a.getByRole('dialog').locator('button[type=submit]').click(); await settle(a);
  await a.getByText('קישור הפעלה').first().waitFor({ timeout: 15000 }).catch(() => undefined);
  await snap(a, 'a06-activation', a.getByText('קישור הפעלה').first());
  await a.getByRole('button', { name: 'פתיחת סביבת העבודה' }).click(); await settle(a);
  await a.waitForURL(/\/admin\/couples\/[0-9a-f-]{36}/).catch(() => undefined); await settle(a);
  await snap(a, 'a07-couple-admin', a.getByText('שיבוץ דיג׳יי').first());

  await go('/admin/djs');
  await snap(a, 'a08-djs', a.getByRole('button', { name: 'הוספת דיג׳יי' }).first());
  await a.getByRole('button', { name: 'הוספת דיג׳יי' }).first().click(); await a.waitForTimeout(500);
  await snap(a, 'a09-new-dj', a.getByRole('dialog').locator('input').first());
  await a.keyboard.press('Escape'); await a.waitForTimeout(300);

  await go('/admin/playlists');
  await snap(a, 'a10-playlists', a.getByText('פלייליסטים מספוטיפיי').first());
  await a.mouse.wheel(0, 450); await a.waitForTimeout(300);
  await snap(a, 'a11-playlists-list', a.getByText('כניסה לחופה עברית').first());

  await go('/admin/catalog');
  await snap(a, 'a12-catalog', a.locator('table tr').nth(1));
  await go('/admin/taxonomy');
  await snap(a, 'a13-taxonomy', a.getByRole('button', { name: /הוספת ז׳אנר/ }).first());
  await go('/admin/moments');
  await snap(a, 'a14-moments', a.getByRole('button', { name: 'הוספת רגע' }).first());
  await go('/admin/questionnaire');
  await snap(a, 'a15-questionnaire', a.getByRole('button', { name: /גרסה חדשה/ }).first());
  await go('/admin/content');
  await snap(a, 'a16-content', a.getByRole('button', { name: 'הוספת תוכן' }).first());
  await go('/admin/radio');
  await snap(a, 'a17-radio', a.getByText('תחנה').first());
  await go('/admin/settings');
  await snap(a, 'a18-settings', a.getByText('מדיניות שיבוץ דיג׳יי').first());

  const prev: Shot[] = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : [];
  writeFileSync(INDEX, JSON.stringify([...prev.filter((s) => !s.id.startsWith('a')), ...shots], null, 1));
});
