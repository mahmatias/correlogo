# Roadmap - Changelog

## v2.3 (versionCode 20) — 2026-07-30
**CI/CD GitHub Actions**

### Added
- `.github/workflows/firebase-deploy.yml` — Capacitor-adapted CI/CD:
  - `workflow_dispatch` + push to `main`
  - Node.js 20 + JDK 17 + Android SDK
  - Cria `.env` from secret `ENV_FILE` (base64-decoded)
  - `npm ci` → `npm run build` → `npx cap sync android`
  - `assembleRelease` com signing injetado via `-Pandroid.injected.signing.*`
  - Deploy Firebase App Distribution (grupo "testers")
  - Cleanup de `keystore.jks` e `firebase-key.json` (always)
- `RELEASE_NOTES.txt` — template
- `.gitignore` — `keystore.jks`, `firebase-key.json`

### Build
- `npm run build` ✅

---

## v2.2 (versionCode 19) — 2026-07-30
**Refresh Token OAuth + FTMS UUID Fix + Strava Feedback**

### Added: Refresh Token OAuth
- Cloud Function `authCallback` retorna `refresh_token` no redirect
- Nova CF `POST refreshAuthToken` — troca `refresh_token` por `access_token`
- `gmailApi.ts`: token armazenado como `{access_token, refresh_token}` (compatível com token string antigo)
- `sendMessage()` retry automático: 401 → refresh → retry
- `getValidAccessToken()` faz refresh se `refresh_token` existir
- Deep link handlers capturam `refresh_token`

### Fixed: FTMS UUID
- `TreadmillBleService.kt:23` — UUID `FTMS_MEASUREMENT_CHAR` corrigido de `00002a63` (Cycling Power) para `00002acd` (Treadmill Data)

### Fixed: Strava feedback
- `WorkoutTracker.tsx` — nova prop `showFeedback` para toast de sucesso/erro
- `App.tsx` propaga `showFeedback` ao renderizar

### Build
- `npm run build` ✅ → `npx cap sync android` ✅ → `gradlew assembleDebug` ✅

---

## v2.2 (versionCode 19) — 2026-07-29
**Strava via Gmail API + Health Connect Fixes**

### Added
- `src/lib/gmailApi.ts` — Gmail OAuth (`gmail.send`) + MIME TCX/GPX + Gmail API send
- Web + APK OAuth flows (`gm_web_` / `gm_` state prefixes)
- Auto-send Strava on save + retry (`WorkoutTracker.handleSaveAndSync`, `App.tsx.onExportSession`)
- Route fallback no HC (tenta com rota, falha → retry sem rota)

### Changed
- Cloud Function `authCallback`: hardcoded Web Client ID/Secret, `gm_web_` routing
- `App.tsx` deep link handler: `gm_web_` → `gm_` → `c3_` priority
- Web callback handler para `gm_web_` state

### Fixed
- `redirect_uri_mismatch` no Gmail OAuth (usar Web Client ID)
- APK abria Calendar modal após Gmail OAuth (state prefix collision)
- Web OAuth "load eterno" (Cloud Function redirecionava p/ deep link)

### Build
- `npm run build` ✅ → `npx cap sync android` ✅ → `gradlew assembleDebug` ✅
- APK: `Corre Logo v2.2.apk` (versionCode 19, versionName "2.2")

---

## v2.1 (versionCode 18) — 2026-07-29
**Health Connect Route Fallback**

### Changed
- `HealthConnectPlugin.kt`: `exportWorkout` tenta inserir com `ExerciseRoute`; se falha, retry sem route + log warning
- `health-connect.ts`: wrapper propaga erro detalhado para JS toast

### Fixed
- Outdoor workouts falhavam silenciosamente no HC (route insert error)
- Erro agora visível no toast + log

---

## v2.0 (versionCode 11) — 2026-07-29
**Health Connect Permission Flow Fix (v2.0)**

### Root Cause
Todas v1.6-v1.9: `requestHcPermissions()` usava `startActivity(intent)` + resolvia `granted=true` **antes** do usuário interagir → HC permission screen abria mas app não sabia se user concedeu → `exportWorkout()` falhava com `SecurityException`.

### Fix
- `HealthConnectPlugin.kt`: `registerForActivityResult(PermissionController.createRequestPermissionResultContract())` no `load()`
- `requestHcPermissions()` usa `launcher.launch(permissions)` + aguarda callback
- Callback resolve com `granted = grantedPerms.contains(WRITE_EXERCISE)`
- Removidas 5 tentativas `startActivity()` pseudo-fixes
- `exportWorkout()`: rejeita limpo se permissão não concedida (sem re-abrir tela)

### Files Modified
- `HealthConnectPlugin.kt` — rewrite completo
- `android/app/build.gradle` — versionCode 10→11, versionName "1.1"→"2.0"

### Build Validation
- `npm run build` ✅ → `npx cap sync android` ✅ → `gradlew assembleDebug` ✅
- APK: `Corre Logo v2.0.apk`

---

## v1.8 (versionCode 10) — 2026-07-29
**Permission Check Before Export + Real Feedback**

### Added
- `exportWorkout()` verifica `getGrantedPermissions()` antes de `insertRecords()`
- Se sem permissão: reabre tela HC + rejeita com mensagem clara

### Changed
- Toast: "Falha ao sincronizar. Verifique as permissões do Health Connect e tente novamente."

---

## v1.7 (versionCode 9) — 2026-07-29
**Multi-Attempt Permission Intent + Package Visibility**

### Added
- `<queries>` no Manifest: `com.google.android.apps.healthdata` + `health-connect://`
- 5-attempt fallback chain: PermissionController → deep link → package launch → Play Store → App Settings
- Helper `tryOpenIntent()` com try/catch limpo

---

## v1.6 (versionCode 8) — 2026-07-29
**Permission Flow Refactoring**

### Changed
- `requestHcPermissions()`: `activity.startActivity(intent)` direto (sem aguardar resultado)
- Removeu `handleOnActivityResult()`, `pendingPermCall`, `PERMISSION_REQUEST`
- Fallback: HC permission screen → Play Store → App Settings

---

## v1.5 — 2026-07-29b
**Health Connect Pivot (substitui Samsung Health)**

### Strategic Pivot
Samsung Health → **Android Health Connect** (`androidx.health.connect:connect-client:1.1.0`)

### Rationale
- Gratuito, sem partnership
- Cobre Strava + GymRats nativamente
- Parte do Android Jetpack
- Built-in Android 14+ (instalável via Play Store em anteriores)

### Changes
- `HealthConnectPlugin.kt` — novo plugin Capacitor (isAvailable, requestHcPermissions, exportWorkout)
- `health-connect.ts` — wrapper JS (mesma interface `WorkoutExport`/`SyncStatus`)
- `WorkoutTracker.tsx` + `App.tsx` — imports trocados Samsung → HC
- `build.gradle` — AGP 8.7.2→8.9.1, `connect-client:1.1.0` + `kotlinx-coroutines-android:1.8.1`
- `AndroidManifest.xml` — remove Samsung meta-data + `WRITE_USE_APP_SURVEY`, adiciona `android.permission.health.READ_EXERCISE` + `WRITE_EXERCISE`
- `variables.gradle` — `compileSdk=36`, `targetSdk=36`, `minSdk=26`
- Deleted: `SamsungHealthPlugin.kt`, `samsung-health.ts`

---

## v1.4 — 2026-07-25
**TTS Metade + Audio Ducking Fix + WakeLock**

### TTS
- "Chegamos na metade dessa volta!" (etapas Corrida >180s ou 50% distância)
- "Chegamos na metade do treino!" (50% tempo total, ignora Treino Livre)

### Audio Ducking Fix
- Bug: `abandonFocus()` via `setTimeout` enquanto TTS ainda tocava → música não voltava
- Root cause: Capacitor TTS Promise resolve em `onDone()` (não imediato)
- Fix: `abandonFocus()` **após** `await TextToSpeech.speak()` — sem `setTimeout`

### WakeLock (Foreground Service)
- `PARTIAL_WAKE_LOCK` em `onStartCommand`, libera em `onDestroy`
- Modo esteira: `startKeepAlive`/`stopKeepAlive` no `TrackingPlugin` (inicia FG service sem GPS)

### Build
- APK v1.1 (versionCode 9, 6.9 MB)
- Deploy: Web `correlogo.web.app` + APK `Corre Logo v1.1.apk`

---

## v1.3 — 2026-07-21c
**Fix Reschedule Cascade**

### Bug
`generatedFromProgramId` nunca atribuído → cascade silencioso (condição `programId &&` retornava false).

### Fix
- Campo `generatedFromProgramId?: string` em `WorkoutPlan` (`types.ts:72`)
- Ao confirmar programa: cada plano recebe `generatedFromProgramId: finalProgram.id` (`App.tsx:939`)
- Fallback compat: cascade usa `programName` se `generatedFromProgramId` ausente

---

## v1.2 — 2026-07-21b
**Migração AWS → Firebase Hosting + Cloud Functions**

### Infraestrutura
- Cloud Function `authCallback` (v2, Node 22): troca OAuth code → token, redirect web/APK
- Cloud Function `healthCheck`: GET `/api/health` → `{"status":"ok"}`
- Firebase Hosting: serve `dist/`, rewrites p/ Functions, CSP + security headers
- Domínio: `correlogo.web.app` (novo) — `correlogo.sytes.net` (AWS) fallback

### Limpeza Deps
- Removidos: `express`, `helmet`, `cors`, `express-rate-limit`, `google-auth-library`, `dotenv`, `esbuild`, `@types/express`
- Scripts simplificados: `"dev": "vite"`, `"build": "vite build"`

### CSP
- `firebase.json` headers (substitui meta tag `index.html`)
- `script-src` inclui Google APIs para Firebase Auth web

### APK
- Redirect URI atualizado p/ `correlogo.web.app`
- versionCode 8

---

## v1.1 — 2026-07-10
**Fix Export TCX/GPX Android + Fix Mapa Resumo + Firestore Rules**

### Export Android
- `@capacitor/filesystem@7.1.8`
- `saveFile()` → `Filesystem.writeFile()` em `Directory.ExternalStorage/Download/CorreLogo/`
- Toast "Arquivo salvo"

### Mapa Resumo
- CSP `index.html` adiciona tiles OSM/Carto/Esri
- Container `height: 300px` inline
- `map.invalidateSize()` no `MapBounds` (fix height 10px web)

### Firestore Rules
- `correlogo-dev` Test Mode expira 2026-07-29
- `firestore.rules` versionado (auth required, scoped por UID)
- **Deploy manual necessário** via Console ou `firebase deploy --only firestore:rules`

---

## v1.0 — 2026-07-06e
**Finalização WorkoutTracker + OAuth Completo**

### Layout Final
- CSS overflow global (`html, body, #root { overflow: hidden }`) — fix phantom scroll WebView
- `MapComponent.tsx:62` `h-64` → `h-full` (fix mapa fixo 256px)
- Outdoor: mapa `flex-1 min-h-64`
- Esteira: speed controls `flex-shrink-0`, lap card `flex-1 min-h-0` + `flex flex-col items-center justify-center h-full`
- Botões âncora bottom: `mt-auto` + `pb-[calc(48px+env(safe-area-inset-bottom,0px))]`
- Removido spacer `<div className="flex-1">` (comia 40% espaço)
- Esteira-only: marquee `h-5`→`h-10`, progress bars `h-2.5`→`h-5`
- Free training: esconde "Tempo restante"

### OAuth + SHA-1
- Novo debug keystore → SHA-1 `7E:AD:85:85:52:D9:F3:2C:59:E4:93:73:12:31:9B:28:8C:86:BE:C6` registrado no Firebase `correlogo-prod`
- Google OAuth **FUNCIONANDO** confirmado pelo usuário
- Permission dialogs (notificação, atividade, localização) aparecem pós-login
- APK build + install pipeline passa em ~12 iterações

---

## v0.9 — 2026-07-06d
**WorkoutTracker Layout Final (outdoor + treadmill)**

### Outdoor
- Mapa `flex-1 min-h-64` preenche entre progress bars e lap card (mín 256px)
- `MapComponent.tsx:62` `h-64` → `h-full` (bug: mapa fixado 256px ignorando `h-*` pai)

### Treadmill
- Speed controls revertido `flex-shrink-0`
- Lap card `flex-1 min-h-0` apenas esteira
- Conteúdo lap card `text-center` → `flex flex-col items-center justify-center h-full`

### Botões Âncora
- `mt-auto` no container + `pb-[calc(48px+env(safe-area-inset-bottom,0px))]`

### Removido
- `<div className="flex-1">` spacer (comia 40% espaço)

### Tamanhos Esteira
- Marquee `h-5` → `h-10`
- Progress bars `h-2.5` → `h-5` (condicional `mode === 'treadmill'`)

### Free Training
- "Tempo restante" escondido quando `isFreeTraining === true`

### Build
- Pipeline completo passa em ~12 iterações
- APK 6.8 MB (v1.0.4)

---

## v0.8 — 2026-07-05e
**Reprioritização + Status Pendências**

### Done
- Repetição manual, Escalonamento Standard/ImprovePace, Onboarding

### Em Teste
- CSP meta tag (foto perfil)
- Áudio ducking

### Precisa Corrigir
- Reschedule cascade (testar em conjunto)
- Botão Nav Back (fecha app em vez de fechar modal)

### Reavaliar
- 11 itens antigos (dotenv, performance, deps duplicadas, estrutura dados, onSnapshot, etc.)

---

## v0.7 — 2026-07-05d
**8 Issues (WorkoutTracker + OAuth + SHA-1 + Permissions + Layout + Audio)**

### Issues Resolvidos
1. Timer contando no countdown → Dual-timer conflict fix (JS early return em esteira+nativo)
2. Distância pulando na troca de etapa → Acúmulo incremental via `prevElapsedRef`
3. TTS metade não disparava → Closure stale `lapSeconds` → `lapElapsed` local + refs
4. Volume música não restaurava → `setWillPauseWhenDucked(true)` contradizia `MAY_DUCK` → removido
5. SHA-1 resolvido → novo debug keystore + Firebase Console `correlogo-prod`
6. Google OAuth FUNCIONANDO → confirmado usuário
7. Permission dialogs aparecem → Promise.race removido + plugins registrados
8. APK build + install → pipeline completo passa

---

## v0.6 — 2026-07-05c
**Android Native Tracking + Audio + Calendar**

### TrackingService.kt
- Foreground service + FusedLocationProvider (GPS) + Step Counter sensor
- Notification channel `tracking_channel` (PT-BR, IMPORTANCE_LOW, silencioso)
- Lifecycle: `onCreate` setup sensors, `onStartCommand` start updates, `onDestroy` cleanup
- Bridge via `companion object { var currentPlugin: TrackingPlugin? }`

### TrackingPlugin.kt
- `@CapacitorPlugin(name="Tracking")` permissions: FINE/COARSE/BACKGROUND_LOCATION, ACTIVITY_RECOGNITION
- Methods: `startTracking()`, `stopTracking()`, `getStepCount()`
- Events: `locationUpdate`, `stepUpdate`

### MainActivity.java
- Registra `TrackingPlugin` em `onCreate` via `registerPlugin()`

### Build Config
- Kotlin plugin 2.0.21 + `play-services-location:21.0.1`

---

## v0.5 — 2026-07-04d
**Fix Logout + Blocos Repetição + iCal Export**

### Fixes
- Logout: `onAuthStateChanged(null)` branch chama `finalizeAuth()` + `setShowUserProfile(false)`

### WorkoutEditor
- Blocos com `repeat: N` (1-99), steps duplicados N vezes ao salvar
- Ex: bloco 2x [corrida, caminhada] → corrida, caminhada, corrida, caminhada
- Múltiplos blocos com reordenação, add/remove step por bloco

---

## v0.4 — 2026-07-04c
**Calendário Mensal + iCal Export + Reagendar + Marcador Prova**

### MonthCalendar
- Grade completa mês, navegação < >, bolinhas status (accent=planejado, accent-secondary=completo, amber=prova)
- Indicador dia atual/selecionado, toggle expand/collapse v/^ com animação

### iCal Export
- `src/lib/ical.ts` gera `.ics` válido (RFC 5545) com VEVENT por plano com `scheduledDate`
- Botão "Exportar para Calendário (.ics)" no menu Planos

### Reagendar
- Botão "Reagendar" abre modal com `<input type="date" colorScheme="dark">` + `onKeyDown preventDefault`
- Picker oculto anterior removido

### Escala Iniciante
- Tabela runna 16 sem → interpolação linear `mapTableIndex` para N semanas
- Fim de plano com `raceDate` insere marcador 🏁 no calendário

### Cores Opção 1 (Acessibilidade)
- Selected: `border-2 border-accent` + `bg-bg-elevated` (bolinha programado visível)
- Barra progresso Finalizar: `bg-accent-secondary/45` (âmbar) em vez de `bg-white opacity-20`
- Light mode: accent `#C70048`, accent-secondary `#D49400`

---

## v0.3 — 2026-07-02
**Calendário de Treinos + Export JSON + Fixes**

### Página Reformulada
- Layout centrado no calendário semanal
- `WeekCalendar` (semana horizontal, 7 dias, bolinhas status)
- `BottomSheet` (ações de plano)
- Saudação "Olá, {displayName}"

### Planos com Data
- Campo `scheduledDate` em `WorkoutPlan`
- Planos manuais/importados/do programa ganham data automática

### Lista Vinculada
- Planos filtrados por dia selecionado
- Navegação entre semanas

### Export JSON
- Atalho removido da UI (função mantida como dead code)

### Fixes
- Completed plans sem `scheduledDate` mostram bolinha verde via session date
- Badge "X restantes" quando hoje selecionado
- "Realizada em" no SessionSummary

### Countdown Atividade
- Tempo volta decrescente (etapas tempo)
- Distância decrescente (etapas distância)
- TTS adaptado ("2:30 minutos" / "1,75km")

### Data Programada Editável
- Input `type="date"` em cada card
- Mudar data reposiciona no calendário

### Gerador com startDate
- Usuário escolhe data início
- `calculateTotalWeeks` usa `startDate` em vez de `Date.now()`
- `assignScheduledDates` distribui sessões conforme `daysOfWeek`

### Controle de Carga
- Iniciante > 2 dias/sem → sessões regenerativas (caminhada 15min + trote curto) dias extras

### Onboarding
- Tela boas-vindas Rocket + CTAs para novos usuários sem planos

---

## v0.2 — 2026-06-25
**UI Audit — 16 itens corrigidos (P0 a P3)**

### Prioridades
- P0: Fontes (Geologica headings, IBM Plex Sans body)
- P0: 18x `text-gray-500` → `text-text-muted`, 5x `text-gray-600` → `text-text-secondary` (TrainingGenerator)
- P1: Cores hardcoded → tokens temáticos (`text-success`, `text-danger`, `text-warning`, `bg-bg-surface`)
- P1: Loading states — skeleton no carregamento Firestore, `disabled` + feedback Login/Signup
- P1: Componente `<Modal>` (backdrop centralizado, variantes dialog/alertdialog)
- P1: Componente `<Button>` (variantes primary/secondary/ghost/danger, sizes sm/md/lg)
- P2: `text-[10px]` → `text-xs` (WorkoutTracker)
- P2: Touch targets ≥ 44px (p-2 botões toggle/mapa)
- P2: `truncate` nomes plano
- P2: `text-text-muted` → `text-text-secondary` labels estatísticas
- P2: `opacity-50` → `opacity-70` planos completos
- P3: Animação expand/collapse (`max-h` + `opacity` + `transition-all`)
- P3: Empty states com ícone (Clipboard/ClipboardList) + CTA textual
- P3: `alert()` → inline errors (ImportPlan, Login)
- P3: `max-w-lg` → `max-w-xl` container principal
- P3: `onKeyDown`/`onKeyUp` botões velocidade (Enter/Space)

### Performance
- `Promise.all` planos/sessões/settings paralelos
- `limit(50)` query sessões
- Timeout 5s Firestore + fallback localStorage
- Cache localStorage sessões (além de planos + tema)

### Sync Offline
- Dados offline (`local-*` prefix) → auto-sync próxima conexão
- Planos merge (local + remote)

### Segurança
- `firebase-applet-config.json` removido do git + `.gitignore`
- Analytics removido do `init()` (carregamento sob demanda)

### Firebase
- Logs `[timing]` no console para diagnóstico
- Firestore ativado no `correlogo-dev-9a96a` (estava desligado)

### Infra
- `NODE_ENV=production` documentado em AGENTS.md com instruções restart

---

## v0.1 — 2026-06-21
**Infra: Migrated production to AWS EC2 (Ubuntu), domain `correlogo.sytes.net`**

### Fixes
- Node process rodava em dev mode (missing `NODE_ENV=production`) → `server.ts` montava Vite dev middleware/HMR
- Production build tinha Firebase config stale → required `npm run build` + `pm2 restart` para tomar efeito
- PM2 process management (`correlogo`), registered with systemd
- Nginx reverse proxy (80/443 → 3000), removing port from public URL
- SSL via Let's Encrypt/Certbot, auto HTTP→HTTPS redirect
- Nginx block denying `.env`/`.git` access
- `vite.config.ts` `server.allowedHosts: ['correlogo.sytes.net']`

---

*Última atualização: 2026-07-30 (v2.3)*