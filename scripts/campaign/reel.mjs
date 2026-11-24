// Paskol Instagram reel (30 s, 1080×1920, 30 fps), both skins, cut on the beat of scripts/campaign/reel-music.py (120 bpm).
// Every scene is an HTML page with paused CSS animations, stepped frame by frame and piped to ffmpeg.
// Screens come from the capture spec in both skins (real song and collection covers):
//   SKIN=dark  SHOTS_OUT=scripts/tutorial/out/reel-dark  …  pizmon-capture.spec.ts
//   SKIN=light SHOTS_OUT=scripts/tutorial/out/reel-light …
// Run from the repo root:  node scripts/campaign/reel.mjs <out-dir> [sceneIndex…]      PREVIEW="i:t,i:t" → stills only
import { readFileSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? 'scripts/campaign/out-reel';
const ONLY = process.argv.slice(3).map(Number);
const PREVIEW = process.env.PREVIEW;
mkdirSync(OUT, { recursive: true });
const W = 1080, H = 1920, FPS = 30;
const C = { ivory: '#F8F4ED', champagne: '#D7C3A6', taupe: '#A89886', charcoal: '#1F1F1F', violet: '#7a60dc', lilac: '#b9a9f5', mist: '#c9c5da' };
const b64 = (p) => readFileSync(p).toString('base64');
const fnt = (fam, file, w) => `@font-face{font-family:${fam};font-weight:${w};src:url(data:font/woff2;base64,${b64(file)}) format('woff2')}`;
const fonts = [400, 500, 700].map((w) => fnt('Heebo', `node_modules/@fontsource/heebo/files/heebo-hebrew-${w}-normal.woff2`, w)
  + fnt('HeeboL', `node_modules/@fontsource/heebo/files/heebo-latin-${w}-normal.woff2`, w)).join('')
  + ['hebrew', 'latin'].map((r) => fnt('Rubik', `node_modules/@fontsource/rubik/files/rubik-${r}-900-normal.woff2`, 900)).join('');
const uri = (p, t = 'image/png') => `data:${t};base64,${b64(p)}`;
const shot = (skin, id) => uri(`scripts/tutorial/out/reel-${skin}/${id}.png`);
const L = JSON.parse(readFileSync('public/brand/opening/layers.json', 'utf8'));
const layer = (n) => uri(`public/brand/opening/${n}.webp`, 'image/webp');

const base = `${fonts}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;direction:rtl;font-family:Heebo,HeeboL,sans-serif}
[data-a]{animation-fill-mode:both;animation-play-state:paused;animation-timing-function:cubic-bezier(.2,.8,.2,1)}
@keyframes up{from{opacity:0;transform:translateY(70px)}to{opacity:1;transform:none}}
@keyframes slam{0%{opacity:0;transform:scale(1.35);filter:blur(10px)}100%{opacity:1;transform:none;filter:blur(0)}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes out{to{opacity:0;transform:scale(.92);filter:blur(8px)}}
@keyframes pop{0%{opacity:0;transform:scale(.55) rotate(-8deg)}65%{opacity:1;transform:scale(1.05) rotate(-2deg)}100%{opacity:1;transform:rotate(-3deg)}}
@keyframes phone{from{opacity:0;transform:translateY(420px) rotate(5deg)}to{opacity:1;transform:rotate(1.5deg)}}
@keyframes drift{from{transform:scale(1)}to{transform:scale(1.06)}}
@keyframes push{from{transform:scale(1)}to{transform:scale(1.035)}}
@keyframes strike{from{width:0}to{width:104%}}
@keyframes shake{0%,100%{transform:none}20%{transform:translateX(-14px)}40%{transform:translateX(12px)}60%{transform:translateX(-8px)}80%{transform:translateX(5px)}}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(540deg)}}
@keyframes wipe{from{clip-path:inset(0 0 0 100%)}to{clip-path:inset(0 0 0 0)}}
@keyframes glow{0%{opacity:.25;transform:scale(.9)}100%{opacity:.75;transform:scale(1.08)}}
.h{font-family:Rubik,Heebo;font-weight:900;line-height:.98;letter-spacing:-.01em}
`;
// data-a (not a class) so it combines with an element's own class attribute
const A = (name, delay, dur = 0.6, extra = '', style = '') => `data-a ${extra ? `class="${extra}" ` : ''}style="${style}animation-name:${name};animation-delay:${delay}s;animation-duration:${dur}s"`;
const skinCss = (dark) => dark
  ? `body{background:radial-gradient(1100px 1000px at 50% 70%,#2c2150 0%,#120f1c 50%,#000 100%);color:#fff}
     .h1{text-shadow:-6px 6px 0 #5a46a0}.sub{color:${C.mist}}.chip{color:${C.lilac};border-color:#3d3363;background:#16131f}`
  : `body{background:radial-gradient(1100px 1000px at 50% 70%,#fffdf8 0%,${C.ivory} 55%,#ece2d2 100%);color:${C.charcoal}}
     .h1{text-shadow:-6px 6px 0 ${C.champagne}}.sub{color:#5d5248}.chip{color:#8a7a68;border-color:#e0d4c2;background:#fff}`;

// a phone with the screen; optional zoomed "callout" of a region of the same screen (in screenshot pixels, 1170 wide)
const PW = 560, PH = Math.round(PW * 2532 / 1170), BZ = 16;
const phone = (src, dark, { top = 640, right = 120, anim = A('phone', 0.05, 0.6) } = {}) => `
  <div ${anim.replace('style="', `style="position:absolute;top:${top}px;right:${right}px;width:${PW + 2 * BZ}px;height:${PH + 2 * BZ}px;padding:${BZ}px;border-radius:78px;
    background:${dark ? 'linear-gradient(160deg,#4a4258,#121014 40%,#322b40)' : '#1d1b19'};
    box-shadow:0 60px 140px -30px ${dark ? 'rgba(122,96,220,.65)' : 'rgba(31,31,31,.35)'};`)}>
    <div style="width:${PW}px;height:${PH}px;border-radius:62px;overflow:hidden"><img ${A('drift', 0, 2.2, '', `width:${PW}px;display:block;transform-origin:50% 30%;animation-timing-function:linear;`)} src="${src}"></div>
  </div>`;
const callout = (src, [sx, sy, sw, sh], dark, { width = 660, left = 40, top = 1180, delay = 0.5 } = {}) => {
  const k = width / sw;
  return `<div ${A('pop', delay, 0.55, '', `position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${Math.round(sh * k)}px;border-radius:34px;
    background:url(${src}) ${-sx * k}px ${-sy * k}px/${1170 * k}px auto no-repeat;
    border:3px solid ${dark ? 'rgba(185,169,245,.55)' : '#fff'};
    box-shadow:0 50px 120px -20px ${dark ? 'rgba(0,0,0,.9),0 0 60px rgba(122,96,220,.45)' : 'rgba(31,31,31,.45)'};`)}></div>`;
};

// ---------- scenes (durations on the 2-second bar) ----------
const scenes = [];

// 0. Hook (0–4 s): the pain, said plainly
scenes.push({ dur: 4.0, html: `<style>${base}
  body{background:#0a0909;color:#fff}
  .wrap{position:absolute;top:330px;right:90px;left:90px}
  .l1{font-size:124px}.l2{font-size:104px;color:#ff7a6b;margin-top:30px;position:relative;display:inline-block;white-space:nowrap}
  .l2 i{position:absolute;right:-2%;top:46%;height:14px;background:#e2483d;border-radius:7px}
  .post{position:absolute;top:960px;right:80px;left:80px;background:#fff;color:#111;border-radius:40px;padding:48px 52px;box-shadow:0 40px 120px rgba(0,0,0,.7)}
  .who{display:flex;align-items:center;gap:22px;margin-bottom:28px;font-size:34px;font-weight:700}
  .av{width:80px;height:80px;border-radius:50%;background:#c13fd1}
  .who span{display:block;font-size:28px;color:#888;font-weight:400}
  .q{font-size:56px;font-weight:700;line-height:1.22}
  .rx{margin-top:30px;padding-top:24px;border-top:2px solid #eee;font-size:32px;color:#666;display:flex;justify-content:space-between}
  .lbl{position:absolute;top:880px;right:90px;font-size:36px;color:${C.taupe};font-weight:500}
  .all{position:absolute;inset:0}
</style>
<div class="all" ${A('out', 3.55, 0.45)}>
<div class="wrap">
  <div class="h l1" ${A('slam', 0.05, 0.4)}>ביקשתם שירים.</div>
  <div class="h l2" ${A('shake', 1.3, 0.4)}><span ${A('slam', 0.95, 0.4)}>הדיג׳יי לא שם אותם.</span></div>
</div>
<div class="lbl" ${A('fade', 2.0, 0.3)}>פוסט אמיתי מקבוצת זוגות:</div>
<div class="post" ${A('up', 2.05, 0.5)}>
  <div class="who"><div class="av"></div><div>משתתפת אנונימית<span>לפני 17 שעות</span></div></div>
  <div class="q">״התאכזבתי מהדיג׳יי בחתונה שלא שם הרבה שירים שביקשתי״</div>
  <div class="rx"><span>66 תגובות</span><span>16 לייקים</span></div>
</div></div>` });

// 1. The answer (4–6 s): the logo, the record spins
const LW = 620, k = LW / L.w;
scenes.push({ dur: 2.0, html: `<style>${base}
  body{background:radial-gradient(900px 900px at 50% 44%,#1c1730 0%,#07070a 60%,#000 100%);color:#fff;display:flex;flex-direction:column;align-items:center}
  .k{margin-top:260px;font-size:52px;font-weight:700;color:${C.mist}}
  .logo{position:relative;width:${LW}px;height:${Math.round(L.h * k)}px;margin-top:70px}
  .logo:before{content:'';position:absolute;inset:-25%;border-radius:50%;background:radial-gradient(closest-side,rgba(215,195,166,.22),transparent);animation:inherit}
  .logo img{position:absolute;display:block}
  .rec{left:${((L.cx - L.size / 2) * k).toFixed(1)}px;top:${((L.cy - L.size / 2) * k).toFixed(1)}px;width:${(L.size * k).toFixed(1)}px}
  .top{inset:0;width:100%;height:100%}
  .t{margin-top:80px;font-size:60px;letter-spacing:.06em;color:#f4f1ec;font-weight:500}
</style>
<div class="k" ${A('fade', 0, 0.3)}>בגלל זה בניתי את</div>
<div class="logo" ${A('slam', 0.05, 0.5)}><img ${A('spin', 0, 2.0, 'rec', 'animation-timing-function:cubic-bezier(.3,0,.25,1);')} src="${layer('record-light')}"><img class="top" src="${layer('top-light')}"></div>
<div class="t" ${A('up', 0.7, 0.5)}>הרגעים שלכם. המוזיקה שלנו.</div>` });

// 2–7. Features, one bar each, alternating skins; the callout zooms into the part with the covers
const feats = [
  ['dark', 'p08-library', 'מאגר מוזיקה מוכן', 'אוספים לכל רגע בחתונה', [70, 860, 1100, 690]],
  ['light', 'p08-moments', 'שיר לכל רגע', 'חופה, שבירת כוס, ריקוד ראשון', [30, 810, 1110, 800]],
  ['dark', 'p09-added', 'שומעים ובוחרים', 'האזנה בלחיצה, הוספה בפלוס', [30, 990, 1110, 660]],
  ['light', 'p10-search', 'כל שיר שתרצו', 'חיפוש בכל המאגר ובספוטיפיי', [30, 1000, 1110, 840]],
  ['dark', 'p11-stages', 'מסודר לפי שלבים', 'חופה, קבלת פנים, מסיבה', [60, 1370, 1070, 840]],
  ['light', 'p13-send', 'הכל אצל הדיג׳יי', 'תקציר מוזיקלי מסודר, גם כ-PDF', [50, 1060, 1090, 1000]],
];
feats.forEach(([skin, id, t, s, box], i) => {
  const dark = skin === 'dark', src = shot(skin, id);
  scenes.push({ dur: 2.0, feat: { id, skin, box }, html: `<style>${base}${skinCss(dark)}
    .stage{position:absolute;inset:0}
    .chip{position:absolute;top:170px;right:90px;font-family:HeeboL,Heebo;font-weight:700;font-size:30px;letter-spacing:.12em;border:2px solid;border-radius:999px;padding:8px 24px;direction:ltr}
    .h1{position:absolute;top:255px;right:90px;left:90px;font-size:118px}
    .sub{position:absolute;top:400px;right:90px;left:90px;font-size:50px;font-weight:500}
  </style><div ${A('push', 0, 2.0, 'stage', 'animation-timing-function:linear;')}>
  <div class="chip" ${A('fade', 0, 0.25)}>0${i + 1} / 06</div>
  <div class="h h1 fit" ${A('slam', 0.02, 0.38)}>${t}</div>
  <div class="sub" ${A('up', 0.18, 0.45)}>${s}</div>
  ${phone(src, dark)}
  ${callout(src, box, dark)}
  </div>` });
});

// 8. Light or dark (18–22 s): the same home screen, wiped from light to dark on the downbeat
scenes.push({ dur: 4.0, html: `<style>${base}
  .bgL,.bgD{position:absolute;inset:0}
  .bgL{background:radial-gradient(1100px 1000px at 50% 70%,#fffdf8 0%,${C.ivory} 55%,#ece2d2 100%)}
  .bgD{background:radial-gradient(1100px 1000px at 50% 70%,#2c2150 0%,#120f1c 50%,#000 100%);animation-name:wipe;animation-timing-function:cubic-bezier(.7,0,.2,1)}
  .t{position:absolute;top:220px;right:0;left:0;text-align:center;font-size:132px}
  .tL{color:${C.charcoal};text-shadow:-6px 6px 0 ${C.champagne}}
  .tD{color:#fff;text-shadow:-6px 6px 0 #5a46a0}
  .s{position:absolute;top:400px;right:0;left:0;text-align:center;font-size:56px;font-weight:700}
  .sD{color:${C.mist}}
  .ph{position:absolute;top:600px;left:50%;margin-left:-${(PW + 2 * BZ) / 2}px;width:${PW + 2 * BZ}px;height:${PH + 2 * BZ}px;padding:${BZ}px;border-radius:78px;background:#1d1b19;box-shadow:0 60px 140px -30px rgba(31,31,31,.4)}
  .ph .sc{position:absolute;inset:${BZ}px;border-radius:62px;overflow:hidden}
  .ph .sc img{width:${PW}px;display:block}
  .scD{animation-name:wipe;animation-timing-function:cubic-bezier(.7,0,.2,1)}
  .phD{background:linear-gradient(160deg,#4a4258,#121014 40%,#322b40);box-shadow:0 60px 140px -30px rgba(122,96,220,.7);animation-name:wipe;animation-timing-function:cubic-bezier(.7,0,.2,1)}
</style>
<div class="bgL"></div>
<div class="h t tL" ${A('slam', 0.05, 0.4)}>בהיר</div>
<div ${A('up', 0.3, 0.4, 's', 'color:#5d5248;')}>או...</div>
<div class="ph" ${A('phone', 0.1, 0.6)}><div class="sc"><img src="${shot('light', 'p05-home')}"></div></div>
<div ${A('wipe', 2.0, 0.5, 'bgD')}></div>
<div ${A('wipe', 2.0, 0.5, '', 'position:absolute;inset:0;animation-timing-function:cubic-bezier(.7,0,.2,1);')}>
  <div class="h t tD">כהה.</div><div class="s sD" ${A('up', 2.35, 0.45)}>אתם בוחרים. בכל רגע.</div>
  <div class="ph phD" style="animation:none"><div class="sc"><img src="${shot('dark', 'p05-home')}"></div></div>
</div>` });

// 9. Proof (22–24 s)
scenes.push({ dur: 2.0, html: `<style>${base}
  body{background:#0a0909;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 90px}
  .n{font-size:240px;color:${C.champagne};line-height:1}
  .u{font-size:78px;margin-top:6px}
  .row{display:flex;gap:70px;align-items:flex-end}
  .s{font-size:48px;color:${C.taupe};margin-top:70px;font-weight:500;line-height:1.35}
  .s b{color:#fff}
</style>
<div class="row"><div ${A('slam', 0.02, 0.4)}><div class="h n">17</div><div class="h u">שנה</div></div>
<div ${A('slam', 0.3, 0.4)}><div class="h n">600</div><div class="h u">חתונות ויותר</div></div></div>
<div class="s" ${A('up', 0.75, 0.5)}>בניתי את פסקול מאחורי העמדה,<br>כדי ש<b>אף שיר שלכם לא ילך לאיבוד.</b><br>אלקנה פז</div>` });

// 10. CTA (24–30 s): free, for every couple
scenes.push({ dur: 6.0, html: `<style>${base}
  body{background:radial-gradient(1000px 900px at 50% 30%,#2c2150 0%,#120f1c 55%,#000 100%);color:#fff;display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:250px}
  .free{font-size:260px;text-shadow:-10px 10px 0 #5a46a0}
  .all{font-size:96px;margin-top:4px}
  .gift{margin-top:46px;font-size:44px;line-height:1.4;color:${C.mist};font-weight:500}
  .logo{position:relative;width:440px;height:${Math.round(L.h * 440 / L.w)}px;margin-top:70px}
  .logo img{position:absolute;display:block}
  .rec2{left:${((L.cx - L.size / 2) * 440 / L.w).toFixed(1)}px;top:${((L.cy - L.size / 2) * 440 / L.w).toFixed(1)}px;width:${(L.size * 440 / L.w).toFixed(1)}px}
  .top2{inset:0;width:100%;height:100%}
  .url{margin-top:56px;font-family:HeeboL;font-weight:700;font-size:64px;letter-spacing:.04em;direction:ltr;color:#fff;padding:24px 70px;border-radius:999px;
    background:linear-gradient(180deg,#8f79dc,#6a54ad 48%,#4f3c8a);box-shadow:inset 0 2px 0 rgba(255,255,255,.38),inset 0 -3px 0 rgba(0,0,0,.35),0 24px 50px -14px rgba(122,96,220,.9)}
  .ring{position:absolute;top:120px;left:50%;margin-left:-480px;width:960px;height:620px;border-radius:50%;background:radial-gradient(rgba(122,96,220,.55),transparent 70%)}
</style>
<div ${A('glow', 0, 3.0, 'ring', 'animation-direction:alternate;animation-iteration-count:2;')}></div>
<div class="h free" ${A('slam', 0.02, 0.45)}>חינם.</div>
<div class="h all" ${A('up', 0.45, 0.5)}>לכל הזוגות.</div>
<div class="gift" ${A('up', 0.9, 0.5)}>בוחרים את השירים, מסדרים את הרגעים,<br>והדיג׳יי מקבל הכל. בלי הפתעות.</div>
<div class="logo" ${A('up', 1.4, 0.6)}><img ${A('spin', 1.4, 4.6, 'rec2', 'animation-timing-function:cubic-bezier(.3,0,.25,1);')} src="${layer('record-light')}"><img class="top2" src="${layer('top-light')}"></div>
<div class="url" ${A('slam', 1.9, 0.45)}>paskol.app</div>` });

// ---------- render ----------
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const seek = (t) => page.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }), t * 1000);
const fit = () => page.evaluate(async () => {
  await document.fonts.ready;
  for (const el of document.querySelectorAll('.fit')) { el.style.whiteSpace = 'nowrap'; let f = parseFloat(getComputedStyle(el).fontSize); while (el.scrollWidth > el.clientWidth && f > 50) { f -= 2; el.style.fontSize = f + 'px'; } }
});
const total = scenes.reduce((s, x) => s + x.dur, 0);
console.log('total', total.toFixed(2), 's');
if (PREVIEW) {
  for (const p of PREVIEW.split(',')) {
    const [i, t] = p.split(':').map(Number);
    await page.setContent(scenes[i].html); await fit(); await seek(t);
    await page.screenshot({ path: `${OUT}/prev-${i}-${t}.jpg`, quality: 85, type: 'jpeg' });
  }
} else {
  const files = [];
  for (const [i, sc] of scenes.entries()) {
    const name = `${OUT}/s${String(i).padStart(2, '0')}.mp4`; files.push(name);
    if (ONLY.length && !ONLY.includes(i)) continue;
    await page.setContent(sc.html); await fit();
    const tmp = name.replace('.mp4', '.tmp.mp4');
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < Math.round(sc.dur * FPS); f++) {
      await seek(f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    if (await new Promise((r) => ff.on('close', r)) !== 0) throw new Error(`scene ${i} ffmpeg`);
    renameSync(tmp, name);
    console.log('scene', i, 'done');
  }
  writeFileSync(`${OUT}/list.txt`, files.map((f) => `file '${f.split('/').pop()}'`).join('\n'));
}
await browser.close();
