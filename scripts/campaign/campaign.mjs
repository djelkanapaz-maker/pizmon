// Paskol campaign video (9:16, 30 fps). Each scene = an HTML page with paused CSS animations,
// stepped frame by frame in Playwright and piped to ffmpeg. Run from the repo root:
//   node scripts/campaign/campaign.mjs <out-dir> [sceneIndex…]
import { readFileSync, mkdirSync, renameSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? 'scripts/campaign/out';
const ONLY = process.argv.slice(3).map(Number);
const PREVIEW = process.env.PREVIEW; // "i:t,i:t" -> only stills
mkdirSync(OUT, { recursive: true });
const W = 1080, H = 1920, FPS = 30;
const C = { ivory: '#F8F4ED', champagne: '#D7C3A6', taupe: '#A89886', charcoal: '#1F1F1F', ink: '#141414' };
const b64 = (p) => readFileSync(p).toString('base64');
const fnt = (fam, file, w) => `@font-face{font-family:${fam};font-weight:${w};src:url(data:font/woff2;base64,${b64(file)}) format('woff2')}`;
const fonts = [400, 500, 700].map((w) => fnt('Heebo', `node_modules/@fontsource/heebo/files/heebo-hebrew-${w}-normal.woff2`, w)
  + fnt('HeeboL', `node_modules/@fontsource/heebo/files/heebo-latin-${w}-normal.woff2`, w)).join('')
  + ['hebrew', 'latin'].map((r) => fnt('Rubik', `node_modules/@fontsource/rubik/files/rubik-${r}-900-normal.woff2`, 900)).join('');
const LOGO = `data:image/png;base64,${b64('public/brand/paskol-logo.png')}`;
const shot = (id) => `data:image/png;base64,${b64(`scripts/tutorial/out/pz-shots/${id}.png`)}`;

const base = `${fonts}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;direction:rtl;font-family:Heebo,HeeboL,sans-serif}
.a{animation-fill-mode:both;animation-play-state:paused;animation-timing-function:cubic-bezier(.2,.8,.2,1)}
@keyframes up{from{opacity:0;transform:translateY(60px)}to{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes pop{0%{opacity:0;transform:scale(.6)}70%{opacity:1;transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes phone{from{opacity:0;transform:translateY(260px) rotate(-4deg) scale(.92)}to{opacity:1;transform:none}}
@keyframes drift{from{transform:scale(1)}to{transform:scale(1.045)}}
@keyframes strike{from{width:0}to{width:100%}}
@keyframes glow{0%,100%{opacity:.35}50%{opacity:.7}}
.h{font-family:Rubik,Heebo;font-weight:900;line-height:.98;letter-spacing:-.01em}
`;
const A = (name, delay, dur = 0.6) => `class="a" style="animation-name:${name};animation-delay:${delay}s;animation-duration:${dur}s"`;

// ---------- scenes ----------
const scenes = [];

// 1. Hook: the post
scenes.push({ dur: 4.6, html: `<style>${base}
  body{background:${C.ink};color:#fff}
  .lbl{position:absolute;top:250px;right:90px;left:90px;font-size:40px;font-weight:500;color:${C.taupe};letter-spacing:.02em}
  .card{position:absolute;top:360px;right:70px;left:70px;background:#fff;color:#111;border-radius:36px;padding:56px 56px 48px;box-shadow:0 40px 120px rgba(0,0,0,.6)}
  .who{display:flex;align-items:center;gap:24px;margin-bottom:40px}
  .av{width:92px;height:92px;border-radius:50%;background:#c13fd1;display:grid;place-items:center}
  .av i{display:block;width:46px;height:20px;border-radius:10px;background:#fff}
  .nm{font-size:38px;font-weight:700}.sub{font-size:30px;color:#777;margin-top:4px}
  .t{font-size:68px;font-weight:700;line-height:1.18}
  .x{font-size:40px;line-height:1.45;color:#333;margin-top:34px}
  .rx{display:flex;justify-content:space-between;margin-top:44px;padding-top:30px;border-top:2px solid #eee;font-size:34px;color:#666}
  .sad{display:inline-block;width:54px;height:54px;border-radius:50%;background:#f7c948;vertical-align:middle;margin-left:12px;position:relative}
  .sad:before,.sad:after{content:'';position:absolute;top:18px;width:8px;height:10px;border-radius:4px;background:#5a3b00}.sad:before{right:14px}.sad:after{left:14px}
  .bottom{position:absolute;bottom:250px;right:90px;left:90px;font-size:56px;font-weight:700;color:${C.champagne}}
</style>
<div class="lbl" ${A('fade', 0.1)}>פוסט אמיתי מקבוצה של זוגות לפני חתונה</div>
<div class="card" ${A('up', 0.25, 0.7)}>
  <div class="who"><div class="av"><i></i></div><div><div class="nm">משתתפת אנונימית</div><div class="sub">לפני 17 שעות</div></div></div>
  <div class="t">״התאכזבתי מהדיג׳י בחתונה שלא שם הרבה שירים שביקשתי״</div>
  <div class="x">״עשינו תיאום ציפיות ורשימת שירים לפני, ובכל זאת התאכזבתי.״</div>
  <div class="rx"><span><span class="sad"></span>66 תגובות</span><span>16 לייקים</span></div>
</div>
<div class="bottom" ${A('up', 2.6)}>הפוסט הזה חוזר שוב ושוב.</div>` });

// 2. Problem statements
scenes.push({ dur: 3.6, html: `<style>${base}
  body{background:${C.ink};color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 90px;gap:34px}
  .l{font-size:68px;white-space:nowrap}.l s{position:relative;text-decoration:none}
  .l s:after{content:'';position:absolute;right:0;top:52%;height:10px;background:#e2483d;animation-name:strike}
  .sm{font-size:50px;color:${C.taupe};font-weight:500;margin-top:30px}
</style>
<div class="h l l1" ${A('up', 0.05)}><s>רשימת שירים בוואטסאפ</s></div>
<div class="h l l2" ${A('up', 0.55)}><s>פתקים בפגישה</s></div>
<div class="h l l3" ${A('up', 1.05)}><s>״אל תשכח את השיר שלנו״</s></div>
<div class="sm" ${A('up', 1.9)}>ושירים שפשוט הולכים לאיבוד.</div>
<style>.l s:after{animation-fill-mode:both;animation-play-state:paused;animation-duration:.4s}
.l1 s:after{animation-delay:.6s}.l2 s:after{animation-delay:1.1s}.l3 s:after{animation-delay:1.6s}</style>` });

// 3. Turn: logo
scenes.push({ dur: 3.0, html: `<style>${base}
  body{background:${C.ivory};color:${C.charcoal};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  .k{font-size:58px;font-weight:700;color:${C.taupe}}
  .big{font-size:118px;margin-top:20px;text-shadow:-6px 6px 0 ${C.champagne}}
  img{width:640px;margin-top:90px}
</style>
<div class="k" ${A('fade', 0, 0.4)}>בגלל זה בניתי את</div>
<img src="${LOGO}" ${A('pop', 0.25, 0.7)}>
<div class="h big" ${A('up', 1.2)}>זה לא יקרה לכם.</div>` });

// 4–9. Features
const feats = [
  ['שיר לכל רגע', 'כניסה לחופה, שבירת כוס, ריקוד ראשון', 'p07-chosen'],
  ['הפלייליסט שלכם', 'מסודר לפי שלבי הערב: חופה, קבלת פנים, מסיבה', 'p11-stages'],
  ['שאלון טעם מוזיקלי', 'מה אתם אוהבים, ומה ממש לא', 'p09-dislikes'],
  ['אוספים נבחרים', 'רעיונות לכל שלב בחתונה', 'p08-library'],
  ['כל שיר בעולם', 'חיפוש ישיר מספוטיפיי', 'p10-spotify'],
  ['תקציר מוזיקלי אחד', 'כל הבחירות שלכם, מסודרות, אצל הדיג׳י', 'p13-playlist'],
];
feats.forEach(([t, s, id], i) => scenes.push({ dur: 2.7, html: `<style>${base}
  body{background:${C.ivory};color:${C.charcoal}}
  .n{position:absolute;top:150px;right:90px;font-family:HeeboL;font-weight:700;font-size:34px;letter-spacing:.14em;color:${C.taupe};direction:ltr}
  .t{position:absolute;top:210px;right:90px;left:90px;font-size:112px;text-shadow:-5px 5px 0 ${C.champagne}}
  .s{position:absolute;top:350px;right:90px;left:90px;font-size:46px;color:#5d5248;line-height:1.3}
  .ph{position:absolute;top:560px;left:50%;margin-left:-330px;width:660px;height:1428px;border-radius:84px;background:#111;padding:18px;box-shadow:0 50px 120px rgba(31,31,31,.28)}
  .ph div{width:100%;height:100%;border-radius:68px;overflow:hidden}
  .ph img{width:100%;display:block;animation-name:drift;animation-duration:2.7s;animation-timing-function:linear}
  .blob{position:absolute;bottom:0;left:0;width:640px;height:640px;border-top-right-radius:100%;background:${C.champagne};opacity:.45}
</style>
<div class="blob"></div>
<div class="n" ${A('fade', 0, 0.3)}>0${i + 1} / 06</div>
<div class="h t fit" ${A('up', 0.05, 0.5)}>${t}</div>
<div class="s" ${A('up', 0.25, 0.5)}>${s}</div>
<div class="ph" ${A('phone', 0.1, 0.7)}><div><img class="a" src="${shot(id)}"></div></div>` }));

// 10. Promise
scenes.push({ dur: 3.0, html: `<style>${base}
  body{background:${C.charcoal};color:${C.ivory};display:flex;flex-direction:column;justify-content:center;padding:0 90px}
  .l{font-size:108px}.c{color:${C.champagne}}
  .s{font-size:48px;color:${C.taupe};margin-top:50px;font-weight:500}
</style>
<div class="h l" ${A('up', 0.05)}>השירים שלכם.</div>
<div class="h l c" ${A('up', 0.45)}>ברגעים שלכם.</div>
<div class="s" ${A('up', 1.1)}>בלי הפתעות ובלי אכזבות.</div>` });

// 11. CTA: free
scenes.push({ dur: 5.0, html: `<style>${base}
  body{background:${C.ivory};color:${C.charcoal};display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:300px}
  .free{font-size:250px;text-shadow:-9px 9px 0 ${C.champagne}}
  .all{font-size:82px;margin-top:10px}
  .gift{margin-top:60px;font-size:44px;line-height:1.4;color:#4d443b;font-weight:500}
  .gift b{font-weight:700;color:${C.charcoal}}
  img{width:470px;margin-top:80px}
  .url{margin-top:50px;font-family:HeeboL;font-weight:700;font-size:60px;letter-spacing:.04em;direction:ltr;background:${C.charcoal};color:${C.ivory};padding:22px 60px;border-radius:999px}
  .ring{position:absolute;top:210px;left:50%;margin-left:-420px;width:840px;height:520px;border-radius:50%;background:radial-gradient(${C.champagne},transparent 70%);animation-name:glow;animation-duration:2.5s;animation-iteration-count:2;animation-timing-function:ease-in-out}
</style>
<div class="ring a"></div>
<div class="h free" ${A('pop', 0.05, 0.7)}>חינם.</div>
<div class="h all" ${A('up', 0.5)}>לכל הזוגות.</div>
<div class="gift" ${A('up', 1.0)}>מחווה ממני, <b>אלקנה פז</b><br>17 שנה ויותר מ-600 חתונות על הרחבה</div>
<img src="${LOGO}" ${A('fade', 1.6)}>
<div class="url" ${A('up', 2.0)}>paskol.app</div>` });

// ---------- render ----------
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const seek = (t) => page.evaluate((ms) => document.getAnimations().forEach((a) => { a.currentTime = ms; }), t * 1000);
let start = 0;
const times = [];
for (const [i, sc] of scenes.entries()) { times.push(start); start += sc.dur; }
console.log('total', start.toFixed(2), 's');
if (PREVIEW) {
  for (const p of PREVIEW.split(',')) {
    const [i, t] = p.split(':').map(Number);
    await page.setContent(scenes[i].html); await page.evaluate(async () => { await document.fonts.ready; for (const el of document.querySelectorAll('.fit')) { el.style.whiteSpace = 'nowrap'; let f = parseFloat(getComputedStyle(el).fontSize); while (el.scrollWidth > el.clientWidth && f > 50) { f -= 2; el.style.fontSize = f + 'px'; } } }); await seek(t);
    await page.screenshot({ path: `${OUT}/prev-${i}-${t}.jpg`, quality: 85, type: 'jpeg' });
  }
} else {
  for (const [i, sc] of scenes.entries()) {
    if (ONLY.length && !ONLY.includes(i)) continue;
    await page.setContent(sc.html); await page.evaluate(async () => { await document.fonts.ready; for (const el of document.querySelectorAll('.fit')) { el.style.whiteSpace = 'nowrap'; let f = parseFloat(getComputedStyle(el).fontSize); while (el.scrollWidth > el.clientWidth && f > 50) { f -= 2; el.style.fontSize = f + 'px'; } } });
    const tmp = `${OUT}/s${String(i).padStart(2, '0')}.tmp.mp4`;
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round(sc.dur * FPS);
    for (let f = 0; f < n; f++) {
      await seek(f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    const code = await new Promise((r) => ff.on('close', r));
    if (code !== 0) throw new Error(`scene ${i} ffmpeg ${code}`);
    renameSync(tmp, `${OUT}/s${String(i).padStart(2, '0')}.mp4`);
    console.log('scene', i, 'done');
  }
}
await browser.close();
