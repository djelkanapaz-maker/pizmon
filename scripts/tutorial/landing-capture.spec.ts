// Screens for the landing page's "What you get" cards, from the LOCAL stack, using the demo couple (דניאל & נועה)
// that pizmon-capture.spec.ts created last:  a chuppah moment with both songs chosen, a collection, the
// must / never lists, and page 1 of the brief PDF.
//   SHOTS_OUT=… ART_DIR=… npx playwright test -c scripts/tutorial/playwright.config.ts landing-capture
import { test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { sql, TEST_PASSWORD } from '../../tests/helpers/stack';

const OUT = process.env.SHOTS_OUT ?? 'scripts/tutorial/out/landing';
mkdirSync(OUT, { recursive: true });
const settle = (p: Page) => p.waitForLoadState('networkidle').catch(() => undefined);
const tidy = (p: Page) => p.addStyleTag({ content: 'div[aria-live="polite"].fixed{display:none!important} nextjs-portal{display:none!important}' });

test.use({ actionTimeout: 10_000, navigationTimeout: 30_000 });

test('landing feature screens', async ({ browser }) => {
  test.setTimeout(600_000);
  const [ev] = await sql<{ event_id: string; user_id: string; email: string }>(
    `select cm.event_id, cm.user_id, u.email from public.couple_members cm join auth.users u on u.id = cm.user_id
     where u.email like 'noa-daniel-%' order by cm.created_at desc limit 1`);
  await sql(`update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')) where id = $1`, [ev.user_id, TEST_PASSWORD]);
  // the must / never lists, as a couple would fill them
  await sql(`delete from public.music_restrictions where event_id = $1`, [ev.event_id]);
  await sql(`insert into public.music_restrictions (event_id, kind, strength, target_type, track_id, created_by)
    select $1, 'must_play', 'absolute', 'track', id, $2 from public.music_tracks where title in ('Perfect', 'מכל האהבות', 'Tudo Bom') limit 3`, [ev.event_id, ev.user_id]);
  await sql(`insert into public.music_restrictions (event_id, kind, strength, target_type, text_value, reason, created_by) values
    ($1, 'never_play', 'absolute', 'text', 'Macarena', 'לא בחתונה שלנו', $2),
    ($1, 'never_play', 'absolute', 'text', 'שירי מזרחית כבדה', null, $2),
    ($1, 'never_play', 'preference', 'text', 'סלואו ארוך מדי', 'עדיף להימנע', $2)`, [ev.event_id, ev.user_id]);

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'he-IL' });
  const ART = process.env.ART_DIR;
  await ctx.route(/spotifycdn\.com|scdn\.co|i\.ytimg\.com/, (r) => {
    const h = r.request().url().split('/').pop() ?? '';
    const f = ART && /^[A-Za-z0-9]+$/.test(h) ? `${ART}/${h}.jpg` : '';
    return f && existsSync(f) ? r.fulfill({ status: 200, contentType: 'image/jpeg', body: readFileSync(f) }) : r.fulfill({ status: 404 });
  });
  const c = await ctx.newPage();
  const skin = async (s: 'light' | 'dark') => {
    await sql(`update public.profiles set skin = $2 where id = $1`, [ev.user_id, s]);
    await ctx.addCookies([{ name: 'paskol_skin', value: s, url: 'http://localhost:3000' }]);
  };
  await skin('light');
  await c.goto('/login'); await settle(c);
  await c.locator('input[type=email]').fill(ev.email);
  await c.locator('input[type=password]').fill(TEST_PASSWORD);
  await c.locator('form button[type=submit]').click();
  await c.waitForURL((u) => !u.pathname.startsWith('/login')); await settle(c);

  // 1. a song for every moment: the chuppah entrance, one song for each of them (chosen once)
  await c.goto('/wedding/moments/chuppah-entrance'); await settle(c);
  try {
    const two = c.getByRole('button', { name: 'שני שירים: לחתן ולכלה' }).first();
    if (await two.isVisible().catch(() => false)) { await two.click(); await settle(c); await c.waitForTimeout(800); }
    for (const who of ['לחתן', 'לכלה']) {
      const pick = c.getByRole('button', { name: 'בחירה', exact: true });
      if (!(await pick.count())) break;
      await pick.first().click();
      await c.getByRole('dialog').getByRole('button', { name: who }).click(); await settle(c); await c.waitForTimeout(1500);
    }
  } catch (e) { console.log('moment pick:', (e as Error).message.split('\n')[0]); }

  for (const s of ['light', 'dark'] as const) {
    await skin(s);
    await c.goto('/wedding/moments/chuppah-entrance'); await settle(c); await c.waitForTimeout(600); await tidy(c);
    await c.screenshot({ path: `${OUT}/moment-${s}.png` });
    // the suggestions for that moment, with their covers
    await c.getByRole('heading', { name: 'הצעות' }).first().evaluate((el) => { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); }).catch(() => undefined);
    await c.waitForTimeout(1200);
    await c.screenshot({ path: `${OUT}/suggest-${s}.png` });
    // 2. hundreds of wedding hits: the collections with their covers
    await c.goto('/discover'); await settle(c);
    await c.getByRole('heading', { name: 'קבלת פנים ואווירה' }).first().evaluate((el) => { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); }).catch(() => undefined);
    await c.waitForTimeout(1200); await tidy(c);
    await c.screenshot({ path: `${OUT}/collections-${s}.png` });
    // 3. the must / never lists
    await c.goto('/wedding/restrictions'); await settle(c); await c.waitForTimeout(600); await tidy(c);
    await c.locator('#col-never_play').evaluate((el) => { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -110); }).catch(() => undefined);
    await c.waitForTimeout(600);
    await c.screenshot({ path: `${OUT}/never-${s}.png` });
  }

  // 4. the brief PDF, page 1
  const pdf = await c.request.get('/api/brief/pdf');
  writeFileSync(`${OUT}/brief.pdf`, await pdf.body());
  console.log('pdf', pdf.status(), (await pdf.body()).length);
  await ctx.close();
});
