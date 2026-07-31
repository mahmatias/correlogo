# TODO — Corre Logo

> Arquivo persistente de tarefas.
> Pendentes organizados por prioridade. Concluídos organizados por data.

---

## Pendentes

### Alta (imediato)
- [ ] **Implementar Share Cards/Adesivos** — SDD plan `docs/superpowers/plans/2026-07-31-share-cards.md` (8 tasks, subagent-driven):
  - [x] Task 1: `splits.ts` (pace splits por km/5km)
  - [x] Task 2: `gradients.ts` (6 presets)
  - [x] Task 3: `card-map.ts` (Web Mercator, tiles CARTO dark_all, 816×816)
  - [x] Task 4: `ShareCard.tsx` 4 variantes (A: pace | B: left | C: bottom | D: map)
  - [x] Task 5: `SocialSharePlugin.kt` — `saveToGallery` + `shareToWhatsApp` (nativo) — **review passed, minSdk bumped to 29**
  - [ ] Task 6: TS wrappers em `src/lib/shareCard.ts` (`saveToGallery`, `shareToWhatsApp`)
  - [ ] Task 7: `ShareScreen.tsx` (abas Cartões/Adesivos + EditPanel inline) + `@capacitor/camera@^7`
  - [ ] Task 8: Wiring em `SessionSummary.tsx` + pipeline completo (`npm run build` → `cap sync` → `gradlew assembleDebug`)
- [ ] **Figurinha no Stories — dívida técnica (nova abordagem)** — usuário estudando como outros apps fazem (a Meta parece exigir processo/asset específico além do PNG transparente). Investigar alternativas: `MediaSharePlugin` do Capacitor (intent nativo `com.instagram.share.ADD_TO_STORY`), share sheet nativo do Android, ou plugin `@capacitor/share` com MIME correto
- [ ] **AGENTS.md desatualizado** — seção "Production Infrastructure" ainda descreve EC2/PM2/Nginx/`correlogo.sytes.net`, mas AWS foi desativada (hoje: Firebase Hosting + Cloud Functions + Firestore). Reescrever para refletir stack atual
- [ ] **Alinhar deps Capacitor** — `@capacitor/app@8.1.0`/`@capacitor/browser@8.0.3` exigem core 8, projeto está no core 7.6.7 (invalid no `npm ls`). Reverter para v7 ou migrar tudo para v8
- [ ] **Permission intent Health Connect** — `PermissionController.createIntent()` não resolve no device do usuário. Próximo passo: depurar `health-connect://permissions` deep link ou tentar `Intent(ACTION_VIEW, Uri.parse(...))` alternativo
- [ ] Botão Nav Back — quando modal de treino manual está aberto, back deve fechar modal (não app)
- [ ] Foto do perfil — exibição com problemas (dívida técnica)

### Média
- [ ] Dados PII (gênero, data nascimento) — coletados mas nunca utilizados
- [ ] Performance (P5) — useCallback / React.memo — reavaliar no estado atual
- [ ] firestore.indexes.json — reavaliar necessidade de versionamento
- [ ] Estrutura de dados (D2) — migrar para subcoleção — reavaliar se ainda necessário
- [ ] setDoc sem merge (D7) — reavaliar se ainda causa sobrescrita
- [ ] Sem onSnapshot (D8) — abas dessincronizadas — reavaliar necessidade de tempo real
- [ ] Gerador complexo (U2) — 15+ campos — reavaliar se ainda precisa simplificar
- [ ] Visão de progresso (U3) — streak, evolução, PRs — reavaliar
- [ ] Termos de Serviço (U10) — criar conteúdo (link quebrado)
- [ ] Re-exportação após fechar summary (U14) — reavaliar no estado atual

---

## ✅ Concluídos (Sessão 2026-07-31h — minSdk 29 + Task 5 SDD review + full pipeline)

- [x] **Task 5 review (SDD)**: reviewer found `saveToGallery` uses API 29+ MediaStore APIs (`VOLUME_EXTERNAL_PRIMARY`, `RELATIVE_PATH`, `IS_PENDING`) but `minSdk=26` → method always failed on Android 8/9
- [x] **Decision**: user chose Option 2 — raise `minSdkVersion` 26→29 (drops Android 8/9 support) instead of legacy path + WRITE_EXTERNAL_STORAGE permission
- [x] **Applied**: `android/variables.gradle` — `minSdkVersion = 29` (compileSdk/targetSdk kept at 36)
- [x] **Full pipeline validated**: `npm run build` ✅ (6.93s) · `npx cap sync android` ✅ (0.14s, 8 plugins) · `gradlew assembleDebug` ✅ (19s, 315 tasks up-to-date)
- [x] **CHANGELOG.md** + **HANDOFF.md** updated with decision and build evidence
- [x] Task 5 implementation now valid for entire supported range → Task 6 can proceed without SDK guards

## ✅ Concluídos (Sessão 2026-07-31g — Share Cards/Adesivos: design fechado)
- [x] **Mock v1→v6** (`mockups/share-cards.html`): 4 cards aprovados no celular (stats+pace / stats esquerda / stats embaixo / mapa real 816×816 tiles `dark_all`), logo uniforme 60px, 6 presets de gradiente, área útil y 350–1650. Fix colisão `.t.logo` (block flow puro).
- [x] **Decisões de design**: edição inline (painel colapsável, não modal); Salvar Cartões → Galeria MediaStore; Adesivos → PNG transparente + Copiar; foto de fundo `@capacitor/camera@^7` (cards 1–3); `@capacitor/share` não tem `packageName` → `shareToWhatsApp` nativo + fallback.
- [x] **Spike CORS tiles + dom-to-image passou** → card 4 sem Leaflet (tiles `<img>` + SVG).
- [x] **Spec de design**: `docs/superpowers/specs/2026-07-31-share-cards-design.md`
- [x] CHANGELOG/HANDOFF/TODO atualizados. Commit `[skip ci]`.

## ✅ Concluídos (Sessão 2026-07-31f — Housekeeping: auditoria de limpeza)
- [x] **Auditoria** de arquivos/deps/scripts/docs mortos (5 grupos, aprovada pelo usuário: G1–G4 deletar, G5 arquivar)
- [x] **G5 arquivado** em `docs/archive/` (git mv): 13 docs históricas + `superpowers/` + `FTMS-Bluetooth-Esteiras/` (+zip) + `GitHub-Actions-Firebase-APK/` (+zip) + `.firecrawl/` → `firecrawl-research/`
- [x] **G1 removido**: `install_server.sh`, `server.err`, `server.log`, `dist.tar.gz`, `cert/`, `Corre Logo v2.2.apk`, `metadata.json`
- [x] **G2 removido**: segredos CI em disco (`gh_env_base64.txt`, `gh_firebase_cred_base64.txt`, `gh_keystore_base64.txt`)
- [x] **G3 des-commitado**: `.firebase/hosting.ZGlzdA.cache` (cache commitado em `8de8624`) + `.firebase/` no `.gitignore`; `docs/Download/` (logcats) e `logs/` deletados
- [x] **G4**: `autoprefixer` + `tsx` removidos do package.json (deps mortas). **`react-is` mantido** — recharts importa em runtime (build provou)
- [x] **Validação**: `npm install --legacy-peer-deps` ✅ · `npm run build` ✅ (2381) · `npm test` ✅ (29/29) · `npx cap sync android` ✅ (android/ sem diff)
- [x] **Links corrigidos**: `docs/wiki/tracking/ftms.md`, `docs/wiki/architecture/folder-structure.md`, `HANDOFF.md`, `TODO.md`
- [ ] **Pendente**: commit + push da limpeza (65 mudanças staged) — decidir `[skip ci]` ou aguardar mudança de código

## ✅ Concluídos (Sessão 2026-07-31d — v3.4 sticker de verdade: PNG transparente + intent Instagram spec)
- [x] **Retorno do usuário (feedback pós-release)**: Auto-update 3.2→3.4 de ponta a ponta ✅ · Overlay do mapa ✅ · Copiar PNG transparente ✅ (cola como texto no story) · Figurinha no Stories ❎ (dívida técnica)
- [x] **Infra**: AWS/EC2/`correlogo.sytes.net` **desativados** pelo usuário — sistema roda 100% em Firebase (Hosting `correlogo.web.app` UP 200, `/api/health` → `{"status":"ok"}`, Firestore `correlogo-prod`, APK aponta `correlogo-prod`)
- [x] **Docs rewrite (sessão docs)**: AGENTS.md (seção "Production & Deploy — Firebase Only"), README.md, `docs/todo.md` → redirect para TODO.md, wiki 7 páginas (web-deploy sem AWS/nginx/certbot, env-vars sem APP_URL morto, stack/overview atualizados, changelog wiki com v3.0→v3.4, ADR-010 AWS decommissioned), nota histórica no ui-audit-report
- [x] Causa raiz (copy + sticker): véu `bg-black/30` no card variante Foto tornava o PNG "transparente" com cor
- [x] `ShareCard.tsx`: véu removido — só o texto tem opacidade, resto opacidade 0
- [x] `SocialSharePlugin.kt`: `setPackage` + `setDataAndType` no intent principal (primary = bg ?? sticker) + extras `background_image_uri`/`interactive_asset_uri` + `grantUriPermission`
- [x] Builds ✅ `npm run build` + `npx cap sync android` + `gradlew assembleDebug` (APK debug com chunk novo verificado)
- [x] Release 3.4 (135) validada via aapt: versionCode 135, `REQUEST_INSTALL_PACKAGES` ok, `bg-black/30` ausente, App ID ok

## ✅ Concluídos (Sessão 2026-07-31c — v3.3 fix overlay mapa/modal)
- [x] Causa raiz: `MapComponent` raiz com `relative` sem z-index → z-index do Leaflet (400/1000) vencem o modal de compartilhamento `z-60` no stacking context da raiz do SessionSummary (`z-50`)
- [x] Fix: `relative z-0` no raiz do `MapComponent` (cria stacking context, confina os z-index do Leaflet)
- [x] Builds ✅ `npm run build` + `npx cap sync android` + `gradlew assembleDebug`

## ✅ Concluídos (Sessão 2026-07-31b — v3.2 auto-update bootstrap)
- [x] Causa raiz do "fecha modal e não atualiza": `AndroidManifest.xml` sem `REQUEST_INSTALL_PACKAGES` → Android 8+ bloqueia instalação programática
- [x] `ApkInstallerPlugin.kt`: `canRequestPackageInstalls()` + `openInstallSettings()` (`ACTION_MANAGE_UNKNOWN_APP_SOURCES`) + pre-check nativo `INSTALL_BLOCKED`
- [x] `update-checker.ts`: wrappers `canInstallApk`/`openInstallSettings`; `_onProgress` removido (código morto); validação do APK baixado (magic `UEsD`)
- [x] `UpdatePrompt.tsx`: progresso indeterminado + tela de permissão de instalação
- [x] `App.tsx`/`UserProfile.tsx`: rota única pelo modal (`onUpdateAvailable`) — resolve "botão do perfil só roda"
- [x] Builds ✅ `npm run build` + `npx cap sync android` + `gradlew assembleDebug`

## ✅ Concluídos (Sessão 2026-07-30j — v3.0.2 auto-update definitivo)
- [x] Causa raiz real: GitHub Releases sem `Access-Control-Allow-Origin` + CORS da WebView → "Failed to fetch" (auto-update nunca funcionou em device)
- [x] `checkForUpdate` + `downloadApkAndInstall` via `CapacitorHttp.get()` nativo (OkHttp, sem CORS); web mantém `fetch`
- [x] Download APK: `responseType: 'blob'` → base64 direto para o Filesystem
- [x] Builds ✅ `npm run build` + `npx cap sync android` + `gradlew assembleDebug`

## ✅ Concluídos (Sessão 2026-07-30i — v3.0.1 fix auto-update)
- [x] Causa raiz: `checkForUpdate` mascarava toda falha como "up to date" (fetch/timeout/cache stale)
- [x] Cache-buster `?v=Date.now()` + `cache: 'no-store'` no manifest
- [x] Retorno `UpdateCheckResult {update, error}` — erro real exibido no toast
- [x] "Versão instalada: X (build Y)" na seção de atualização do app
- [x] Builds ✅ `npm run build` + `npx cap sync android` + `gradlew assembleDebug` + `vitest` (29 testes)

## ✅ Concluídos (Sessão 2026-07-30h — v3.0 Instagram Stories direto + Copiar PNG modo Foto)
- [x] `SocialSharePlugin.kt` nativo — intent `com.instagram.share.ADD_TO_STORY` (background/sticker) + `copyImageToClipboard`
- [x] Botão "Copiar imagem" no modo Foto (variante d) — `SessionSummary.tsx`
- [x] `shareCard.ts` — `shareToInstagramStories` background/sticker com fallback; `copyCardToClipboard`
- [x] `VITE_FACEBOOK_APP_ID=1604373561408021` no `.env.apk`
- [x] `versionName` 2.2 → 3.0
- [x] Builds ✅ `npm run build` + `npx cap sync android` + `gradlew assembleDebug` (33s)

## ✅ Concluídos (Sessão 2026-07-29c — Permission Flow Refactoring)
- [x] Health ConnectPlugin refatorado: `startActivityForResult` → `activity.startActivity(intent)` direto
- [x] `handleOnActivityResult()` + `pendingPermCall` removidos (dead code no Capacitor 7)
- [x] Fallback chain: PermissionController → Play Store → app settings
- [x] APK v1.6 build + validado (`npm run build` ✅, `gradlew assembleDebug` ✅)

## ✅ Concluídos (Sessão 2026-07-29 — 4 Bug Fixes + Samsung Health Plan)

| Item | Resultado |
|------|-----------|
| **Bug #1: Timer durante countdown** | JS timer retorna early em modo esteira+nativo. Native timer é única fonte da verdade |
| **Bug #2: Distância pulando na troca de passo** | Acúmulo incremental via `prevElapsedRef` — `distRef.current += delta * dPerSec` |
| **Bug #3: TTS metade não disparava** | `lapElapsed` local + refs em vez de `lapSeconds` estale do closure |
| **Bug #4: Volume música não restaurava** | `setWillPauseWhenDucked(true)` removido do `AudioFocusPlugin.kt` |
| **Samsung Health spec** | Aprovada: `docs/archive/superpowers/specs/2026-07-29-samsung-health-integration-design.md` |
| **Samsung Health plan** | Escrito: `docs/archive/superpowers/plans/2026-07-29-samsung-health-sync.md` — 4 gaps corrigidos no pre-flight |
| **APK v1.1** | `Corre Logo v1.1.apk` gerado com sucesso |

## ✅ Concluídos (Sessão 2026-07-25 — TTS Metade + Audio Ducking + WakeLock)

| Item | Resultado |
|------|-----------|
| **TTS "Chegamos na metade dessa volta!"** | Dispara em etapas de Corrida >180s (tempo) ou 50% da distância. Ignora aquecimento/caminhada/desaquecimento |
| **TTS "Chegamos na metade do treino!"** | Dispara uma vez aos 50% do tempo total (ignorado no Treino Livre) |
| **Audio ducking fix** | `await speak()` já espera TTS terminar no Android — `abandonFocus()` imediatamente após |
| **WakeLock (foreground service)** | `PARTIAL_WAKE_LOCK` mantém CPU ativa durante treino — impede morte do serviço ao apagar tela |

## ✅ Concluídos (Sessão 2026-07-21b — Migração Firebase)

| Item | Resultado |
|------|-----------|
| **AWS → Firebase Hosting + Cloud Functions** | Deployado em `correlogo.web.app` |
| **Cloud Function authCallback** | Funcionando (web + APK OAuth) |
| **Cloud Function healthCheck** | Funcionando |
| **Limpeza deps server** | express, helmet, cors, dotenv, esbuild removidos |
| **server.ts removido** | Substituído por Firebase Hosting |
| **CSP via firebase.json** | Headers de segurança no hosting |
| **APK v1.0 (versionCode 8)** | OAuth + export funcionando |
| **Firestore rules** | Publicadas via Console |

## 🐛 Em Correção / Teste (Sessão 2026-07-21)

| Item | Status | Ação Necessária |
|------|--------|-----------------|
| **Export TCX/GPX Android** | ✅ Implementado + Testado | OK |
| **Mapa resumo (web 10px)** | ✅ Corrigido | OK |
| **Mapa APK inexistente** | ✅ Corrigido | OK |
| **CSP tiles mapa** | ✅ Corrigido | OK |
| **Firestore rules dev** | ✅ Publicadas | OK |
| **Foto do perfil** | ⚠️ Problema conhecido | Investigar exibição (dívida técnica) |
| **Reschedule cascade** | ⚠️ Código implementado | Testar em conjunto: criar plano em usuário diferente |
| **Botão Nav Back** | ❌ Bug confirmado | Corrigir: quando modal aberto, back deve fechar modal (não app) |
| **CSP meta tag** | ✅ Em teste | Continuar testando durante a semana |
| **Áudio ducking** | ✅ Corrigido (2026-07-25) | `await speak()` espera TTS terminar — `abandonFocus()` imediatamente após |

---

## Concluídos

### 2026-07-10d — Reavaliação Geral do Projeto
- ✅ Função de Repetição na criação manual de treino
- ✅ Escalonamento de duração mínima para Standard/ImprovePace (6-52 semanas)
- ✅ Onboarding para novos usuários (tela de boas-vindas com CTAs)

### 2026-07-10c — UX Fixes (Toast, Back Button, Input Focus)
- ✅ Toast centralizado na parte inferior (bottom-24, altura reduzida, texto centralizado)
- ✅ Botão Nav Back — fecha modais/telas secundárias (exceto workout) — **bug: fecha app em vez de fechar modal**
- ✅ Input "Repetir bloco" — seleciona texto no foco

### 2026-07-10b — Fix TTS repetitivo + APK gerado
- ✅ Fix TTS repetitivo: spokenCompletionRef impede loop de "Exercício concluído, parabéns!" no treino livre
- ✅ APK gerado: Corre Logo v1.0.apk (versionCode 5)

### 2026-07-10 — 5 Melhorias (Loading, CSP, APK Export, Cascata, Áudio Ducking)
- ✅ Loading screen: skeletons → logo seta-rastro SVG + spinner + "Corre Logo"
- ✅ CSP meta tag em index.html para fotos Google Profile no Capacitor WebView — **em teste**
- ✅ APK export automation (scripts/export-apk.ps1 + npm run build:apk)
- ✅ Reschedule cascade (single + cascade mode com delta offset) — **precisa testar em conjunto**
- ✅ Áudio ducking: setWillPauseWhenDucked(true) + timer reduzido — **em teste**

### 2026-07-10c — UX Fixes (Toast, Back Button, Input Focus)
- ✅ Toast centralizado na parte inferior (bottom-24)
- ✅ Botão Nav Back — fecha modais/telas secundárias (exceto workout)
- ✅ Input "Repetir bloco" — seleciona texto no foco
- ⚠️ CSP Android — adicionado config, **precisa testar foto no device**

### 2026-07-10b — Fix TTS repetitivo + APK gerado
- ✅ Fix TTS repetitivo: spokenCompletionRef impede loop de "Exercício concluído, parabéns!" no treino livre
- ✅ APK gerado: Corre Logo v1.0.apk (versionCode 3)

### 2026-07-10 — 5 Melhorias (Loading, CSP, APK Export, Cascata, Áudio Ducking)
- ✅ Loading screen: skeletons → logo seta-rastro SVG + spinner + "Corre Logo"
- ✅ CSP meta tag em index.html para fotos Google Profile no Capacitor WebView
- ✅ APK export automation (scripts/export-apk.ps1 + npm run build:apk)
- ✅ Reschedule cascade (single + cascade mode com delta offset)
- ✅ Áudio ducking: setWillPauseWhenDucked(true) + timer reduzido

### 2026-07-04 — Kotlin TrackingPlugin (foreground GPS + step counter)
- ✅ Android `TrackingService.kt` — foreground service com GPS (FusedLocationProviderClient, 3s interval) + step counter (TYPE_STEP_COUNTER)
- ✅ Android `TrackingPlugin.kt` — Capacitor plugin (startTracking, stopTracking, getStepCount) com declarações de permissão
- ✅ `MainActivity.java` registra TrackingPlugin via `registerPlugin(TrackingPlugin.class)`
- ✅ Kotlin suporte + play-services-location adicionados ao build.gradle

### 2026-07-04 — Correções no gerador, data editing, marcador de prova
- ✅ Data editável: bloqueio de digitação manual (`onKeyDown e.preventDefault`) no input date
- ✅ Gerador iniciante: remove cap de 16 semanas; `mapTableIndex` interpola a tabela runna para qualquer duração (6-52 sem); fim do plano com data de prova insere marcador 🏁
- ✅ Marcador de prova no calendário: `isRaceMarker` no `WorkoutPlan`, bolinha amber-500 no `WeekCalendar`, legenda "Prova"
- ✅ Renderização condicional: `isRaceMarker` oculta botões de ação, duração e input de data

### 2026-07-02 — Calendário de Treinos + Fixes
- ✅ Calendário semanal horizontal (WeekCalendar) com navegação entre semanas
- ✅ BottomSheet para ações de plano (Novo Treino Manual, Treino Livre, Gerador Automático, Carregar/Substituir, Apagar)
- ✅ `scheduledDate` adicionado ao WorkoutPlan; datas atribuídas automaticamente em todos os fluxos de criação
- ✅ Lista de treinos vinculada ao dia selecionado no calendário
- ✅ Saudação personalizada ("Olá, {nome}")
- ✅ Export JSON removido da UI (atalho)
- ✅ Fix: completed plans sem `scheduledDate` aparecem com bolinha verde via `TrainingSession.date`
- ✅ Badge "X restantes" quando hoje está selecionado (total de planos incompletos)
- ✅ "Realizada em DD/MM/AAAA às HH:MM:SS" no SessionSummary
- ✅ Data programada editável (input date em cada card de plano)
- ✅ Gerador com startDate + distribuição automática de scheduledDate no calendário
- ✅ Controle de carga: sessões regenerativas para iniciante em dias excedentes a daysOfWeek
- ✅ Onboarding para novos usuários (tela de boas-vindas com CTAs)
- ✅ Deploy para produção (`a9f80b1`)

### 2026-07-01 — Google Auth + CSP
- ✅ Testar modo GPS com localização em movimento mock
- ✅ Sessões de análise pós treino, origem das informações
- ✅ Continuar como treino livre após objetivo

### 2026-06-25 — Pendências do audit
- ✅ React.lazy(SessionSummary) + MapComponent com Suspense
- ✅ Remover @google/genai, @vis.gl/react-google-maps, motion, uuid
- ✅ Substituir uuidv4() por crypto.randomUUID()
- ✅ Criar firestore.rules + firebase.json versionados
- ✅ writeBatch para deleção em lote (em vez de for...of deleteDoc)
- ✅ enableIndexedDbPersistence no firebase.ts
- ✅ Mapear erros Firebase Auth para português (Login/Signup)
- ✅ Feedback visual (toast) em falhas de save
- ✅ Onboarding / welcome screen
- ✅ Adicionar auth/missing-password ao mapa de erros pt-BR
- ✅ Corrigir feedback "salvo" ao deletar plano
- ✅ Adicionar opção de deletar atividades no histórico

### 2026-06-25 — Correções e features (pré-audit)
- ✅ Identidade visual Pôr-do-Sol (paleta, CSS variables, Geologica + IBM Plex Sans)
- ✅ Acessibilidade (aria-labels, focus-visible, roles ARIA)
- ✅ Perfil A substituído por Runna Couch-to-5K (16 semanas, 2 treinos/semana)
- ✅ Perfis B/C: teto pace Easy = refPace + 2
- ✅ Walk pace mínimo 12 min/km
- ✅ Anúncios de voz ("Caminhada", "quase lá" só em corrida)
- ✅ Treino Livre (step único 24h, isFreeTraining)
- ✅ Delete individual com flag manual
- ✅ SSH + git remoto configurado
- ✅ Cache localStorage + Promise.all + limit(50) + timeout 5s
- ✅ Sync offline→online automático
- ✅ Analytics sob demanda + timing logs
- ✅ Firestore ativado no correloco-dev-9a96a
- ✅ firebase-applet-config.json removido do git
- ✅ Componente Button (variants primary/secondary/ghost/danger, sizes sm/md/lg)
- ✅ Componente Modal (dialog/alertdialog)
- ✅ Skeleton loading (animate-pulse + bg-bg-elevated)
- ✅ Empty states com ícone + CTA
- ✅ Toast em vez de alert()
- ✅ Touch targets ≥ 44px
- ✅ text-[10px] → text-xs, truncate, opacity-70
- ✅ max-w-lg → max-w-xl
- ✅ Keyboard handlers nos controles
- ✅ Animação expand/collapse com transition

### 2026-06-25 — Fixes S3, S7, U9, U12, U13, U15
- ✅ S3. Servidor Express com helmet (CSP/HSTS/X-Frame-Options)
- ✅ S7. GOOGLE_MAPS_PLATFORM_KEY removido do vite.config.ts (morto)
- ✅ U9. Signup com link "Já tem conta? Entrar"
- ✅ U12. Botão DESCARTAR com estilo secundário (bg-bg-elevated + border)
- ✅ U13. Google Login com fallback signInWithRedirect se popup for bloqueado
- ✅ U15. Aviso explícito de "apagado permanentemente" no modal de uncomplete
