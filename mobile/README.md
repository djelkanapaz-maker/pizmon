# פסקול — iOS & Android app

A Capacitor shell around the live web app (`https://www.paskol.app`). Every screen, permission
and rule comes from the web app and the database, so most changes ship without a store release.
Native adds push notifications, the splash screen, the status bar and the Android back button.

- App id (both stores): `app.paskol` · name: `פסקול`
- Icons & splash: sources in `assets/` → `npm run assets`
- After changing config or plugins: `npx cap sync`

## Builds (GitHub Actions, `.github/workflows/mobile.yml`)
- Every push to `mobile/**`: an installable Android debug APK (artifact `paskol-android-debug`)
  and an iOS compile check.
- **Store builds**: Actions → *Mobile apps* → *Run workflow* (version e.g. `1.0.0`, platforms).
  - **iOS**: archived, signed automatically and uploaded to App Store Connect → TestFlight.
    Secrets: `APPSTORE_API_KEY_P8` (the .p8 file's text), `APPSTORE_API_KEY_ID`, `APPSTORE_API_ISSUER_ID`,
    `APPLE_TEAM_ID`. The API key needs the **Admin** role (cloud-managed signing).
  - **Android**: signed `.aab` (artifact `paskol-google-play-bundle`). Secrets: `ANDROID_KEYSTORE_BASE64`,
    `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, optional `GOOGLE_SERVICES_JSON`
    (Firebase, for push). With `PLAY_SERVICE_ACCOUNT_JSON` it is also uploaded to Play's internal track
    (the very first upload of the app must be done by hand in Play Console).
  - The build number is the workflow run number, so every store build is newer than the last.

## Push notifications
1. Android: Firebase project → Android app `app.paskol` → `google-services.json` → GitHub secret
   `GOOGLE_SERVICES_JSON`. Firebase service account JSON → Supabase edge-function secret `FCM_SERVICE_ACCOUNT`.
2. iOS: Apple Developer → Keys → APNs key (.p8) → Supabase secrets `APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`
   (`APNS_BUNDLE_ID` defaults to `app.paskol`).
3. `send-push` edge function with `PUSH_SECRET`; its URL and secret in `private.app_settings`
   (`push_function_url`, `push_secret`).
