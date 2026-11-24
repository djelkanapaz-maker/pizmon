// Store screenshots in the dark skin, plus a "light or dark" slide, in the same layout as the light store kit.
// Writes public/store-kit/{appstore,play}/ next to the existing light screenshots and renumbers the set:
//   1 home (light) · 2 light or dark · 3 moments (dark) · 4 chuppah (light) · 5 library (dark)
//   6 our playlist (light) · 7 brief, ready to send (dark) · 8 "never" list (light)
// Needs the dark capture:  SKIN=dark SHOTS_OUT=scripts/tutorial/out/dark-shots (pizmon-capture.spec.ts)
//   and the light one in scripts/tutorial/out/pz-shots.     Run: node scripts/store/kit.mjs
import { createRequire } from 'node:module';
import { readFileSync, renameSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
const { chromium } = createRequire(process.cwd() + '/')('playwright');
const KIT = 'public/store-kit';
const DARK = 'scripts/tutorial/out/dark-shots', LIGHT = 'scripts/tutorial/out/pz-shots';
const b64 = (p) => readFileSync(p).toString('base64');
const ff = (fam, file, w) => `@font-face{font-family:${fam};font-weight:${w};src:url(data:font/woff2;base64,${b64(file)}) format('woff2')}`;
const fonts = [500, 700].map((w) => ff('Heebo', `node_modules/@fontsource/heebo/files/heebo-hebrew-${w}-normal.woff2`, w) + ff('HeeboL', `node_modules/@fontsource/heebo/files/heebo-latin-${w}-normal.woff2`, w)).join('')
  + ['hebrew', 'latin'].map((r) => ff('Rubik', `node_modules/@fontsource/rubik/files/rubik-${r}-900-normal.woff2`, 900)).join('');
const img = (p) => `data:image/png;base64,${b64(p)}`;

// the light screenshots already in the kit keep their pictures, only their numbers change
const LIGHT_KEEP = { 1: 'p15-home', 4: 'p08-chuppah', 6: 'p07-ours', 8: 'p10-never' };
const OLD_NUM = { 'p15-home': 1, 'p08-chuppah': 3, 'p07-ours': 4, 'p10-never': 5 };
const NEW = [
  [2, 'skins', 'בהיר או כהה?', 'אתם בוחרים איך האפליקציה תיראה'],
  [3, 'p08-moments', 'שיר לכל רגע', 'כניסה לחופה, שבירת הכוס, הריקוד הראשון'],
  [5, 'p08-library', 'מאגר מוזיקה ענק', 'אוספים מוכנים לכל שלב באירוע'],
  [7, 'p13-send', 'הדיג׳יי מקבל הכל', 'סיכום מוזיקלי מסודר, עד הפרט הקטן'],
];

// same geometry as the light kit (designed at 1290 wide), in the dark skin's colors
const page = (W, H, shot, cap, sub) => {
  const s = W / 1290;
  const pw = Math.round(Math.min(860 * s, (H - 640 * s - 40) * 1170 / 2532)), ph = Math.round(pw * 2532 / 1170);
  const pad = Math.round(26 * s), top = Math.round(H - ph - 26 * s - H * 0.035);
  const phone = (src, extra = '') => `<div class="ph" style="${extra}"><img src="${src}"></div>`;
  const body = shot === 'skins'
    ? phone(img(`${LIGHT}/p15-home.png`), `margin-left:${-(pw + 2 * pad) / 2 + Math.round(170 * s)}px;transform:scale(.86) rotate(4deg);transform-origin:50% 100%;background:#e9e1d4`)
      + phone(img(`${DARK}/p15-home.png`), `margin-left:${-(pw + 2 * pad) / 2 - Math.round(170 * s)}px;transform:scale(.86) rotate(-4deg);transform-origin:50% 100%;z-index:2`)
    : phone(img(`${DARK}/${shot}.png`));
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>${fonts}
  *{margin:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden;font-family:Heebo,HeeboL;
    background:radial-gradient(${Math.round(1100 * s)}px ${Math.round(900 * s)}px at 50% 62%,#2a2046 0%,#120f1c 48%,#000 100%)}
  .t{position:absolute;top:${Math.round(150 * s)}px;left:${Math.round(80 * s)}px;right:${Math.round(80 * s)}px;text-align:center}
  h1{font-family:Rubik,Heebo;font-weight:900;font-size:${Math.round(108 * s)}px;line-height:1.05;color:#fff;text-shadow:${-6 * s}px ${6 * s}px 0 #5a46a0}
  p{margin-top:${Math.round(30 * s)}px;font-weight:500;font-size:${Math.round(52 * s)}px;color:#c9c5da}
  .ph{position:absolute;left:50%;top:${top}px;width:${pw + 2 * pad}px;margin-left:-${(pw + 2 * pad) / 2}px;padding:${pad}px;border-radius:${Math.round(120 * s)}px;
    background:linear-gradient(160deg,#3a3446,#111 40%,#2a2536);box-shadow:0 ${40 * s}px ${110 * s}px -${20 * s}px rgba(122,96,220,.55)}
  .ph img{display:block;width:${pw}px;height:${ph}px;border-radius:${Math.round(96 * s)}px}
  </style></head><body><div class="t"><h1>${cap}</h1><p>${sub}</p></div>${body}</body></html>`;
};

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
for (const [dir, W, H] of [['appstore', 1206, 2622], ['play', 1080, 1920]]) {
  // renumber the light ones first (from their original names, so the script can run again)
  const have = readdirSync(`${KIT}/${dir}`);
  for (const [n, id] of Object.entries(LIGHT_KEEP)) {
    const target = `${n}-${id}.png`;
    if (have.includes(target)) continue;
    const src = have.find((f) => f.endsWith(`-${id}.png`)) ?? `${OLD_NUM[id]}-${id}.png`;
    renameSync(`${KIT}/${dir}/${src}`, `${KIT}/${dir}/${target}`);
  }
  // the old light moments and brief give way to their dark versions
  for (const old of ['2-p08-moments.png', '6-p13-brief.png']) if (existsSync(`${KIT}/${dir}/${old}`)) unlinkSync(`${KIT}/${dir}/${old}`);
  const p = await b.newPage({ viewport: { width: W, height: H } });
  for (const [n, shot, cap, sub] of NEW) {
    await p.setContent(page(W, H, shot, cap, sub)); await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: `${KIT}/${dir}/${n}-${shot === 'skins' ? 'skins' : shot + '-dark'}.png` });
  }
  await p.close();
}
await b.close();
console.log(readdirSync(`${KIT}/appstore`).join('\n'));
