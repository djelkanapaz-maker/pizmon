// Renders one PNG per tutorial step: the app screen in a device frame, a title,
// a highlight on what to tap, and the narration as a Hebrew subtitle.
// Usage: node scripts/tutorial/frames.mjs couple|dj
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const which = process.argv[2] ?? 'couple';
const script = JSON.parse(readFileSync('scripts/tutorial/script.json', 'utf8'))[which];
const shots = Object.fromEntries(JSON.parse(readFileSync('scripts/tutorial/out/shots.json', 'utf8')).map((s) => [s.id, s]));
const outDir = `scripts/tutorial/out/frames-${which}`;
mkdirSync(outDir, { recursive: true });
const logo = readFileSync('public/brand/atisuto-slick.svg', 'utf8').replace(/<\?xml[^>]*\?>/, '');
const STAR = 'M30.1,0A30.1,30.1,0,1,0,60.2,30.1,30.13,30.13,0,0,0,30.1,0ZM43.9,49.8,30.1,39.7,16.2,49.8l5.3-16.3L7.7,23.4H24.8L30.1,7.1l5.3,16.3H52.5L38.7,33.5Z';
const portrait = which === 'couple';
const W = portrait ? 1080 : 1920, H = portrait ? 1920 : 1080;

const font = (fam, file, w) => `@font-face{font-family:${fam};font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(`node_modules/@fontsource/${file}`).toString('base64')}) format('woff2')}`;
const fonts = [500, 700, 800, 900].map((w) => font('Heebo', `heebo/files/heebo-hebrew-${w}-normal.woff2`, w)).join('')
  + [800, 900].map((w) => font('Rubik', `rubik/files/rubik-hebrew-${w}-normal.woff2`, w)).join('');
const base = `${fonts}
  *{box-sizing:border-box;margin:0}
  html,body{width:${W}px;height:${H}px;background:#0b0909;color:#fff;font-family:Heebo,'Noto Sans Hebrew',Arial,sans-serif;overflow:hidden}
  .band{position:absolute;inset:0 0 auto 0;height:${portrait ? 150 : 110}px;background:#c01f22;display:flex;align-items:center;justify-content:space-between;padding:0 ${portrait ? 56 : 72}px}
  .band svg{height:${portrait ? 54 : 46}px;width:auto}
  .band .tag{font-weight:800;font-size:${portrait ? 34 : 30}px;color:#fbd100;direction:rtl}
  .step{font-weight:800;font-size:${portrait ? 30 : 26}px;color:#c9bdbd}
  h1{font-weight:900;direction:rtl;font-family:Rubik,Heebo,sans-serif}
  .sub{direction:rtl;background:rgba(255,255,255,.06);border:2px solid #3b2f2f;border-radius:28px;color:#fff;line-height:1.45;font-weight:500}
`;

function stepHtml(step, i, n) {
  const s = shots[step.id];
  const img = 'data:image/png;base64,' + readFileSync(resolve(s.file)).toString('base64');
  if (portrait) {
    const ph = 1180, scale = ph / s.vh, pw = Math.round(s.vw * scale);
    const box = s.box && { x: s.box.x * scale - 14, y: s.box.y * scale - 14, w: s.box.w * scale + 28, h: s.box.h * scale + 28 };
    return `<!doctype html><html><head><meta charset="utf-8"><style>${base}
      h1{position:absolute;top:196px;right:64px;left:64px;font-size:68px;line-height:1.05;text-align:right}
      .step{position:absolute;top:290px;right:66px}
      .phone{position:absolute;top:350px;left:${(W - pw) / 2 - 16}px;width:${pw + 32}px;height:${ph + 32}px;border-radius:64px;background:#1b1414;border:3px solid #3b2f2f;padding:16px;box-shadow:0 30px 80px rgba(0,0,0,.6), 0 10px 0 #c01f22}
      .screen{position:relative;width:${pw}px;height:${ph}px;border-radius:48px;overflow:hidden}
      .screen img{width:100%;height:100%;display:block}
      .hl{position:absolute;border:7px solid #fbd100;border-radius:24px;box-shadow:0 0 0 9999px rgba(0,0,0,.28), 0 0 30px rgba(251,209,0,.7)}
      .sub{position:absolute;left:56px;right:56px;bottom:56px;padding:30px 36px;font-size:42px;min-height:220px;display:flex;align-items:center}
    </style></head><body>
      <div class="band"><span class="tag">${script.title}</span>${logo}</div>
      <h1>${step.title}</h1><div class="step">${i} / ${n}</div>
      <div class="phone"><div class="screen"><img src="${img}">${box ? `<div class="hl" style="left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px"></div>` : ''}</div></div>
      <div class="sub">${step.say}</div>
    </body></html>`;
  }
  const sw = 1240, scale = sw / s.vw, sh = Math.round(s.vh * scale);
  const box = s.box && { x: s.box.x * scale - 10, y: s.box.y * scale - 10, w: s.box.w * scale + 20, h: s.box.h * scale + 20 };
  return `<!doctype html><html><head><meta charset="utf-8"><style>${base}
    h1{position:absolute;top:128px;right:72px;font-size:46px}
    .step{position:absolute;top:140px;left:72px}
    .win{position:absolute;top:196px;left:${(W - sw) / 2 - 10}px;width:${sw + 20}px;border-radius:22px;background:#1b1414;border:2px solid #3b2f2f;padding:40px 10px 10px;box-shadow:0 24px 60px rgba(0,0,0,.6), 0 8px 0 #c01f22}
    .dots{position:absolute;top:14px;left:18px;display:flex;gap:8px}.dots i{width:12px;height:12px;border-radius:50%;background:#3b2f2f;display:block}
    .screen{position:relative;width:${sw}px;height:${sh}px;border-radius:12px;overflow:hidden}
    .screen img{width:100%;display:block}
    .hl{position:absolute;border:5px solid #fbd100;border-radius:16px;box-shadow:0 0 0 9999px rgba(0,0,0,.25), 0 0 24px rgba(251,209,0,.7)}
    .sub{position:absolute;left:220px;right:220px;bottom:36px;padding:16px 28px;font-size:30px;text-align:center;justify-content:center;display:flex}
  </style></head><body>
    <div class="band"><span class="tag">${script.title}</span>${logo}</div>
    <h1>${step.title}</h1><div class="step">${i} / ${n}</div>
    <div class="win"><div class="dots"><i></i><i></i><i></i></div><div class="screen"><img src="${img}">${box ? `<div class="hl" style="left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px"></div>` : ''}</div></div>
    <div class="sub">${step.say}</div>
  </body></html>`;
}

function cardHtml(title, text) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${base}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${portrait ? 56 : 36}px;background:radial-gradient(circle at 50% 35%, #2a1010 0%, #0b0909 60%)}
    .star{width:${portrait ? 260 : 180}px;height:${portrait ? 260 : 180}px;border-radius:50%;background:#c01f22;display:grid;place-items:center;box-shadow:0 0 0 14px rgba(192,31,34,.25)}
    .star svg{width:68%;height:68%}
    .logo svg{height:${portrait ? 90 : 70}px;width:auto}
    h1{font-size:${portrait ? 96 : 84}px;text-align:center}
    .sub{max-width:${portrait ? 900 : 1300}px;padding:28px 40px;font-size:${portrait ? 42 : 34}px;text-align:center}
  </style></head><body>
    <div class="star"><svg viewBox="0 0 60.2 60.2"><path fill="#fbd100" d="${STAR}"/></svg></div>
    <div class="logo">${logo}</div><h1>${title}</h1><div class="sub">${text}</div>
  </body></html>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const steps = script.steps.filter((s) => shots[s.id]);
const list = [{ id: '00-intro', html: cardHtml(script.title, script.intro), say: script.intro }];
steps.forEach((s, i) => list.push({ id: `${String(i + 1).padStart(2, '0')}-${s.id}`, html: stepHtml(s, i + 1, steps.length), say: s.say }));
list.push({ id: '99-outro', html: cardHtml('ATISUTO', script.outro), say: script.outro });
for (const f of list) {
  await page.setContent(f.html, { waitUntil: 'load' });
  await page.screenshot({ path: `${outDir}/${f.id}.png` });
}
writeFileSync(`${outDir}/list.json`, JSON.stringify(list.map(({ id, say }) => ({ id, say })), null, 1));
await browser.close();
console.log(`${list.length} frames → ${outDir}`);
