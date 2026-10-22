// The MVP definition-of-done journey, driven through the real UI on the LOCAL stack.
// Admin creates a couple → couple activates → onboarding → DJ selection → preferences →
// admin approves → DJ sees the profile and recommends → couple responds. Both languages.
import { test, expect, type Page, type Browser } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { adminClient, anonClient, createDj, sql, TEST_PASSWORD, uniq } from '../helpers/stack';

const SHOTS = 'test-results/screens';
mkdirSync(SHOTS, { recursive: true });
/** wait until the page is hydrated and idle before interacting */
const settle = (page: Page) => page.waitForLoadState('networkidle');
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

async function login(browser: Browser, email: string, locale: 'he' | 'en' = 'he') {
  const ctx = await browser.newContext({ ...test.info().project.use, locale: locale === 'he' ? 'he-IL' : 'en-US' });
  const page = await ctx.newPage();
  await page.goto('/login'); await settle(page);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.locator('form button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login')); await settle(page);
  return page;
}

test('admin → couple → DJ end-to-end journey', async ({ browser }) => {
  await adminClient();                       // bootstraps the local admin with a per-run test password
  const djName = `E2E DJ ${Date.now() % 100000}`;
  const dj = await createDj(djName);         // DJ with an activated login
  const coupleEmail = uniq('e2e-couple');

  // ── 1. Admin creates the couple in the UI (Hebrew, RTL) ──
  const admin = await login(browser, 'admin@wmc.test');
  await expect(admin.locator('html')).toHaveAttribute('dir', 'rtl');
  await admin.goto('/admin/couples?new=1'); await settle(admin);
  await admin.locator('#n-p1').fill('נועה');
  await admin.locator('#n-p2').fill('דניאל');
  await admin.locator('#n-email').fill(coupleEmail);
  await admin.locator('#n-date').fill('2027-06-18');
  await admin.locator('#n-v').fill('גן אירועים לדוגמה');
  await admin.getByRole('dialog').locator('button[type=submit]').click();
  const linkEl = admin.getByRole('dialog').locator('code');
  await expect(linkEl).toContainText('/auth/confirm?token_hash=');
  const activation = (await linkEl.textContent())!.trim();
  await shot(admin, '01-admin-couple-created');
  await admin.getByRole('button', { name: 'פתיחת סביבת העבודה' }).click();
  await admin.waitForURL(/\/admin\/couples\/[0-9a-f-]{36}/);
  const coupleAdminUrl = admin.url();

  // ── 2. Couple activates the account and sets a password ──
  const coupleCtx = await browser.newContext({ ...test.info().project.use, locale: 'he-IL' });
  const couple = await coupleCtx.newPage();
  await couple.goto(activation); await settle(couple);
  await couple.waitForURL('**/activate'); await settle(couple);
  await shot(couple, '02-activate');
  await couple.locator('#password').fill(TEST_PASSWORD);
  await couple.locator('#confirm').fill(TEST_PASSWORD);
  await couple.locator('form button[type=submit]').click();

  // ── 3. First-time onboarding ──
  await couple.waitForURL('**/onboarding'); await settle(couple);
  await shot(couple, '03-onboarding-welcome');
  await couple.getByRole('button', { name: 'מתחילים' }).click();
  await expect(couple.getByRole('heading', { name: 'בחרו את הדיג׳יי שלכם' })).toBeVisible();
  await shot(couple, '04-onboarding-djs');
  await couple.getByRole('button', { name: djName }).click();
  await couple.getByRole('dialog').getByRole('button', { name: new RegExp(djName) }).click();
  await expect(couple.getByText('ממתינים לאישור החברה')).toBeVisible();
  await couple.getByRole('button', { name: 'המשך' }).click();
  await expect(couple.locator('#venue')).toHaveValue('גן אירועים לדוגמה');   // prepopulated
  await couple.locator('#guests').fill('280');
  await couple.locator('#start').fill('19:30');
  await couple.locator('#city').fill('תל אביב');
  await shot(couple, '05-onboarding-details');
  await couple.getByRole('button', { name: 'כניסה לסביבה שלנו' }).click();
  await couple.waitForURL('**/home'); await settle(couple);
  await expect(couple.getByRole('heading', { name: 'היי נועה & דניאל' })).toBeVisible();
  await shot(couple, '06-home');

  // returning users go straight home
  await couple.goto('/'); await settle(couple);
  await couple.waitForURL('**/home'); await settle(couple);

  // ── 4. Discover: search + add with the plus ──
  await couple.goto('/discover?q=September'); await settle(couple);
  await expect(couple.getByRole('button', { name: /שמירה: September/ })).toHaveCount(0);
  // every pick converges into the couple's one playlist
  await couple.getByRole('button', { name: /הוספה לפלייליסט שלנו: September/ }).click();
  await expect(couple.getByRole('button', { name: /בפלייליסט שלנו: September/ })).toBeVisible();
  await shot(couple, '07-discover');
  await couple.goto('/wedding/playlists'); await settle(couple);
  await expect(couple.getByRole('heading', { name: 'הפלייליסט שלנו' })).toBeVisible();
  await expect(couple.getByText('September', { exact: true })).toBeVisible();
  await shot(couple, '07b-our-playlist');

  // friends help pick: share link → public page → a friend's suggestion reaches the couple
  await couple.getByRole('button', { name: 'יצירת קישור שיתוף' }).click();
  const shareUrl = (await couple.locator('#friends p[dir=ltr]').innerText()).trim();
  expect(shareUrl).toMatch(/\/s\/[A-Za-z0-9_-]{20,}$/);
  const friendCtx = await browser.newContext({ ...test.info().project.use, locale: 'he-IL' });
  const friend = await friendCtx.newPage();
  await friend.goto(shareUrl); await settle(friend);
  await expect(friend.getByRole('heading', { level: 1 })).toContainText('נועה');
  await expect(friend.getByText('September', { exact: true })).toBeVisible();
  await shot(friend, '07d-share-page');
  const token = shareUrl.split('/s/')[1];
  const { error: sugErr } = await anonClient().rpc('share_suggest', { p_token: token, p_name: 'דנה', p_message: 'חובה!', p_spotify: '2grjqo0Frpf2okIBiifQKs', p_title: 'September', p_artists: 'Earth, Wind & Fire', p_artwork: null });
  expect(sugErr).toBeNull();
  await couple.reload(); await settle(couple);
  await expect(couple.locator('#friends').getByText('מדנה')).toBeVisible();
  await couple.locator('#friends').getByRole('button', { name: /הסרה: September/ }).click(); await settle(couple);
  await expect(couple.locator('#friends').getByText('מדנה')).toHaveCount(0);
  await friend.goto('/s/not-a-real-token-123456789'); await settle(friend);
  await expect(friend.getByText('הקישור הזה כבר לא פעיל')).toBeVisible();
  await friendCtx.close();
  await couple.goto('/wedding/meeting'); await settle(couple);
  await expect(couple.getByRole('heading', { name: 'פגישת תיאום מוזיקה' })).toBeVisible();
  await shot(couple, '07c-meeting');

  // ── 5. Questionnaire with autosave ──
  await couple.goto('/wedding/questionnaire/personality'); await settle(couple);
  await couple.getByRole('button', { name: 'דיסקו ופאנק' }).first().click();
  await couple.getByRole('button', { name: 'האוס' }).first().click();
  await couple.locator('fieldset', { hasText: 'מיינסטרים או אלטרנטיבי' }).getByRole('button', { name: '2', exact: true }).click();
  await expect(couple.getByText('נשמר אוטומטית')).toBeVisible();
  await shot(couple, '08-questionnaire');
  // personality is followed directly by the special moments, listed inline
  await couple.getByRole('link', { name: 'לחלק הבא' }).click(); await settle(couple);
  await expect(couple).toHaveURL(/\/wedding\/questionnaire\/moments$/);
  await expect(couple.getByRole('link', { name: /שבירת הכוס/ })).toBeVisible();
  await shot(couple, '08b-questionnaire-moments');

  // ── 6. Never play (absolute) ──
  await couple.goto('/wedding/restrictions'); await settle(couple);
  await couple.locator('#col-never_play').locator('..').locator('..').getByRole('button', { name: 'הוספה' }).click();
  const sheet = couple.getByRole('dialog');
  await sheet.getByRole('button', { name: 'אמן' }).click();
  await sheet.locator('input[role=combobox]').fill('ABBA');
  await sheet.getByRole('option', { name: /ABBA/ }).click();
  await sheet.locator('#reason').fill('לא בחתונה שלנו');
  await sheet.locator('button[type=submit]').click();
  await expect(couple.getByText('ABBA')).toBeVisible();
  await shot(couple, '09-restrictions');

  // ── 7. Special moment: picking the song is the choice (no approval step) ──
  await couple.goto('/wedding/moments/first-dance'); await settle(couple);
  await couple.getByRole('button', { name: 'בחירה', exact: true }).first().click();
  await expect(couple.getByRole('button', { name: 'אישור הבחירה' })).toHaveCount(0);
  await shot(couple, '10-moment-confirmed');

  // chuppah entrance: two songs, typed freely
  await couple.goto('/wedding/moments/chuppah-entrance'); await settle(couple);
  await couple.getByRole('button', { name: 'שני שירים: לחתן ולכלה' }).click();
  await expect(couple.getByLabel('שיר לכלה')).toBeVisible();
  await couple.getByLabel('שיר לחתן').fill('Perfect - Ed Sheeran');
  await couple.getByLabel('שיר לכלה').fill('ממעמקים - עידן רייכל');
  await couple.getByLabel('שיר לכלה').blur();
  await settle(couple); await couple.waitForTimeout(800);   // let the autosave land
  await couple.goto('/wedding/moments'); await settle(couple);
  await expect(couple.getByText(/2 מתוך \d+ נבחרו/)).toBeVisible();
  await shot(couple, '10b-chuppah-two-songs');

  // ── 8. Review and send the brief ──
  await couple.goto('/wedding/brief'); await settle(couple);
  await expect(couple.getByText('ABBA')).toBeVisible();
  await couple.getByRole('button', { name: 'שליחת התקציר לדיג׳יי' }).click();
  await expect(couple.getByRole('button', { name: 'שליחת תקציר מעודכן' })).toBeVisible();
  await shot(couple, '11-brief');
  // one-page PDF of the brief, for the couple
  const pdfRes = await couple.request.get('/api/brief/pdf');
  expect(pdfRes.status()).toBe(200);
  expect(pdfRes.headers()['content-type']).toBe('application/pdf');
  const pdfBody = await pdfRes.body();
  expect(pdfBody.subarray(0, 5).toString()).toBe('%PDF-');
  writeFileSync(`${SHOTS}/brief-couple.pdf`, pdfBody);

  // ── 9. Admin approves the DJ choice ──
  await admin.goto(coupleAdminUrl); await settle(admin);
  await admin.getByRole('button', { name: 'אישור', exact: true }).click();
  await expect(admin.getByText('מאושר').first()).toBeVisible();
  await shot(admin, '12-admin-approved');

  // ── 9b. Couple books the planning meeting somewhere other than the office/Zoom ──
  await dj.client.rpc('save_google_connection', { p_dj: dj.djId, p_cipher: 'fake', p_email: 'dj@atisuto.test' });
  await couple.goto('/wedding/meeting'); await settle(couple);
  await couple.locator('[role=grid] button:not([disabled])').first().click();
  await couple.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first().click();
  await couple.getByRole('radio', { name: /אחר/ }).click();
  await expect(couple.getByRole('button', { name: 'קביעת הפגישה' })).toBeDisabled();
  await couple.locator('#meeting-place').fill('בית קפה לנדוור, רוטשילד 1');
  await shot(couple, '12b-meeting-other');
  await couple.getByRole('button', { name: 'קביעת הפגישה' }).click(); await settle(couple);
  await expect(couple.getByText('הפגישה נקבעה').first()).toBeVisible();
  await expect(couple.getByText('בית קפה לנדוור, רוטשילד 1')).toBeVisible();

  // ── 10. DJ sees the profile (English, LTR) ──
  const djPage = await login(browser, dj.email, 'en');
  await expect(djPage.locator('html')).toHaveAttribute('dir', 'ltr');
  await djPage.goto('/dj'); await settle(djPage);
  await djPage.getByRole('link', { name: /נועה & דניאל/ }).first().click();
  await expect(djPage.getByRole('note')).toContainText('ABBA');          // absolute ban banner
  await expect(djPage.getByText('Brief submitted').first()).toBeVisible();
  await shot(djPage, '13-dj-brief');
  // …and the same PDF for the assigned DJ (download button on the brief tab)
  const djPdfHref = await djPage.getByRole('link', { name: 'Download brief as PDF' }).getAttribute('href');
  const djPdf = await djPage.request.get(djPdfHref!);
  expect(djPdf.status()).toBe(200);
  expect((await djPdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  writeFileSync(`${SHOTS}/brief-dj.pdf`, await djPdf.body());
  await djPage.getByRole('link', { name: 'Recommend' }).click();
  await djPage.locator('input[role=combobox]').fill('Dancing Queen');
  await djPage.getByRole('option', { name: /Dancing Queen/ }).click();
  await expect(djPage.getByText('Blocked by the couple’s NEVER PLAY list')).toBeVisible();
  await djPage.getByRole('button', { name: 'Clear' }).click();
  await djPage.locator('input[role=combobox]').fill('Get Lucky');
  await djPage.getByRole('option', { name: /Get Lucky/ }).click();
  await djPage.locator('#rec-msg').fill('Perfect for opening the dancefloor');
  await djPage.getByRole('button', { name: 'Send' }).click();
  await expect(djPage.getByText('Recommendation sent')).toBeVisible();
  await djPage.getByRole('link', { name: 'Activity' }).click();
  await expect(djPage.getByText('Confirmed a moment song').first()).toBeVisible();
  await shot(djPage, '14-dj-activity');

  // ── 10b. Wedding day: the DJ is asked to check the couple's playlist and confirm the changes ──
  await expect(djPage.getByText('בית קפה לנדוור, רוטשילד 1').first()).toBeVisible();   // meeting place on the DJ side
  const eventId = djPage.url().match(/\/dj\/couples\/([0-9a-f-]{36})/)![1];
  await sql(`update public.wedding_events set wedding_date = public.israel_today() where id = $1`, [eventId]);
  await djPage.goto('/dj'); await settle(djPage);                     // opening the app queues the wedding-day check
  await djPage.goto('/dj/notifications'); await settle(djPage);
  await djPage.getByText(/Today is .*wedding\. Check the playlist/).first().click();
  await djPage.waitForURL(/\/dj\/couples\//); await settle(djPage);
  const review = djPage.locator('#review');
  await expect(review).toContainText('Wedding day: playlist check');
  await expect(review).toContainText('September');                   // the song the couple added
  await shot(djPage, '14b-dj-wedding-day');
  await review.getByRole('button', { name: 'I’ve reviewed the changes' }).click(); await settle(djPage);
  await expect(review).toContainText('No changes since your last review');
  // a change later that day shows up again and notifies the DJ
  await sql(`delete from public.playlist_tracks where id = (select pt.id from public.playlist_tracks pt join public.playlists p on p.id = pt.playlist_id where p.event_id = $1 and p.kind = 'couple' limit 1)`, [eventId]);
  await djPage.reload(); await settle(djPage);
  await expect(review).toContainText('Changes since your last review: 1');
  const [{ n }] = await sql<{ n: number }>(`select count(*)::int as n from public.notifications where event_id = $1 and type = 'wedding_day_change'`, [eventId]);
  expect(n).toBeGreaterThan(0);

  // ── 11. Couple sees the DJ action and responds ──
  await couple.goto('/wedding/recommendations'); await settle(couple);
  await expect(couple.getByText('Get Lucky')).toBeVisible();
  await couple.getByRole('button', { name: 'אהבנו' }).click();
  await expect(couple.getByText('אושר').first()).toBeVisible();
  await shot(couple, '15-couple-recommendation');

  // ── 12. Language switch on the couple side ──
  await couple.goto('/profile'); await settle(couple);
  await couple.getByRole('button', { name: 'EN' }).click();
  await expect(couple.locator('html')).toHaveAttribute('dir', 'ltr');
  await couple.goto('/home'); await settle(couple);
  await expect(couple.getByText('Planning progress')).toBeVisible();
  await shot(couple, '16-home-en');
});
