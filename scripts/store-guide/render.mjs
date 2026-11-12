// Store-publishing tutorial video (1920×1080, 30 fps): one scene per slide in slides.json.
// Each scene = 0.8 s of entrance animation (frames) + the last frame held. Then concat.
//   node scripts/store-guide/render.mjs <outDir> [--stills]
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const STILLS = process.argv.includes('--stills');
const W = 1920, H = 1080, FPS = 30, ANIM = 24;
const slides = JSON.parse(readFileSync('scripts/store-guide/slides.json', 'utf8'));
const b64 = (p) => readFileSync(p).toString('base64');
const ff = (fam, file, w) => `@font-face{font-family:${fam};font-weight:${w};src:url(data:font/woff2;base64,${b64(file)}) format('woff2')}`;
const fonts = [400, 500, 700].map((w) => ff('Heebo', `node_modules/@fontsource/heebo/files/heebo-hebrew-${w}-normal.woff2`, w) + ff('HeeboL', `node_modules/@fontsource/heebo/files/heebo-latin-${w}-normal.woff2`, w)).join('')
  + ['hebrew', 'latin'].map((r) => ff('Rubik', `node_modules/@fontsource/rubik/files/rubik-${r}-900-normal.woff2`, 900)).join('');
const logo = 'data:image/png;base64,' + b64('public/brand/paskol-logo.png');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
// Latin runs (paths, field names) are isolated so they read left-to-right inside Hebrew lines
const bidi = (s) => esc(s).replace(/([A-Za-z0-9_][A-Za-z0-9_ .:/@&+\-()]*[A-Za-z0-9_)])/g, '<bdi dir="ltr">$1</bdi>');
const steps = slides.filter((s) => s.step);
// "English label: value" → the label as one left-to-right run, the value after it
const item = (t) => {
  const m = String(t).match(/^([A-Za-z][^:\u0590-\u05FF]*?):\s*(.*)$/);
  if (m) return `<b class="lbl" dir="ltr">${esc(m[1])}</b><span class="val" dir="auto">${bidi(m[2])}</span>`;
  return `<span class="val" dir="auto">${bidi(t)}</span>`;
};

const css = `${fonts}
*{margin:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#F8F4ED;color:#1F1F1F;font-family:Heebo,HeeboL,sans-serif;direction:rtl}
.a{opacity:0;transform:translateY(24px)}
.top{position:absolute;top:44px;right:90px;left:90px;display:flex;justify-content:space-between;align-items:center}
.top img{height:78px}
.chip{font-family:HeeboL,Heebo;font-weight:700;font-size:26px;letter-spacing:.06em;color:#A89886}
.big{font-family:Rubik,Heebo;font-weight:900;line-height:1.02;text-shadow:-5px 5px 0 #D7C3A6}
.num{font-family:Rubik;font-weight:900;font-size:150px;line-height:1;color:#D7C3A6}
.path{display:flex;flex-wrap:wrap;gap:10px;align-items:center;direction:ltr;justify-content:flex-end;margin-top:26px}
.path span{font-family:HeeboL,Heebo;font-weight:700;font-size:28px;background:#1F1F1F;color:#F8F4ED;padding:8px 18px;border-radius:12px}
.path i{font-style:normal;color:#A89886;font-size:30px;font-weight:700}
ol{list-style:none;margin-top:34px;display:flex;flex-direction:column;gap:16px;counter-reset:n}
ol li{counter-increment:n;font-size:44px;font-weight:500;line-height:1.35;display:flex;gap:20px;align-items:baseline}
ol li::before{content:counter(n);font-family:Rubik;font-weight:900;font-size:30px;min-width:52px;height:52px;border-radius:50%;background:#D7C3A6;color:#1F1F1F;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transform:translateY(6px)}
ol li .lbl{font-family:HeeboL,Heebo;font-weight:700;unicode-bidi:isolate}
ol li .lbl::after{content:':';}
ol li .val{unicode-bidi:isolate}
ol.mono li{font-family:HeeboL,Heebo;font-weight:700;direction:ltr;justify-content:flex-end;flex-direction:row-reverse}
.tip{margin-top:34px;background:#fff;border-right:8px solid #A89886;border-radius:14px;padding:20px 28px;font-size:32px;font-weight:500;color:#4a4038;max-width:1500px}
.bar{position:absolute;bottom:0;right:0;left:0;height:12px;background:rgba(168,152,134,.25)}
.bar b{display:block;height:100%;background:#1F1F1F;margin-right:0;margin-left:auto}
.foot{position:absolute;bottom:34px;right:90px;left:90px;display:flex;justify-content:space-between;font-family:HeeboL,Heebo;font-size:24px;font-weight:700;color:#A89886}
bdi{unicode-bidi:isolate}
`;

function html(s, i) {
  const k = steps.indexOf(s);
  const prog = k >= 0 ? (k + 1) / steps.length : s.kind === 'end' ? 1 : 0;
  const foot = k >= 0 ? `<div class="foot"><span>${esc(s.part)} · שלב ${esc(s.step)}</span><bdi dir="ltr">${k + 1} / ${steps.length}</bdi></div>` : '';
  let body = '';
  if (s.kind === 'cover' || s.kind === 'end') {
    body = `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
      <img class="a" src="${logo}" style="height:300px">
      <div class="big a" style="font-size:110px;margin-top:40px">${bidi(s.title)}</div>
      <div class="a" style="font-size:44px;font-weight:500;color:#6b5f54;margin-top:28px">${bidi(s.sub)}</div></div>`;
  } else if (s.kind === 'part') {
    body = `<div style="position:absolute;top:300px;right:150px;left:150px">
      <div class="a chip">חלק ${esc(s.n)}</div>
      <div class="big a" style="font-size:150px;margin-top:20px">${bidi(s.title)}</div>
      <div class="a" style="font-size:46px;font-weight:500;color:#6b5f54;margin-top:34px">${bidi(s.sub)}</div></div>`;
  } else if (s.kind === 'overview') {
    body = `<div style="position:absolute;top:190px;right:150px;left:150px">
      <div class="big a" style="font-size:92px">${bidi(s.title)}</div>
      <ol>${s.items.map((t) => `<li class="a">${item(t)}</li>`).join('')}</ol>
      ${s.tip ? `<div class="tip a">${bidi(s.tip)}</div>` : ''}</div>`;
  } else {
    body = `<div style="position:absolute;top:170px;right:150px;left:150px">
      <div style="display:flex;align-items:flex-end;gap:36px"><div class="num a">${esc(s.step)}</div><div class="big a" style="font-size:84px;padding-bottom:14px">${bidi(s.title)}</div></div>
      ${s.path ? `<div class="path a">${s.path.map((p) => `<span>${esc(p)}</span>`).join('<i>›</i>')}</div>` : ''}
      <ol class="${s.mono ? 'mono' : ''}">${s.items.map((t) => `<li class="a">${s.mono ? esc(t) : item(t)}</li>`).join('')}</ol>
      ${s.tip ? `<div class="tip a">${bidi(s.tip)}</div>` : ''}</div>`;
  }
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>${css}</style></head><body>
    <div class="top"><img src="${logo}"><span class="chip">מדריך העלאה לחנויות</span></div>${body}${foot}
    <div class="bar"><b style="width:${(prog * 100).toFixed(1)}%"></b></div>
    <script>window.anim=(f)=>{document.querySelectorAll('.a').forEach((el,i)=>{const t=Math.max(0,Math.min(1,(f-i*2.2)/9));const e=1-Math.pow(1-t,3);el.style.opacity=e;el.style.transform='translateY('+(1-e)*24+'px)';});};</script>
  </body></html>`;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const list = [];
for (const [i, s] of slides.entries()) {
  await page.setContent(html(s, i), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  if (STILLS) { await page.evaluate(() => window.anim(999)); await page.screenshot({ path: `${OUT}/still-${String(i).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 80 }); continue; }
  const name = `${OUT}/${String(i).padStart(2, '0')}.mp4`, tmp = name.replace('.mp4', '.tmp.mp4');
  const hold = Math.max(1, s.secs - ANIM / FPS);
  const ffm = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `tpad=stop_mode=clone:stop_duration=${hold.toFixed(3)},format=yuv420p`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', String(FPS), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = ANIM + 6 + s.items?.length * 2.2 || ANIM;
  const frames = Math.min(60, Math.ceil(total));
  for (let f = 0; f < frames; f++) {
    await page.evaluate((x) => window.anim(x), f);
    ffm.stdin.write(await page.screenshot({ type: 'jpeg', quality: 92 }));
  }
  ffm.stdin.end();
  if (await new Promise((r) => ffm.on('close', r)) !== 0) throw new Error('ffmpeg ' + i);
  renameSync(tmp, name); list.push(`file '${name}'`);
}
if (!STILLS) writeFileSync(`${OUT}/list.txt`, list.join('\n'));
await browser.close();
