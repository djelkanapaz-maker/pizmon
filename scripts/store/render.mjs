// Google Play listing graphics: phone screenshots (1080x1920) and the feature graphic (1024x500).
// Usage: node scripts/store/render.mjs <outDir>   (needs scripts/tutorial/out/shots from the tutorial capture)
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'scripts/store/out';
mkdirSync(out, { recursive: true });
const b64 = (p) => readFileSync(p).toString('base64');
const font = (fam, file, w) => `@font-face{font-family:${fam};font-weight:${w};src:url(data:font/woff2;base64,${b64(`node_modules/@fontsource/${file}`)})}`;
const fonts = [500, 700].map((w) => font('Heebo', `heebo/files/heebo-hebrew-${w}-normal.woff2`, w)).join('')
  + [800, 900].map((w) => font('Rubik', `rubik/files/rubik-hebrew-${w}-normal.woff2`, w)).join('')
  + [800, 900].map((w) => font('Rubik', `rubik/files/rubik-latin-${w}-normal.woff2`, w)).join('');
const logo = readFileSync('public/brand/atisuto-slick.svg', 'utf8').replace(/<\?xml[^>]*\?>/, '');
const STAR = 'M30.1,0A30.1,30.1,0,1,0,60.2,30.1,30.13,30.13,0,0,0,30.1,0ZM43.9,49.8,30.1,39.7,16.2,49.8l5.3-16.3L7.7,23.4H24.8L30.1,7.1l5.3,16.3H52.5L38.7,33.5Z';
const shots = [
  ['c08-home', 'כל המוזיקה של החתונה', 'במקום אחד, יחד עם ה-DJ שלכם'],
  ['c11-library', 'מאגר המוזיקה', 'אוספים נבחרים ורעיונות לשירי חופה'],
  ['c12-collection', 'בוחרים שירים בקלות', 'האזנה בלחיצה, והוספה לפלייליסט עם הפלוס'],
  ['c22-chuppah', 'שיר כניסה לחופה', 'שיר אחד לשניכם, או שיר לחתן ושיר לכלה'],
  ['c25-our-playlist', 'הפלייליסט שלנו', 'כל השירים שבחרתם, מסודרים ל-DJ'],
  ['c27-meeting-calendar', 'פגישת תיאום', 'קובעים ישירות ביומן של ה-DJ'],
  ['c30-brief', 'התקציר המוזיקלי', 'נשלח ל-DJ ומוכן להורדה כ-PDF'],
  ['c31-radio', 'ATISUTO RADIO', 'סטים ומיקסים מה-DJs של אטיסוטו'],
];
const base = `${fonts} *{margin:0;box-sizing:border-box} body{font-family:Heebo,sans-serif;direction:rtl;color:#fff;overflow:hidden}`;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
let i = 1;
for (const [id, title, sub] of shots) {
  const img = `data:image/png;base64,${b64(`scripts/tutorial/out/shots/${id}.png`)}`;
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${base}
    body{width:1080px;height:1920px;background:linear-gradient(180deg,#c01f22 0 560px,#0b0909 560px)}
    html{overflow:hidden} .top{height:560px;padding:96px 80px 0;position:relative;overflow:hidden}
    .top .star{position:absolute;left:-90px;top:-80px;width:420px;opacity:.12}
    .top svg.logo{height:46px;width:auto}
    h1{font-family:Rubik,Heebo;font-weight:900;font-size:96px;line-height:1.02;margin-top:56px}
    p{font-size:44px;font-weight:500;color:#ffe3e3;margin-top:22px;line-height:1.3}
    .phone{position:absolute;left:50%;top:480px;transform:translateX(-50%);width:700px;height:1515px;border-radius:72px;background:#1b1414;padding:18px;border:3px solid #3b2f2f;box-shadow:0 40px 90px rgba(0,0,0,.55)}
    .phone img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:56px;display:block}
  </style></head><body><div class="top"><svg class="star" viewBox="0 0 60.2 60.2"><path d="${STAR}" fill="#fff" fill-rule="evenodd"/></svg>
    ${logo.replace('<svg', '<svg class="logo"')}<h1>${title}</h1><p>${sub}</p></div><div class="phone"><img src="${img}"></div></body></html>`, { waitUntil: 'load' });
  await page.screenshot({ path: `${out}/screenshot-${i++}.png` });
}
await page.setViewportSize({ width: 1024, height: 500 });
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${base}
  body{width:1024px;height:500px;background:radial-gradient(circle at 22% 50%,#e0262a 0,#c01f22 40%,#8f1518 100%);display:flex;align-items:center;justify-content:space-between;padding:0 70px}
  .t svg{height:56px;width:auto} h1{font-family:Rubik,Heebo;font-weight:900;font-size:58px;line-height:1.08;margin-top:26px} p{font-size:28px;color:#ffe3e3;margin-top:14px}
  .badge{width:300px;height:300px;flex:none} </style></head><body>
  <div class="t">${logo}<h1>המוזיקה של החתונה<br>שלכם, במקום אחד</h1><p>מתכננים יחד עם ה-DJ — מכל מקום</p></div>
  <svg class="badge" viewBox="0 0 60.2 60.2"><path d="${STAR}" fill="#fbd100" fill-rule="evenodd"/></svg></body></html>`, { waitUntil: 'load' });
await page.screenshot({ path: `${out}/feature-graphic.png` });
await b.close();
console.log('done →', out);
