# Design analysis & design system

## 1. What was actually observed on atisuto.com (2026-10-20)

Inspected live in a real browser (mobile-width viewport ~600px, computed styles read from the DOM, screenshots of hero, about, DJ roster and contact sections). Desktop layout was not separately captured; findings below are from the mobile rendering, which is what this product targets.

| Aspect | Observation |
|---|---|
| Typography | One family: **Proxima Nova** (400/700/900 loaded). Display lines are 900-weight, ALL CAPS, very tight, filled in red with a hard black outline and a hard offset shadow — a screen-print / sticker look. Body copy is 400 at a large size (~23px at that viewport), generous line height (~1.57), slight negative tracking. Names in the DJ grid are 900 caps, centered, stacked on two lines. |
| Color | Strict 4-colour system: crimson **#C01F22** (page frame + header bar), signal yellow **#FBD100** (logo, links, CTAs, form shadows), black **#000** (text, outlines, footer/contact block), white (content panels). Yellow hero uses a distressed, paper-texture print. No gradients other than that texture. |
| Composition | The whole page is a **framed poster**: a red border frames a white panel; a fixed red header bar holds the wordmark and burger. Sections are tall, single-column, with lots of vertical air. A vertical katakana word (アティスト) sits beside the headline as a graphic accent. |
| Image treatment | DJ portraits are **circles with a thick black ring**, in a 3-column **staggered** grid (middle column offset down) — rhythmic, like records on a wall. |
| Controls | Pill-shaped outline buttons with black stroke ("Book Now!"). Form inputs are black fields with a thin yellow stroke and a **hard yellow offset shadow** (no blur). Persistent bottom action bar (Waze / Call / Text) and a floating WhatsApp button. |
| Motion | Scroll cues and section anchors; a small loading dots animation. Motion is functional, not decorative. |
| Personality | Loud, warm, confident, a little retro — nightlife poster rather than wedding stationery. Communication-first (call / WhatsApp everywhere). |

## 2. Principles translated (not copied)

We keep the *principles* and build an original identity. We do **not** reuse Atisuto's logo, star mark, red/yellow pairing, katakana device, texture or layouts.

1. **Poster typography** → heavy, condensed-feeling display caps for section titles, with a hard (blur-free) offset shadow used sparingly on hero titles only.
2. **Strict small palette** → four roles only: ink, paper, one signal accent, one "confirmed" accent. No gradients.
3. **Hard offset shadows instead of soft elevation** → cards and primary buttons get a 3px solid offset in ink/accent. This replaces glassmorphism and blurred drop shadows entirely.
4. **Circular portraits with heavy rings, staggered** → DJ selection grid and DJ avatars.
5. **Framed, single-column, tall sections** → mobile screens are one idea per section with generous whitespace.
6. **Persistent bottom bar** → becomes the app's bottom navigation + mini player.
7. **The opposite of their communication-first stance**: their site pushes you to call; our app's job is to make calls unnecessary. Structured requests replace the WhatsApp button.

## 3. Original identity — "WEDDING MUSIC CLUB" (configurable)

Dark-first, because it is a music product used in the evening, and artwork reads best on ink.

### Colour tokens

| Token | Value | Use |
|---|---|---|
| `ink` | `#0F0E0D` | App background |
| `ink-2` | `#1A1817` | Cards / sheets |
| `ink-3` | `#26231F` | Inputs, raised controls |
| `line` | `#3A3530` | Hairlines, outlines |
| `paper` | `#F3ECDF` | Primary text on ink, light surfaces |
| `paper-dim` | `#B9AFA0` | Secondary text |
| `ember` | `#FF5B35` | Signal accent: primary actions, focus, "now playing" |
| `gold` | `#E9B949` | Confirmed selections, DJ approval |
| `danger` | `#FF4D6D` | NEVER PLAY, destructive, errors |
| `ok` | `#5ED39B` | Saved / success |

Contrast: paper on ink ≈ 16:1, paper-dim on ink ≈ 8.9:1, ink on ember ≈ 6.4:1, ink on gold ≈ 10:1.

### Typography

- **Display:** Rubik 800/900, uppercase, `letter-spacing: -0.01em`, line-height 0.95. Rubik has first-class Hebrew, so RTL titles keep the same voice.
- **Text:** Heebo 400/500/700 (Hebrew + Latin).
- Scale (mobile → desktop): display-xl 44→72, display-l 32→48, title 20→24, body 16, small 14, micro 12 (caps, +0.08em tracking for labels).

### Shape, depth, spacing

- Radii: **one** radius for containers (`16px`), pills for buttons/chips (`999px`), circles for portraits. No other radii.
- Depth: hard offset shadow `3px 3px 0 0` in `ember` (primary) or `paper` at 12% (cards). No blur.
- Spacing: 4px base; screen gutter 20px; section gap 40px.
- Touch targets ≥ 44px.

### Artwork

No stock or scraped album art. Tracks without authorized artwork get a **generated typographic cover** (deterministic colour block + initials from title/artist), so empty catalogs still look intentional and nothing pretends to be official artwork.

### Motion

150–220ms ease-out for state changes, sheet slide-up 260ms. All motion disabled under `prefers-reduced-motion`. No fake waveforms or animated equalizers unless audio is genuinely playing.

### States

Every list has designed **empty**, **loading** (skeleton blocks in `ink-2`) and **error** (message + retry) states. Saved/failed feedback comes from the server result — never optimistic success on failure.
