// Captures the screens for the Hebrew tutorial videos from the LOCAL stack.
// Run: scripts/tutorial/make.sh (sets up the stack, the demo wedding and runs this).
import { test, expect, type Page, type BrowserContext, type Locator } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { adminClient, activate, COMPANY_ID, fn, sql, token, TEST_PASSWORD } from '../../tests/helpers/stack';

const OUT = 'scripts/tutorial/out/shots';
mkdirSync(OUT, { recursive: true });
type Shot = { id: string; file: string; kind: 'mobile' | 'desktop'; box?: { x: number; y: number; w: number; h: number }; vw: number; vh: number };
const shots: Shot[] = [];
const settle = (p: Page) => p.waitForLoadState('networkidle').catch(() => undefined);

async function snap(page: Page, id: string, kind: Shot['kind'], focus?: Locator) {
  await page.waitForTimeout(450);
  // keep transient toasts out of the frames
  await page.addStyleTag({ content: 'div[aria-live="polite"].fixed{display:none!important}' }).catch(() => undefined);
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
  shots.push({ id, file, kind, box, vw: vp.width, vh: vp.height });
}

const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'he-IL' };
const DESKTOP = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, locale: 'he-IL' };

test.setTimeout(1_500_000);

test('tutorial capture', async ({ browser }) => {
  // ── demo data ──
  const admin = await adminClient();
  await sql(readFileSync('scripts/tutorial/demo-playlists.sql', 'utf8'));
  await sql(`update public.playlists set purpose = 'ceremony' where spotify_playlist_id in ('3NSFElDCyaNmcMoGWn6iuW','4ylDUKmogCJsLcFAWHROaw')`);
  await sql(`update public.playlists set status = 'archived' where kind = 'editorial' and spotify_playlist_id is null`);
  const [noam] = await sql<{ id: string }>(`select id from public.djs where company_id = $1 and display_name = 'Noam Kochav'`, [COMPANY_ID]);
  const djEmail = `noam-${Date.now() % 100000}@atisuto.test`;
  const link = await fn('link_dj_account', { dj_id: noam.id, email: djEmail }, await token(admin));
  expect(link.status).toBe(200);
  const djClient = await activate(link.body.activation_link);
  await djClient.rpc('save_google_connection', { p_dj: noam.id, p_cipher: 'fake', p_email: 'noam@atisuto.com' });

  const wedding = new Date(Date.now() + 26 * 86_400_000).toISOString().slice(0, 10);
  const coupleEmail = `noa-daniel-${Date.now() % 100000}@atisuto.test`;
  const created = await fn('create_couple', {
    company_id: COMPANY_ID, partner_one_name: 'דניאל', partner_two_name: 'נועה', email: coupleEmail, wedding_date: wedding,
    venue_name: 'אחוזת השרון', venue_city: 'תל אביב', guest_count: 350, locale: 'he', dj_id: noam.id,
  }, await token(admin));
  expect(created.status).toBe(200);
  const eventId = created.body.event_id as string;
  await sql(`update public.dj_assignments set status = 'proposed' where event_id = $1`, [eventId]);

  // ── couple (phone) ──
  const cctx: BrowserContext = await browser.newContext(MOBILE);
  const c = await cctx.newPage();
  await c.goto('/login'); await settle(c);
  await snap(c, 'c01-login', 'mobile', c.locator('form'));
  await c.goto(created.body.activation_link); await settle(c);
  await c.waitForURL('**/activate'); await settle(c);
  await c.locator('#password').fill(TEST_PASSWORD);
  await c.locator('#confirm').fill(TEST_PASSWORD);
  await snap(c, 'c02-activate', 'mobile', c.locator('form button[type=submit]'));
  await c.locator('form button[type=submit]').click();
  await c.waitForURL('**/onboarding'); await settle(c);
  await snap(c, 'c03-welcome', 'mobile', c.getByRole('button', { name: 'מתחילים' }));
  await c.getByRole('button', { name: 'מתחילים' }).click(); await settle(c);
  await snap(c, 'c04-dj-confirm', 'mobile', c.getByRole('button', { name: /אישור הדיג/ }));
  await c.getByRole('button', { name: /אישור הדיג/ }).click(); await settle(c);
  await expect(c.getByText('הדיג׳יי שלכם מאושר')).toBeVisible();
  await snap(c, 'c05-dj-confirmed', 'mobile', c.getByText('הדיג׳יי שלכם מאושר'));
  await c.getByRole('button', { name: 'המשך' }).click(); await settle(c);
  await snap(c, 'c06-details', 'mobile', c.locator('#cultural'));
  await c.locator('#cultural').fill('חצי מהאורחים ממשפחה מרוקאית, ואנחנו מאוד אוהבים האוס ודיסקו.');
  await c.getByRole('button', { name: 'כניסה לסביבה שלנו' }).click();
  await c.waitForURL('**/home'); await settle(c);
  // within a month of the wedding the booking calendar pops up
  await expect(c.getByRole('dialog')).toBeVisible({ timeout: 8000 });
  await settle(c);
  await snap(c, 'c07-meeting-popup', 'mobile', c.getByRole('dialog'));
  await c.getByRole('dialog').getByRole('button', { name: 'אחר כך' }).click();
  await snap(c, 'c08-home', 'mobile', c.getByText('הצעד הבא'));
  await snap(c, 'c09-home-dj', 'mobile', c.getByText('התקדמות התכנון'));
  await snap(c, 'c10-home-playlist', 'mobile', c.getByRole('link', { name: /הפלייליסט שלנו/ }));

  await c.goto('/discover'); await settle(c);
  await snap(c, 'c11-library', 'mobile', c.getByText('רעיונות לשירי חופה'));
  await c.getByRole('link', { name: /Hupa songs/ }).first().click(); await settle(c);
  const plus = c.getByRole('button', { name: /הוספה לפלייליסט שלנו:/ });
  await snap(c, 'c12-collection', 'mobile', plus.first());
  await plus.nth(0).click(); await c.waitForTimeout(700);
  await plus.nth(1).click(); await c.waitForTimeout(700);
  await snap(c, 'c13-added', 'mobile', c.getByRole('button', { name: /בפלייליסט שלנו:/ }).first());
  await c.getByRole('button', { name: /^ניגון:/ }).first().waitFor({ timeout: 3000 }).catch(() => undefined);
  await snap(c, 'c14-play', 'mobile', c.getByRole('button', { name: /^ניגון:/ }).first());
  await c.goto('/discover?q=' + encodeURIComponent('עומר אדם')); await settle(c);
  await snap(c, 'c15-search', 'mobile', c.locator('input[type=search], input[name=q]').first());
  const firstTrack = c.locator('ul li button[aria-haspopup=dialog]').first();
  await firstTrack.click(); await settle(c);
  await snap(c, 'c16-track-sheet', 'mobile', c.getByRole('dialog').getByRole('button', { name: /לרגע מיוחד/ }));
  await c.keyboard.press('Escape');

  await c.goto('/wedding'); await settle(c);
  await snap(c, 'c17-wedding-hub', 'mobile', c.getByRole('link', { name: /השאלון המוזיקלי/ }));
  await c.goto('/wedding/questionnaire'); await settle(c);
  await snap(c, 'c18-questionnaire', 'mobile', c.locator('ol li').first());
  await c.goto('/wedding/questionnaire/personality'); await settle(c);
  for (const g of ['האוס', 'דיסקו ופאנק', 'פופ ישראלי', 'מזרחית וים תיכונית']) await c.getByRole('button', { name: g, exact: true }).first().click();
  await snap(c, 'c19-genres', 'mobile', c.getByRole('button', { name: 'האוס', exact: true }).first());
  const disliked = c.locator('fieldset', { hasText: 'ז׳אנרים שפחות מתאימים לכם' });
  await disliked.getByRole('button', { name: 'רוק', exact: true }).click();
  await disliked.getByRole('button', { name: 'טכנו', exact: true }).click();
  const specific = c.locator('fieldset', { hasText: 'אמנים או שירים ספציפיים' }).locator('textarea');
  await specific.fill('בלי "מקרנה" ובלי שירי ילדים 🙂');
  await specific.blur();
  await expect(c.getByText('נשמר אוטומטית')).toBeVisible();
  await snap(c, 'c20-dislikes', 'mobile', specific);
  await c.goto('/wedding/questionnaire/moments'); await settle(c);
  await snap(c, 'c21-moments', 'mobile', c.getByRole('link', { name: /שיר כניסה לחופה/ }));
  await c.getByRole('link', { name: /שיר כניסה לחופה/ }).click(); await settle(c);
  await c.getByRole('button', { name: 'שני שירים: לחתן ולכלה' }).click();
  await expect(c.getByLabel('שיר לכלה')).toBeVisible();
  await c.getByLabel('שיר לחתן').fill('Perfect - Ed Sheeran');
  await c.getByLabel('שיר לכלה').fill('ממעמקים - עידן רייכל');
  await c.getByLabel('שיר לכלה').blur();
  await settle(c); await c.waitForTimeout(800);
  await snap(c, 'c22-chuppah', 'mobile', c.getByLabel('שיר לכלה'));
  await c.goto('/wedding/moments/first-dance'); await settle(c);
  await c.getByRole('button', { name: 'בחירה', exact: true }).first().click(); await settle(c);
  await c.goto('/wedding/moments'); await settle(c);
  await snap(c, 'c23-chuppah-confirmed', 'mobile', c.getByText(/מתוך \d+ נבחרו/).first());
  await c.goto('/wedding/moments/breaking-the-glass'); await settle(c);
  await snap(c, 'c24-glass', 'mobile', c.getByRole('button', { name: 'עברי / ישראלי' }));

  await c.goto('/wedding/playlists'); await settle(c);
  await snap(c, 'c25-our-playlist', 'mobile', c.getByPlaceholder('הערה לדיג׳יי').first());

  await c.goto('/wedding/restrictions'); await settle(c);
  await c.locator('#col-never_play').locator('..').locator('..').getByRole('button', { name: 'הוספה' }).click();
  const sheet = c.getByRole('dialog');
  await sheet.getByRole('button', { name: 'אמן' }).click();
  await sheet.locator('input[role=combobox]').fill('ABBA');
  await sheet.getByRole('option', { name: /ABBA/ }).click();
  await sheet.locator('#reason').fill('לא בחתונה שלנו');
  await snap(c, 'c26-never-play', 'mobile', sheet.locator('button[type=submit]'));
  await sheet.locator('button[type=submit]').click(); await settle(c);

  await c.goto('/wedding/meeting'); await settle(c);
  const freeDay = c.locator('[role=grid] button:not([disabled])').first();
  await freeDay.waitFor();
  await snap(c, 'c27-meeting-calendar', 'mobile', freeDay);
  await freeDay.click();
  const slot = c.getByRole('button', { name: /^1[0-9]:00$/ }).first();
  await slot.click();
  await c.getByRole('radio', { name: /במשרד/ }).click();
  await snap(c, 'c28-meeting-details', 'mobile', c.getByRole('button', { name: 'קביעת הפגישה' }));
  await c.getByRole('button', { name: 'קביעת הפגישה' }).click(); await settle(c);
  await expect(c.getByText('הפגישה נקבעה').first()).toBeVisible();
  await snap(c, 'c29-meeting-booked', 'mobile', c.getByText('הפגישה נקבעה').first());

  await c.goto('/wedding/brief'); await settle(c);
  await snap(c, 'c30-brief', 'mobile', c.getByRole('button', { name: 'שליחת התקציר לדיג׳יי' }));
  await c.getByRole('button', { name: 'שליחת התקציר לדיג׳יי' }).click(); await settle(c);
  await c.goto('/radio'); await settle(c);
  await snap(c, 'c31-radio', 'mobile', c.getByRole('heading', { name: 'רדיו' }));
  await c.goto('/profile'); await settle(c);
  await snap(c, 'c32-profile', 'mobile', c.getByRole('button', { name: 'EN' }));

  // a question from the couple to the DJ (shows in the DJ's requests tab)
  const [{ id: reqId }] = await sql<{ id: string }>(
    `insert into public.couple_requests (event_id, category, title, description, created_by)
     select $1, 'israeli_balance', 'כמה מוזיקה ישראלית בסט הרחבה?', 'אנחנו מתלבטים בין חצי-חצי לבין יותר לועזי.', cm.user_id from public.couple_members cm where cm.event_id = $1 limit 1 returning id`, [eventId]);
  await sql(`insert into public.request_messages (request_id, author_id, body) select $1, created_by, description from public.couple_requests where id = $1`, [reqId]);

  // ── DJ (computer) ──
  const dctx = await browser.newContext(DESKTOP);
  const d = await dctx.newPage();
  await d.goto('/login'); await settle(d);
  await d.locator('#email').fill(djEmail);
  await d.locator('#password').fill(TEST_PASSWORD);
  await snap(d, 'd01-login', 'desktop', d.locator('form button[type=submit]'));
  await d.locator('form button[type=submit]').click();
  await d.waitForURL((u) => !u.pathname.startsWith('/login')); await settle(d);
  await d.goto('/dj'); await settle(d);
  await snap(d, 'd02-couples', 'desktop', d.getByRole('link', { name: /דניאל & נועה/ }).first());
  await d.getByRole('link', { name: /דניאל & נועה/ }).first().click(); await settle(d);
  await snap(d, 'd03-workspace', 'desktop', d.getByRole('note'));
  const base = d.url().split('?')[0];
  // bring the tab bar to the top so the tab's content fills the frame
  const toTabs = () => d.locator('nav.mt-6.border-b').first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 12)).catch(() => undefined);
  const tab = async (t: string, id: string, focus?: (p: Page) => Locator) => { await d.goto(`${base}?tab=${t}`); await settle(d); await toTabs(); await snap(d, id, 'desktop', focus?.(d)); };
  await tab('brief', 'd04-brief', (p) => p.getByText('ז׳אנרים אהובים').first());
  await tab('moments', 'd05-moments', (p) => p.getByText('שיר לכלה').first());
  await tab('playlists', 'd06-playlists', (p) => p.getByText('הפלייליסט שלנו').first());
  await d.goto(`${base}?tab=recommendations`); await settle(d);
  await d.locator('input[role=combobox]').fill('September');
  await d.getByRole('option', { name: /September/ }).first().click();
  await d.locator('#rec-msg').fill('מושלם לפתיחת הרחבה!');
  await toTabs();
  await snap(d, 'd07-recommend', 'desktop', d.locator('#rec-msg'));
  await d.getByRole('button', { name: 'שליחה' }).click(); await settle(d);
  await tab('requests', 'd08-requests', (p) => p.getByText('כמה מוזיקה ישראלית').first());
  await d.goto(`${base}?tab=notes`); await settle(d);
  await d.locator('textarea').first().fill('להביא רמיקס מזרחי לשבירת הכוס. הסבתא של הכלה מבקשת שיר של זוהר ארגוב.');
  await toTabs();
  await snap(d, 'd09-notes', 'desktop', d.locator('textarea').first());
  await tab('activity', 'd10-activity', (p) => p.getByRole('button', { name: /סימון כנבדק|נבדק/ }).first());
  await d.goto('/dj/profile'); await settle(d);
  await snap(d, 'd11-calendar', 'desktop', d.getByText('יומן ופגישות תיאום').first());

  // couple sees the DJ recommendation
  await c.goto('/wedding/recommendations'); await settle(c);
  await snap(c, 'c33-recommendation', 'mobile', c.getByRole('button', { name: 'אהבנו' }).first());

  writeFileSync('scripts/tutorial/out/shots.json', JSON.stringify(shots, null, 1));
});
