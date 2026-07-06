# Handoff

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
