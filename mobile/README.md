# ATISUTO — iOS & Android app

A Capacitor shell around the live web app (`https://atisuto-wedding-music.vercel.app`).
Every screen, permission and rule comes from the web app and the database, so most
changes ship without a store release. Native adds push notifications, splash screen,
status bar and the Android back button.

- App id: `com.atisuto.weddingmusic` · name: `ATISUTO`
- Icons & splash: `assets/` → `npm run assets`
- After changing config or plugins: `npx cap sync`

## Builds
- **CI** (`.github/workflows/mobile.yml`): every push to `mobile/**` builds an installable
  Android debug APK (artifact `atisuto-android-debug`) and checks the iOS project compiles.
- **Android release**: `npm run android:release` (needs the upload keystore) → upload the `.aab` to Play Console.
- **iOS release**: open `ios/App/App.xcodeproj` in Xcode (or a cloud Mac), set the Team, Archive → App Store Connect.

## Push notifications
1. Android: Firebase project → Android app `com.atisuto.weddingmusic` → put `google-services.json`
   in `android/app/`. Service account JSON → edge-function secret `FCM_SERVICE_ACCOUNT`.
2. iOS: Apple Developer → Keys → APNs key (.p8) → secrets `APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`.
3. Deploy the `send-push` edge function, set `PUSH_SECRET`, and store the function URL and
   secret in `private.app_settings` (`push_function_url`, `push_secret`).
