# Changelog

## [2026-07-29] — 4 Bug Fixes + Samsung Health Plan

### Bug Fixes

#### Bug #1: Timer counting during countdown (warmup start at 04:55 instead of 05:00)
- **Root cause:** Dual-timer conflict — JS `setInterval` and native timer `Handler` both writing to `elapsedSeconds`/`lapSeconds`. JS timer incremented while native timer was counting down, so by the time the countdown reached 0, elapsed was already at ~5s
- **Fix:** JS timer returns early (`return`) for treadmill+native timer mode; native timer acts as sole source of truth

#### Bug #2: Total distance jumping on step change (500m → 1.2km → 700m)
- **Root cause:** `distRef.current = elapsed * dPerSec` recalculated total distance FROM SCRATCH each frame using current speed. When a step changed, `dPerSec` changed, causing the accumulated distance to jump
- **Fix:** Incremental accumulation via `prevElapsedRef` — `distRef.current += delta * dPerSec`. Distance now only grows by the delta

#### Bug #3: Half-lap/half-workout TTS not firing
- **Root cause:** `lapSeconds` variable captured in `onTimerTick` callback closure was stale — the closure was created once at listener registration with the initial value `0`
- **Fix:** Use `lapElapsed` (local variable passed into the callback) or `elapsedRef.current - lapStartElapsedRef.current` (ref, no stale closure)

#### Bug #4: Music volume not restoring after TTS
- **Root cause:** `setWillPauseWhenDucked(true)` told Android that Corre Logo would PAUSE when ducked, contradicting `MAY_DUCK` behavior. Android cached this and never restored other apps' volume after TTS
- **Fix:** Removed `setWillPauseWhenDucked(true)` from `AudioFocusPlugin.kt`

### Samsung Health Integration Plan
- Spec written and approved: `docs/superpowers/specs/2026-07-29-samsung-health-integration-design.md`
- Implementation plan created: `docs/superpowers/plans/2026-07-29-samsung-health-sync.md`
- Pre-flight scan identified 4 gaps (App.tsx wiring, syncStatus persistence, Kotlin API, task ordering), corrected

---

## [2026-07-25] — TTS Metade + Audio Ducking Fix + WakeLock

**APK v1.1 (versionCode 9) — Deploy:**
- Web: `https://correlogo.web.app` ✅
- APK: `Corre Logo v1.1.apk` (6.2 MB)

### TTS Metade (Volta/Treino)
- **TTS "Chegamos na metade dessa volta!":** dispara ao atingir 50% de etapas de Corrida (>180s em tempo, ou 50% da distância em etapas por distância). Não dispara em aquecimento, caminhada, descanso ou desaquecimento
- **TTS "Chegamos na metade do treino!":** dispara uma vez ao atingir 50% do tempo total do treino (ignorado no Treino Livre)

### Audio Ducking Fix
- **Bug:** `abandonFocus()` era chamado via `setTimeout` enquanto o TTS ainda estava tocando. O player de música nunca recebia o sinal de restauração porque o TTS ainda detinha o foco de áudio
- **Causa raiz:** comentário no código original dizia `// speak() returns immediately`, mas isso é **falso no Android** — o plugin Capacitor TTS resolve a Promise em `UtteranceProgressListener.onDone()`, ou seja, `await TextToSpeech.speak()` **espera o TTS terminar de falar**
- **Fix:** `abandonFocus()` chamado imediatamente após `await TextToSpeech.speak()` — sem `setTimeout`, sem state module-level. Timing perfeito: foco é abandonado no instante em que o TTS termina

### WakeLock (Foreground Service)
- **Bug:** CPU podia dormir quando a tela apagava, matando o TrackingService mesmo sendo foreground
- **Fix:** `PARTIAL_WAKE_LOCK` adquirido no `onStartCommand` e liberado no `onDestroy` — mantém a CPU ativa durante o treino
- **Permissão:** `WAKE_LOCK` adicionada ao `AndroidManifest.xml`
- **Modo esteira:** foreground service NÃO era iniciado no modo esteira (só no outdoor via `startTracking`). Fix: novos métodos `startKeepAlive`/`stopKeepAlive` no `TrackingPlugin` — inicia o foreground service + WakeLock sem precisar de permissão de GPS. Chamado no mount do `WorkoutTracker` quando `mode === 'treadmill'`
- **APK:** `Corre Logo v1.1.apk` (versionCode 9, 6.9 MB)

## [2026-07-21c] — Fix Reschedule Cascade
- **Bug:** `generatedFromProgramId` nunca era atribuído aos planos quando um programa era gerado, causando silêncio no cascade (condição `programId &&` retornava false)
- **Fix:** Adicionado campo `generatedFromProgramId?: string` ao tipo `WorkoutPlan` (`types.ts:72`). Ao confirmar programa, cada plano recebe `generatedFromProgramId: finalProgram.id` (`App.tsx:939`)
- **Compatibilidade retroativa:** Lógica do cascade agora usa `programName` como fallback quando `generatedFromProgramId` não existe (planos antigos). Se `generatedFromProgramId` existe, usa match por ID; senão, usa match por `programName`
- **Resultado:** Reagendar um treino com "Reagendar este e seguintes" agora desloca todos os planos do mesmo programa a partir da data original — funciona tanto para planos novos quanto antigos

## [2026-07-21b] — Migração AWS → Firebase Hosting + Cloud Functions
- **Cloud Function `authCallback` (v2, Node.js 22):** troca Google OAuth code → access_token. Redireciona web via query params (`/?gcal_token=...`) ou APK via custom scheme (`com.correlogo.app://oauth/callback?token=...`). Secrets via `.env` (não `functions.config()`)
- **Cloud Function `healthCheck`:** GET `/api/health` → `{"status":"ok"}`
- **Firebase Hosting:** serve `dist/` (SPA), rewrites pra Cloud Functions, CSP + X-Content-Type-Options + X-Frame-Options + Referrer-Policy via `firebase.json` headers
- **Domínio:** `correlogo.web.app` (novo) — `correlogo.sytes.net` (AWS) continua rodando como fallback
- **Limpeza de deps:** removidos `express`, `helmet`, `cors`, `express-rate-limit`, `google-auth-library`, `dotenv`, `esbuild`, `@types/express`
- **Scripts simplificados:** `"dev": "vite"`, `"build": "vite build"` (sem esbuild server.cjs)
- **`server.ts` removido** — substituído por Firebase Hosting + Cloud Functions
- **CSP meta tag removida do `index.html`** — agora fica no `firebase.json` (mais restritiva, inclui domínios Google pra Auth)
- **APK:** redirect URI atualizado pra `correlogo.web.app`, versionCode 8
- **Blaze plan ativado** (necessário pra Cloud Functions, custo $0 dentro do free tier)

## [2026-07-21] — Fix Export TCX/GPX Android + Fix Mapa Resumo + Firestore Rules
- **Export .tcx/.gpx no Android:** instalado `@capacitor/filesystem@7.1.8`. `saveFile()` salva em `Download/CorreLogo/` via `Filesystem.writeFile()` (nativo) em vez de `Blob`+`<a download>` (web). Toast "Arquivo salvo" ao final
- **Mapa no resumo da sessão:** CSP do `index.html` agora inclui `https://*.tile.openstreetmap.org`, `https://*.basemaps.cartocdn.com`, `https://server.arcgisonline.com` — tiles carregam no APK. Container do mapa alterado de `h-64` para `height: 300px` inline. Adicionado `map.invalidateSize()` no `MapBounds` para corrigir altura de 10px na web
- **Requisito pendente:** Firestore rules do `correlogo-dev` expirando em 4 dias. `firestore.rules` já versionado com rules corretas — deploy manual necessário via Firebase Console ou `firebase deploy --only firestore:rules`

## [2026-07-10d] — Reavaliação Geral + Status das Pendências
- **Concluídos**: Repetição manual, Escalonamento Standard/ImprovePace, Onboarding
- **Em teste**: CSP meta tag (foto perfil), Áudio ducking
- **Precisa corrigir**: Reschedule cascade (testar em conjunto), Botão Nav Back (fecha app em vez de fechar modal)
- **Reavaliar**: 11 itens da lista antiga (dotenv, performance, deps duplicadas, estrutura de dados, onSnapshot, etc.)

## [2026-07-10c] — UX Fixes (Toast, Back Button, Input Focus) + CSP Tentativa
- **Toast centralizado:** feedbacks movidos para `bottom-24 left-1/2 -translate-x-1/2` (100px do fundo)
- **Botão Nav Back:** botão físico de voltar do Android agora fecha modais/telas secundárias (perfil, histórico, gerador, workoutToStart, modais de exclusão/reagendamento, calendar, signup). **Exceção:** desabilitado durante workout
- **Input foco automático:** campo "Repetir bloco" seleciona todo o texto ao receber foco, permitindo digitação imediata
- **CSP Android:** adicionado `captureInput: true` e `server.androidScheme: 'https'` no `capacitor.config.ts` — **foto do perfil pode ainda não carregar, requer teste no device**

## [2026-07-10b] — Fix TTS repetitivo + APK v1.0 (versionCode 3)
- **Fix TTS repetitivo:** `spokenCompletionRef` impede que `speak("Exercício concluído, parabéns!")` dispare mais de uma vez ao final do treino programado, resolvendo loop durante o modo treino livre
- **APK gerado:** `Corre Logo v1.0.apk` via `npm run build:apk` — pipeline completo validado

## [2026-07-10] — 5 Melhorias (Loading, CSP, APK Export, Cascata, Áudio Ducking)
- **Loading screen:** skeletons substituídos por tela com logo seta-rastro SVG + spinner circular + "Corre Logo" centralizado
- **CSP meta tag:** adicionado `Content-Security-Policy` no `index.html` com `img-src 'self' data: https://lh3.googleusercontent.com` — fotos do Google Profile carregam no Capacitor WebView
- **APK export automation:** `scripts/export-apk.ps1` extrai `versionName`, copia APK com nome padronizado, incrementa `versionCode`. Script `build:apk` no `package.json` orquestra pipeline completo
- **Reschedule cascade:** modal com dois botões — "Reagendar apenas este" (single) e "Reagendar este e seguintes" (cascade). Cascade calcula delta e aplica offset a planos do mesmo `generatedFromProgramId`
- **Áudio ducking fix:** `setWillPauseWhenDucked(false)` → `true` em `AudioFocusPlugin.kt` (sistema restaura volume). Timer reduzido de `max(2000, text.length * 90)` → `max(500, text.length * 60)`

## [2026-07-06e]
- **WorkoutTracker layout final (outdoor + treadmill):** usuário confirmou "tudo funcionando perfeitamente" após ~12 iterações.
- **CSS overflow global:** `html, body, #root` com `overflow: hidden` (index.css) — barrou phantom scroll no WebView Android.
- **MapComponent fix:** `h-64` → `h-full` (`MapComponent.tsx:62`) — era o bug que silenciosamente fixava o mapa em 256px ignorando o `h-*` do pai.
- **Outdoor mode:** mapa `flex-1 min-h-64` — preenche espaço entre progress bars e lap card, mínimo 256px.
- **Treadmill mode:** speed controls `flex-shrink-0`, lap card `flex-1 min-h-0` + conteúdo interno `flex flex-col items-center justify-center h-full`.
- **Botões âncora bottom:** `mt-auto` no container + `pb-[calc(48px+env(safe-area-inset-bottom,0px))]` para safe-area.
- **Removed spacer:** `<div className="flex-1">` que comia 40% do espaço eliminado.
- **Treadmill-only size bumps:** marquee `h-5` → `h-10`, progress bars `h-2.5` → `h-5` via conditional.
- **Free training polish:** "Tempo restante" escondido quando `isFreeTraining === true`.
- **SHA-1 resolvido:** novo debug keystore gerado, SHA-1 `7E:AD:85:85:52:D9:F3:2C:59:E4:93:73:12:31:9B:28:8C:86:BE:C6` registrado no Firebase Console para `correlogo-prod`.
- **Google OAuth FUNCIONANDO:** confirmado pelo usuário após SHA-1 + google-services.json correto.
- **Permission dialogs:** notificação, atividade, localização aparecem após login (Promise.race removido + plugins registrados).
- **APK build + install:** pipeline completo passa em todas as ~12 iterações.

## [2026-07-06d]
- **WorkoutTracker layout final (outdoor):** mapa flex-1 preenche espaço entre progress bars e lap card. `MapComponent.tsx:62` mudou `h-64` → `h-full` (era o bug: map era silenciosamente fixado em 256px ignorando o `h-*` pai). Minimum 256px, mas cresce com folga.
- **WorkoutTracker layout final (treadmill):** speed controls revertido pra `flex-shrink-0`, lap card virou `flex-1 min-h-0` apenas no modo esteira. Conteúdo interno do lap card (`text-center` → `flex flex-col items-center justify-center h-full`) preenche o tableto e centraliza verticalmente.
- **Botões âncora bottom:** `mt-auto` empurra para o rodapé; container `pb-[calc(48px+env(safe-area-inset-bottom,0px))]` garante que o botão (~44px) fica inteiro acima do safe-area (corrige botão cortado pela navigation bar do Android).
- **Removed spacer** que causava 40% de vazio.
- **Treadmill-only size bumps:** marquee `h-5` → `h-10`, progress bars `h-2.5` → `h-5` (apenas quando `mode === 'treadmill'`). Outdoor inalterado.
- **CSS overflow em html, body e #root** (`index.css`) — barrou o phantom scroll que aparecia no WebView Android.
- **Free training polish:** "Tempo restante" escondido quando `isFreeTraining === true` (não faz sentido em corrida livre — sempre `0:00`).
- **APK rebuild:** build e install passam em todas as iterações. Última versão: outdoor e treadmill visualmente fechados, sem vazios, botões âncora, mapa perfeito.

## [2026-07-06a]
- **WorkoutTracker layout (Issue 1):** inner container `flex-1 flex flex-col` com `overflow-hidden` em vez de `overflow-y-auto`. Lap info ganha `flex-1` para expandir e preencher espaço vertical. Todos os demais elementos `flex-shrink-0`. Botões em `space-y-3`. Conteúdo ocupa 4/5+ da tela sem scroll.
- **Sticky header (Issue 2):** `<main>` perdeu `p-4` (causava gap de 16px no topo do sticky). Sticky header ganhou `px-4 pt-4 pb-2`. Dashboard content envelopado em `<div className="px-4 pb-4">`. WorkoutEditor/TrainingGenerator/ProgramReview com `p-4` wrapper. Header agora fixa exatamente em top-0.
- **GPS "Abrir Configurações" (Issue 3):** novo método nativo `openAppSettings()` no `TrackingPlugin.kt` — abre `ACTION_APPLICATION_DETAILS_SETTINGS` com `Uri.parse("package:" + packageName)`. Interface TS atualizada. `openAppSettings()` em App.tsx agora chama `Tracking.openAppSettings()`.
- **Back button double-press (Issue 4):** listener `backButton` via `@capacitor/app`. Primeira press → toast "Pressione VOLTAR novamente...". Segunda press em 2s → `exitApp()`. Só ativo quando `!activePlan`.
- **Google OAuth logging (Issue 5):** logs detalhados no console nativo: `result.keys`, `result.user`, `result.credential`, `idToken`/`accessToken` flags, `signInWithCredential` chamada, erro completo com `JSON.stringify(err, getOwnPropertyNames)`.
- **Distance pause fix (Issue 6):** `isPausedRef` sincronizado com `isPaused`. GPS `handlePosition` só computa distância quando `!isPausedRef.current`. Mapa continua atualizando coords e path durante pausa.
- **Audio ducking (Issue 7):** `AudioFocusPlugin.kt` troca `AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE` → `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`. Remove `setWillPauseWhenDucked(true)`. Música reduz ~80% em vez de pausar. Sistema restaura volume ao abandonar foco.
- **Workout end flow (Issue 8):** última etapa completa → TTS "Exercício concluído, parabéns!" + `setIsExtended(true)`. Finalizar treino → TTS "Agora é só olhar seu relatório" + modal Save/Discard.
- **Terminology:** "treinos outdoor" → "treinos ao ar livre" no banner de permissão.
- **APK rebuild:** `assembleDebug` bem-sucedido (APK 6.8 MB, v1.0.4).

## [2026-07-05e]
- **WorkoutTracker layout:** removido `<div className="flex-1" />` que criava espaço vazio enorme no modo esteira. Mapa outdoor com altura fixa `h-44` em vez de `flex-1` (não mais empurra botões pra baixo da tela). Container reestruturado para `h-full flex flex-col` + `overflow-y-auto` no conteúdo, sem flex-1 spacer nem `mt-auto`. Margens ajustadas (`mb-6`→`mb-3`, etc). Cabe tudo numa tela sem scroll em ambos os modos.
- **Sticky header:** trocado `sticky -top-4` → `sticky top-0` no header do dashboard. Removido `pt-4` do sticky (padding fica no `<main>`). Header agora fixa corretamente no topo ao scrollar.
- **GPS warmup + modal:** novo fluxo de permissão background. Após usuário conceder localização "Durante o Uso", modal pergunta se quer ativar "Permitir o tempo todo". Botão "Abrir Configurações" → intent para Android Settings. Listener `appStateChange` detecta retorno do app e re-checka. Warmup (startTracking→3s→stopTracking) só dispara após usuário confirmar que ativou background ou re-check automático detectar background=granted. Código duplicado extraído para `doGpsWarmup()` + `checkRunWarmup()`.
- **Modo full-screen (Android nav bar):** `MainActivity.java` adicionado `View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION` + `View.SYSTEM_UI_FLAG_HIDE_NAVIGATION` + `View.SYSTEM_UI_FLAG_FULLSCREEN` + `View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY` + `onWindowFocusChanged` para re-aplicar ao ganhar foco. CSS safe-area movido de `body` para `#root` com `env(safe-area-inset-bottom)`.
- **Google Login (skipNativeAuth):** revertido `skipNativeAuth: false` → `true` no `capacitor.config.ts`. `Login.tsx` agora recebe `result.credential?.idToken` nativo e chama `GoogleAuthProvider.credential(idToken, accessToken)` + `signInWithCredential(auth, credential)` — autentica contra Firebase **prod** (`.env`). `auth.ts` atualizado com mesmo fluxo. Listener `authStateChange` mantido como no-op (evento ignorado).
- **Imports:** removidos imports duplicados `FirebaseAuthentication` e `Capacitor` em App.tsx. Adicionado `Tracking` import.
- **APK rebuild:** build `assembleDebug` bem-sucedido (APK 6.4 MB, v1.0.4).

## [2026-07-05d]
- **Android APK build (v1.0.4):** version bump no `android/app/build.gradle.kts` (versionName 1.0.4, versionCode 4). Build bem-sucedido com `assembleDebug` (APK 6.4 MB). JDK 21, SDK 35.
- **AndroidManifest.xml:** adicionado `deny=android.permission.SCHEDULE_EXACT_ALARM` para evitar conflito com permissões de notificação.
- **docs/todo.md:** resolvido conflito de merge pendente (HEAD vs d2909f4f). Consolidadas tarefas de permissões, GPS e som como pendentes.

## [2026-07-05c]
- **AudioFocusPlugin.kt reescrito:** novo callback `abandonAudioFocusOnPause` para liberar foco corretamente quando o usuário pausa manualmente. Removido `abandonAudioFocus` redundante. `onRequestFocusResult` agora usa `onActivityResult` em vez de callback direto para tratar comportamento assíncrono do `requestAudioFocus` no Android 12+.
- **TrackingPlugin.kt:** `startService` movido para `load()` em vez de `startTracking()`, garantindo que o foreground service esteja rodando antes dos sensores. `handleRequestPermissionsResult` sobrescrito com `@Override` tipado. Novo `UpdateFencingPlugin.java` suporta `updateLocationFencing()` via Capacitor bridge.
- **TrackingService.kt:** `onStartCommand` agora usa `LocationRequest.Builder` + `Task.whenComplete` em vez de `addOnSuccessListener`. FusedLocationClient agora usa `Priority.PRIORITY_BALANCED_POWER_ACCURACY` e intervalos realistas (5s). Step counter delta fixo para cálculo correto.
- **WorkoutTracker.tsx — TTS refatorado:** `speakOnInterval()` substitui o antigo `speakIntervalRef` para exibir contagem regressiva via TTS nos estágios de tempo/distância. `window.speechSynthesis` (Chrome custom tab-friendly) substitui `TTSPlugin.speak` para vozes durante o treino; `TTSPlugin` mantido para notificações pós-treino.
- **src/lib/capacitor/voice.ts:** simplificado — TTS nativo usado apenas para `speakPostWorkout()`, com `queueStrategy: 1` (clear) e `rate: 1.0`.
- **GoogleCalendarModal.tsx:** ajustes no botão de conectar (desabilitado durante loading), limpeza de eventos antigos via `extendedProperty.planId`, filtro de planos futuros (não exibe `completed`).
- **App.tsx:** `requestAllPermissions()` agora aguarda `isNativePlatform()` e `!checkingAuth` para evitar loop. Novas funções `handleGoogleCalendarOpen`/`handleGoogleCalendarClose`. `handleDeleteSession` agora usa `writeBatch` corretamente com `doc()`. Modal de Calendar integrado ao fluxo de seleção de plano. `handleFinishSession` corrigido: previne duplicação de sessões com `lastCompletedSessionId`.
- **Server.ts:** novo route `GET /auth/google/callback` com detecção de Capacitor (`state.startsWith('c3_')`) — redireciona para deep link `com.correlogo.app://oauth/callback?token=...` para dispositivo móvel. Web mantém `/?gcal_token=...`.
- **AGENTS.md:** adicionadas seções de Changeling & Handoff, Build Validation, UI & Component Patterns, Firebase Error Handling, Dependencies, Android/Capacitor Ground Rules, Production Infrastructure.
- **Capacitor:** `@capacitor/browser@8.0.3` + `@capacitor/app@8.1.0` instalados para OAuth via Chrome Custom Tab. `capacitor.config.ts` atualizado com nova appId `com.softnuvem.corre.logo`.

## [2026-07-05b]
- **Fix Calendar redirect_uri_mismatch no Android (Capacitor):** o `redirect_uri = ${window.location.origin}/auth/google/callback` produzia `http://localhost/auth/google/callback` no WebView (sem porta), URI que NÃO está nas authorized redirect URIs. Reescrito fluxo para detectar `isNativePlatform()` e enviar `redirect_uri = https://correlogo.sytes.net/auth/google/callback` (URL autorizada do Google Cloud Console) com `state = c3_<UUID>`. Novo pacote `@capacitor/browser@8.0.3` + `@capacitor/app@8.1.0` instalados para abrir OAuth em Chrome Custom Tab e ouvir o callback via intent custom scheme.
- **Server-side Capacitor detection:** `server.ts /auth/google/callback` detecta `state.startsWith('c3_')` e redireciona para `com.correlogo.app://oauth/callback?token=<access_token>&state=<state>`. Mantém o redirect de web (`/?gcal_token=...`) para o caso não-Capacitor.
- **Deep-link AndroidManifest.xml:** adicionado `<intent-filter>` para scheme `com.correlogo.app` na `MainActivity` — quando o servidor redireciona para o scheme custom, o Android abre o app automaticamente.
- **`appUrlOpen` listener em App.tsx:** parseia `com.correlogo.app://oauth/callback?token=...`, armazena em `localStorage` (`google_calendar_token`) e abre o modal de Calendar já conectado.
- **Modal de Calendar bifurca web/native:** `GoogleCalendarModal.tsx` detecta `isNativePlatform()` e usa `Browser.open({ url })` em vez de `window.location.href`; na web mantém o fluxo de redirect.
- **Fix permissões na primeira execução:** novo `PermissionsPlugin.kt` (Capacitor plugin) solicita `POST_NOTIFICATIONS` (Android 13+) e `ACTIVITY_RECOGNITION` (Android 10+) quando o usuário logga. `TrackingPlugin.kt` continua responsável pela permissão de localização. `requestAllPermissions()` em `App.tsx` agora dispara em `useEffect([user, isLoading])` sem aguardar `isLoading=false` (caso o Firestore esteja offline).
- **Build:** AGP 8.7.2 não suporta `androidx.browser:browser:1.9.0` — adicionado `force 'androidx.browser:browser:1.8.0'` em `capacitor.build.gradle` via `resolutionStrategy { force }`. APK regerado: `android/app/build/outputs/apk/debug/app-debug.apk` (6.86 MB).
- **`server.ts` CSP:** adicionado `https://accounts.google.com` ao `connectSrc` para o chrome custom tab funcionar, e ajustes em `imgSrc`/`scriptSrcElem`/`defaultSrc` para suportar fontes de imagem externas do Google Profile.

## [2026-07-05a]
- **Fix OAuth invalid_client:** server .env estava sem `VITE_GOOGLE_CLIENT_ID`; adicionado ao `.env` do servidor + rebuild
- **Fix OAuth bad request:** GET `/auth/google/callback` no server.ts usava `redirect_uri` hardcoded `http://localhost:3000`, mas o Google exige que o `redirect_uri` do token exchange seja **idêntico** ao da auth request do frontend. Corrigido para usar `APP_URL` (mesmo pattern do POST route)
- **Deploy:** server.cjs copiado para produção, PM2 restartado

## [2026-07-04d]
- **Android native tracking:** `TrackingService.kt` (foreground service, GPS via FusedLocationProviderClient, step counter via TYPE_STEP_COUNTER sensor) + `TrackingPlugin.kt` (Capacitor plugin bridge with `startTracking`, `stopTracking`, `getStepCount` methods)
- **Plugin registration:** `MainActivity.java` now registers `TrackingPlugin` via `registerPlugin()` in `onCreate`
- **Build config:** Kotlin plugin (2.0.21) + `play-services-location:21.0.1` added to Gradle

## [2026-07-04c]
- **Fix logout redirect:** `onAuthStateChanged(null)` branch agora chama `finalizeAuth()` + `setShowUserProfile(false)`, liberando `checkingAuth` para exibir tela de login em vez de spinner infinito
- **Blocos de repetição no WorkoutEditor:** cada bloco tem `repeat: N` (1–99); steps dentro do bloco são duplicados N vezes na expansão ao salvar. Ex: bloco 2x [corrida, caminhada] → corrida, caminhada, corrida, caminhada. Suporta múltiplos blocos com reordenação, add/remove step por bloco

## [2026-07-04] (continuação)
## [2026-07-04b]
- **Calendário mensal expansível:** componente `MonthCalendar` com grade completa do mês, navegação < > entre meses, bolinhas de status (accent=planejado, accent-secondary=completo, amber=prova), indicador do dia atual e selecionado. Toggle v/^ abaixo da linha de semana com animação expand/collapse.
- **Export iCal:** `src/lib/ical.ts` gera arquivo .ics válido (formato RFC 5545) com VEVENT para cada plano com `scheduledDate`. Botão "Exportar para Calendário (.ics)" no menu de Planos.
- **Cores Opção 1 (acessibilidade):** selected state troca `bg-accent` por `border-2 border-accent` + `bg-bg-elevated` — bolinha programado fica visível. Barra progresso do Finalizar: `bg-accent-secondary/45` (âmbar) em vez de `bg-white opacity-20`. Light mode: accent `#C70048`, accent-secondary `#D49400`.

## [2026-07-04]
- **Gerador iniciante adaptável:** tabela runna de 16 semanas agora escala para qualquer duração (6-52 sem). `mapTableIndex` interpola linearmente os índices da tabela para N semanas; fim de plano com data de prova insere marcador 🏁 no calendário
- **Bloqueio de digitação manual no campo de data:** `onKeyDown={(e) => e.preventDefault()}` no input `type="date"` impede entrada numérica livre que causava saltos de data imprevisíveis
- **Marcador de prova no calendário:** quando `raceDate` é definida, um plano `isRaceMarker: true` é adicionado ao programa com `scheduledDate = raceDate`; a bolinha laranja (amber-500) aparece no dia no `WeekCalendar` com legenda "Prova"
- **Renderização condicional de racemarker:** `isRaceMarker` oculta botões de ação (completar, iniciar, histórico) e input de data no card do plano

## [2026-07-02]
- **Calendário de treinos:** página reformulada com layout centrado no calendário semanal
- **Novos componentes:** `WeekCalendar` (semana horizontal, 7 dias, bolinhas de status), `BottomSheet` (menu deslizante de ações de plano)
- **Saudação personalizada:** "Olá, {displayName}" extraído do perfil do usuário
- **Planos com data:** campo `scheduledDate` adicionado ao `WorkoutPlan`; planos manuais, importados e de programa ganham data automaticamente
- **Lista vinculada:** planos filtrados por dia selecionado no calendário; navegação entre semanas
- **Export JSON:** atalho removido da UI (função mantida como dead code)
- **Deploy:** `a9f80b1` → produção (correlogo.sytes.net)
- **Fixes:** completed plans sem `scheduledDate` agora mostram bolinha verde via session date; badge mostra "X restantes" quando hoje está selecionado; "Realizada em" adicionado ao SessionSummary
- **Countdown na atividade:** tempo da volta exibido de forma decrescente em etapas por tempo; distância decrescente em etapas por distância; TTS adaptado ("2:30 minutos" / "1,75km")
- **Data programada editável:** input `type="date"` em cada card de plano; mudar a data reposiciona o plano no calendário automaticamente
- **Gerador com startDate:** usuário escolhe data de início; `calculateTotalWeeks` usa `startDate` em vez de `Date.now()`; `assignScheduledDates` distribui sessões no calendário conforme `daysOfWeek`
- **Controle de carga:** iniciante com mais de 2 dias/semana ganha sessões regenerativas (caminhada 15 min + trote curto) nos dias extras
- **Onboarding:** tela de boas-vindas com Rocket + CTAs para novos usuários sem planos

## [2026-06-25]
- **UI audit — 16 itens corrigidos (P0 a P3):**
  - P0: Fontes aplicadas (Geologica em headings, IBM Plex Sans no body)
  - P0: 18x `text-gray-500` → `text-text-muted`, 5x `text-gray-600` → `text-text-secondary` no TrainingGenerator
  - P1: Cores hardcoded substituídas por tokens temáticos (`text-success`, `text-danger`, `text-warning`, `bg-bg-surface`)
  - P1: Loading states — skeleton no carregamento Firestore, `disabled` + feedback em Login/Signup
  - P1: Componente `<Modal>` extraído (backdrop centralizado, variantes dialog/alertdialog)
  - P1: Componente `<Button>` extraído (variantes primary/secondary/ghost/danger, sizes sm/md/lg)
  - P2: `text-[10px]` → `text-xs` no WorkoutTracker
  - P2: Touch targets ≥ 44px (p-2 nos botões de toggle e mapa)
  - P2: `truncate` em nomes de plano
  - P2: `text-text-muted` → `text-text-secondary` nos labels de estatísticas
  - P2: `opacity-50` → `opacity-70` em planos completos
  - P3: Animação expand/collapse com `max-h` + `opacity` + `transition-all`
  - P3: Empty states com ícone (`Clipboard`/`ClipboardList`) + CTA textual
  - P3: `alert()` substituídos por inline errors em ImportPlan e Login
  - P3: `max-w-lg` → `max-w-xl` no container principal
  - P3: `onKeyDown`/`onKeyUp` nos botões de velocidade (Enter/Space)
- **Performance:** `Promise.all` para carregar planos/sessões/settings em paralelo
- **Performance:** `limit(50)` na query de sessões
- **Performance:** Timeout de 5s nas queries Firestore com fallback para localStorage
- **Performance:** Cache localStorage para sessões (além de planos e tema já existentes)
- **Sync offline:** Dados criados enquanto offline (sessões com `local-*`) são automaticamente sincronizados ao Firestore quando a conexão volta
- **Sync offline:** Planos locais são mesclados com remotos ao reconectar
- **Segurança:** `firebase-applet-config.json` removido do git e adicionado ao `.gitignore`
- **Segurança:** Analytics removido do `init()` do Firebase (carregamento sob demanda), desbloqueando a inicialização
- **Firebase:** Logs de timing adicionados para diagnóstico (console `[timing]`)
- **Firebase:** Firestore ativado no projeto `correlogo-dev-9a96a` (estava desligado)
- **Infra:** `NODE_ENV=production` documentado em AGENTS.md com instruções de restart

## [2026-06-21]
- Infra: Migrated production hosting to AWS EC2 (Ubuntu), domain `correlogo.sytes.net`.
- Fixed: Node process was accidentally running in dev mode (missing `NODE_ENV=production`), causing `server.ts` to mount the Vite dev middleware/HMR instead of serving the static build.
- Fixed: Production build had stale Firebase config baked in because `.env` was edited after the last build; required `npm run build` + `pm2 restart` to take effect (Vite env vars are compile-time, not runtime).
- Added: PM2 process management (`correlogo`), registered with systemd so the app survives reboots.
- Added: Nginx as a reverse proxy (port 80/443 → 3000), removing the need for a port number in the public URL.
- Added: SSL certificate via Let's Encrypt/Certbot, with automatic HTTP→HTTPS redirect and renewal.
- Added: Explicit Nginx block denying access to `.env`/`.git` files, as defense-in-depth on top of Express's existing behavior.
- Security: Removed public inbound access to port 3000 from the EC2 Security Group; the app is now only reachable via 80/443 through Nginx.
- Changed: `vite.config.ts` now sets `server.allowedHosts: ['correlogo.sytes.net']` to allow the dev server to respond to that host (prevents the "Blocked request... not allowed" error).

## [2026-06-18]
- Fixed: Dark mode preference persistence (now correctly loads from Firebase or system preference).
- Fixed: Workout completion logic, including automatic confirmation prompt and state resetting.
- Fixed: Issue preventing starting a new workout after finishing one, by ensuring proper component re-initialization via the `key` prop on `WorkoutTracker` in `App.tsx`.
- Improved: State management in `WorkoutTracker.tsx` to prevent re-render errors when finishing workouts.
- Improved: Firestore integration test logging to verify data saving.
