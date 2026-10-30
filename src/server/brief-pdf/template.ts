/**
 * One-page, Paskol-branded music brief (black & white, print-friendly) as a self-contained HTML document (fonts and logo
 * inlined), printed to PDF by headless Chromium. Pure function: no server or DB access here.
 */

export type BriefDoc = {
  locale: 'he' | 'en';
  couple: string;
  date: string;            // already formatted
  venue: string;
  guests: number | null;
  djName: string | null;
  meeting: string | null;  // already formatted
  generatedAt: string;     // already formatted
  submitted: boolean;
  moments: { name: string; song: string | null; backup: string | null; status: string }[];
  favoriteGenres: string[];
  dislikedGenres: string[];
  dislikedSpecific: string | null;
  favoriteArtists: string[];
  vibes: string[];
  eras: string[];
  languages: string[];
  traditions: string[];
  israeliShare: number | null;
  mustPlay: string[];
  neverAbsolute: string[];
  neverPreference: string[];
  playlist: { title: string; artist: string; status: string | null; note: string | null }[];
  playlistTotal: number;
  familyNotes: string | null;
  djNotes: string | null;
};

export type BriefAssets = { fonts: { family: string; weight: number; base64: string }[]; logoSvg: string };

const T = {
  he: {
    title: 'התקציר המוזיקלי', moments: 'הרגעים המיוחדים', taste: 'הטעם המוזיקלי', love: 'סגנונות שאנחנו אוהבים',
    less: 'פחות מתאים לנו', lessSpecific: 'אמנים / שירים שפחות נרצה', artists: 'אמנים אהובים', vibe: 'אווירה', eras: 'תקופות',
    languages: 'שפות', traditions: 'מסורות', israeli: 'מוזיקה ישראלית', must: 'חובה לנגן', never: 'לעולם לא', neverPref: 'עדיף שלא',
    playlist: 'הפלייליסט שלנו', more: 'ועוד {n} שירים באפליקציה', notes: 'הערות ל-DJ', family: 'על המשפחה והקהל',
    guests: 'אורחים', dj: 'DJ', meeting: 'פגישת תיאום', empty: '—', backup: 'גיבוי', footer: 'פסקול · הרגעים שלכם. המוזיקה שלנו. · אלקנה פז',
    draft: 'טיוטה — עוד לא נשלח ל-DJ', sent: 'נשלח ל-DJ',
    status: { confirmed: 'מאושר', awaiting_confirmation: 'ממתין לאישור', browsing: 'בבחירה', shortlisted: 'ברשימה קצרה', change_requested: 'בקשת שינוי', not_started: 'טרם נבחר', approved: 'מאושר', maybe: 'אולי', backup: 'גיבוי' } as Record<string, string>,
  },
  en: {
    title: 'Music brief', moments: 'Special moments', taste: 'Musical taste', love: 'Styles we love',
    less: 'Not for us', lessSpecific: 'Artists / songs we’d rather skip', artists: 'Favorite artists', vibe: 'Vibe', eras: 'Eras',
    languages: 'Languages', traditions: 'Traditions', israeli: 'Israeli music', must: 'Must play', never: 'Never play', neverPref: 'Rather not',
    playlist: 'Our playlist', more: '+{n} more songs in the app', notes: 'Notes for the DJ', family: 'About our family & crowd',
    guests: 'guests', dj: 'DJ', meeting: 'Planning meeting', empty: '—', backup: 'Backup', footer: 'Paskol · Your moments. Our music. · Elkana Paz',
    draft: 'Draft — not yet sent to the DJ', sent: 'Sent to the DJ',
    status: { confirmed: 'Confirmed', awaiting_confirmation: 'Awaiting OK', browsing: 'Choosing', shortlisted: 'Shortlisted', change_requested: 'Change requested', not_started: 'Not chosen', approved: 'Approved', maybe: 'Maybe', backup: 'Backup' } as Record<string, string>,
  },
};

const STAR = 'M30.1,0A30.1,30.1,0,1,0,60.2,30.1,30.13,30.13,0,0,0,30.1,0ZM43.9,49.8,30.1,39.7,16.2,49.8l5.3-16.3L7.7,23.4H24.8L30.1,7.1l5.3,16.3H52.5L38.7,33.5Z';
const PLAYLIST_MAX = 32;

const esc = (s: string | null | undefined) => (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Print-friendly: black & white, thin rules, no filled areas — light on printer ink. */
export function renderBriefHtml(d: BriefDoc, a: BriefAssets): string {
  const t = T[d.locale];
  const rtl = d.locale === 'he';
  const start = rtl ? 'right' : 'left';
  const end = rtl ? 'left' : 'right';
  const inline = (xs: string[]) => xs.length ? `<p class="inline">${xs.map((x) => `<bdi>${esc(x)}</bdi>`).join('<span class="sep">·</span>')}</p>` : `<p class="muted">${t.empty}</p>`;
  const section = (title: string, body: string, cls = '') => `<section class="sec ${cls}"><h3><span>${title}</span></h3>${body}</section>`;
  const list = (xs: string[]) => `<ul class="plain">${xs.map((x) => `<li><bdi>${esc(x)}</bdi></li>`).join('')}</ul>`;
  const logo = a.logoSvg;

  const moments = d.moments.map((m) => `
    <tr>
      <th>${esc(m.name)}</th>
      <td><div class="song">${m.song ? `<bdi>${esc(m.song)}</bdi>` : `<span class="muted">${t.empty}</span>`}</div>${m.backup ? `<div class="backup">${t.backup}: <bdi>${esc(m.backup)}</bdi></div>` : ''}</td>
    </tr>`).join('');

  const shown = d.playlist.slice(0, PLAYLIST_MAX);
  const playlist = shown.length ? `
    <ol class="pl">${shown.map((p) => `<li><bdi class="pt">${esc(p.title)}</bdi> <bdi class="pa">${esc(p.artist)}</bdi></li>`).join('')}</ol>
    ${d.playlistTotal > shown.length ? `<p class="muted small">${t.more.replace('{n}', String(d.playlistTotal - shown.length))}</p>` : ''}` : `<p class="muted">${t.empty}</p>`;

  const facts = [d.date, d.venue, d.guests ? `${d.guests} ${t.guests}` : '', d.djName ? `${t.dj}: ${d.djName}` : '', d.meeting ? `${t.meeting}: ${d.meeting}` : ''].filter(Boolean);
  const fonts = a.fonts.map((f) => `@font-face{font-family:'${f.family}';font-weight:${f.weight};src:url(data:font/woff2;base64,${f.base64}) format('woff2')}`).join('');

  return `<!doctype html><html lang="${d.locale}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(t.title)} · ${esc(d.couple)}</title>
<style>${fonts}
@page { size: A4; margin: 0 }
* { box-sizing: border-box; margin: 0; padding: 0 }
html, body { width: 210mm; background: #fff }
body { font-family: Heebo, Arial, sans-serif; color: #111; font-size: 8.7pt; line-height: 1.38 }
#page { width: 210mm; height: 296mm; padding: 13mm 14mm 9mm; display: flex; flex-direction: column }
header { padding-bottom: 5mm; border-bottom: .6mm solid #111 }
header .top { display: flex; justify-content: space-between; align-items: center }
header .logo svg, header .logo img { height: 16mm; width: auto; display: block }
header .kicker { font-size: 9pt; font-weight: 500; color: #555; ${rtl ? '' : 'letter-spacing: .14em; text-transform: uppercase;'} }
header h1 { font-family: Heebo, sans-serif; font-weight: 900; font-size: 25pt; line-height: 1.1; margin-top: 6mm; letter-spacing: -.01em }
header .facts { margin-top: 2mm; font-size: 9pt; color: #333 }
header .facts span + span::before { content: '|'; color: #aaa; margin: 0 2.5mm }
header .state { margin-top: 2mm; font-size: 7.6pt; color: #666 }
main { flex: 1; display: grid; grid-template-columns: 1.12fr 1fr; gap: 9mm; padding-top: 6mm; min-height: 0 }
.col { display: flex; flex-direction: column; gap: 5.5mm; min-width: 0 }
.sec h3 { font-family: Heebo, sans-serif; font-weight: 700; letter-spacing: 0; font-size: 10pt; margin-bottom: 2.2mm; display: flex; align-items: center; gap: 2.5mm }
.sec h3::after { content: ''; flex: 1; border-top: .25mm solid #111 }
h4 { font-size: 7.4pt; font-weight: 700; color: #555; margin: 2.4mm 0 .6mm }
h4:first-of-type { margin-top: 0 }
table.moments { width: 100%; border-collapse: collapse }
table.moments tr { border-bottom: .2mm solid #ccc }
table.moments tr:last-child { border-bottom: 0 }
table.moments th { text-align: start; font-weight: 700; width: 31%; padding: 1.8mm 0; vertical-align: top }
table.moments td { padding: 1.8mm 2mm; padding-${end}: 0; vertical-align: top }
.song { } .backup { font-size: 7.4pt; color: #666; }
.status { font-size: 6.8pt; color: #555; white-space: nowrap; border: .2mm solid #999; border-radius: 3mm; padding: .2mm 1.6mm }
.s-confirmed, .s-approved { color: #111; border-color: #111; font-weight: 700 }
.inline { } .sep { color: #999; margin: 0 1.6mm }
.muted { color: #888 } .small { font-size: 7.2pt; margin-top: 1.2mm }
ul.plain { list-style: none } ul.plain li { padding: .5mm 0; padding-${start}: 3.5mm; position: relative; }
ul.plain li::before { content: '–'; position: absolute; ${start}: 0; color: #555 }
.frame { border: .25mm solid #111; padding: 2.6mm 3.2mm }
.frame h3::after { display: none }
.frame.never { border-width: .5mm }
p.text { white-space: pre-wrap; }
.meter { display: flex; align-items: center; gap: 2.5mm } .meter .bar { flex: 1; height: 1.6mm; border: .2mm solid #111 } .meter .bar i { display: block; height: 100%; background: #111 }
ol.pl { list-style: none; columns: 2; column-gap: 5mm; counter-reset: s }
ol.pl li { break-inside: avoid; padding: .55mm 0; padding-${start}: 5mm; position: relative; counter-increment: s; border-bottom: .15mm solid #e2e2e2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
ol.pl li::before { content: counter(s); position: absolute; ${start}: 0; font-size: 6.6pt; color: #888; top: .9mm }
ol.pl .pt { font-weight: 700; font-size: 7.8pt } ol.pl .pa { font-size: 7.2pt; color: #555 }
footer { border-top: .25mm solid #111; padding-top: 2.6mm; display: flex; justify-content: space-between; align-items: center; color: #666; font-size: 7pt }
footer .brand { display: flex; align-items: center; gap: 1.8mm } footer svg { width: 3.6mm; height: 3.6mm }
</style></head><body><div id="page">
<header>
  <div class="top"><span class="kicker">${esc(t.title)}</span><span class="logo">${logo}</span></div>
  <h1>${esc(d.couple)}</h1>
  <p class="facts">${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</p>
  <p class="state">${d.submitted ? t.sent : t.draft}</p>
</header>
<main>
  <div class="col">
    ${section(t.moments, `<table class="moments">${moments}</table>`)}
    ${section(`${t.playlist} (${d.playlistTotal})`, playlist)}
  </div>
  <div class="col">
    ${section(t.taste, `
      <h4>${t.love}</h4>${inline(d.favoriteGenres)}
      <h4>${t.less}</h4>${inline(d.dislikedGenres)}
      ${d.dislikedSpecific ? `<h4>${t.lessSpecific}</h4><p class="text">${esc(d.dislikedSpecific)}</p>` : ''}
      ${d.favoriteArtists.length ? `<h4>${t.artists}</h4>${inline(d.favoriteArtists)}` : ''}
      ${d.vibes.length ? `<h4>${t.vibe}</h4>${inline(d.vibes)}` : ''}
      ${d.eras.length ? `<h4>${t.eras}</h4>${inline(d.eras)}` : ''}
      ${d.languages.length ? `<h4>${t.languages}</h4>${inline(d.languages)}` : ''}
      ${d.traditions.length ? `<h4>${t.traditions}</h4>${inline(d.traditions)}` : ''}
      ${d.israeliShare !== null ? `<h4>${t.israeli}</h4><div class="meter"><div class="bar"><i style="width:${Math.max(0, Math.min(100, d.israeliShare))}%"></i></div><span>${d.israeliShare}%</span></div>` : ''}
    `)}
    ${d.mustPlay.length ? section(t.must, list(d.mustPlay), 'frame') : ''}
    ${d.neverAbsolute.length || d.neverPreference.length ? section(t.never, `${list(d.neverAbsolute)}${d.neverPreference.length ? `<h4>${t.neverPref}</h4>${list(d.neverPreference)}` : ''}`, 'frame never') : ''}
    ${d.djNotes || d.familyNotes ? section(t.notes, `${d.familyNotes ? `<h4>${t.family}</h4><p class="text">${esc(d.familyNotes)}</p>` : ''}${d.djNotes ? `${d.familyNotes ? '<h4>&nbsp;</h4>' : ''}<p class="text">${esc(d.djNotes)}</p>` : ''}`) : ''}
  </div>
</main>
<footer><span class="brand"><svg viewBox="0 0 60.2 60.2"><path d="${STAR}" fill="#111" fill-rule="evenodd"/></svg>${t.footer}</span><span>${esc(d.generatedAt)}</span></footer>
</div></body></html>`;
}

/**
 * Evaluated in the page before printing; returns the print scale that keeps everything on one A4
 * page (1 when it already fits). Pass the result as the `scale` option of page.pdf().
 */
export const FIT_SCALE = `(() => {
  const page = document.getElementById('page');
  page.style.height = 'auto';
  const need = page.scrollHeight;
  const max = 296 * 96 / 25.4;
  const scale = need > max ? Math.max(0.6, Math.floor((max / need) * 100) / 100) : 1;
  page.style.height = scale < 1 ? (296 / scale) + 'mm' : '296mm';
  return scale;
})()`;
