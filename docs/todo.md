# TODO

## Concluído — 2026-07-06e (Finalização WorkoutTracker + OAuth completo)

- **WorkoutTracker layout final (outdoor):** mapa flex-1 preenche espaço entre progress bars e lap card. `MapComponent.tsx:62` mudou `h-64` → `h-full` (era o bug: mapa fixado em 256px ignorando o `h-*` pai).
- **WorkoutTracker layout final (treadmill):** speed controls `flex-shrink-0`, lap card `flex-1 min-h-0` + conteúdo interno `flex flex-col items-center justify-center h-full`.
- **CSS overflow global:** `html, body, #root` com `overflow: hidden` (index.css) — barrou phantom scroll no WebView Android.
- **Botões âncora bottom:** `mt-auto` + `pb-[calc(48px+env(safe-area-inset-bottom,0px))]` para safe-area.
- **Removed spacer:** `<div className="flex-1">` que comia 40% do espaço eliminado.
- **Treadmill-only size bumps:** marquee `h-5` → `h-10`, progress bars `h-2.5` → `h-5` via conditional.
- **Free training polish:** "Tempo restante" escondido quando `isFreeTraining === true`.
- **SHA-1 resolvido:** novo debug keystore gerado, SHA-1 `7E:AD:85:85:52:D9:F3:2C:59:E4:93:73:12:31:9B:28:8C:86:BE:C6` registrado no Firebase Console para `correlogo-prod`.
- **Google OAuth FUNCIONANDO:** confirmado pelo usuário após SHA-1 + google-services.json correto.
- **Permission dialogs:** notificação, atividade, localização aparecem após login (Promise.race removido + plugins registrados).
- **APK build + install:** pipeline completo (`build` → `cap sync` → `assembleDebug` → `adb install -r`) passa em todas as ~12 iterações.
- **Usuário confirmou:** "tudo funcionando perfeitamente".

## Concluído — 2026-07-06d (WorkoutTracker layout final)

- **CSS base:** `overflow: hidden` em `html, body` e `#root` (index.css) — barrou o phantom scroll no WebView Android.
- **MapComponent fix:** `h-64` → `h-full` (era o bug que silenciosamente fixou mapa em 256px ignorando o `h-*` do pai).
- **Outdoor mode:** mapa `flex-1 min-h-64` (cresce, min 256px), preenche espaço entre progress bars e lap card.
- **Treadmill mode:** speed controls revertido pra `flex-shrink-0`, lap card virou `flex-1 min-h-0` apenas no esteira. Conteúdo interno do lap card `flex flex-col items-center justify-center h-full` (preenche painel e centraliza verticalmente).
- **Botões âncora bottom:** `mt-auto` no buttons container; `pb-[calc(48px+env(safe-area-inset-bottom,0px))]` no container pra acomodar a altura do botão.
- **Removed spacer:** `<div className="flex-1">` que comia 40% do espaço eliminado.
- **Treadmill-only size bumps:** marquee `h-5` → `h-10` (20→40px), progress bars `h-2.5` → `h-5` (10→20px) via conditional class `{mode === 'treadmill' ? ... : ...}`. Outdoor inalterado.
- **Free training polish:** "Tempo restante" escondido quando `isFreeTraining === true` (não há plano pra contar regressão).
- **APK build + install:** pipeline completo (`build` → `cap sync` → `assembleDebug` → `adb install -r`) passa em todas as ~10 iterações.

## Concluído — 2026-07-06c (8 issues)

- **SHA-1 resolvido:** novo debug keystore gerado, SHA-1 `7E:AD:85:85:52:D9:F3:2C:59:E4:93:73:12:31:9B:28:8C:86:BE:C6` registrado no Firebase Console para `correlogo-prod`
- **Google OAuth FUNCIONANDO:** confirmado pelo usuário após SHA-1 + google-services.json correto
- **Permission dialogs:** notificação, atividade, localização aparecem após login (Promise.race removido + plugins registrados)
- **WorkoutTracker layout final:** textos grandes restaurados (text-2xl/4xl, text-lg, [11px]), lap card `flex-shrink-0` (sem `flex-1`), `mt-1` gaps, `overflow-hidden` no `<main>`
- **Scroll eliminado na fonte:** `<main>` condicional: `overflow-hidden` quando `activePlan` está setado
- **openAppSettings caption:** modal agora tem instrução "Se abrir Informações do aplicativo, toque em Permissões → Localização"
- **APK build + install:** `npm run build` → `npx cap sync` → `gradlew assembleDebug` → `adb install -r`
- **HANDOFF.md + docs/todo.md atualizados**

## Concluído — 2026-07-06b (7 issues)

- **Permissions fix:** removed Promise.race timeout → permission dialogs (notification, activity, location) now appear after login
- **Native plugin registration:** TrackingPlugin, PermissionsPlugin, AudioFocusPlugin registered in MainActivity `load()` override
- **openAppSettings:** updated to `APPLICATION_PERMISSION_SETTINGS` intent on API 31+ (raw string), with fallback
- **google-services.json:** replaced with `correlogo-prod` version (project `985879764466`)
- **WorkoutTracker layout:** 3 compact passes (reduced spacings, text sizes, centering card)
- **SHA-1 fingerprint extraction:** `A8:85:4A:B2:17:C4:47:A9:74:6A:AE:08:48:45:A6:19:ED:06:B3:E8` for debug keystore
- **Build validation:** `npm run build` + `npx cap sync` + `gradlew assembleDebug` all pass

## Concluído — 2026-07-06a (8 issues)

- **WorkoutTracker layout (Issue 1):** conteúdo ocupa 4/5+ da tela sem scroll. Lap info com `flex-1` para expandir verticalmente. Todos elementos `flex-shrink-0`. `overflow-hidden` em vez de `overflow-y-auto`.
- **Sticky header (Issue 2):** `<main>` sem `p-4`. Sticky header com top-0 real. Dashboard envelopado em `px-4 pb-4`
- **GPS "Abrir Configurações" (Issue 3):** novo `@PluginMethod openAppSettings()` nativo (ACTION_APPLICATION_DETAILS_SETTINGS). Substitui `intent://` URL quebrado.
- **Back button (Issue 4):** double-press to exit no main screen, desabilitado durante workout.
- **Google OAuth logging (Issue 5):** logs detalhados de credencial, idToken, signInWithCredential.
- **Distance pause fix (Issue 6):** `isPausedRef` → GPS só computa distância quando `!isPausedRef.current`. Mapa continua.
- **Audio ducking (Issue 7):** `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` em vez de EXCLUSIVE. Música reduz ~80% sem pausar.
- **Workout end flow (Issue 8):** TTS duplo — "concluído, parabéns!" na última etapa + "olhar seu relatório" ao finalizar.
- **APK 1.0.4 rebuild:** assembleDebug OK (6.8 MB).

## Concluído — 2026-07-05e

- WorkoutTracker layout: removido espaço vazio esteira; mapa h-44 fixo; sem scroll
- Sticky header: -top-4 → top-0
- GPS warmup + modal background
- Full-screen Android (IMMERSIVE_STICKY)
- Google Login prod (skipNativeAuth:true)
- APK 1.0.4 rebuild (6.4 MB)

## Concluído — 2026-07-05

- Fix OAuth invalid_client + bad request + deploy

## Concluído — 2026-07-04b

- Calendário mensal expansível (MonthCalendar)
- Export iCal (.ics)
- Reagendar movido para modal
- Bloqueio de digitação manual input date
- Escala iniciante 6-52 semanas
- Marcador de prova
- Light mode corrigido

## Concluído — 2026-07-10c (UX Fixes + CSP)
- **Toast centralizado:** `bottom-24 left-1/2` — 100px do fundo da tela
- **Botão Nav Back:** Android back button fecha modais/telas (perfil, histórico, gerador, workoutToStart, exclusão, reagendamento, calendar, signup). Desabilitado durante workout
- **Input auto-select:** campo "Repetir bloco" seleciona texto no foco
- **CSP Android:** `captureInput: true` + `androidScheme: 'https'` adicionados — **TESTAR NO DEVICE se foto carrega**

## Concluído — 2026-07-10b (Fix TTS + APK)
- **Fix TTS repetitivo:** `spokenCompletionRef` no WorkoutTracker — TTS de conclusão dispara apenas 1 vez na transição para treino livre
- **APK gerado:** `Corre Logo v1.0.apk` (versionCode 2→3), pipeline `build:apk` validado

## Concluído — 2026-07-10 (5 Melhorias)

- **Loading screen:** skeletons → tela centralizada com logo seta-rastro SVG + spinner circular + "Corre Logo"
- **CSP meta tag:** adicionado `Content-Security-Policy` no `index.html` com `img-src https://lh3.googleusercontent.com` — fotos Google Profile carregam no WebView
- **APK export automation:** `scripts/export-apk.ps1` extrai versionName, copia APK, incrementa versionCode. Script `build:apk` no package.json
- **Reschedule cascade:** modal com dois modos (single/cascade) — cascade aplica delta a planos do mesmo `generatedFromProgramId`
- **Áudio ducking fix:** `setWillPauseWhenDucked(true)` no Kotlin + timer `max(500, text.length * 60)` no voice.ts

## Pendente

- **Skeleton loading visível até 5s** — considerar reduzir timeout (agora menos crítico com loading screen)
- **favicon.ico 404** — cosmético
