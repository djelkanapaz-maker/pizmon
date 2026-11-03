@AGENTS.md

# פסקול (Paskol, formerly פזמון / Pizmon): Elkana Paz's own wedding music app

This repo is **Paskol** (renamed from Pizmon on 2026-10-30; repo, Vercel and Supabase names still say pizmon), Elkana Paz's own-branded app. It started as a copy of the Atisuto app
(repo `WeddingMusicClub`) but is a **separate product**. Work here never touches Atisuto.

## Belongs to Pizmon (OK to change)
- GitHub: `djelkanapaz-maker/pizmon`
- Vercel project: `pizmon` (team `team_NROm3lzqKNVnNGxGTCtOrvZS`); URLs: https://www.paskol.app (primary; paskol.app redirects to www; DNS at GoDaddy: A @ 216.198.79.1 + 64.29.17.1, CNAME www → 531667d347badd0a.vercel-dns-017.com), https://app.elkanapaz.com (CNAME `app` at GoDaddy) and https://pizmon.vercel.app
- Supabase project: `pizmon`, ref `zfeogwyvylctqxifovzs` (eu-central-1); company slug `pizmon`, id `00000000-0000-4000-8000-000000000001`
- Spotify app: Elkana's own (client id ends `…2f73`), set in the Vercel `pizmon` env only
- Website link to the app: repo `elkanapaz-website`, branch `couple-app-link` (merge once app.elkanapaz.com resolves)

## NEVER change from here (they belong to Atisuto)
- Repo `WeddingMusicClub`, Vercel project `atisuto-wedding-music`, Supabase ref `dfjchhxdldutgtjnkftj`, Atisuto's Spotify app

## Product decisions
- Brand: פסקול / Paskol, tagline "הרגעים שלכם. המוזיקה שלנו." Logo = record + horn + פסקול wordmark
  (`public/brand/paskol-logo*.{png,webp}`, app icon `public/brand/paskol-icon.png`; source PNG from Elkana).
  Colors: ivory #F8F4ED, champagne #D7C3A6, taupe #A89886, charcoal #1F1F1F, white.
  Typography (poster board): headlines Rubik 900 (Latin uppercase), text Heebo 400/500/700, hard 4px champagne
  poster shadow on opening titles. Tokens in `src/app/globals.css`, marks in `src/components/pizmon-mark.ts` / `brand.tsx`.
- Single DJ: Elkana Paz. New couples are assigned to him and confirmed automatically (`admin-users` edge function).
- Free self-signup (paskol.app): `/` is a public landing page for signed-out visitors, `/signup` creates the couple via the `self_signup`
  action of `admin-users` (wedding `signup_source='self'`, no DJ assignment, no DJ step). Leads live in `event_leads` (admin-only RLS;
  status + private note) and are worked at `/admin/leads`. Couples without a DJ can tap "אשמח שאלקנה יחזור אליי" (`couple_request_call`).
  The server action proves itself with `SIGNUP_SECRET` (Vercel env; its SHA-256 in `private.app_secrets`) so rate limits use the visitor IP.
- Meetings: Zoom or "another place"; "office" only appears if `NEXT_PUBLIC_OFFICE_ADDRESS` is set.
- The user writes in Hebrew; reply in Hebrew.
