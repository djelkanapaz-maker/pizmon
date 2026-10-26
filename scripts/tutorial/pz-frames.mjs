// Renders the Pizmon couples-tutorial frames (1080×1920): intro, one frame per shot, outro.
// Input: scripts/tutorial/pz-plan.json + out/pz-shots.json. Output: out/pz-frames/*.png
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const plan = JSON.parse(readFileSync('scripts/tutorial/pz-plan.json', 'utf8'));
const shots = Object.fromEntries(JSON.parse(readFileSync('scripts/tutorial/out/pz-shots.json', 'utf8')).map((s) => [s.id, s]));
const OUT = 'scripts/tutorial/out/pz-frames';
mkdirSync(OUT, { recursive: true });
const W = 1080, H = 1920;
const C = { ivory: '#F8F4ED', champagne: '#D7C3A6', taupe: '#A89886', charcoal: '#1F1F1F', gold: '#B89F7C' };
const WAVE = [10, 18, 28, 42, 56, 42, 30, 20, 34, 48, 34, 22, 14];
const FLOW = Array.from({ length: 7 }, (_, i) => { const o = i * 11; return `M-40 ${236 + o}C 200 ${150 + o * 1.5}, 430 ${330 + o * 0.7}, 650 ${236 + o}S 1010 ${110 + o * 1.7}, 1240 ${196 + o * 0.6}`; });
const font = (w) => `@font-face{font-family:Heebo;font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(`node_modules/@fontsource/heebo/files/heebo-hebrew-${w}-normal.woff2`).toString('base64')}) format('woff2')}`
  + `@font-face{font-family:HeeboL;font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(`node_modules/@fontsource/heebo/files/heebo-latin-${w}-normal.woff2`).toString('base64')}) format('woff2')}`;
const fonts = [100, 200, 300, 400, 500].map(font).join('');
const flow = (op = 1) => `<svg class="flow" viewBox="0 0 1200 400" preserveAspectRatio="none" style="opacity:${op}">${FLOW.map((d, i) => `<path d="${d}" fill="none" stroke="${i % 3 === 2 ? C.charcoal : i % 2 ? C.taupe : C.gold}" stroke-opacity="${i % 3 === 2 ? 0.22 : 0.55}" stroke-width="1.6"/>`).join('')}</svg>`;
const wave = (scale = 1, color = C.taupe) => `<div class="wave">${WAVE.map((h) => `<i style="height:${h * scale}px;width:${3 * scale}px;background:${color}"></i>`).join('')}</div>`;
const base = `${fonts}
  *{box-sizing:border-box;margin:0}
  html,body{width:${W}px;height:${H}px;background:${C.ivory};color:${C.charcoal};font-family:Heebo,HeeboL,sans-serif;overflow:hidden;direction:rtl}
  .flow{position:absolute;left:0;right:0;bottom:0;width:100%;height:520px}
  .wave{display:flex;align-items:center;gap:7px;justify-content:center}
  .wave i{display:block;border-radius:4px}
`;

const total = plan.parts.length;
function frameHtml(part, pi, shotId) {
  const s = shots[shotId];
  const img = 'data:image/png;base64,' + readFileSync(resolve(s.file)).toString('base64');
  const ph = 1240, scale = ph / s.vh, pw = Math.round(s.vw * scale);
  const big = s.box && (s.box.w * s.box.h) / (s.vw * s.vh) > 0.33;
  const box = s.box && !big && !plan.noHighlight?.includes(shotId) && { x: s.box.x * scale - 12, y: s.box.y * scale - 12, w: s.box.w * scale + 24, h: s.box.h * scale + 24 };
  const top = 520;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${base}
    .bar{position:absolute;top:64px;right:72px;left:72px;display:flex;justify-content:space-between;align-items:center}
    .mark{font-weight:200;font-size:58px;letter-spacing:.02em}
    .count{font-family:HeeboL,Heebo;font-weight:300;font-size:32px;letter-spacing:.18em;color:${C.taupe};direction:ltr}
    .rule{position:absolute;top:168px;right:72px;width:120px;height:2px;background:${C.gold}}
    h1{position:absolute;top:214px;right:72px;left:72px;font-weight:200;font-size:96px;line-height:1.05;letter-spacing:-.01em}
    .tip{position:absolute;top:338px;right:72px;left:72px;font-weight:300;font-size:40px;line-height:1.35;color:#6b5f54}
    .phone{position:absolute;top:${top}px;left:${(W - pw) / 2 - 18}px;width:${pw + 36}px;height:${ph + 36}px;border-radius:78px;background:${C.charcoal};padding:18px;box-shadow:0 40px 90px rgba(31,31,31,.22),0 8px 24px rgba(31,31,31,.12)}
    .screen{position:relative;width:${pw}px;height:${ph}px;border-radius:62px;overflow:hidden;background:#fff}
    .screen img{width:100%;height:100%;display:block}
    .hl{position:absolute;border:6px solid ${C.gold};border-radius:26px;box-shadow:0 0 0 9999px rgba(31,31,31,.06),0 0 34px rgba(184,159,124,.75)}
    .dots{position:absolute;bottom:64px;left:72px;right:72px;display:flex;gap:10px;direction:rtl}
    .dots i{flex:1;height:5px;border-radius:3px;background:rgba(168,152,134,.28)}
    .dots i.on{background:${C.charcoal}}
  </style></head><body>
    ${flow(0.55)}
    <div class="bar"><span class="mark">פזמון</span><span class="count">${String(pi + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span></div>
    <div class="rule"></div>
    <h1>${part.title}</h1>
    <div class="tip">${part.tip}</div>
    <div class="phone"><div class="screen"><img src="${img}">${box ? `<div class="hl" style="left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px"></div>` : ''}</div></div>
    <div class="dots">${plan.parts.map((_, i) => `<i class="${i <= pi ? 'on' : ''}"></i>`).join('')}</div>
  </body></html>`;
}

const card = (inner) => `<!doctype html><html><head><meta charset="utf-8"><style>${base}
  .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding-bottom:260px}
  .word{font-weight:100;font-size:260px;line-height:1;letter-spacing:.02em;margin-top:56px}
  .tag{margin-top:40px;font-weight:300;font-size:40px;letter-spacing:.24em;color:${C.taupe}}
  .rule{width:140px;height:2px;background:${C.gold};margin:72px auto 56px}
  .kicker{font-weight:300;font-size:54px}
  .small{margin-top:22px;font-family:HeeboL,Heebo;font-weight:300;font-size:36px;letter-spacing:.12em;color:#6b5f54;direction:ltr}
</style></head><body>${flow(0.9)}<div class="c">${inner}</div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const render = async (html, name) => { await page.setContent(html, { waitUntil: 'load' }); await page.waitForTimeout(120); await page.screenshot({ path: `${OUT}/${name}.png` }); };

await render(card(`${wave(2.2)}<div class="word">פזמון</div><div class="tag">הרגעים שלכם. המוזיקה שלנו.</div><div class="rule"></div><div class="kicker">${plan.introKicker}</div>`), 'intro');
const index = [];
for (const [pi, part] of plan.parts.entries()) {
  for (const [si, id] of part.shots.entries()) {
    if (!shots[id]) { console.error('missing shot', id); continue; }
    const name = `p${String(pi + 1).padStart(2, '0')}-${si + 1}`;
    await render(frameHtml(part, pi, id), name);
    index.push({ part: pi + 1, name, shot: id });
  }
}
await render(card(`${wave(2.2)}<div class="word">פזמון</div><div class="tag">הרגעים שלכם. המוזיקה שלנו.</div><div class="rule"></div><div class="kicker">${plan.outroKicker}</div><div class="small">app.elkanapaz.com</div>`), 'outro');
writeFileSync(`${OUT}/index.json`, JSON.stringify(index, null, 1));
await browser.close();
console.log(`${index.length + 2} frames`);
