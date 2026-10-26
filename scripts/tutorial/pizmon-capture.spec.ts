// Captures the couple screens for the Pizmon couples tutorial video, from the LOCAL stack.
// Spotify artwork can't load offline, so those image requests get a brand-toned placeholder.
import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { adminClient, activate, COMPANY_ID, fn, sql, token, TEST_PASSWORD } from '../../tests/helpers/stack';

const OUT = 'scripts/tutorial/out/pz-shots';
mkdirSync(OUT, { recursive: true });
type Shot = { id: string; file: string; kind: 'mobile' | 'desktop'; box?: { x: number; y: number; w: number; h: number }; vw: number; vh: number };
const shots: Shot[] = [];
const failures: string[] = [];
const settle = (p: Page) => p.waitForLoadState('networkidle').catch(() => undefined);

async function snap(page: Page, id: string, focus?: Locator, kind: Shot['kind'] = 'mobile') {
  await page.waitForTimeout(500);
  await page.addStyleTag({ content: 'div[aria-live="polite"].fixed{display:none!important} nextjs-portal{display:none!important}' }).catch(() => undefined);
  let box: Shot['box'];
  if (focus) {
    await focus.first().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(300);
    const b = await focus.first().boundingBox({ timeout: 3000 }).catch(() => null);
    if (b) box = { x: b.x, y: b.y, w: b.width, h: b.height };
  }
  const file = `${OUT}/${id}.png`;
  await page.screenshot({ path: file });
  const vp = page.viewportSize()!;
  shots.push({ id, file, kind, box, vw: vp.width, vh: vp.height });
}
async function step(name: string, fnc: () => Promise<void>) {
  try { await fnc(); } catch (e) { failures.push(`${name}: ${(e as Error).message.split('\n')[0]}`); }
}

const PALETTE = [['#D7C3A6', '#A89886'], ['#E9DCC8', '#C9B596'], ['#A89886', '#5E5247'], ['#F1E7D8', '#D7C3A6'], ['#1F1F1F', '#5E5247']];
function art(url: string) {
  let h = 0; for (const ch of url) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [a, b] = PALETTE[h % PALETTE.length];
  const r = 20 + (h % 50);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><circle cx="150" cy="150" r="${70 + r}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/><circle cx="150" cy="150" r="${30 + r / 3}" fill="#fff" fill-opacity=".18"/><circle cx="150" cy="150" r="6" fill="#fff" fill-opacity=".6"/></svg>`;
}

const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'he-IL' };
test.setTimeout(1_500_000);
test.use({ actionTimeout: 10_000, navigationTimeout: 30_000 });

test('pizmon couple tutorial capture', async ({ browser }) => {
  const admin = await adminClient();
  await sql(readFileSync('scripts/tutorial/demo-playlists.sql', 'utf8')).catch((e) => failures.push('playlists sql: ' + e.message));
  const [elkana] = await sql<{ id: string; user_id: string | null }>(`select id, user_id from public.djs where company_id = $1 and display_name = 'Elkana Paz'`, [COMPANY_ID]);
  let djClient;
  if (!elkana.user_id) {
    const link = await fn('link_dj_account', { dj_id: elkana.id, email: `elkana-${Date.now() % 100000}@pizmon.test` }, await token(admin));
    expect(link.status).toBe(200);
    djClient = await activate(link.body.activation_link);
    await djClient.rpc('save_google_connection', { p_dj: elkana.id, p_cipher: 'fake', p_email: 'djelkanapaz@gmail.com' });
  }

  const wedding = new Date(Date.now() + 26 * 86_400_000).toISOString().slice(0, 10);
  const created = await fn('create_couple', {
    company_id: COMPANY_ID, partner_one_name: 'דניאל', partner_two_name: 'נועה', email: `noa-daniel-${Date.now() % 100000}@pizmon.test`, wedding_date: wedding,
    venue_name: 'אחוזת השרון', venue_city: 'תל אביב', guest_count: 350, locale: 'he',
  }, await token(admin));
  expect(created.status).toBe(200);
  const eventId = created.body.event_id as string;

  const ctx = await browser.newContext(MOBILE);
  await ctx.route(/spotifycdn\.com|scdn\.co|i\.ytimg\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: art(r.request().url()) }));
  const c = await ctx.newPage();

  // 01 opening / 02 activation
  await c.goto('/login'); await settle(c);
  await snap(c, 'p01-login');
  await c.goto(created.body.activation_link); await settle(c);
  await c.waitForURL('**/activate/start?**'); await settle(c);
  await snap(c, 'p02-start', c.getByRole('button', { name: 'המשך לבחירת סיסמה' }));
  await c.getByRole('button', { name: 'המשך לבחירת סיסמה' }).click();
  await c.waitForURL('**/activate'); await settle(c);
  await c.locator('#password').fill(TEST_PASSWORD);
  await c.locator('#confirm').fill(TEST_PASSWORD);
  await snap(c, 'p02-password', c.locator('form button[type=submit]'));
  await c.locator('form button[type=submit]').click();
  await c.waitForURL((u) => !u.pathname.startsWith('/activate')); await settle(c);

  // 04 onboarding
  await step('onboarding', async () => {
    await snap(c, 'p04-welcome', c.getByRole('button', { name: 'מתחילים' }));
    await c.getByRole('button', { name: 'מתחילים' }).click(); await settle(c);
    await c.getByRole('heading', { level: 1 }).first().waitFor();
    const dj = c.getByRole('button', { name: /אישור הדיג/ });
    if (await dj.isVisible().catch(() => false)) { await dj.click(); await settle(c); }
    await c.getByText('הדיג׳יי שלכם מאושר').first().waitFor({ timeout: 8000 }).catch(() => undefined);
    await snap(c, 'p04-dj', c.getByText('הדיג׳יי שלכם מאושר').first());
    await c.getByRole('button', { name: 'המשך', exact: true }).click(); await settle(c);
    await c.locator('#cultural').fill('חצי מהאורחים ממשפחה מרוקאית, ואנחנו מאוד אוהבים האוס ודיסקו.');
    await snap(c, 'p04-details', c.locator('#cultural'));
    await c.getByRole('button', { name: 'כניסה לסביבה שלנו' }).click();
    await c.waitForURL('**/home'); await settle(c);
  });

  // 05 home
  await step('home', async () => {
    if (!c.url().includes('/home')) { await c.goto('/home'); await settle(c); }
    const dlg = c.getByRole('dialog');
    if (await dlg.isVisible({ timeout: 6000 }).catch(() => false)) {
      await snap(c, 'p12-popup', dlg);
      await dlg.getByRole('button', { name: 'אחר כך' }).click();
    }
    const later = c.getByRole('button', { name: 'אחר כך' });
    if (await later.first().isVisible().catch(() => false)) { await later.first().click(); await c.waitForTimeout(500); }
    await c.evaluate(() => window.scrollTo(0, 0));
    await snap(c, 'p05-home', c.getByText('הצעד הבא'));
    await snap(c, 'p05-progress', c.getByText('התקדמות התכנון'));
  });

  // 03 add to home screen (profile)
  await step('profile', async () => {
    await c.goto('/profile'); await settle(c);
    await snap(c, 'p03-install', c.getByText('הוספה למסך הבית').first());
  });

  // 06 discover
  await step('discover', async () => {
    await c.goto('/discover'); await settle(c);
    await snap(c, 'p06-library', c.getByRole('search').or(c.locator('input[type=search], input[name=q]')).first());
    await c.mouse.wheel(0, 700); await c.waitForTimeout(400);
    await snap(c, 'p06-shelves');
    await c.goto('/discover?q=' + encodeURIComponent('עומר אדם')); await settle(c);
    await snap(c, 'p06-search', c.locator('input[type=search], input[name=q]').first());
    const firstTrack = c.locator('ul li button[aria-haspopup=dialog]').first();
    await firstTrack.click(); await settle(c);
    await snap(c, 'p06-track', c.getByRole('dialog').getByRole('button', { name: /שמירה|לרגע מיוחד/ }).first());
    await c.keyboard.press('Escape');
  });

  // 07 playlist
  await step('playlist', async () => {
    await c.goto('/discover'); await settle(c);
    await c.getByRole('link', { name: /Hupa songs|כניסה לחופה/ }).first().click(); await settle(c);
    const plus = c.getByRole('button', { name: /הוספה לפלייליסט שלנו:/ });
    await snap(c, 'p07-collection', plus.first());
    for (let i = 0; i < 3; i++) { await plus.nth(0).click(); await c.waitForTimeout(700); }
    await snap(c, 'p07-added', c.getByRole('button', { name: /בפלייליסט שלנו:/ }).first());
    await c.goto('/wedding/playlists'); await settle(c);
    await snap(c, 'p07-ours', c.getByText('הפלייליסט שלנו').first());
  });

  // 08 moments
  await step('moments', async () => {
    await c.goto('/wedding/moments'); await settle(c);
    await snap(c, 'p08-moments', c.getByRole('link', { name: /שיר כניסה לחופה/ }).first());
    await c.getByRole('link', { name: /שיר כניסה לחופה/ }).first().click(); await settle(c);
    await c.getByRole('button', { name: 'שני שירים: לחתן ולכלה' }).click();
    await c.getByLabel('שיר לחתן').fill('Perfect - Ed Sheeran');
    await c.getByLabel('שיר לכלה').fill('ממעמקים - עידן רייכל');
    await c.getByLabel('שיר לכלה').blur(); await settle(c); await c.waitForTimeout(800);
    await snap(c, 'p08-chuppah', c.getByLabel('שיר לכלה'));
    await c.goto('/wedding/moments/breaking-the-glass'); await settle(c);
    await snap(c, 'p08-glass', c.getByRole('button', { name: 'עברי / ישראלי' }));
  });

  // 09 questionnaire
  await step('questionnaire', async () => {
    await c.goto('/wedding/questionnaire'); await settle(c);
    await snap(c, 'p09-questionnaire', c.locator('ol li').first());
    await c.goto('/wedding/questionnaire/personality'); await settle(c);
    for (const g of ['האוס', 'דיסקו ופאנק', 'פופ ישראלי', 'מזרחית וים תיכונית']) await c.getByRole('button', { name: g, exact: true }).first().click().catch(() => undefined);
    await snap(c, 'p09-genres', c.getByRole('button', { name: 'האוס', exact: true }).first());
    await c.mouse.wheel(0, 900); await c.waitForTimeout(500);
    await snap(c, 'p09-energy', c.getByText('נשמר אוטומטית').first());
  });

  // 10 must / never
  await step('restrictions', async () => {
    await c.goto('/wedding/restrictions'); await settle(c);
    await c.locator('#col-never_play').locator('..').locator('..').getByRole('button', { name: 'הוספה' }).click();
    const sheet = c.getByRole('dialog');
    await sheet.getByRole('button', { name: 'אמן' }).click();
    await sheet.locator('input[role=combobox]').fill('ABBA');
    await sheet.getByRole('option', { name: /ABBA/ }).click();
    await sheet.locator('#reason').fill('לא בחתונה שלנו');
    await snap(c, 'p10-never', sheet.getByText('מוחלט').first());
    await sheet.locator('button[type=submit]').click(); await settle(c);
    await c.evaluate(() => window.scrollTo(0, 0));
    await snap(c, 'p10-list', c.locator('#col-never_play'));
  });

  // 11 recommendation from the DJ (inserted as Elkana)
  await step('recommendation', async () => {
    const [t] = await sql<{ id: string }>(`select id from public.music_tracks where title ilike '%September%' limit 1`);
    const [dj] = await sql<{ user_id: string }>(`select user_id from public.djs where id = $1`, [elkana.id]);
    if (t) await sql(`insert into public.dj_recommendations (event_id, dj_id, track_id, message, created_by) values ($1, $2, $3, 'מושלם לפתיחת הרחבה!', $4)`, [eventId, elkana.id, t.id, dj.user_id]);
    await c.goto('/wedding/recommendations'); await settle(c);
    await snap(c, 'p11-recs', c.getByRole('button', { name: 'אהבנו' }).first());
  });

  // 12 meeting
  await step('meeting', async () => {
    await c.goto('/wedding/meeting'); await settle(c);
    const freeDay = c.locator('[role=grid] button:not([disabled])').first();
    await freeDay.waitFor({ timeout: 8000 });
    await snap(c, 'p12-calendar', freeDay);
    await freeDay.click();
    await c.getByRole('button', { name: /^1[0-9]:00$/ }).first().click();
    await c.getByRole('radio', { name: /בזום/ }).click();
    await snap(c, 'p12-details', c.getByRole('button', { name: 'קביעת הפגישה' }));
    await c.getByRole('button', { name: 'קביעת הפגישה' }).click(); await settle(c);
    await snap(c, 'p12-booked', c.getByText('הפגישה נקבעה').first());
  });

  // 13 brief
  await step('brief', async () => {
    await c.goto('/wedding/brief'); await settle(c);
    await snap(c, 'p13-brief', c.getByText('האישיות המוזיקלית').first());
    await snap(c, 'p13-send', c.getByRole('button', { name: 'שליחת התקציר לדיג׳יי' }));
  });

  // 14 notifications + radio
  await step('notifications', async () => {
    await c.goto('/notifications'); await settle(c);
    await snap(c, 'p14-notifications');
    await c.goto('/radio'); await settle(c);
    await snap(c, 'p14-radio', c.getByRole('heading', { name: 'רדיו' }));
  });

  // 15 closing
  await step('closing', async () => {
    await c.goto('/home'); await settle(c); await c.waitForTimeout(2500);
    const later = c.getByRole('button', { name: 'אחר כך' });
    if (await later.first().isVisible().catch(() => false)) { await later.first().click(); await c.waitForTimeout(800); }
    await snap(c, 'p15-home', c.getByText('הצעד הבא'));
    await c.mouse.wheel(0, 650); await c.waitForTimeout(600);
    await snap(c, 'p15-home-scroll', c.getByText('התקדמות התכנון'));
  });

  writeFileSync('scripts/tutorial/out/pz-shots.json', JSON.stringify(shots, null, 1));
  writeFileSync('scripts/tutorial/out/pz-failures.txt', failures.join('\n'));
});
