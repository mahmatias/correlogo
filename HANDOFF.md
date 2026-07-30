# Handoff

## Session Context (2026-07-30d — ShareCard: Compartilhar Estatísticas em Redes Sociais)

### What changed
Full share-to-social flow added to SessionSummary:
- **3 card variants**: Gradient (A), Glass (B), SVG Map (C) at 1080×1920 (Insta Stories)
- **Stat selection**: user picks which stats to show via checkboxes before generating
- **Capture pipeline**: hidden full-size element captured by `dom-to-image-more` → saved to Cache → shared via `@capacitor/share` (native share sheet with APK images)
- **Route polyline** (variant C): draws session GPS points as an SVG path with green/red start/end markers — no Leaflet dependency
- **Web fallback**: download via `<a>` tag or Web Share API

### Files created
- `src/components/ShareCard.tsx` — 3-variant card component (1080×1920 fixed size)
- `src/lib/shareCard.ts` — captureBlob() + shareImage() logic

### Files modified
- `src/components/SessionSummary.tsx` — share button, share modal (style selector, stat checkboxes, preview, share button), hidden capture element
- `CHANGELOG.md` — new entry

### CI Fix — Autoupdate Breaking Bug
**Root cause**: `gh release delete latest -y` removed the existing release, then `gh release create` failed (likely upload timeout), leaving **no** `latest` release → `update-manifest.json` returned 404 → app's `checkForUpdate()` got `!resp.ok` and returned null silently.

**Fix in `b245d50`**:
- Replaced delete+create with `gh release upload --clobber` (never delete the release)
- Added `git tag -f latest HEAD` + `git push origin latest --force` to ensure tag points to current commit
- `gh release create` only as fallback for first run (no prior release)

### Pending
1. **Verify CI fix** — `b245d50` CI run should recreate `latest` release with new `update-manifest.json`
2. **Test in-app update** — once CI completes, open app → should prompt update
3. **Test share flow** on real device: tap Compartilhar → select stats/style → preview → share sheet
4. **Map variant C**: SVG polyline needs validation with real GPS data (start/end markers, path fidelity)

## Session Context (2026-07-30 — FTMS UUID Fix + Refresh Token + CI/CD + Release Keystore)

### What changed
**Google Sign-In "No Credentials available"**: CI/CD APK was signed with a new release keystore whose SHA-1 (`B4:56:92:B8:F1:3B:9B:FC:23:DA:38:87:AC:6B:79:8D:CC:35:B4:BA`) was not registered in Firebase Console. Previously only the debug keystore SHA-1 was registered. User added the new SHA-1 manually. `google-services.json` re-downloaded now includes both OAuth client entries.

**Auto-increment versionCode**: Each CI workflow run now uses `$GITHUB_RUN_NUMBER + 100` as `versionCode` via `-PciVersionCode` Gradle property. This ensures each build creates a *new* Firebase App Distribution release instead of overwriting the same one. `android/app/build.gradle` falls back to `19` for local builds.

**Gmail API exports**: `src/lib/gmailApi.ts` now exports `isGmailConnected()` and `disconnectGmail()` for use in Profile page UI.

### Files modified
- `.github/workflows/firebase-deploy.yml` — `Compute version code` step, `-PciVersionCode` flag
- `android/app/build.gradle` — dynamic `versionCode` from project property
- `android/app/google-services.json` — second OAuth client entry for release keystore SHA-1
- `src/lib/gmailApi.ts` — exported `isGmailConnected()`, `disconnectGmail()`

### This session — Release Keystore + Profile fixes + In-App Update

**Gmail connect/disconnect button**: `UserProfile.tsx` now has a proper Gmail section below Health Connect that shows connection status (`Conectado`/`Desconectado`) and a button to connect/disconnect. Uses `isGmailConnected()`/`disconnectGmail()`/`startGmailOAuth()` from `gmailApi.ts`.

**Profile scroll fix**: `Modal.tsx` inner container got `max-h-[calc(100vh-2rem)] overflow-y-auto` so tall content scrolls instead of overflowing.

**Custom in-app update system** (replaces Firebase App Tester):
- `ApkInstallerPlugin.kt` — new Capacitor plugin installs APK via FileProvider + install intent
- `src/lib/capacitor/apk-installer.ts` — TS wrapper
- `src/lib/update-checker.ts` — fetches `update-manifest.json` from GitHub Releases, compares versionCode, downloads + installs
- `src/components/UpdatePrompt.tsx` — modal showing new version prompt with "Baixar" / "Agora não"
- `App.tsx` — on auth, calls `CapApp.getInfo()` → `checkForUpdate()` → shows prompt if newer version found
- `.github/workflows/firebase-deploy.yml` — after build, creates/updates GitHub Release `latest` with `app-release.apk` + `update-manifest.json`

### Files created
- `android/app/src/main/java/com/correlogo/app/ApkInstallerPlugin.kt`
- `src/lib/capacitor/apk-installer.ts`
- `src/lib/update-checker.ts`
- `src/components/UpdatePrompt.tsx`

### Files modified
- `.github/workflows/firebase-deploy.yml` — versionCode bump + GitHub Release upload
- `android/app/build.gradle` — dynamic versionCode via `ciVersionCode` property
- `android/app/google-services.json` — second OAuth client entry for release keystore
- `android/app/src/main/java/com/correlogo/app/MainActivity.java` — register ApkInstallerPlugin
- `src/components/Modal.tsx` — scrollable modal content
- `src/components/UserProfile.tsx` — Gmail connect/disconnect, scroll fix
- `src/lib/gmailApi.ts` — exported `isGmailConnected()`, `disconnectGmail()`
- `src/App.tsx` — update check on auth, UpdatePrompt component

### Pending
1. **Test Gmail re-authorize** — user needs to tap "Conectar Gmail" in Profile to capture `refresh_token` for permanent access
2. **Test in-app update** — next CI build will create GitHub Release; app should prompt on next launch

---

## Session Context (2026-07-29i — Bluetooth FTMS Treadmill Control)

### What changed
Complete Bluetooth LE FTMS (Fitness Machine Service) integration for Matrix T600x treadmill control. Full bidirectional: read telemetry + write speed/incline commands, with auto-adjust based on workout plan steps.

### New files

**Native Kotlin:**
- `android/app/.../MatrixFtmsManager.kt` — Pure FTMS encode/decode (opcodes, bitmask parsing, UINT24/SINT16)
- `android/app/.../TreadmillBleService.kt` — GATT state machine (9 sealed states), scan, connect, auto-transition via `onCharacteristicWrite`/`onDescriptorWrite` callbacks, keep-alive coroutine (3s)
- `android/app/.../TreadmillBlePlugin.kt` — Capacitor plugin bridge (scan, connect, setSpeed, setIncline, requestControl, startWorkout, events for telemetry/state/errors)

**TypeScript:**
- `src/lib/capacitor/treadmill-ble.ts` — JS interface + wrapper functions
- `src/lib/mock-treadmill-engine.ts` — MockTreadmillEngine for web dev (simulates BLE events, manual speed/incline controls)
- `src/lib/treadmill-connection.ts` — `useTreadmill()` hook (abstracts native + mock)

**UI:**
- `src/components/TreadmillPanel.tsx` — Scan/connect UI, live telemetry display, speed/incline ± controls, target indicator

### Modified files
- `MainActivity.java` — registered `TreadmillBlePlugin`
- `AndroidManifest.xml` — added BLE permissions + `<uses-feature android:hardware.bluetooth_le>`
- `WorkoutTracker.tsx` — integrates `useTreadmill()`, syncs speed to BLE on step change (`setStepSpeed`) and on manual adjustment (`startAdjusting`), renders `TreadmillPanel` in treadmill mode

### Architecture notes
- BLE ops require WRITE_TYPE_DEFAULT (write with response); WRITE_TYPE_NO_RESPONSE fails silently on Matrix consoles
- Keep-alive at 3s prevents Matrix 5-10s safety timeout
- Telemetry parsed at 1Hz from Treadmill Data notification (0x2ACD) with bitmask flags
- Mock engine for web: `createMockEngine()` simulates full connection sequence (CONNECTING → ACTIVE_SESSION_CONTROLLED) with manual speed/incline controls
- Auto-adjust: `useEffect` watches `currentSpeed` + `treadmill.connected`, sends SetSpeed on change; `setStepSpeed` sends target speed on step transition

### Testing
- Web mock: start workout in treadmill mode → "Conectar esteira" button → mock connects in ~2s → manual speed/incline controls work
- Real device: scan filters for FTMS service UUID (0x1826), connects to Matrix T600x, request control handshake, speed/incline commands, 3s keep-alive

---

## Session Context (2026-07-29h — Fix web TDZ + deploy)

### What changed
Web interface was broken by `ReferenceError: Cannot access 'ei' before initialization` — a Temporal Dead Zone bug introduced by uncommitted changes.

### Root cause
The new `useEffect` for `backActionStack` (LIFO back button stack) referenced `planToUncomplete` in its dependency array at line ~134, but `const [planToUncomplete, setPlanToUncomplete]` was declared at line ~639. In JavaScript, `const` is in TDZ until its declaration is reached. The minifier (esbuild) mangled `planToUncomplete` to `ei`, producing the error.

### Fix
- Moved `useState(planToUncomplete)` from line ~639 to line 94 (alongside other modal state vars)
- Cleaned duplicate `showBackgroundPrompt` entries (was 3x in body + 2x in deps array)
- Built + deployed to Firebase Hosting (`correlogo.web.app`)

### Impact
Web interface restored. APK unaffected.

---

## Session Context (2026-07-29g — Strava via Gmail API v2.2)

### What changed
Strava upload channel implemented: email with TCX (treadmill) or GPX (outdoor) sent to `stravaupload@gotoes.org` via Gmail API (`gmail.send` scope). Reuses existing `generateTCX`/`generateGPX` from `exportUtils.ts`.

### Files created
- **`src/lib/gmailApi.ts`** — Full Gmail OAuth + send service:
  - `startGmailOAuth()` — opens Google consent via `Browser.open({ url })` with `gm_` state prefix (same pattern as Calendar)
  - `listenForGmailCallback()` — registers `appUrlOpen` listener, differentiates `gm_` prefix from `c3_` (Calendar)
  - `getStoredGmailToken()` / `clearGmailToken()` — localStorage key `gmail_strava_token`
  - `sendWorkoutToStravaViaEmail(session)` — builds MIME `multipart/mixed` email with base64-encoded TCX (treadmill) or GPX (outdoor) attachment, POSTs to `gmail.googleapis.com/gmail/v1/users/me/messages/send`
  - Token expiry: on 401, clears token and returns error "Token expirado. Reconecte o Gmail."

### Files modified
- **`src/App.tsx`** — Deep link handler bifurcated:
  - State with `gm_` prefix → stores as `gmail_strava_token`, shows toast "Gmail conectado!", does NOT open Calendar modal
  - State without `gm_` prefix → existing Calendar flow unchanged
  - `onExportSession` handler: after HC export, also calls `sendWorkoutToStravaViaEmail(session)` and shows a second toast on success/error
- **`src/components/WorkoutTracker.tsx`** — `handleSaveAndSync`: after HC sync, constructs a `TrainingSession` from refs and calls `sendWorkoutToStravaViaEmail()` fire-and-forget (logs error, doesn't block UI)
- **`android/app/build.gradle`** — versionCode 18→19, versionName "2.1"→"2.2"

### OAuth Architecture
- Same backend flow as Calendar: `Browser.open()` → Google consent → server exchanges code → redirects to `com.correlogo.app://oauth?token=...&state=gm_xxx`
- `state` prefix `gm_` vs `c3_` is the ONLY distinction — both use the same server callback
- No new cloud function or server endpoint needed
- Token stored separately from Calendar token (different localStorage key, different scope)

### Build validation
- `npm run build` ✅ → `npx cap sync android` ✅ → `gradlew assembleDebug` ✅
- APK: `app-debug.apk` (versionCode 19, versionName "2.2")

### Next steps for user
1. **Install v2.2 APK** and test on device
2. **First Strava send**: app will redirect to Google OAuth consent → authorize `gmail.send` → return to app → email sent
3. **Verify** treadmill workout appears on Strava (TCX via email)
4. **Verify** outdoor workout appears on Strava (GPX via email, when outdoor HC export works)
5. **Fix outdoor route HC export** — still failing. Check `adb logcat` for the specific error (route fallback should insert without route and log error)

### Relevant files
- `src/lib/gmailApi.ts` — new, main Gmail/Strava integration
- `src/App.tsx` — deep link handler lines 329-360, onExportSession lines 915-943
- `src/components/WorkoutTracker.tsx` — handleSaveAndSync lines 681-706
- `src/lib/exportUtils.ts` — TCX/GPX generators (unchanged)
- `android/app/src/main/java/com/correlogo/app/HealthConnectPlugin.kt` — route fallback

---

## Session Context (2026-07-29f — Proper ActivityResultLauncher Permission Flow v2.0)

### Diagnosis (cumulative)
All previous attempts (v1.6 through v1.9) shared the same root flaw:
- `requestHcPermissions()` called `startActivity(intent)` and immediately resolved `granted=true` without waiting for the user
- The HC permission screen opened but the app had no way to know whether the user actually granted `WRITE_EXERCISE`
- When `exportWorkout()` ran, it found permissions not granted and failed — user saw "Falha ao sincronizar"
- v1.7 added `<queries>` (package visibility), v1.8 added `getGrantedPermissions()` check, v1.9 added `setPackage` — all on top of the broken `startActivity` foundation

### Fix
- **Registered `ActivityResultLauncher`** via `ComponentActivity.registerForActivityResult()` in `HealthConnectPlugin.load()` — this is the only correct way to get the permission result
- `load()` is called during Capacitor bridge creation, which runs during `BridgeActivity.onCreate()`, so the activity's lifecycle is CREATED (not yet STARTED) — this satisfies `registerForActivityResult`'s requirement of being called before STARTED
- The launcher's callback receives the actual set of granted permissions from the Health Connect permission screen
- `pendingPermCall` stores the PluginCall reference; the callback resolves it with the real `granted` boolean
- All 5 `startActivity()` fallback attempts removed — they were all pseudo-fixes that never waited for user input
- `exportWorkout()` now has a clean rejection path: if `WRITE_EXERCISE` not granted, rejects with message guiding user to Profile > Health Connect

### Files modified
- `android/app/src/main/java/com/correlogo/app/HealthConnectPlugin.kt` — full rewrite:
  - Added `override fun load()` with `registerForActivityResult`
  - Added `permLauncher: ActivityResultLauncher<Set<String>>?`
  - `requestHcPermissions()` uses `launcher.launch(permissions)`, resolves from callback
  - Removed `permContract`, `tryOpenIntent()`, all 5 intent attempts, imports for `Intent`/`Uri`
  - `exportWorkout()`: removed broken re-launch attempt on permission check failure
- `android/app/build.gradle` — versionCode 10→11, versionName "1.1"→"2.0"

### User-facing flow
1. User taps "Autorizar Health Connect" in Profile
2. `requestHealthPermission()` → `requestHcPermissions()` → `permLauncher.launch(permissions)`
3. Health Connect permission screen opens (not main HC app) — user sees Corre Logo and toggles WRITE_EXERCISE
4. When user returns, callback fires with `grantedPerms: Set<String>`
5. JS receives `granted: true/false` — UI updates accordingly
6. To export: user completes workout or taps retry in SessionHistory
7. `exportWorkout()` calls `getGrantedPermissions()` — if granted, writes `ExerciseSessionRecord` + `DistanceRecord` + `ExerciseRoute`
8. If not granted: toast tells user to check permissions → Profile → re-authorize → retry

### Build validation
- `npm run build` ✅ → `npx cap sync android` ✅ → `gradlew assembleDebug` ✅
- APK: `Corre Logo v2.0.apk` (versionCode 11)

### Next steps
1. **Install v2.0 APK** on user's device and test the full flow:
   - Tap "Autorizar Health Connect" → HC permission screen should open with WRITE_EXERCISE toggle
   - Grant permission → UI shows "Autorizado"
   - Complete a workout → export → verify in Health Connect app → check Strava/GymRats
2. If permission screen still doesn't open: check `adb logcat -s CorreLogo-HC` for any errors
3. If permission screen opens but WRITE_EXERCISE doesn't appear: check that `android:healthPermissions` attribute is in `AndroidManifest.xml` `<uses-permission>` — already present
4. If in-app test works: also test export on a non-treadmill workout with GPS route to verify `ExerciseRoute` writing

---

## Session Context (2026-07-29e — Permission Check Before Export)

### Diagnosis
User reports:
- "Autorizar Health Connect" now opens HC app ✅
- ✅ shows in UserProfile ✅
- Completion modal shows **nothing** about sync status
- SessionHistory shows status "pendente", retry shows "Falha ao sincronizar"

Root cause: `requestHcPermissions()` opens the HC app but we immediately resolve with `granted: true` without waiting for actual user action. The user may not have actually granted `WRITE_EXERCISE`. When `exportWorkout()` calls `insertRecords()`, it throws SecurityException silently.

### Fix
- Added `c.permissionController.getGrantedPermissions()` check before `insertRecords()` in `exportWorkout()`
- If `WRITE_EXERCISE` not granted: re-open HC permission screen via `permContract.createIntent()` + reject with clear message
- Updated toast message: "Falha ao sincronizar. Verifique as permissões do Health Connect e tente novamente."

### Still broken
- The `useEffect` in WorkoutTracker that triggers export on `isWorkoutCompleted` shows no sync status — user sees nothing in the completion modal. This is likely because `syncStatus` starts as `'idle'` and the export fails before the modal reads the updated status, OR the component re-renders without the status block becoming visible.

### Build validation
- `npm run build` ✅, `gradlew assembleDebug` ✅
- APK: `Corre Logo v1.8.apk` (8.4 MB)

---

## Session Context (2026-07-29d — Multi-Attempt Permission Intent + Package Visibility)

### What changed
User reports v1.6 opens Play Store instead of Health Connect permission screen. Root cause: on Android 11+, package visibility restrictions prevent our app from resolving Health Connect intents. Fixes:
- **AndroidManifest.xml**: added `<queries>` block declaring `com.google.android.apps.healthdata` package + `health-connect://` scheme
- **5-attempt fallback chain** in `requestHcPermissions()`:
  1. `PermissionController.createIntent()` — official Health Connect permission screen
  2. Direct deep link `health-connect://permissions` via `Intent(ACTION_VIEW)`
  3. `getLaunchIntentForPackage("com.google.android.apps.healthdata")` — open Health Connect app main screen
  4. Play Store (`market://details?id=com.google.android.apps.healthdata`)
  5. App settings (last resort)
- New `tryOpenIntent()` helper — clean try/catch per attempt with logging

### Files modified
- `android/app/src/main/AndroidManifest.xml` — added `<queries>` block
- `android/app/src/main/java/com/correlogo/app/HealthConnectPlugin.kt` — added `tryOpenIntent()`, 5-attempt flow, `Uri` import

### Build validation
- `npm run build` ✅
- `gradlew assembleDebug` ✅
- Merged manifest confirmed: `<queries>` with `com.google.android.apps.healthdata` + `health-connect` scheme present
- APK: `Corre Logo v1.7.apk` (8.4 MB)

### Pendentes (unchanged)
- Testar botão "Autorizar Health Connect" no v1.7
- Botão Nav Back (modal)
- Foto do perfil
- Dados PII

---

## Session Context (2026-07-29c — Permission Flow Refactoring)

### What changed
Removed `startActivityForResult` + `handleOnActivityResult` pattern from `HealthConnectPlugin.kt`. Capacitor 7 uses `ActivityResultLauncher` internally, making `handleOnActivityResult` unreliable. New approach:
- `requestHcPermissions()` calls `activity.startActivity(intent)` directly — no result waiting
- Resolves `call` immediately with `{ granted: true }` (assumes user will see the permission screen)
- Fallback chain: Health Connect permission screen → Play Store → app settings
- `handleOnActivityResult()` and `pendingPermCall` removed as dead code
- `exportWorkout()` fails with `Permission denied` if user didn't grant — handled by existing catch block, user sees "sync failed" and can retry authorization

### Files modified
- `android/app/src/main/java/com/correlogo/app/HealthConnectPlugin.kt` — replaced `startActivityForResult` with `activity.startActivity`, removed `permContract` constants, removed `handleOnActivityResult`, removed `pendingPermCall`

### Build validation
- `npm run build` ✅
- `gradlew assembleDebug` ✅
- APK: `Corre Logo v1.6.apk` (8.4 MB)

### Pendentes (unchanged)
- Permission intent still untested on user's device — may need further debugging
- Botão Nav Back (modal)
- Foto do perfil
- Dados PII

---

## Session Context (2026-07-29b — Health Connect Pivot)

### What changed
Health Connect (Android's native health platform, `androidx.health.connect:connect-client:1.1.0`) replaced the Samsung Health SDK. This was a strategic pivot after finding that both **Strava** and **GymRats** natively support Health Connect — writing once to Health Connect covers both targets. Health Connect is free, requires no partnership, is built into Android 14+ (installable on older devices via Google Play), and uses the official Jetpack API.

### Files created
- `android/app/src/main/java/com/correlogo/app/HealthConnectPlugin.kt` — Capacitor plugin wrapping `HealthConnectClient`, `PermissionController`, `ExerciseSessionRecord`, `DistanceRecord`, `ExerciseRoute`. Methods: `isAvailable()`, `requestHcPermissions()`, `exportWorkout()`
- `src/lib/capacitor/health-connect.ts` — JS wrapper exporting `isHealthConnectAvailable()`, `requestHealthPermission()`, `exportWorkoutToHealthConnect()`

### Files deleted
- `android/app/src/main/java/com/correlogo/app/SamsungHealthPlugin.kt` — replaced by HealthConnectPlugin
- `src/lib/capacitor/samsung-health.ts` — replaced by health-connect.ts

### Files modified
- `android/app/build.gradle` — added `androidx.health.connect:connect-client:1.1.0` + `kotlinx-coroutines-android:1.8.1`, removed Samsung AAR fileTree comment
- `android/app/src/main/AndroidManifest.xml` — removed Samsung Health meta-data + `WRITE_USE_APP_SURVEY` permission; added `android.permission.health.READ_EXERCISE` + `WRITE_EXERCISE`
- `src/components/WorkoutTracker.tsx` — import swapped to health-connect, same `onSyncResult` flow
- `src/App.tsx` — import + function call + feedback message (`"Treino sincronizado com Health Connect!"`)
- `android/variables.gradle` — `compileSdkVersion=36`, `targetSdkVersion=36`, `minSdkVersion=26` (required by Health Connect)
- `android/build.gradle` — AGP `8.7.2` → `8.9.1` (required by connect-client 1.1.0)

### What Health Connect writes
- **ExerciseSessionRecord** with `EXERCISE_TYPE_RUNNING` (outdoor) or `EXERCISE_TYPE_RUNNING_TREADMILL`, `Metadata.unknownRecordingMethod()`, title "Corre Logo"
- **DistanceRecord** with `Length.kilometers(distanceKm)` — written alongside the session
- **ExerciseRoute** with `ExerciseRoute.Location` per GPS point (lat, lng, altitude as `Length.meters`, timestamp as `Instant`) — only for outdoor workouts with routes
- **Permissions requested**: `WRITE_EXERCISE` on `ExerciseSessionRecord` + `DistanceRecord`

### Key API corrections discovered during build
- `ExerciseSessionRecord` uses `Int` exercise type constants (`EXERCISE_TYPE_RUNNING`, etc.), not a sealed class
- `Distance` is `Length` (`Length.kilometers()`, `Length.meters()`)
- `Altitude` is also `Length.meters()`
- `Route` is `ExerciseRoute` (`ExerciseRoute.Location` for points)
- `ExerciseSessionRecord` takes 6 mandatory params: `(startTime, startZoneOffset, endTime, endZoneOffset, metadata, exerciseType)`
- Constructor overload accepting `ExerciseRoute` takes 11 params (adds title, notes, segments, laps, route)
- Permission contract: `PermissionController.createRequestPermissionResultContract()` (not `HealthPermissionsRequestAppContract` — it's internal)

### Build validation
- `npm run build` ✅ (web)
- `gradlew assembleDebug` ✅ (APK, with deprecation warnings on pre-existing patterns only)

### Pendentes
- Botão Nav Back (modal)
- Foto do perfil
- Dados PII

---

## Session Context (2026-07-25 — TTS Metade + Audio Ducking Fix + WakeLock)

### O que foi feito
- **TTS "Chegamos na metade dessa volta!":** dispara em etapas de Corrida >180s (tempo) ou 50% da distância. Ignora aquecimento/caminhada/desaquecimento
- **TTS "Chegamos na metade do treino!":** dispara uma vez aos 50% do tempo total (ignorado no Treino Livre)
- **Audio ducking fix:** `abandonFocus()` chamado imediatamente após `await TextToSpeech.speak()` — descobrimos que o plugin Capacitor TTS resolve a Promise em `UtteranceProgressListener.onDone()`, então `await speak()` já espera o TTS terminar no Android (comentário original estava errado)
- **WakeLock (foreground service):** `PARTIAL_WAKE_LOCK` adquirido no `onStartCommand`, liberado no `onDestroy` — mantém CPU ativa durante treino, impede morte do serviço ao apagar tela
- **Modo esteira keep-alive:** novos métodos `startKeepAlive`/`stopKeepAlive` no `TrackingPlugin.kt` — inicia o foreground service sem GPS. `WorkoutTracker.tsx` chama no mount quando `mode === 'treadmill'`
- **Deploy:** Web em `correlogo.web.app` + APK v1.1 (versionCode 9, 6.9 MB)

### Pendentes
- Botão Nav Back (modal)
- Foto do perfil
- Dados PII

---

## Session Context (2026-07-21b — Migração AWS → Firebase Hosting + Cloud Functions)

### O que foi feito
- **Migração completa AWS EC2 → Firebase Hosting + Cloud Functions:**
  - Cloud Function `authCallback` (v2, Node.js 22): troca Google OAuth code → token, redireciona web (query params) ou APK (custom scheme `com.correlogo.app://oauth/callback`)
  - Cloud Function `healthCheck`: GET `/api/health` retorna `{"status":"ok"}`
  - Firebase Hosting: serve `dist/` (SPA), rewrites pra Cloud Functions, CSP + security headers no `firebase.json`
  - Domínio: `correlogo.web.app` (novo) — `correlogo.sytes.net` (AWS) continua rodando como fallback
- **Limpeza de deps do servidor:** removidos `express`, `helmet`, `cors`, `express-rate-limit`, `google-auth-library`, `dotenv`, `esbuild`, `@types/express`
- **Simplificação de scripts:** `"dev": "vite"`, `"build": "vite build"` (sem esbuild server.cjs)
- **Remoção de `server.ts`** — substituído por Firebase Hosting + Cloud Functions
- **Remoção de CSP meta tag do `index.html`** — CSP agora fica no `firebase.json` (headers do Firebase Hosting)
- **Atualização de domínio:** redirect URI em `GoogleCalendarModal.tsx` mudou de `correlogo.sytes.net` → `correlogo.web.app`
- **CSP expandida no Firebase Hosting:** `script-src` inclui `https://apis.google.com`, `https://accounts.google.com`, `https://securetoken.googleapis.com`, `https://www.gstatic.com` (necessário pra Firebase Auth web)
- **Cloud Functions `.env`:** variáveis `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` via `.env` (não `functions.config()` deprecated)
- **APK build:** versionCode 8, `Corre Logo v1.0.apk` — OAuth nativo funciona com `correlogo-prod`
- **Firestore rules:** publicadas via Firebase Console
- **Blaze plan ativado** no `correlogo-prod` (necessário pra Cloud Functions, custo $0 dentro do free tier)

### Infraestrutura final
- **Firebase project:** `correlogo-prod`
- **Hosting URL:** `https://correlogo.web.app` (site: `correlogo`)
- **Cloud Functions:** `authCallback` + `healthCheck` (us-central1, Node.js 22, v2)
- **Firestore:** rules deployadas (auth required, scoped por UID)
- **AWS EC2:** interrompido (2026-07-21) — domínio `correlogo.sytes.net` não é mais servido

### Próximos passos
1. ✅ ~~Desligar AWS EC2~~ — **Interrompido (2026-07-21)**
2. Corrigir exibição da foto do perfil (dívida técnica)
3. Corrigir Botão Nav Back (modal treino manual)
4. Testar Reschedule cascade em conjunto

### Files touched
- `functions/package.json` — criado (deps Cloud Function)
- `functions/tsconfig.json` — criado
- `functions/.gitignore` — criado (node_modules, lib, .env)
- `functions/.env` — criado (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET — gitignored)
- `functions/src/index.ts` — criado (authCallback + healthCheck)
- `firebase.json` — substituído (hosting rewrites + headers + functions)
- `package.json` — removidas deps do server, scripts simplificados
- `index.html` — removida tag CSP meta
- `server.ts` — deletado
- `src/components/GoogleCalendarModal.tsx` — redirect URI → `correlogo.web.app`
- `CHANGELOG.md`, `TODO.md`, `HANDOFF.md` — docs atualizados

---

### O que foi feito
- **Fix export .tcx/.gpx no Android**: Instalado `@capacitor/filesystem@7.1.8`. `saveFile()` em `SessionSummary.tsx` agora bifurca via `isNative()`:
  - Nativo: `Filesystem.writeFile()` em `Directory.ExternalStorage/Download/CorreLogo/`
  - Web: mantém `Blob` + `<a download>` original
  - Toast "Arquivo salvo" via `showFeedback` prop
- **Fix mapa no resumo da sessão**:
  - CSP do `index.html` atualizado com domínios dos tiles: `https://*.tile.openstreetmap.org`, `https://*.basemaps.cartocdn.com`, `https://server.arcgisonline.com`
  - Container do mapa alterado de `h-64` para `height: 300px` inline (`SessionSummary.tsx:103`)
  - Adicionado `map.invalidateSize()` no `MapBounds` do `MapComponent.tsx` — resolve height 10px na web
- **Firestore rules expirando**: `correlogo-dev` em Test Mode expira em 4 dias. `firestore.rules` já versionado com regras corretas (auth required, scoped por UID). **Necessita deploy** via Firebase Console ou `firebase deploy --only firestore:rules`
- **APK build**: `BUILD SUCCESSFUL` com `@capacitor/filesystem` plugin registrado

### Próximos passos
1. 🔴 **Urgente**: Deploy das Firestore rules no `correlogo-dev` (4 dias)
2. Testar Export TCX/GPX no device Android físico
3. Testar mapa no resumo (web + APK)
4. Corrigir Botão Nav Back (modal treino manual)
5. Testar Reschedule cascade em conjunto

### Files touched
- `src/components/SessionSummary.tsx` — `saveFile()` c/ Capacitor Filesystem + `showFeedback` prop + altura mapa 300px
- `src/components/MapComponent.tsx` — `invalidateSize()` no `MapBounds`
- `src/App.tsx` — `showFeedback` passado para `SessionSummary`
- `index.html` — CSP inclui tiles OSM, Carto, Esri
- `firestore.rules` — já versionado, precisa deploy
- `package.json` — `@capacitor/filesystem` adicionado
- `android/` — `npx cap sync android` registrou plugin
- `CHANGELOG.md`, `TODO.md`, `HANDOFF.md` — docs atualizados

---
## Session Context (2026-07-10d — Reavaliação Geral do Projeto)

### O que foi feito
- **Revisão completa das pendências**: itens concluídos removidos da lista, itens antigos reavaliados
- **Atualização de docs**: `TODO.md`, `CHANGELOG.md`, `HANDOFF.md` sincronizados
- **Status atualizado**:
  - ✅ Concluídos: Repetição manual, Escalonamento Standard/ImprovePace, Onboarding, 5 melhorias (loading, CSP, APK export, cascata, áudio ducking), TTS fix, UX fixes
  - ⚠️ Em teste: CSP meta tag, Áudio ducking
  - ❌ Bugs pendentes: Reschedule cascade (precisa testar em conjunto), Botão Nav Back (fecha app em vez de fechar modal)
  - 📋 Para reavaliar: 11 itens antigos (dotenv, performance, deps duplicadas, estrutura de dados, onSnapshot, etc.)

### Próximos passos sugeridos
1. **Testar durante a semana**: CSP (foto perfil), Áudio ducking
2. **Próxima sessão de correções**:
   - Testar **Reschedule cascade** em conjunto (criar plano em usuário diferente)
   - Corrigir **Botão Nav Back** (fechar modal primeiro)
   - Validar **Toast corrigido**
3. **Depois das correções**: Priorizar reavaliação dos 11 itens antigos ou novas features

### Files touched
- `TODO.md` — removidos itens concluídos, adicionada seção "Em Correção / Teste"
- `CHANGELOG.md` — nova entrada 2026-07-10d
- `HANDOFF.md` — nova seção de contexto 2026-07-10d

---

## Session Context (2026-07-10c — 5 Melhorias)

### What was accomplished

**5 melhorias independentes implementadas e validadas (build aprovado):**

1. **Loading screen** — substitui dois skeletons `animate-pulse` por tela limpa com logo seta-rastro (SVG inline, `var(--color-accent)`) + "Corre Logo" + spinner circular (`border-accent border-t-transparent animate-spin`). Mesma tela para auth check e data load.

2. **CSP meta tag** — adicionado `<meta http-equiv="Content-Security-Policy">` no `index.html` com `default-src 'self'`, `img-src 'self' data: https://lh3.googleusercontent.com`, `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`, `font-src 'self' https://fonts.gstatic.com`, `script-src 'self' 'unsafe-inline'`, `connect-src 'self' https:`. Resolve fotos de perfil Google não carregando no Capacitor WebView (antes o CSP só existia no server.ts, não no HTML base).

3. **APK export automation** — `scripts/export-apk.ps1`: extrai `versionName` do `build.gradle`, copia `app-debug.apk` → `Corre Logo v{version}.apk`, incrementa `versionCode`. `package.json` ganhou script `build:apk` que orquestra `build → cap sync → assembleDebug → export`.

4. **Reschedule cascade** — modal de reagendamento refatorado:
   - `handleDateChange(planId, newDate, mode: 'single' | 'cascade')`
   - Funções auxiliares: `parseDate`, `daysBetween`, `addDays`
   - Modo cascade: calcula delta (`newDate - oldDate`), filtra planos por mesmo `generatedFromProgramId` com `scheduledDate >= oldDate`, aplica offset
   - Modal tem dois botões: "Reagendar apenas este" (primary) e "Reagendar este e seguintes" (secondary), mais Cancelar (ghost)

5. **Áudio ducking fix** — `AudioFocusPlugin.kt`: `setWillPauseWhenDucked(false)` → `true` (Android gerencia restauro do volume). `voice.ts`: timer `max(2000, text.length * 90)` → `max(500, text.length * 60)` (volume volta mais rápido após TTS curto).

### Files touched
- `src/App.tsx` — loading screen (2x skeleton blocks), reschedule modal + handleDateChange + helpers
- `index.html` — CSP meta tag
- `package.json` — novo script `build:apk`
- `scripts/export-apk.ps1` — (novo) script PowerShell de export
- `android/app/src/main/java/com/correlogo/app/AudioFocusPlugin.kt` — setWillPauseWhenDucked(true)
- `src/lib/capacitor/voice.ts` — timer reduzido
- `docs/superpowers/specs/2026-07-10-5-improvements-design.md` — design aprovado
- `docs/superpowers/plans/2026-07-10-5-improvements.md` — implementation plan

### Build validation
- `npm run build` passou (vite + esbuild server.cjs). Warnings pré-existentes (duplicate keys no server.ts CSP, chunk size).
- TODO: `npm run build:apk` requer APK assemble para validar script de export (AGENTS.md ground rule 7).

### ✅ Concluído (não mais pendente)
- Todas as 5 melhorias implementadas e validadas
- Fix TTS repetitivo: `spokenCompletionRef` adicionado ao WorkoutTracker
- APK gerado via `npm run build:apk` — `Corre Logo v1.0.apk` (versionCode 3)

### ⚠️ Ainda pendente (não tocado nesta sessão)
- **Foto do perfil no APK** — CSP configurado, **precisa testar no device** se carrega
- **Reagendamento em cascata** — código implementado, **precisa validar** se plano tem `generatedFromProgramId` e se há outros planos com mesma origem
- Mesmo pendências da sessão anterior (openAppSettings, scaling duração Standard/ImprovePace, favicon.ico 404, etc.)

## Session Context (2026-07-06e — Finalização WorkoutTracker + OAuth completo)

### What was accomplished

**WorkoutTracker layout final (outdoor + treadmill)**
Usuário confirmou "tudo funcionando perfeitamente" após ~12 iterações de build+install.

1. **CSS base overflow:** `html, body, #root` com `overflow: hidden` (index.css) — barrou phantom scroll no WebView Android.
2. **MapComponent fix:** `h-64` → `h-full` em `MapComponent.tsx:62` (era o bug: mapa fixado em 256px ignorando o `h-*` do pai).
3. **Outdoor mode:** mapa `flex-1 min-h-64` — preenche espaço entre progress bars e lap card, mínimo 256px.
4. **Treadmill mode:** speed controls `flex-shrink-0`, lap card `flex-1 min-h-0` + conteúdo interno `flex flex-col items-center justify-center h-full`.
5. **Botões âncora bottom:** `mt-auto` no container + `pb-[calc(48px+env(safe-area-inset-bottom,0px))]` para safe-area.
6. **Removed spacer:** `<div className="flex-1">` que comia 40% do espaço eliminado.
7. **Treadmill-only size bumps:** marquee `h-5` → `h-10`, progress bars `h-2.5` → `h-5` via conditional.
8. **Free training polish:** "Tempo restante" escondido quando `isFreeTraining === true`.

**OAuth + SHA-1 completo**
9. **SHA-1 resolvido:** novo debug keystore gerado, SHA-1 `7E:AD:85:85:52:D9:F3:2C:59:E4:93:73:12:31:9B:28:8C:86:BE:C6` registrado no Firebase Console para `correlogo-prod`.
10. **Google OAuth FUNCIONANDO:** confirmado pelo usuário após SHA-1 + google-services.json correto.
11. **Permission dialogs:** notificação, atividade, localização aparecem após login (Promise.race removido + plugins registrados).

**Build validation**
- Pipeline completo: `Copy-Item .env.apk → .env` → `npm run build` → `npx cap sync android` → `gradlew assembleDebug` → `adb install -r`.
- APK instalado no device `adb-R9XY9071AEW-p3LW3D._adb-tls-connect._tcp`.
- Usuário confirmou "tudo funcionando perfeitamente".

### Files touched
- `src/components/WorkoutTracker.tsx` — layout final outdoor/treadmill
- `src/components/MapComponent.tsx:62` — `h-64` → `h-full`
- `src/index.css` — `overflow: hidden` global
- `src/App.tsx` — free training conditional
- `android/app/google-services.json` — prod version com SHA-1 atualizado

### ✅ Concluído (não mais pendente)
- OAuth funcionando (SHA-1 + google-services.json)
- Permission dialogs aparecem
- WorkoutTracker layout finalizado (ambos os modos)
- APK build + install validado

### ⚠️ Ainda pendente (não tocado nesta sessão)
- **openAppSettings ainda abre App Info:** se o intent não funcionar mesmo com fallback, a instrução textual já está no modal. Próximo passo tentar `ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION` ou Activity nativa.
- **Scaling de duração mínima para Standard e ImprovePace** (como já feito no Beginner)
- **Skeleton loading timeout** (considerar reduzir de 5s)
- **favicon.ico 404** (cosmético)
- **GOOGLE_CLIENT_SECRET no .env do servidor**

## Session Context (2026-07-06, third session — WorkoutTracker layout & free training polish)

### What was accomplished

This session focused exclusively on **WorkoutTracker** layout iterating on user's live device testing until both modes (outdoor and treadmill) look perfect. About a dozen build+install cycles.

**Outdoors** (where map shows):
1. **CSS base:** global `overflow: hidden` on `html, body` and `#root` (index.css) — kills the phantom scrollbar the user could see on Android WebView.
2. **MapComponent.tsx:62** — hardcoded `h-64` changed to `h-full` so the parent controls height (was silently clipping the map to 256px regardless of parent `h-*`).
3. **Outdoor map parent** (`WorkoutTracker.tsx:528`) — `flex-shrink-0 h-32` → `flex-1 min-h-64`. Map now fills the available vertical space between progress bars and lap card (min 256px).
4. **Speed controls reverted** to `flex-shrink-0` — user said speed controls do not need to be big on treadmill.
5. **Lap card conditional** (`WorkoutTracker.tsx:533`) — `flex-shrink-0` on outdoor (so map can grow), `flex-1 min-h-0` on treadmill (so card fills the gap where there's no map).
6. **Lap card inner panel** (`WorkoutTracker.tsx:534`) — `text-center` → `flex flex-col items-center justify-center h-full`. Now fills its panel and centers content vertically (no awkward top-aligned text inside the tall panel).
7. **Removed** `<div className="flex-1"></div>` spacer that was eating 40% of screen below the buttons.
8. **Buttons** (`WorkoutTracker.tsx:590`) — `flex-shrink-0 space-y-2 mt-1` → `flex-shrink-0 space-y-2 mt-auto`. Buttons now anchored to bottom of inner container.
9. **Container bottom padding** (`WorkoutTracker.tsx:494`) — `pb-[calc(4px+env(safe-area-inset-bottom,0px))]` → `pb-[calc(48px+env(safe-area-inset-bottom,0px))]`. The button's full ~44px height fits above the padding, visible above the gesture nav bar even when `env(safe-area-inset-bottom)` returns 0 in WebView.
10. **Treadmill-only bar sizes** (`WorkoutTracker.tsx:513,519,523`) — `(mode === 'treadmill' ? 'h-10' : 'h-5')` for marquee, `(mode === 'treadmill' ? 'h-5' : 'h-2.5')` for both progress bars. Match what's needed to fill the taller stat area on treadmill mode.

**Free training** — hide "Tempo restante":
11. **`WorkoutTracker.tsx:546`** — wrap the `{formatTime(...)} + "Tempo restante"` lines in `{!isFreeTraining && (...)}`. Free training has no plan to advance against, so time remaining is meaningless (always `0:00`).

### Build validation
- Every iteration: `Copy-Item .env.apk → .env` → `npm run build` → `npx cap sync android` → `gradlew assembleDebug` → `adb install -r`. All passed.
- APK installed and live on `adb-R9XY9071AEW-p3LW3D._adb-tls-connect._tcp`.

### Files touched
- `src/components/WorkoutTracker.tsx` — main layout iteration
- `src/components/MapComponent.tsx:62` — `h-64` → `h-full`
- `src/index.css` — `html, body { overflow: hidden; height: 100% }` and `#root { overflow: hidden }`

### ❌ Still problematic (unchanged from prior sessions)
- **openAppSettings still opens App Info** on Xiaomi/MIUI — modal has fallback text instructing user to navigate manually to Permissões → Localização.

## Session Context (2026-07-06, second session)

### What was accomplished
1. **SHA-1 fingerprint resolved** — Generated new debug keystore (backed up old as `~/.android/debug.keystore.bak`). New SHA-1: `7E:AD:85:85:52:D9:F3:2C:59:E4:93:73:12:31:9B:28:8C:86:BE:C6`. Registered in Firebase Console for `correlogo-prod` Android app. Re-downloaded `google-services.json` now includes `client_type: 1` (Android OAuth client) with new hash.
2. **Google OAuth is WORKING** — user confirmed "oauth funcionando!" after SHA-1 registration + fresh google-services.json.
3. **Permission dialogs confirmed working** — notification, activity, location dialogs appear after login (fix: removed Promise.race timeout + registered plugins in MainActivity).
4. **WorkoutTracker layout restored** — Large text sizes (text-2xl step type, text-lg values, text-[11px] labels, text-4xl lap card, text-2xl speed, py-2.5 buttons, h-1.5 bars, h-20 map). Lap card: `flex-shrink-0` (not `flex-1`). All items stack with `mt-1` gaps. Content now fills full screen without empty space.
5. **Scroll fixed at source** — App.tsx `<main>` changed from always `overflow-y-auto` to conditional: `${activePlan ? 'overflow-hidden' : 'overflow-y-auto'}`. When workout is active, main blocks scroll at the viewport level.
6. **openAppSettings** — Kotlin plugin rewritten: tries `"android.settings.APPLICATION_PERMISSION_SETTINGS"` first (API 30+), with try/catch falling back to `"android.settings.APPLICATION_DETAILS_SETTINGS"`. Added logging. Button caption in modal now includes "Se abrir 'Informações do aplicativo', toque em Permissões → Localização."
7. **Build + install** — `npm run build` → `npx cap sync android` → `gradlew assembleDebug` → `adb install -r` all pass. APK installed on device.

### ❌ Still problematic
- **openAppSettings still opens App Info** on user's device (likely Samsung/MIUI OEM behavior ignoring `APPLICATION_PERMISSION_SETTINGS` intent). Fallback instruction text has been added to the modal.

### Files touched this session
- `src/components/WorkoutTracker.tsx` — large text sizes restored, lap card `flex-shrink-0`, `mt-1` vertical gaps
- `src/App.tsx` (line 756) — `<main>` overflow conditional; settings modal fallback text
- `android/app/src/main/java/com/correlogo/app/TrackingPlugin.kt` — openAppSettings with APPLICATIONS_PERMISSION_SETTINGS (raw string) + try/catch fallback + logging
- `android/app/google-services.json` — prod version with `client_type: 1` + new SHA-1 hash
- `android/app/src/main/java/com/correlogo/app/MainActivity.java` — plugin registration in `load()`
- `src/lib/capacitor/permissions.ts` — Promise.race timeout removed
- `HANDOFF.md` and `docs/todo.md` — updated

## Android Native Tracking (2026-07-04)

### TrackingService.kt
- `android/app/src/main/java/com/correlogo/app/TrackingService.kt`
- Foreground service (`startForeground`) with:
  - **GPS:** `FusedLocationProviderClient` with `Priority.PRIORITY_HIGH_ACCURACY`, 3s interval, 1s min update interval
  - **Step counter:** `Sensor.TYPE_STEP_COUNTER`, delta from initial reading, emits `stepUpdate` events
  - **Notification channel:** `tracking_channel` with Portuguese labels, `IMPORTANCE_LOW`, silent
  - Lifecycle: `onCreate` sets up sensors/callbacks, `onStartCommand` starts updates, `onDestroy` removes listeners
- Communication with plugin via `companion object { var currentPlugin: TrackingPlugin? }`

### TrackingPlugin.kt
- `android/app/src/main/java/com/correlogo/app/TrackingPlugin.kt`
- `@CapacitorPlugin(name = "Tracking")` with permissions: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `ACTIVITY_RECOGNITION`
- Methods: `startTracking()` (checks fine location, starts foreground service), `stopTracking()`, `getStepCount()`
- Events: `locationUpdate` (lat/lng/alt/accuracy/speed/timestamp), `stepUpdate` (steps)
- Set `TrackingService.currentPlugin` in `load()` — service-to-plugin bridge

### MainActivity.java
- Registers `TrackingPlugin.class` in `onCreate` via `registerPlugin()`

### Build config
- `android/build.gradle`: Kotlin plugin `org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21` added to classpath
- `android/app/build.gradle`: `kotlin-android` plugin applied, `com.google.android.gms:play-services-location:21.0.1` dependency added

### Usage from TypeScript
```typescript
// Import plugin via Capacitor
import { Tracking } from '@/plugins/tracking'; // or registerWebPlugin if JS-side needed

// Start tracking
await Tracking.startTracking();

// Listen for location updates
Tracking.addListener('locationUpdate', (data: { latitude, longitude, altitude, accuracy, speed, timestamp }) => { ... });

// Listen for step updates
Tracking.addListener('stepUpdate', (data: { steps }) => { ... });

// Stop tracking
await Tracking.stopTracking();

// Get current step count
const { steps } = await Tracking.getStepCount();
```

### Known limitations
- Web/iOS stubs not yet implemented — this is Android-only for now
- No permission request flow in the plugin itself (relies on caller having granted permissions first)

## Native Audio (AudioFocusPlugin.kt)
- `android/app/src/main/java/com/correlogo/app/AudioFocusPlugin.kt`
- `requestAudioFocus()` — solicita `AUDIOFOCUS_GAIN_TRANSIENT` (pausa música externa durante TTS)
- `abandonFocus()` — libera foco após TTS (timer ~90ms/char)
- `abandonAudioFocusOnPause()` — libera foco quando usuário pausa manualmente
- `onRequestFocusResult()` — usa `onActivityResult` para tratar async `requestAudioFocus` no Android 12+

## Calendar Sync (GoogleCalendarModal.tsx)
- `src/components/GoogleCalendarModal.tsx`
- Bifurca web/native: `isNativePlatform()` → `Browser.open({ url })` com `state=c3_<UUID>`
- **Web:** `window.location.href = url` direto
- Redireciona para `https://correlogo.sytes.net/auth/google/callback`
- Listener `appUrlOpen` em App.tsx captura deep link `com.correlogo.app://oauth/callback?token=`
- Token armazenado em `localStorage` (`google_calendar_token`)
- Limpeza de eventos antigos via `extendedProperty.planId`
- Filtro de planos futuros (não exibe `completed`)

## Server OAuth (server.ts)
- `GET /auth/google/callback` — detecta Capacitor via `state.startsWith('c3_')`
- Native: redireciona para `com.correlogo.app://oauth/callback?token=<access_token>&state=<state>`
- Web: redireciona para `/?gcal_token=...`
- POST route mantido para web login

## Current Functional State (2026-07-04b)

### Calendar & Plan Rendering
- `MonthCalendar` component: full month grid, navigation < >, dot markers (accent=planned, accent-secondary=completed, amber=race), current/selected day highlight
- Collapsible via v/^ button below the week row with `max-h` + `opacity` transition animation
- `exportIcal(plans, filename?)` and `downloadIcal(plans, filename?)` in `src/lib/ical.ts` — generates RFC 5545 `.ics` with VEVENT per plan with `scheduledDate`
- "Exportar para Calendário (.ics)" button in Planos BottomSheet (appears when plans.length > 0)
- Race marker dot color: `bg-amber-500` in MonthCalendar too (same convention)

### Date Input
- **Mudança:** Date picker movido para dentro do card expandido: botão "Reagendar" (apenas se não for raceMarker) abre modal com `<input type="date" colorScheme="dark">` com `onKeyDown e.preventDefault()` para bloquear digitação manual
- Picker oculto anterior removido (`datePickerTarget`, `datePickerRef` não existem mais no App.tsx)
- "Reagendar" funciona para planos existentes também

### Month Calendar
- `MonthCalendar` em `src/components/` — props: `selectedDate`, `onSelectDate`, `plannedDates`, `completedDates`, `raceDates`
- Toggle state `showMonthCalendar` em App.tsx

### iCal Export
- `src/lib/ical.ts` — `generateIcal()` e `downloadIcal()`
- Formato: versão 2.0, DATE (all-day), SUMMARY = plan.name, DESCRIPTION = steps + total duration
- Botão no BottomSheet de Planos

## Google OAuth Debug — 2026-07-06

### Login flow (APK)
- `Login.tsx` → `handleGoogleLogin()`:
  1. `FirebaseAuthentication.signInWithGoogle()` — logs result keys, user, credential presence
  2. `result.credential?.idToken` — logs idToken present/absent, accessToken present/absent
  3. `GoogleAuthProvider.credential(idToken)` — logs call
  4. `signInWithCredential(auth, credential)` — logs call and success
  5. On error: `console.error` with `.code`, `.message`, and full `JSON.stringify` via `Object.getOwnPropertyNames`
- **If Google Login fails on APK (Issue 5):** run the build with these logs, capture `logcat` output:
  ```
  adb logcat -s CorreLogo,GoogleLogin
  ```
  This will show: whether the native plugin returned a credential, whether idToken is present, and whether `signInWithCredential` succeeded or threw.

## Layout Structure (App.tsx) — 2026-07-06

### Main container
- `<main className="flex-1 overflow-y-auto w-full max-w-xl mx-auto">` — **NO `p-4`** (removed to fix sticky header)
- Each child section manages its own padding:
  - **Skeleton/auth:** `<div className="p-4">`
  - **WorkoutTracker:** self-contained (has its own padding)
  - **WorkoutEditor/TrainingGenerator/ProgramReview:** `<div className="p-4">`
  - **Dashboard:** sticky header gets `px-4 pt-4 pb-2`; content below wrapped in `<div className="px-4 pb-4">`

### Sticky header
- `<div className="sticky top-0 z-10 bg-bg-deep px-4 pb-2 pt-4">`
- `top: 0` now truly at viewport top (no longer inside main's old `p-4`)
- `pt-4` compensates for the removed main padding

### Back button (double-press to exit)
- Registered in `useEffect` with `activePlan` dependency (disabled during workout)
- First back press → `showFeedback('success', 'Pressione VOLTAR novamente para fechar o app')`
- Second back press within 2s → `CapApp.exitApp()`
- Uses `CapApp.addListener('backButton')` from `@capacitor/app`

## WorkoutTracker Layout — 2026-07-06

### Inner structure
```jsx
<div className="flex-1 flex flex-col px-4 py-4 ... overflow-hidden">
  <div className="flex-shrink-0">Current step label</div>
  <div className="flex-shrink-0">Stats grid</div>
  <div className="flex-shrink-0">Progress bars (2x)</div>
  {outdoor && <div className="flex-shrink-0">Map (h-44)</div>}
  <div className="flex-1 flex items-center justify-center">Lap info card</div>
  {treadmill && <div className="flex-shrink-0">Speed controls</div>}
  <div className="flex-shrink-0 space-y-3">Buttons</div>
</div>
```

### Key changes
- Removed `overflow-y-auto` → replaced with `overflow-hidden`
- Lap info card gets `flex-1` + `flex items-center justify-center` to fill vertical space
- All other sections `flex-shrink-0` to not compress
- Buttons in `space-y-3` for consistent spacing without `mb-3`/`mb-6` margins
- Content fills 4/5+ of screen, no scroll in either treadmill or outdoor mode

## GPS Distance Fix — 2026-07-06

- `isPausedRef` synced to `isPaused` via `useEffect`
- In GPS `handlePosition`: `if (d > 0.001 && !isPausedRef.current)` — distance only counted when NOT paused
- Map (coords + path) continues updating during pause

## Audio Ducking — 2026-07-06

### AudioFocusPlugin.kt changes
| Before | After |
|--------|-------|
| `AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE` | `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` |
| `setWillPauseWhenDucked(true)` | `setWillPauseWhenDucked(false)` |
| Music **pauses** completely | Music **ducks** ~80% (system-managed) |
| Low-end phones fail to resume | System restores volume on `abandonFocus()` |

## Workout End Flow — 2026-07-06

1. **Last step completes** → `speak("Exercício concluído, parabéns!", true)` → `setIsExtended(true)` (free training)
2. **User presses finalizar** → `setIsWorkoutCompleted(true)` → `speak("Agora é só olhar seu relatório", true)` → modal with Salvar/Descartar

## Native Plugin: openAppSettings — 2026-07-06

- **TrackingPlugin.kt** new `@PluginMethod openAppSettings()`:
  - Originally: `Intent(ACTION_APPLICATION_DETAILS_SETTINGS)` — opens **App Info** page
  - **Updated 2026-07-06 (afternoon):** For Android 12+ (API 31+): `Intent(ACTION_APPLICATION_PERMISSION_SETTINGS)` → opens **App Permissions** page directly. Fallback to `ACTION_APPLICATION_DETAILS_SETTINGS` on older versions.
- **tracking.ts** TypeScript interface updated with `openAppSettings(): Promise<void>`
- **App.tsx** `openAppSettings()` calls `Tracking.openAppSettings()` (was broken `intent://` URL)

### ⚠️ Pending: openAppSettings still navigating to wrong screen
Despite the API 31+ fix, user reports that tapping "Abrir Configurações" still opens the **App Info** page (screenshot available, filename: `WhatsApp Image 2026-07-06 at 14.58.11 (1).jpeg`). The **desired** target is the **App Permissions** page (screenshot: `WhatsApp Image 2026-07-06 at 14.58.11.jpeg`).

The `ACTION_APPLICATION_PERMISSION_SETTINGS` intent requires Android 12+ (API 31). Either:
a) The user's device is on Android < 12 and falls back to `ACTION_APPLICATION_DETAILS_SETTINGS`
b) The intent works but still shows the App Info page (possible Android OEM behavior)
c) The updated APK wasn't installed yet when the user tested (the user was likely still running the previous build without the fix)

If (a) or (b): on older Android (< 12), replacing the button action with `App.launchApp({ url: "android-app://com.correlogo.app/android.settings.APPLICATION_DETAILS_SETTINGS" })` or using the older `ACTION_APPLICATION_DETAILS_SETTINGS` is the only option — user must manually tap "Permissões" > "Localização". Could add a caption to the button saying "Toque em Permissões → Localização".

## WorkoutTracker Layout — 2026-07-06 (afternoon, 2nd attempt)

### What changed
- **Container:** `px-[50px]` → `px-6`. All inner text sizes reduced (`text-2xl` values → `text-lg`, `text-4xl` step type → `text-2xl`, `text-5xl` card → `text-4xl`, `text-xl` in card → `text-base`)
- **Spacing:** `py-3` → `py-1.5`, `mb-2` → `mb-1`/`mb-0.5`, `mb-3` → `mb-1.5`, `gap-2` → `gap-1`, `space-y-3` → `space-y-1.5`
- **Map:** `h-24` (96px) → `h-20` (80px)
- **Progress bars:** `h-2` → `h-1.5`
- **Buttons:** `py-3` → `py-2.5`, `text-lg` removed
- **Card:** Added `text-center` class to fix left-alignment
- **Perm banner:** moved from inside main content area to top (`flex-shrink-0 w-full`), removed `max-w-md mx-auto`

### ⚠️ Remaining issues (confirmed by user screenshots)
1. **Still too much vertical spacing** — elements have too much gap between them, wasting screen space
2. **Vertical scroll still present** — content overflows viewport height
3. **Central card was left-aligned** — `text-center` was added to fix this (user hasn't confirmed if this works yet)

### Suggested approach for Big Pickle
The core tension: the "bigger elements" request conflicts with "no scroll" on small phone viewports (~650-700px usable). Recommendations:
1. Switch from `text-xs`/`text-[10px]` to using tiny labels (`text-[9px]`) with larger values
2. Make the lap info card use `text-5xl` or `text-6xl` but reduce EVERYTHING else's height:
   - Step type label: `text-base` or `text-lg` (not `text-2xl`)
   - Stats grid: `text-sm` or `text-base`
   - Map: `h-16` (64px) minimum viable
   - Buttons: `py-2` with smaller icons
   - Progress bars: `h-1`
3. Alternatively, use a scrollable content area with `overflow-y-auto` + `h-full` on the outer — let the flex-1 card fill remaining space and only the card area scrolls if content inside is too tall. Remove `overflow-hidden`.
4. The user's phone may have large status/nav bars — test with `window.innerHeight` logging.

### Loading & Sync
- App carrega em <1.2s (cache localStorage instantâneo + Firestore paralelo com timeout de 5s)
- Dados offline (sessões com prefixo `local-*`) são sincronizados ao Firestore automaticamente na próxima conexão bem-sucedida
- Planos criados offline são mesclados com remotos ao reconectar
- Logs `[timing]` no console para diagnóstico de performance

### Firebase Projects
- **Dev** (`.env`): `correlogo-dev-9a96a` — Firestore ativado em modo teste (expira 2026-07-25)
- **Prod** (servidor AWS): `correlogo-prod` — credenciais no `.env` do servidor
- `firebase-applet-config.json` removido do git (projeto `zealous-arcanum-nwfkz` era do AI Studio e não é mais usado)

### UI Components
- `<Button>` — variantes: `primary`, `secondary`, `ghost`, `danger`; sizes: `sm`, `md`, `lg`
- `<Modal>` — backdrop centralizado com `role="dialog"` ou `role="alertdialog"`
- `<BottomSheet>` — painel que desliza de baixo com overlay (ações de plano)
- `<WeekCalendar>` — semana horizontal com 7 dias, navegação, bolinhas de status
- Todos em `src/components/`

### Known Issues
- Firestore no dev `correlogo-dev-9a96a` expira modo teste em 2026-07-25 — atualizar regras antes
- Skeleton de carregamento aparece enquanto Firestore não responde (até 5s) — reduzir timeout se necessário
- `favicon.ico` retorna 404 (cosmético, sem impacto)
- Geradores Standard/ImprovePace também devem escalar duração mínima (clampedWeeks do iniciante) — pendente
- **WorkoutTracker layout:** ainda com espaçamento vertical excessivo e scroll; bloco central estava left-aligned (text-center adicionado, não confirmado)
- **openAppSettings:** navega para App Info em vez de Permissões — verificar se dispositivo é < API 31; adicionar instrução visual "Toque em Permissões > Localização" se fallback for inevitável

### Calendar & Plan Rendering
- `WeekCalendar` recebe `plannedDates`, `completedDates`, `raceDates` como `Set<string>`
- Marcador de prova usa bolinha `amber-500` com legenda "Prova" no calendário
- `isRaceMarker?: true` no `WorkoutPlan` oculta botões de ação, duração e input de data no card
- Planos com `isRaceMarker` mostram apenas nome "🏁 Prova" sem ações — não é clicável para iniciar/completar

### Beginner Generator Scaling
- `mapTableIndex` mapeia o índice da semana (0..N-1) para a tabela runna de 16 semanas usando interpolação linear: `Math.round(weekIdx / (totalWeeks - 1) * 15)`
- Duração mínima: 6 semanas (clamped), máxima: 52 semanas
- Para durações > 16 sem: a tabela de 16 semanas é esticada proporcionalmente ao número de semanas
- Carga regenerativa (sessões extras para dias além dos 2 da tabela runna) mantida
- Marcador de prova injetado em `generateProgram` após `assignScheduledDates`, com `scheduledDate = data.raceDate`

### Date Input
- Botão estilizado (borda, hover accent) mostra data no formato `DD/MM` ou "➕ data"
- Ao clicar, `datePickerRef` (input oculto no final do `<main>`) recebe foco via `showPicker()` com `colorScheme: dark` para o picker nativo usar tema escuro
- `datePickerTarget` (state) guarda o `plan.id` do card clicado; o `onChange` do picker oculto usa esse target para chamar `handleDateChange`
- Picker oculto posicionado off-screen (`top: -200px, left: -200px, opacity: 0`)

### Light Mode
- `.light` class no `<html>` agora também sobrescreve `--color-*` (ex: `--color-text-primary`, `--color-bg-elevated`)
- Todas as Tailwind classes (`text-text-primary`, `bg-bg-surface`, etc.) agora refletem o modo claro
- Fix: nome do app e textos que usam Tailwind utility classes estavam invisíveis no light mode por resolverem `--color-*` do tema escuro

## Google Login — Android Native (skipNativeAuth:true) — 2026-07-05e

### Key changes
- **`capacitor.config.ts`:** `skipNativeAuth` revertido para `true` — o plugin Capacitor não faz auth automático
- **Login.tsx:** após login nativo, recebe `result.credential?.idToken` e chama `GoogleAuthProvider.credential(idToken, accessToken)` + `signInWithCredential(auth, credential)`. Autentica diretamente contra o Firebase **prod** (as credenciais VITE_FIREBASE_* no .env apontam para `correlogo-prod`)
- **auth.ts:** mesmo fluxo de signInWithCredential replicado
- **authStateChange listener:** mantido como no-op (evento ignorado — o listener `onAuthStateChanged` do Firebase já cobre)
- **Importante:** com `skipNativeAuth:true`, o plugin NÃO usa `google-services.json` para configurar Google Sign-In nativo diretamente, mas o plugin **precisa** do arquivo para obter a API key do Firebase usada na REST API do Google Sign-In. **Atualizado em 2026-07-06:** `google-services.json` do Firebase Console (projeto `correlogo-prod`) foi baixado e substituiu o antigo (que apontava para `correlogo-dev-9a96a`). Esta era a causa do erro `auth/invalid-credential` no OAuth — autenticava contra o projeto dev e tentava usar o token contra o prod.

## Layout (App.tsx + WorkoutTracker.tsx) — 2026-07-05e

### Root structure (App.tsx)
- `<div className="min-h-screen h-screen flex flex-col bg-bg-deep">`
- `<main className="flex-1 overflow-y-auto w-full max-w-xl mx-auto p-4">`
- Dashboard header: `<div className="sticky top-0 z-10 bg-bg-deep pb-2">`
- Sticky changed from `-top-4` → `top-0` — header now pins correctly at viewport top

### WorkoutTracker layout
- Outer: `<div className="h-full flex flex-col ...">`
- Inner: `<div className="flex-1 overflow-y-auto ...">` — content scrolls naturally
- **No flex-1 spacer** between top and bottom sections
- **Outdoor map:** `<div className="h-44 w-full rounded-lg overflow-hidden mb-3">` — fixed 176px height, doesn't push buttons
- **No `mt-auto`** on bottom section — buttons sit directly below content
- Treadmill mode: no extra spacer. Everything fits on one screen without scroll.

### Full-screen / nav bar
- `MainActivity.java`: `SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION` + `HIDE_NAVIGATION` + `FULLSCREEN` + `IMMERSIVE_STICKY`
- `onWindowFocusChanged` re-applies flags on focus gain
- CSS: `#root` with `padding: env(safe-area-inset-bottom)` — moved from `body`

## GPS Warmup + Background Permission Modal — 2026-07-05e

### Flow
1. User taps "Treino Livre" outdoor
2. `checkLocationPermission()` requests `ACCESS_FINE_LOCATION` (foreground only, "Durante o Uso")
3. If granted, `showBackgroundModal = true` — a modal asks user to enable "Permitir o tempo todo"
4. Modal has two buttons:
   - "Abrir Configurações" → `App.launchApp({ options: { action: "APPLICATION_DETAILS_SETTINGS" } })` — opens Android Settings for the app
   - "Já ativei" → checks permission again and runs warmup if background granted
5. `appStateChange` listener in that modal detects when user returns from Settings; auto-rechecks and dismisses modal + runs warmup if background is now granted
6. Warmup: `startTracking() → wait 3s → stopTracking()` — primes GPS for faster first fix

### Extracted functions
- `doGpsWarmup()` in App.tsx — starts tracking, sets timeout to stop after 3s
- `checkRunWarmup()` in App.tsx — runs warmup only if user confirmed background or auto-check passed

### Important
- If user denies background ("Negar"), modal stays until they pick an action. They can close the modal (X) to skip warmup entirely — workout starts without GPS warmup.

## Key Considerations for Future Agent
- `App.tsx` gerencia todo o estado global (plans, sessions, user, theme) — persistência centralizada
- `WorkoutTracker` usa `key={sessionId}` para re-inicialização correta
- `isFreeTraining` flag + `speak(text, force)` controlam anúncios de voz no Treino Livre
- `manual: true` em planos criados no WorkoutEditor controla visibilidade do botão de deletar
- `scheduledDate?: string` ("YYYY-MM-DD") adicionado ao `WorkoutPlan` — planos sem data recebem data atual na carga
- `WeekCalendar` recebe `plannedDates`/`completedDates` como `Set<string>` (chaves "YYYY-MM-DD")
- Planos de programa ganham `scheduledDate` baseado em `raceDate` ou data atual + número da semana
- Ações de plano movidas para `BottomSheet` (Novo Treino Manual, Treino Livre, Gerador Automático, Carregar/Substituir, Apagar)
- Export JSON removido da UI (atalho); função `handleExportJson` mantida como dead code
- Sempre usar `limit(50)` em queries de sessões — documentado como regra
- Cache localStorage: chaves `correlogo:plans:{uid}`, `correlogo:sessions:{uid}`, `correlogo:darkMode:{uid}`, `correlogo:profile:{uid}`, `correlogo:settings:{uid}`

## Production Deployment State (as of 2026-06-21)

The app runs on an AWS EC2 instance (Ubuntu), domain `correlogo.sytes.net` (No-IP dynamic DNS) pointing to a static public IP. None of the following lives in this repo — it's server-side configuration — but any agent working on build/env/server-related code needs this context.

**Process management:**
- The app runs as `node /opt/correlogo/dist/server.cjs`, managed by **PM2** under the process name `correlogo`, running as `root` (matches how it was originally set up).
- Started with `NODE_ENV=production` explicitly set — without this, `server.ts` falls back to a Vite dev-middleware branch instead of serving the static `dist/` build (see `AGENTS.md`).
- PM2 is registered with systemd (`pm2-root.service`) so the app survives instance reboots. State was frozen with `pm2 save`.
- Only **one** instance should ever be running on port 3000 — there was an incident during setup where two PM2-managed instances both tried to bind port 3000, causing `EADDRINUSE` errors in the logs. If `pm2 list` ever shows more than one entry named `correlogo`, delete all and restart clean with a single `pm2 start`.

**Web server / TLS:**
- **Nginx** is installed and acts as a reverse proxy: `correlogo.sytes.net` (ports 80/443) → `127.0.0.1:3000` (the Node process).
- Config file: `/etc/nginx/sites-available/correlogo` (symlinked into `sites-enabled`). The default Nginx site was removed to avoid conflicts.
- Config includes an explicit `location ~ /\.(env|git|gitignore) { deny all; return 404; }` block, blocking sensitive files at the Nginx layer regardless of Express's SPA catch-all behavior.
- SSL via **Let's Encrypt / Certbot** (`certbot --nginx`), auto-renewal scheduled via `certbot.timer`. Certificate expires 2026-09-19 (auto-renews before that).
- HTTP (port 80) auto-redirects to HTTPS (301).

**Security Group (AWS Console):**
- Port 3000 is **no longer publicly exposed** — it was removed from inbound rules after the Nginx/SSL setup was confirmed working. Only 80, 443, and 22 (SSH) should be open to `0.0.0.0/0`.
- If a future change seems to require re-opening port 3000 publicly, that's a red flag — it means something is bypassing Nginx, which shouldn't happen.

**Build/env gotcha already hit once:** the production build had stale/missing `VITE_FIREBASE_*` values baked in because `.env` was edited *after* the last `npm run build`. Symptom was "Firebase has no API key" in the browser console despite a correct `.env` on disk. Fix was re-running `npm run build` (with `sudo`, since `/opt/correlogo` is root-owned) followed by `pm2 restart correlogo`. Keep this in mind for any future `VITE_*` env change.
