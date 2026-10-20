# Architecture

## Shape

```
Next.js 16 (App Router, React 19, Tailwind 4)      ← presentation (web / PWA)
  src/app/**            routes (couple · onboarding · dj · admin · auth)
  src/components/**     design system, music/audio, staff workspace
  src/server/**         data-access layer + server actions (zod-validated, RLS-bound)
  src/core/**           pure domain logic — no React/Next imports (shared with a future native app)
  src/i18n/**           he (default, RTL) / en (LTR) dictionaries + Intl formatting

Supabase                                            ← one backend for web + future iOS/Android
  Postgres  schema + RLS + security-definer RPCs + triggers (supabase/migrations)
  Auth      email/password; invite & recovery links (token_hash flow)
  Storage   artwork (public) · media (company members only)
  Edge fn   admin-users — the ONLY holder of the service-role key
```

The web app never sees a privileged key. Every query runs as the signed-in user, so **Postgres RLS is the security boundary**; the proxy and page guards are UX only.

## Routes

| Area | Routes |
|---|---|
| Auth | `/login`, `/activate`, `/forgot-password`, `/auth/confirm` (link handler), `/no-access`, `/setup` |
| Couple | `/onboarding` → `/home`, `/discover` (+ `/discover/collection/[id]`), `/wedding` hub: `questionnaire/[section]`, `moments/[slug]`, `playlists/[id]`, `restrictions`, `saved`, `recommendations`, `requests/[id]`, `brief`; `/radio`, `/profile`, `/notifications` |
| DJ | `/dj` (filters: upcoming / needs attention / submitted), `/dj/couples/[id]?tab=brief|moments|restrictions|playlists|questionnaire|recommendations|requests|notes|activity`, `/dj/profile` |
| Admin | `/admin` (metrics), `couples` (+ create / activation links / assignment / workspace), `djs`, `catalog`, `taxonomy`, `moments`, `playlists`, `content`, `radio`, `questionnaire` (versions), `settings` |

## Core flow

Admin → `admin-users.create_couple` (event + invite link) → couple opens `/auth/confirm?token_hash…` → `/activate` (sets password) → `/onboarding` (welcome → DJ → details, each step persisted) → home. DJ choice goes through `select_dj()`; with "requires approval" on it is `pending_approval` until `admin_decide_assignment()`. Only then does the DJ gain read access to the couple.

## Data model (main relations)

`companies` 1—n `company_members` (role admin | dj | couple) · `djs` · `wedding_events`
`wedding_events` 1—n `couple_members`, `dj_assignments` (history kept; ≤1 live), `moment_selections`, `music_restrictions`, `saved_tracks`, `rejected_tracks`, `playlists(kind=couple)`, `questionnaire_responses` (pinned to a `questionnaire_versions` row), `dj_recommendations` → `recommendation_responses`, `couple_requests` → `request_messages`, `internal_notes`, `activity_events`
Catalog: `artists` 1—n `music_tracks` n—n `tags` (category | mood), `genres`, `moment_tracks` (with he/intl collection), editorial `playlists`
Content & radio: `content_items` (mixes, sets… — one table, `kind` enum, no duplicate “dj_mixes”), `radio_stations`, `radio_schedule_items`, `media_assets`

Integrity enforced in the database, not only the UI:
- Playable URLs require matching `rights_status` (CHECK constraints).
- A recommendation matching an **absolute NEVER PLAY** (track, artist or genre) is rejected by trigger.
- The same target cannot be both MUST and NEVER.
- A selection can only be `confirmed` with a song; confirmed-song changes write before/after history and notify the DJ.
- Published questionnaire versions are immutable; responses keep their version.
- Event data may only reference tracks from the event's own company.

## Permission model (RLS summary)

| | Couple | Assigned DJ | Other DJ | Admin |
|---|---|---|---|---|
| Own event + couple data | read/write (column-limited on events) | read | — | read/write |
| Internal notes | — | read/write own | — | read/write own |
| DJ assignment | via `select_dj` / `confirm_assigned_dj` only | read | — | via RPCs |
| Recommendations | read + respond | create (never-play guarded) | — | create |
| Catalog / content | published only | published only | published only | full CRUD |
| Accounts | — | — | — | via edge function |

Covered by `tests/integration/authorization.test.ts` (26 cases against real PostgREST + Auth).

## Audio

`AudioProvider` owns a single `HTMLAudioElement` (no overlapping playback). Every source is typed: `live_stream`, `demo_stream`, `company_mix`, `licensed_preview`, `licensed_full`. Catalog tracks are metadata unless rights allow playback; otherwise the UI offers clearly-labelled external *searches*. Radio is in **demo mode** with original generated audio until a stream URL is configured; live streams auto-reconnect (3 tries). Browsers may pause audio when a phone locks — stated in the UI, not hidden.

## Native iOS / Android path

Recommended: **Expo (React Native) + expo-router**, in a monorepo next to this app.

1. Move `src/core` to `packages/core` unchanged (it has no web dependencies) and import it from both apps.
2. Native app talks to the same Supabase project with `@supabase/supabase-js` (session in SecureStore). RLS + RPCs already encode all rules, so no new backend.
3. Server actions are thin wrappers around table writes/RPCs; the native app calls the same tables/RPCs directly (see `src/server/actions/*` for the exact payloads), or they can be lifted into Postgres functions/edge functions if logic must not live on the client.
4. Audio: implement the `AudioSource` contract with `expo-audio` (background mode + lock-screen controls via the OS audio session).
5. Push: add `device_tokens` table + edge function fan-out from `notifications` inserts (the notifications table is already the single source).
6. Deep links: `wmc://wedding/moments/[slug]` etc. mirror the web routes; activation links can open the app via universal links on `/auth/confirm`.

## AI (prepared, not required)

`dj_recommendations.is_ai_suggestion` marks machine suggestions; `core/restrictions.applyRestrictions` must wrap any generated list, and the DB trigger blocks never-play violations regardless. The product works fully with no AI provider configured.
