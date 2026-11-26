// Nine Instagram feed posts (1080×1350, 4:5) for the Paskol profile: one app screen each, alternating light and
// dark so the 3×3 grid reads as a checkerboard. Screens from the capture specs (reel-light / reel-dark, landing).
//   node scripts/campaign/posts.mjs <out-dir>
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? 'scripts/campaign/out-posts';
mkdirSync(OUT, { recursive: true });
const W = 1080, H = 1350;
const b64 = (p) => readFileSync(p).toString('base64');
const uri = (p, t = 'image/png') => `data:${t};base64,${b64(p)}`;
const ff = (fam, file, w) => `@font-face{font-family:${fam};font-weight:${w};src:url(data:font/woff2;base64,${b64(`node_modules/@fontsource/${file}`)}) format('woff2')}`;
const fonts = [500, 700].map((w) => ff('Heebo', `heebo/files/heebo-hebrew-${w}-normal.woff2`, w) + ff('HeeboL', `heebo/files/heebo-latin-${w}-normal.woff2`, w)).join('')
  + ['hebrew', 'latin'].map((r) => ff('Rubik', `rubik/files/rubik-${r}-900-normal.woff2`, 900)).join('');
const shot = (skin, id) => uri(id.startsWith('never') ? `scripts/tutorial/out/landing/never-${skin}.png` : `scripts/tutorial/out/reel-${skin}/${id}.png`);

// [skin, screen, title, subtitle, callout box in screenshot pixels (1170 wide) or null]
const POSTS = [
  ['light', 'p05-home', 'הפסקול של החתונה שלכם', 'כל המוזיקה של היום הגדול, במקום אחד', null],
  ['dark', 'p08-moments', 'שיר לכל רגע', 'חופה, שבירת כוס, ריקוד ראשון', [30, 800, 1110, 760]],
  ['light', 'p08-library', 'מאגר מוזיקה מוכן', 'אוספים לכל שלב באירוע', [40, 860, 1110, 780]],
  ['dark', 'p09-added', 'שומעים ובוחרים', 'האזנה בלחיצה, הוספה בפלוס', [30, 990, 1110, 660]],
  ['light', 'p11-stages', 'מסודר לפי שלבים', 'חופה, קבלת פנים, מסיבה', [40, 1290, 1090, 940]],
  ['dark', 'never', 'רשימת ״לעולם לא״', 'מה שלא תרצו לשמוע, הדיג׳יי רואה', [40, 1398, 1100, 1000]],
  ['light', 'p12-times', 'פגישת תיאום', 'קובעים ישר ביומן של הדיג׳יי', [30, 1450, 1110, 900]],
  ['dark', 'p13-send', 'הכל אצל הדיג׳יי', 'תקציר מוזיקלי מסודר, גם כ-PDF', [30, 820, 1110, 1150]],
  ['light', 'cta', 'חינם. לכל הזוגות.', 'עכשיו ב-App Store וב-Google Play', null],
];

const PW = 470, PH = Math.round(PW * 2532 / 1170), BZ = 13;
const page = ([skin, id, title, sub, box], n) => {
  const dark = skin === 'dark';
  const bg = dark ? 'radial-gradient(900px 900px at 50% 62%,#2c2150 0%,#120f1c 52%,#000 100%)'
    : 'radial-gradient(900px 900px at 50% 62%,#fffdf8 0%,#f8f4ed 55%,#ece2d2 100%)';
  const ink = dark ? '#fff' : '#1f1f1f', dim = dark ? '#c9c5da' : '#5d5248', shadow = dark ? '#5a46a0' : '#D7C3A6';
  const frame = dark ? 'linear-gradient(160deg,#4a4258,#121014 40%,#322b40)' : '#1d1b19';
  const glow = dark ? 'rgba(122,96,220,.6)' : 'rgba(31,31,31,.35)';
  const head = `<style>${fonts}*{margin:0;box-sizing:border-box}
    html,body{width:${W}px;height:${H}px;overflow:hidden;background:${bg};color:${ink};font-family:Heebo,HeeboL,sans-serif;direction:rtl}
    .h{position:absolute;top:120px;left:60px;right:60px;text-align:center;font-family:Rubik,Heebo;font-weight:900;font-size:100px;line-height:1;white-space:nowrap;text-shadow:-6px 6px 0 ${shadow}}
    .s{position:absolute;top:245px;left:60px;right:60px;text-align:center;font-size:46px;font-weight:500;color:${dim}}
    .ph{position:absolute;width:${PW + 2 * BZ}px;padding:${BZ}px;border-radius:64px;background:${frame};box-shadow:0 50px 110px -30px ${glow}}
    .ph img{display:block;width:${PW}px;border-radius:52px}
    .co{position:absolute;border-radius:30px;border:3px solid ${dark ? 'rgba(185,169,245,.55)' : '#fff'};box-shadow:0 40px 100px -20px ${dark ? 'rgba(0,0,0,.9)' : 'rgba(31,31,31,.45)'};rotate:-3deg}
    .logo{position:absolute;bottom:56px;left:50%;translate:-50% 0;height:74px}
    </style>`;
  if (id === 'cta') {
    const logo = uri('public/brand/paskol-logo.webp', 'image/webp');
    return `${head}<style>.big{position:absolute;top:360px;left:50%;translate:-50% 0;width:560px}
      .b{position:absolute;top:1010px;left:0;right:0;display:flex;justify-content:center;gap:28px;direction:ltr}.b img{height:104px}
      .u{position:absolute;top:1170px;left:0;right:0;text-align:center;font-family:HeeboL;font-weight:700;font-size:48px;letter-spacing:.04em;direction:ltr}</style>
      <div class="h">${title}</div><div class="s">${sub}</div><img class="big" src="${logo}">
      <div class="b"><img src="${uri('public/badges/app-store.svg', 'image/svg+xml')}"><img src="${uri('public/badges/google-play.png')}"></div>
      <div class="u">paskol.app</div>`;
  }
  const src = shot(skin, id);
  const right = box ? 110 : Math.round((W - PW - 2 * BZ) / 2);
  let co = '';
  if (box) {
    const [sx, sy, sw, sh] = box, cw = 520, k = cw / sw;
    co = `<div class="co" style="left:50px;top:${Math.min(760, H - Math.round(sh * k) - 90)}px;width:${cw}px;height:${Math.round(sh * k)}px;background:url(${src}) ${-sx * k}px ${-sy * k}px/${1170 * k}px auto no-repeat"></div>`;
  }
  return `${head}<div class="h">${title}</div><div class="s">${sub}</div>
    <div class="ph" style="top:350px;right:${right}px"><img src="${src}"></div>${co}`;
};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const p = await browser.newPage({ viewport: { width: W, height: H } });
for (const [i, post] of POSTS.entries()) {
  await p.setContent(page(post, i)); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
  await p.evaluate(() => { const el = document.querySelector('.h'); let f = parseFloat(getComputedStyle(el).fontSize); while (el.scrollWidth > el.clientWidth && f > 50) { f -= 2; el.style.fontSize = f + 'px'; } });
  await p.screenshot({ path: `${OUT}/paskol-post-${i + 1}.png` });
}
await browser.close();
console.log('done', OUT);
