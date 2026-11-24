// Preview video of the opening screen (both skins): the logo settles in, the record spins ~2.5 s, the tagline
// appears, then the splash lifts away into the home screen. Built with the same HTML/CSS the app will use.
//   node scripts/brand/opening-preview.mjs <layers-dir> <out.mp4>
import { readFileSync, mkdirSync, renameSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const [DIR, OUT] = process.argv.slice(2);
const L = JSON.parse(readFileSync(`${DIR}/layers.json`, 'utf8'));
const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const fnt = (file, w) => `@font-face{font-family:Heebo;font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(file).toString('base64')}) format('woff2')}`;
const fonts = [400, 500].map((w) => fnt(`node_modules/@fontsource/heebo/files/heebo-hebrew-${w}-normal.woff2`, w)).join('');
const W = 405, H = 720, DSF = 1080 / 405, FPS = 30, DUR = 4.4;
const LOGO_W = 280, k = LOGO_W / L.w;

const page = (skin, home, v = skin === 'dark' ? '-light' : '') => `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>${fonts}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${skin === 'dark' ? '#000' : '#f8f4ed'};font-family:Heebo,sans-serif}
.app{position:absolute;inset:0;background:url(${home}) top center/100% auto no-repeat}
.splash{position:absolute;inset:0;display:grid;place-items:center;
  background:${skin === 'dark' ? 'radial-gradient(circle at 50% 44%, #15131b 0%, #050506 52%, #000 100%)' : 'radial-gradient(circle at 50% 46%, #fbf8f3 0%, #f8f4ed 55%, #efe7da 100%)'};
  animation:out 450ms ease-in 3200ms both}
.center{display:flex;flex-direction:column;align-items:center;gap:26px;transform:translateY(-14px)}
.logo{position:relative;width:${LOGO_W}px;height:${Math.round(L.h * k)}px;animation:logo-in 900ms cubic-bezier(.2,.8,.2,1) 150ms both}
.logo::before{content:'';position:absolute;inset:-30%;border-radius:50%;
  background:radial-gradient(closest-side, ${skin === 'dark' ? 'rgba(215,195,166,.16)' : 'rgba(215,195,166,.22)'}, transparent);animation:glow 3200ms ease-in-out both}
.logo img{position:absolute;display:block}
.rec{left:${((L.cx - L.size / 2) * k).toFixed(2)}px;top:${((L.cy - L.size / 2) * k).toFixed(2)}px;width:${(L.size * k).toFixed(2)}px;
  animation:spin 2600ms cubic-bezier(.35,0,.2,1) 250ms both}
.top{inset:0;width:100%;height:100%}
.tag{font-size:13px;letter-spacing:.32em;font-weight:500;color:${skin === 'dark' ? '#f4f1ec' : '#6f6457'};animation:tag 900ms ease-out 1000ms both}
@keyframes logo-in{from{opacity:0;transform:scale(.94);filter:blur(6px)}to{opacity:1;transform:none;filter:blur(0)}}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(600deg)}}
@keyframes tag{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes glow{0%{opacity:0}40%{opacity:1}100%{opacity:.7}}
@keyframes out{to{opacity:0;transform:scale(1.04)}}
</style></head><body><div class="app"></div><div class="splash"><div class="center">
<div class="logo"><img class="rec" src="${b64(`${DIR}/record${v}.png`)}"><img class="top" src="${b64(`${DIR}/top${v}.png`)}"></div>
<div class="tag">הרגעים שלכם. המוזיקה שלנו.</div></div></div></body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const p = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
const tmpDir = `${OUT}.parts`; mkdirSync(tmpDir, { recursive: true });
const parts = [];
for (const [skin, home] of [['dark', 'scripts/tutorial/out/noir-shots/p05-home.png'], ['light', 'scripts/tutorial/out/pz-shots/p05-home.png']]) {
  await p.setContent(page(skin, b64(home))); await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  const file = `${tmpDir}/${skin}.mp4`, tmp = `${tmpDir}/${skin}.tmp.mp4`;
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=1080:1920', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < Math.round(DUR * FPS); f++) {
    await p.evaluate((ms) => document.getAnimations().forEach((a) => { a.currentTime = ms; }), (f / FPS) * 1000);
    const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  if (await new Promise((r) => ff.on('close', r)) !== 0) throw new Error('ffmpeg ' + skin);
  renameSync(tmp, file); parts.push(file);
}
await browser.close();
const list = `${tmpDir}/list.txt`;
(await import('node:fs')).writeFileSync(list, parts.map((f) => `file '${f.split('/').pop()}'`).join('\n'));
await new Promise((res, rej) => spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', OUT], { stdio: 'inherit' })
  .on('close', (c) => (c === 0 ? res() : rej(new Error('concat')))));
console.log('done', OUT);
