// Paskol 30s promo (1080×1920, 30 fps). One HTML page drawn for any time t; each scene is
// screenshotted frame by frame (JPEG) and piped into its own ffmpeg encode.
//   node scripts/promo/frames.mjs <outDir> [--stills t1,t2,...]
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, renameSync } from 'node:fs';
import { spawn } from 'node:child_process';

const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const stillsArg = process.argv.indexOf('--stills');
const STILLS = stillsArg > 0 ? process.argv[stillsArg + 1].split(',').map(Number) : null;
const W = 1080, H = 1920, FPS = 30;
const C = { ivory: '#F8F4ED', champagne: '#D7C3A6', taupe: '#A89886', charcoal: '#1F1F1F', gold: '#B89F7C' };
const b64 = (p) => readFileSync(p).toString('base64');
const ff = (fam, file, w) => `@font-face{font-family:${fam};font-weight:${w};src:url(data:font/woff2;base64,${b64(file)}) format('woff2')}`;
const fonts = [400, 500, 700, 900].map((w) => ff('Heebo', `node_modules/@fontsource/heebo/files/heebo-hebrew-${w}-normal.woff2`, w) + ff('HeeboL', `node_modules/@fontsource/heebo/files/heebo-latin-${w}-normal.woff2`, w)).join('')
  + ['hebrew', 'latin'].map((r) => ff('Rubik', `node_modules/@fontsource/rubik/files/rubik-${r}-900-normal.woff2`, 900)).join('');
const shot = (id) => `data:image/png;base64,${b64(`scripts/tutorial/out/pz-shots/${id}.png`)}`;
const logo = `data:image/png;base64,${b64('public/brand/paskol-logo.png')}`;
const FLOW = Array.from({ length: 7 }, (_, i) => { const o = i * 11; return `M-40 ${236 + o}C 200 ${150 + o * 1.5}, 430 ${330 + o * 0.7}, 650 ${236 + o}S 1010 ${110 + o * 1.7}, 1240 ${196 + o * 0.6}`; });
const flow = `<svg class="flow" viewBox="0 0 1200 400" preserveAspectRatio="none">${FLOW.map((d, i) => `<path d="${d}" fill="none" stroke="${i % 3 === 2 ? C.charcoal : i % 2 ? C.taupe : C.gold}" stroke-opacity="${i % 3 === 2 ? 0.2 : 0.55}" stroke-width="1.6"/>`).join('')}</svg>`;

// scenes: [start, end, id]
const SCENES = [
  [0, 2.7, 'dream'], [2.7, 5.4, 'chuppah'], [5.4, 8.4, 'fear'], [8.4, 11, 'reveal'],
  [11, 14.5, 'moments'], [14.5, 18, 'pick'], [18, 21.5, 'never'], [21.5, 25, 'brief'], [25, 30, 'end'],
];
// phone demos: shot, caption, small line, scroll (fraction of the screenshot to pan)
const DEMO = {
  moments: { img: 'p08-moments', cap: 'שיר לכל רגע', sub: 'כניסה לחופה, שבירת הכוס, הריקוד הראשון.', pan: 0.05 },
  pick: { img: 'p08-chuppah', cap: 'בדיוק כמו שחלמתם', sub: 'שיר לחתן, שיר לכלה. אתם בוחרים.', pan: 0.06 },
  never: { img: 'p10-never', cap: 'ומה שלא תרצו לשמוע', sub: 'רשימת ״לעולם לא״ שהדיג׳יי באמת רואה.', pan: 0 },
  brief: { img: 'p13-brief', cap: 'הדיג׳יי מקבל הכל', sub: 'סיכום מוזיקלי מסודר, עד הפרט הקטן.', pan: 0.08 },
};

const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>${fonts}
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${C.charcoal};font-family:Heebo,HeeboL,sans-serif}
.scene{position:absolute;inset:0;display:none;overflow:hidden}
.dark{background:${C.charcoal};color:${C.ivory}}
.light{background:${C.ivory};color:${C.charcoal}}
.flow{position:absolute;left:0;right:0;bottom:0;width:100%;height:560px}
.k{font-weight:700;font-size:36px;letter-spacing:.04em;color:${C.champagne}}
.big{font-family:Rubik,Heebo;font-weight:900;line-height:1.02}
.pos{position:absolute;right:84px;left:84px}
.shadow-c{text-shadow:-6px 6px 0 ${C.champagne}}
.shadow-d{text-shadow:-6px 6px 0 rgba(215,195,166,.35)}
.line{display:block;will-change:transform,opacity}
.phone{position:absolute;left:50%;width:640px;height:1300px;margin-left:-320px;border-radius:84px;background:${C.charcoal};padding:20px;box-shadow:0 50px 110px rgba(31,31,31,.28),0 10px 30px rgba(31,31,31,.15)}
.screen{position:relative;width:600px;height:1260px;border-radius:66px;overflow:hidden;background:#fff}
.screen img{position:absolute;left:0;top:0;width:600px;display:block}
.pill{display:inline-block;background:${C.charcoal};color:${C.ivory};font-family:HeeboL,Heebo;font-weight:700;font-size:52px;padding:26px 64px;border-radius:999px;direction:ltr;box-shadow:-6px 6px 0 ${C.champagne}}
.vign{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 40%,rgba(0,0,0,.55) 100%)}
</style></head><body>
<!-- 1 dream -->
<section class="scene dark" id="dream"><div class="vign"></div>
  <div class="pos" style="top:720px"><span class="k line" id="d0">היום שלכם</span>
  <div class="big shadow-d" style="font-size:120px;margin-top:34px"><span class="line" id="d1">חיכיתם לרגע</span><span class="line" id="d2">הזה כל החיים.</span></div></div>
</section>
<!-- 2 chuppah, the wrong song -->
<section class="scene dark" id="chuppah"><div class="vign"></div>
  <div class="pos" style="top:520px"><span class="k line" id="c0">הכניסה לחופה.</span>
  <div class="big" style="font-size:132px;margin-top:40px"><span class="line" id="c1">והשיר…</span><span class="line" id="c2" style="color:${C.champagne}">לא השיר.</span></div></div>
  <svg id="disc" viewBox="0 0 400 400" style="position:absolute;left:-120px;top:1260px;width:760px;height:760px">
    <circle cx="200" cy="200" r="198" fill="#111"/>
    ${Array.from({ length: 18 }, (_, i) => `<circle cx="200" cy="200" r="${190 - i * 7}" fill="none" stroke="rgba(215,195,166,${i % 3 ? .07 : .16})" stroke-width="1.2"/>`).join('')}
    <path d="M200 200 L370 120 A190 190 0 0 1 385 170 Z" fill="rgba(255,255,255,.06)"/>
    <circle cx="200" cy="200" r="62" fill="${C.champagne}"/><circle cx="200" cy="200" r="58" fill="none" stroke="#1f1f1f" stroke-opacity=".25"/>
    <text x="200" y="210" text-anchor="middle" font-family="Rubik" font-weight="900" font-size="30" fill="#1f1f1f">פסקול</text>
    <circle cx="200" cy="200" r="6" fill="#111"/></svg>
</section>
<!-- 3 fear -->
<section class="scene dark" id="fear">
  <div class="pos big shadow-d" style="top:700px;font-size:104px"><span class="line" id="f0">רגע כזה</span><span class="line" id="f1">לא חוזר.</span></div>
  <div class="pos" style="top:1060px;font-size:50px;font-weight:500;line-height:1.35;color:${C.taupe}"><span class="line" id="f2">לא רוצים להתאכזב</span><span class="line" id="f3">מהמוזיקה בחתונה שלכם.</span></div>
</section>
<!-- 4 reveal -->
<section class="scene light" id="reveal">${flow}
  <img id="rlogo" src="${logo}" style="position:absolute;left:50%;top:560px;width:560px;margin-left:-280px">
  <div class="pos big shadow-c" id="r1" style="top:1150px;text-align:center;font-size:84px">כדי שזה לא יקרה לכם.</div>
</section>
${Object.entries(DEMO).map(([id, d]) => `
<section class="scene light" id="${id}">${flow}
  <div class="pos" style="top:150px"><div class="big shadow-c line" id="${id}-cap" style="font-size:104px">${d.cap}</div>
  <div class="line" id="${id}-sub" style="margin-top:26px;font-size:46px;font-weight:500;color:#6b5f54">${d.sub}</div></div>
  <div class="phone" id="${id}-ph" style="top:520px"><div class="screen"><img id="${id}-img" src="${shot(d.img)}"></div></div>
</section>`).join('')}
<!-- 9 end -->
<section class="scene light" id="end">${flow}
  <img id="elogo" src="${logo}" style="position:absolute;left:50%;top:300px;width:460px;margin-left:-230px">
  <div class="pos big shadow-c line" id="e1" style="top:860px;text-align:center;font-size:100px">הרגעים שלכם.<br>המוזיקה שלנו.</div>
  <div class="pos line" id="e2" style="top:1160px;text-align:center;font-size:52px;font-weight:700">חינם לזוגות מתחתנים</div>
  <div class="pos line" id="e3" style="top:1290px;text-align:center"><span class="pill">www.paskol.app</span></div>
</section>
<script>
const SCENES = ${JSON.stringify(SCENES)};
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
const inOut = (x) => { x = clamp(x); return x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2; };
const $ = (id) => document.getElementById(id);
function rise(id, t, at, dur = .55, dist = 60) {
  const p = ease((t - at) / dur); const el = $(id); if (!el) return;
  el.style.opacity = p; el.style.transform = 'translateY(' + (1 - p) * dist + 'px)';
}
function fadeScene(el, t, s, e, fin = .25, fout = .25) {
  el.style.opacity = Math.min(clamp((t - s) / fin), clamp((e - t) / fout));
}
window.draw = (t) => {
  for (const [s, e, id] of SCENES) {
    const el = $(id), on = t >= s && t < e; el.style.display = on ? 'block' : 'none'; if (!on) continue;
    const lt = t - s;
    if (id === 'dream') { fadeScene(el, t, s, e, .4, .2); rise('d0', lt, .2); rise('d1', lt, .7); rise('d2', lt, 1.1);
      el.style.transform = 'scale(' + (1 + lt * .012) + ')'; }
    if (id === 'chuppah') { el.style.opacity = 1; rise('c0', lt, .05); rise('c1', lt, .6);
      // the wrong song: line 2 snaps in with a jolt, the record wobbles to a stop
      const jolt = lt > 1.55 ? Math.exp(-(lt - 1.55) * 9) : 0;
      const c2 = $('c2'); c2.style.opacity = lt > 1.55 ? 1 : 0; c2.style.transform = 'translateX(' + (Math.sin(lt * 90) * 26 * jolt) + 'px)';
      const spin = lt < 2.6 ? lt * 260 - Math.max(0, lt - 2.0) ** 2 * 200 : 0;
      $('disc').style.transform = 'rotate(' + spin + 'deg)'; $('disc').style.opacity = clamp((lt - .1) / .5);
      el.style.filter = 'none'; }
    if (id === 'fear') { fadeScene(el, t, s, e, .3, .15); rise('f0', lt, .35, .7); rise('f1', lt, .75, .7); rise('f2', lt, 1.5, .6, 30); rise('f3', lt, 1.75, .6, 30); }
    if (id === 'reveal') { el.style.opacity = 1;
      const flash = lt < .6 ? 1 - lt / .6 : 0; el.style.boxShadow = 'inset 0 0 0 2000px rgba(255,255,255,' + flash * .9 + ')';
      const p = ease((lt - .55) / .7); const lg = $('rlogo'); lg.style.opacity = p; lg.style.transform = 'scale(' + (0.82 + p * .18) + ') rotate(' + (1 - p) * -25 + 'deg)';
      rise('r1', lt, 1.3, .6); }
    if (${JSON.stringify(Object.keys(DEMO))}.includes(id)) { fadeScene(el, t, s, e, .2, .15);
      const d = ${JSON.stringify(DEMO)}[id];
      rise(id + '-cap', lt, .1); rise(id + '-sub', lt, .35, .55, 40);
      const p = ease(lt / .7); const ph = $(id + '-ph');
      ph.style.transform = 'translateY(' + (1 - p) * 260 + 'px) rotate(' + (1 - p) * -3 + 'deg)';
      const img = $(id + '-img'); const span = (e - s);
      img.style.transform = 'translateY(' + (-inOut((lt - .6) / (span - .9)) * d.pan * 1300) + 'px)'; }
    if (id === 'end') { el.style.opacity = 1; const p = ease(lt / .7); const lg = $('elogo');
      lg.style.opacity = p; lg.style.transform = 'scale(' + (0.9 + .1 * p) + ')';
      rise('e1', lt, .35); rise('e2', lt, .8, .5, 30); rise('e3', lt, 1.1, .5, 30);
      const pulse = lt > 1.8 ? 1 + Math.sin((lt - 1.8) * Math.PI * 2 / 1.0) * .025 : 1; $('e3').style.transform += ' scale(' + pulse + ')'; }
  }
};
</script></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

if (STILLS) {
  for (const t of STILLS) { await page.evaluate((x) => window.draw(x), t); await page.screenshot({ path: `${OUT}/still-${t}.jpg`, type: 'jpeg', quality: 85 }); }
  await browser.close(); process.exit(0);
}
for (let i = 0; i < SCENES.length; i++) {
  const [s, e, id] = SCENES[i];
  const n = Math.round((e - s) * FPS);
  const tmp = `${OUT}/${String(i).padStart(2, '0')}-${id}.tmp.mp4`;
  const ffm = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < n; f++) {
    await page.evaluate((x) => window.draw(x), s + f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ffm.stdin.write(buf)) await new Promise((r) => ffm.stdin.once('drain', r));
  }
  ffm.stdin.end();
  const code = await new Promise((r) => ffm.on('close', r));
  if (code !== 0) throw new Error(`ffmpeg failed for ${id}`);
  renameSync(tmp, tmp.replace('.tmp.mp4', '.mp4'));
  console.log('scene', id, n, 'frames');
}
await browser.close();
