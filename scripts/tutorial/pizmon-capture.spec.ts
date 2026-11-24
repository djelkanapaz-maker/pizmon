// Captures the couple screens for the Pizmon couples tutorial video, from the LOCAL stack.
// Spotify artwork can't load offline, so those image requests get a brand-toned placeholder.
import { test, expect, type Page, type Locator } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { adminClient, activate, COMPANY_ID, fn, sql, token, TEST_PASSWORD } from '../../tests/helpers/stack';

const OUT = process.env.SHOTS_OUT ?? 'scripts/tutorial/out/pz-shots';
const THEME = process.env.THEME_CSS ? readFileSync(process.env.THEME_CSS, 'utf8') : '';
const SKIN = process.env.SKIN === 'dark' || process.env.SKIN === 'light' ? process.env.SKIN : '';
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
  await sql(readFileSync('scripts/tutorial/demo-library.sql', 'utf8')).catch((e) => failures.push('library sql: ' + e.message));
  await sql(`update public.radio_stations set name = 'רדיו פסקול' where company_id = $1 and is_primary`, [COMPANY_ID]).catch((e) => failures.push('radio: ' + e.message));
  const [dj0] = await sql<{ id: string }>(`select id from public.djs where company_id = $1 and display_name = 'Elkana Paz'`, [COMPANY_ID]);
  await sql(`update public.content_items set status = 'draft' where company_id = $1 and title like '%(Demo)'`, [COMPANY_ID]).catch(() => undefined);
  await sql(`insert into public.content_items (company_id, kind, title, creator_dj_id, status, is_featured, published_at, media_url)
    select $1, 'mix', t, $2, 'published', true, now() - (o || ' days')::interval, 'https://example.com/mix.mp3'
    from (values ('SWEAT & GROOVE 2026 - MIXED BY DJ ELKANA PAZ', 1), ('LIKY''S 2024 MIXTAPE - Mixed By DJ''s Elkana Paz & Gili Kaneti', 2)) v(t, o)
    where not exists (select 1 from public.content_items c where c.company_id = $1 and c.title = v.t)`, [COMPANY_ID, dj0.id]).catch((e) => failures.push('mixes: ' + e.message));
  const [elkana] = await sql<{ id: string; user_id: string | null }>(`select id, user_id from public.djs where company_id = $1 and display_name = 'Elkana Paz'`, [COMPANY_ID]);
  let djClient;
  if (!elkana.user_id) {
    const link = await fn('link_dj_account', { dj_id: elkana.id, email: `elkana-${Date.now() % 100000}@pizmon.test` }, await token(admin));
    expect(link.status).toBe(200);
    djClient = await activate(link.body.activation_link);
    await djClient.rpc('save_google_connection', { p_dj: elkana.id, p_cipher: 'fake', p_email: 'djelkanapaz@gmail.com' });
  }

  // the demo calendar is "connected" (local only; busy times can't be fetched, so every hour shows as free)
  await sql(`insert into private.google_connections (dj_id, token_cipher, google_email) values ($1, 'fake', 'djelkanapaz@gmail.com') on conflict (dj_id) do nothing`, [elkana.id]).catch((e) => failures.push('google: ' + e.message));
  const wedding = new Date(Date.now() + 26 * 86_400_000).toISOString().slice(0, 10);
  const created = await fn('create_couple', {
    company_id: COMPANY_ID, partner_one_name: 'דניאל', partner_two_name: 'נועה', email: `noa-daniel-${Date.now() % 100000}@pizmon.test`, wedding_date: wedding,
    venue_name: 'אחוזת השרון', venue_city: 'תל אביב', guest_count: 350, locale: 'he', dj_id: elkana.id,
  }, await token(admin));
  expect(created.status).toBe(200);
  const eventId = created.body.event_id as string;
  // production: the one DJ (Elkana) is confirmed from the start
  await sql(`update public.dj_assignments set status = 'confirmed' where event_id = $1`, [eventId]).catch((e) => failures.push('confirm: ' + e.message));

  const ctx = await browser.newContext(MOBILE);
  // real Spotify covers, fetched beforehand into ART_DIR (this machine has no internet); a brand-toned stand-in otherwise
  const ART = process.env.ART_DIR;
  await ctx.route(/spotifycdn\.com|scdn\.co|i\.ytimg\.com/, (r) => {
    const h = r.request().url().split('/').pop() ?? '';
    const f = ART && /^[A-Za-z0-9]+$/.test(h) ? `${ART}/${h}.jpg` : '';
    if (f && existsSync(f)) return r.fulfill({ status: 200, contentType: 'image/jpeg', body: readFileSync(f) });
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: art(r.request().url()) });
  });
  // design studies: an extra stylesheet on every page (THEME_CSS=path)
  if (THEME) await ctx.addInitScript((css) => {
    const add = () => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
  }, THEME);
  const c = await ctx.newPage();

  // 01 opening (public landing) / 02 free sign-up + activation
  await step('landing', async () => {
    await c.goto('/'); await settle(c);
    await snap(c, 'p01-landing');
    await c.goto('/signup'); await settle(c);
    await c.locator('input[name=partner_one_name]').fill('נועה');
    await c.locator('input[name=partner_two_name]').fill('דניאל');
    await c.locator('input[name=phone]').fill('050-123-4567');
    await c.locator('input[name=email]').fill('noa.daniel@example.com');
    await snap(c, 'p02-signup', c.locator('input[name=phone]'));
  });
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
    // SKIN=dark|light: picks that look on the welcome step (saved on the account like a real couple's choice)
    if (SKIN) {
      await c.getByRole('radio', { name: SKIN === 'dark' ? /כהה/ : /בהיר/ }).click();
      await c.waitForTimeout(1200);
    }
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

  const later = async () => {
    const dlg = c.getByRole('dialog');
    if (await dlg.isVisible({ timeout: 2500 }).catch(() => false)) await dlg.getByRole('button', { name: 'אחר כך' }).click().catch(() => undefined);
    const l = c.getByRole('button', { name: 'אחר כך' });
    if (await l.first().isVisible().catch(() => false)) { await l.first().click(); await c.waitForTimeout(500); }
  };

  // 03-04 home: days left, progress, the next step; the questionnaire (what you love / what not)
  await step('home', async () => {
    if (!c.url().includes('/home')) { await c.goto('/home'); await settle(c); }
    await later();
    await c.evaluate(() => window.scrollTo(0, 0));
    await snap(c, 'p05-home', c.getByText(/עוד \d+ ימים/).first());
    await snap(c, 'p05-next', c.getByText('הצעד הבא'));
    await c.mouse.wheel(0, 650); await c.waitForTimeout(500);
    await snap(c, 'p05-progress', c.getByText('התקדמות התכנון'));
    await c.goto('/wedding/questionnaire'); await settle(c);
    await snap(c, 'p09-questionnaire', c.locator('ol li').first());
    await c.goto('/wedding/questionnaire/personality'); await settle(c);
    for (const g of ['האוס', 'דיסקו ופאנק', 'פופ ישראלי', 'מזרחית וים תיכונית']) await c.getByRole('button', { name: g, exact: true }).first().click().catch(() => undefined);
    await snap(c, 'p09-genres', c.getByRole('button', { name: 'האוס', exact: true }).first());
    const avoid = c.getByText('ז׳אנרים שפחות מתאימים לכם').first();
    await avoid.scrollIntoViewIfNeeded();
    const grp = avoid.locator('xpath=ancestor::*[.//button][1]');
    for (const g of ['טראנס', 'טכנו', 'רוק']) await grp.getByRole('button', { name: g, exact: true }).first().click({ timeout: 2000 }).catch(() => undefined);
    await c.waitForTimeout(600);
    await snap(c, 'p09-dislikes', avoid);
  });

  // 07 special moments: suggestions, the main song, groom / bride
  await step('moments', async () => {
    await c.goto('/wedding/moments'); await settle(c);
    await snap(c, 'p08-moments', c.getByRole('link', { name: /שיר כניסה לחופה/ }).first());
    await c.goto('/wedding/moments/chuppah-entrance'); await settle(c);
    await c.getByRole('button', { name: 'עברי', exact: true }).scrollIntoViewIfNeeded(); await c.mouse.wheel(0, 250); await c.waitForTimeout(500);
    await snap(c, 'p06-suggest', c.getByRole('button', { name: 'עברי', exact: true }));
    await c.evaluate(() => window.scrollTo(0, 0));
    await c.getByRole('button', { name: 'שני שירים: לחתן ולכלה' }).first().click(); await settle(c); await c.waitForTimeout(800);
    await c.getByRole('button', { name: 'בחירה', exact: true }).first().click();
    const sheet = c.getByRole('dialog'); await sheet.waitFor();
    await snap(c, 'p07-sheet', sheet);
    await sheet.getByRole('button', { name: 'לחתן' }).click(); await settle(c); await c.waitForTimeout(1500);
    await c.getByRole('button', { name: 'בחירה', exact: true }).nth(1).click();
    await c.getByRole('dialog').getByRole('button', { name: 'לכלה' }).click(); await settle(c); await c.waitForTimeout(1500);
    await c.evaluate(() => window.scrollTo(0, 0));
    await snap(c, 'p07-chosen', c.getByText('שיר לכלה').first());
  });

  // 08 library, 09 add + listen, 06 adding to the playlist
  await step('library', async () => {
    await c.goto('/discover'); await settle(c);
    await snap(c, 'p08-library', c.getByRole('heading', { name: 'רעיונות לשירי חופה' }));
    await c.getByRole('heading', { name: 'קבלת פנים ואווירה' }).scrollIntoViewIfNeeded(); await c.mouse.wheel(0, 120); await c.waitForTimeout(400);
    await snap(c, 'p08-reception', c.getByRole('heading', { name: 'קבלת פנים ואווירה' }));
    await c.getByRole('heading', { name: 'אוספים נבחרים' }).scrollIntoViewIfNeeded(); await c.mouse.wheel(0, 120); await c.waitForTimeout(400);
    await snap(c, 'p08-collections', c.getByRole('heading', { name: 'אוספים נבחרים' }));
    await c.goto('/discover'); await settle(c);
    await c.getByRole('link', { name: /קבלת פנים ישראלי/ }).first().click(); await settle(c);
    const plus = c.getByRole('button', { name: /הוספה לפלייליסט שלנו:/ });
    await snap(c, 'p09-collection', plus.first());
    for (let i = 0; i < 3; i++) { await plus.nth(0).click(); await c.waitForTimeout(800); }
    await snap(c, 'p09-added', c.getByRole('button', { name: /בפלייליסט שלנו:/ }).first());
    await c.getByRole('button', { name: /השמעה|ניגון|האזנה/ }).first().click().catch(() => undefined);
    await c.waitForTimeout(2500);
    await snap(c, 'p09-player', c.locator('iframe, [aria-label*="נגן"], [data-player]').last());
    await c.goto('/discover'); await settle(c);
    await c.getByRole('link', { name: /Top Dancefloor Hits/ }).first().click(); await settle(c);
    for (let i = 0; i < 4; i++) { await c.getByRole('button', { name: /הוספה לפלייליסט שלנו:/ }).nth(0).click(); await c.waitForTimeout(800); }
  });

  // 05 + 10 search: the library first, then straight from Spotify
  await step('search', async () => {
    await c.goto('/discover?q=' + encodeURIComponent('Omer Adam')); await settle(c);
    await snap(c, 'p10-search', c.locator('input[type=search], input[name=q]').first());
    const more = c.getByText('עוד מספוטיפיי').first();
    await more.scrollIntoViewIfNeeded(); await c.mouse.wheel(0, 200); await c.waitForTimeout(500);
    await snap(c, 'p10-spotify', more);
  });

  // 06 import + the playlist by stage
  await step('playlist', async () => {
    await c.goto('/wedding/playlists'); await settle(c);
    await snap(c, 'p11-stages', c.getByRole('heading', { name: 'שירי חופה' }));
    await c.getByRole('button', { name: 'העלאת הפלייליסט שלנו' }).first().click();
    await c.locator('#pl-link').fill('https://open.spotify.com/playlist/37i9dQZF1DX4wta20PHgwo');
    await snap(c, 'p12-import', c.locator('#pl-link'));
    await c.keyboard.press('Escape');
  });

  // 11 recommendations (loved / not for us / later, a question)
  await step('recommendation', async () => {
    const [t] = await sql<{ id: string }>(`select id from public.music_tracks where title ilike '%September%' limit 1`);
    const [dj] = await sql<{ user_id: string }>(`select user_id from public.djs where id = $1`, [elkana.id]);
    if (t) await sql(`insert into public.dj_recommendations (event_id, dj_id, track_id, message, created_by) values ($1, $2, $3, 'מושלם לקבלת הפנים!', $4)`, [eventId, elkana.id, t.id, dj.user_id]);
    await c.goto('/wedding/recommendations'); await settle(c);
    await snap(c, 'p11-recs', c.getByText('September').first());
    await snap(c, 'p11-rec-buttons', c.getByRole('button', { name: 'אהבנו' }).first());
    await c.getByRole('button', { name: 'שאלה' }).first().click();
    await c.waitForTimeout(800);
    const q = c.getByRole('dialog').locator('textarea').or(c.locator('textarea')).first();
    await q.fill('אפשר משהו דומה אבל בעברית?').catch(() => undefined);
    await snap(c, 'p11-question', q);
    await c.keyboard.press('Escape');
  });

  // 12 meeting
  await step('meeting', async () => {
    await c.goto('/wedding/meeting'); await settle(c);
    const freeDay = c.locator('[role=grid] button:not([disabled])').first();
    if (!(await freeDay.isVisible({ timeout: 4000 }).catch(() => false))) { await c.getByRole('button', { name: 'החודש הבא' }).click().catch(() => undefined); await settle(c); }
    await freeDay.waitFor({ timeout: 8000 });
    await snap(c, 'p12-calendar', freeDay);
    // a day and hour no earlier capture run has taken (the local DJ calendar keeps their bookings)
    await c.locator('[role=grid] button:not([disabled])').last().click(); await c.waitForTimeout(600);
    const slot = c.getByRole('button', { name: /^1[0-9]:[03]0$/ }).last();
    await snap(c, 'p12-times', slot);
    await slot.click();
    await c.getByRole('radio', { name: /בזום/ }).click();
    await c.getByRole('button', { name: 'קביעת הפגישה' }).click(); await settle(c);
    await c.getByText('הפגישה נקבעה').first().waitFor({ timeout: 15000 });
    await c.evaluate(() => window.scrollTo(0, 0));
    await snap(c, 'p12-booked', c.getByText('הפגישה נקבעה').first());
  });

  // 13 brief: everything on one page, PDF, send
  await step('brief', async () => {
    await c.goto('/wedding/brief'); await settle(c);
    await snap(c, 'p13-brief', c.getByText('האישיות המוזיקלית').first());
    await c.getByRole('heading', { name: 'הפלייליסט שלנו' }).scrollIntoViewIfNeeded(); await c.waitForTimeout(400);
    await snap(c, 'p13-playlist', c.getByRole('heading', { name: 'הפלייליסט שלנו' }));
    await snap(c, 'p13-pdf', c.getByRole('link', { name: /PDF/ }).first());
    await snap(c, 'p13-send', c.getByRole('button', { name: 'שליחת התקציר לדיג׳יי' }));
  });

  // 14 notifications + radio
  await step('notifications', async () => {
    await c.goto('/home'); await settle(c); await later();
    await c.evaluate(() => window.scrollTo(0, 0));
    await snap(c, 'p14-bell', c.getByRole('link', { name: /התראות/ }).or(c.getByRole('button', { name: /התראות/ })).first());
    await c.goto('/notifications'); await settle(c);
    await snap(c, 'p14-notifications', c.locator('main li, main article').first());
    await c.goto('/radio'); await settle(c);
    await snap(c, 'p14-radio', c.getByText('SWEAT & GROOVE').first());
  });

  // 15 closing
  await step('closing', async () => {
    await c.goto('/home'); await settle(c); await c.waitForTimeout(1500); await later();
    await c.evaluate(() => window.scrollTo(0, 0));
    await snap(c, 'p15-home', c.getByText('הצעד הבא'));
  });

  const added = shots.find((x) => x.id === 'p09-added');
  if (added) shots.push({ ...added, id: 'p09-play', box: { x: 75, y: 328, w: 38, h: 38 } });
  writeFileSync(`${OUT}.json`, JSON.stringify(shots, null, 1));
  writeFileSync(`${OUT}-failures.txt`, failures.join('\n'));
});
