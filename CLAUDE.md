@AGENTS.md

# פסקול (Paskol, formerly פזמון / Pizmon): Elkana Paz's own wedding music app

This repo is **Paskol** (renamed from Pizmon on 2026-10-30; repo, Vercel and Supabase names still say pizmon), Elkana Paz's own-branded app. It started as a copy of the Atisuto app
(repo `WeddingMusicClub`) but is a **separate product**. Work here never touches Atisuto.

## Belongs to Pizmon (OK to change)
- GitHub: `djelkanapaz-maker/pizmon`
- Vercel project: `pizmon` (team `team_NROm3lzqKNVnNGxGTCtOrvZS`); URLs: https://app.elkanapaz.com (custom domain, DNS CNAME `app` at GoDaddy) and https://pizmon.vercel.app
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
- Meetings: Zoom or "another place"; "office" only appears if `NEXT_PUBLIC_OFFICE_ADDRESS` is set.
- The user writes in Hebrew; reply in Hebrew.
