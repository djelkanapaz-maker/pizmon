@AGENTS.md

# פזמון (Pizmon): Elkana Paz's own wedding music app

This repo is **Pizmon**, Elkana Paz's own-branded app. It started as a copy of the Atisuto app
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
- Brand: פזמון / Pizmon, tagline "הרגעים שלכם. המוזיקה שלנו." Brand board: ivory #F8F4ED, champagne #D7C3A6,
  taupe #A89886, charcoal #1F1F1F, white; thin Heebo; icon = thin "פ"; sound-wave and flow-line ornaments.
  Tokens live in `src/app/globals.css`, marks in `src/components/pizmon-mark.ts` and `src/components/brand.tsx`.
- Single DJ: Elkana Paz. New couples are assigned to him and confirmed automatically (`admin-users` edge function).
- Meetings: Zoom or "another place"; "office" only appears if `NEXT_PUBLIC_OFFICE_ADDRESS` is set.
- The user writes in Hebrew; reply in Hebrew.
