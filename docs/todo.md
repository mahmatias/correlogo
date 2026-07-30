# TODO — Corre Logo

## Completed This Session (2026-07-30)

- [x] **FTMS UUID fix** — Changed `FTMS_MEASUREMENT_CHAR` from `00002a63` (Cycling Power Control Point) to `00002acd` (Treadmill Data). `getCharacteristic()` now finds it. Reference: `CHANGELOG.md [2026-07-30a]`, commit `hash-tbd`.
- [x] **Strava feedback** — `showFeedback` prop added to `WorkoutTracker.tsx`, passed from `App.tsx`. Auto-save now shows toast. Reference: `CHANGELOG.md [2026-07-30a]`.
- [x] **Refresh Token OAuth** — Cloud function `authCallback` returns `refresh_token`; new `refreshAuthToken` endpoint; `gmailApi.ts` stores/refreshes tokens; `App.tsx` deep links capture `refresh_token`. Solves"re-authorize every hour" problem. Reference: `CHANGELOG.md [2026-07-30a]`.
- [x] **CI/CD GitHub Actions** — `firebase-deploy.yml` workflow: `workflow_dispatch` trigger, Capacitor-adapted (npm build → cap sync → assembleRelease → Firebase App Distribution). `.gitignore` updated. Reference: `CHANGELOG.md [2026-07-30b]`.
- [x] **Diagnostic** — Confirmed WiLinktech treadmill uses correct FTMS (0x1826) with all standard characteristics. UUID was the real bug, not timing. Reference: archive.

## Deploy Prerequisites (Blocking)

- [ ] **Set GitHub secrets**: `ENV_FILE` (base64 of `.env.apk`), `SERVICE_ACCOUNT_JSON` (Firebase App Dist), `KEYSTORE_JKS` (base64 of `keystore.jks`), `KEY_ALIAS`, `KEY_PASSWORD`, `KEY_STORE_PASSWORD`, `FIREBASE_APP_ID`
- [ ] **Push to `main`** OR trigger `workflow_dispatch` to run CI
- [ ] **Deploy cloud functions**: `firebase deploy --only functions`
- [ ] **Re-authorize Gmail once** to capture `refresh_token` for permanent access

## Next Phase

- [ ] Test auto-save Strava with treadmill workout end-to-end
- [ ] Test APK build via CI
- [ ] Test installed APK connects to treadmill and controls workout
