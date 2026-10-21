# Atisuto — Wedding Music App

A mobile-first music platform built for **Atisuto** (אטיסוטו), the Tel Aviv wedding DJ company. Working title: WEDDING MUSIC CLUB. Couples discover music, pick songs for the big moments, set MUST / NEVER play rules and fill a guided questionnaire; their assigned DJ gets a live, structured musical brief; the company manages people, catalog, content and radio — all on one Supabase backend that a future iOS/Android app can reuse.

Hebrew is the default (RTL); English is fully supported (LTR). The product name is configurable per company (seeded as `ATISUTO`; change it in Admin → Settings).

- Design analysis & system: [docs/DESIGN.md](docs/DESIGN.md)
- Architecture, data model, permissions, native-app path: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres + RLS, Auth, Storage, Edge Functions) · zod · Vitest · Playwright

## Setup

### 1. Supabase project

1. Apply the migrations in `supabase/migrations/` in order (Supabase CLI `supabase db push`, or paste them into the SQL editor).
2. Optional demo content: run `supabase/seed.sql` (regenerate with `npx tsx scripts/seed/build-seed.ts`). Everything it creates is flagged `is_demo` and labelled "Demo" in the UI. Catalog songs are **metadata only** — no audio or artwork rights are implied.
3. Deploy the edge function: `supabase functions deploy admin-users --no-verify-jwt` (it verifies callers itself).
4. Edge function secrets: `BOOTSTRAP_SECRET` (random), `APP_URL` (your site URL); optional `RESEND_API_KEY` + `EMAIL_FROM` to email activation links.
5. Auth settings (dashboard → Authentication):
   - **Disable public sign-ups** — accounts are created by admins only.
   - Site URL = your deployment; add `https://YOUR-SITE/auth/confirm` to Redirect URLs.
   - Password reset emails work with the default template (PKCE `code` is handled by `/auth/confirm`).

### 2. First admin

```bash
curl -X POST "$SUPABASE_URL/functions/v1/admin-users" \
  -H "content-type: application/json" -H "x-bootstrap-secret: $BOOTSTRAP_SECRET" \
  -d '{"action":"bootstrap","company_slug":"atisuto","email":"you@example.com","full_name":"Your Name"}'
```

The response contains a one-time activation link. It only works while the company has no admin. Afterwards, rotate or delete `BOOTSTRAP_SECRET`.

### 3. Web app

```bash
cp .env.example .env.local   # fill in URL + anon key
npm install
npm run dev
```

## Using it

- **Admin → Couples → Add couple**: creates the wedding and returns an activation link to share (WhatsApp button included). Optionally assign a DJ right away.
- **Assignment policy** (Admin → Settings): couples choose from the roster (optionally needing approval), or the company assigns and the couple confirms.
- **DJs** sign in to `/dj`: couples sorted by date, "changes since your last review", hard bans pinned at the top, recommendations (blocked automatically if they hit a NEVER PLAY), clarification requests, private notes.
- **Radio** runs in demo mode on original placeholder audio until you set a stream URL in Admin → Radio.

## Testing

```bash
npm run typecheck && npm run lint
npm run test:unit                       # domain logic
scripts/local-stack/start.sh            # local Postgres + Supabase Auth + PostgREST + Deno (no Docker)
npm run test:integration                # 26 authorization tests against the real API
npm run build && npm start &            # app on :3000 using .env.local pointing at the local stack
npm run test:e2e                        # full journey + every admin screen, Hebrew & English, phone viewport
```

The local stack downloads nothing at runtime; it needs Postgres 16 server binaries plus the Supabase Auth, PostgREST and Deno release binaries in `/opt/localstack` (see the header of `scripts/local-stack/start.sh`). E2E logins only ever hit that local stack. Set `CHROMIUM_PATH` if Playwright's browser download isn't available.

## Deployment (Vercel)

Import the repo, set the three `NEXT_PUBLIC_*` variables, deploy, then set the edge-function secret `APP_URL` to the deployed URL. No server secrets are needed in Vercel.

## Known limitations

- Phase 1 + most of Phase 2 are implemented. Not yet: push notifications, native apps, external provider search (Spotify/Apple APIs), AI personalization (data model & guards are ready).
- Catalog tracks have no licensed audio; couples get external *search* links. Add licensed preview/full URLs per track in the catalog (DB constraints enforce rights levels).
- Mobile browsers may stop audio when the screen locks; true background audio arrives with the native app.
- Uploads over ~1 MB go directly to Storage through a signed URL; video is link-only.
- Email delivery of activation links requires a Resend key; otherwise admins share the link.
