# TODO — Corre Logo

> Arquivo persistente de tarefas.
> Pendentes organizados por prioridade. Concluídos organizados por data.

---

## Pendentes

### Alta (imediato)
- [ ] **FTMS: re-testar os 3 modos com o APK corrigido** — teste no device (2026-08-12) mostrou que A/C leem mas não controlam (Set → `0x05` Control Not Permitted, esteira não em estado Started) e o modo B não gerou log. Diagnóstico corrigido (0x07 É Start, ver Concluídos 2026-08-12): auto-Start (0x07) agora vai antes do 1º Set em TODOS os modos + log sempre visível (IS_PENDING removido). Testar de novo e escolher o modo vencedor para fixar como padrão. Ver CHANGELOG 2026-08-12
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

---

## ✅ Concluídos (Sessão 2026-08-12 — FTMS: correção do diagnóstico + auto-Start em todos os modos + log visível)

- [x] **Teste no device (3 modos) analisado** — esteira `A0:BB:3E:DC:25:4E`: A/C concedem Request Control (`0x01`) e leem 2ACC/2AD4/2AD5, mas **todo Set → `0x05 Control Not Permitted`**; B **não gerou log**. 2ACC Target Setting Features `0x0010` (só HR); status 2ADA `0x02`/`0x05`; sem char vendor `d18d2c10-...` (preamble N/A)
- [x] **Correção de diagnóstico** — a sessão 2026-08-05c estava errada: **`0x07` É Start/Resume** na spec FTMS (pycycling, ExFTMS, spec PDF); `0x05` é Set Target Power. `encodeStart()` (0x07) SEMPRE esteve certo — não alterado
- [x] **Root cause real** — spec só permite Set Speed/Incline com a esteira **Started**; A/C nunca enviam Start; B era o único que enviava (e não logou)
- [x] **Fix `TreadmillBleService.sendCommand`** — **auto-Start (0x07) antes do 1º Set em TODOS os modos**; lógica otimista (Set pendente até métricas/2s) permanece B-only
- [x] **Labels de Fitness Machine Status corrigidos** (0x01 Stopped/Paused, **0x02 Stopped by Safety Key**, 0x04 Started, 0x05/0x06 Target Changed...) + **hint no log** para Set rejeitado com `0x05` (esteira não Started → partida manual/safety key)
- [x] **`BleSessionLog` sem `IS_PENDING`** — arquivo sempre visível em `Download/CorreLogo/` mesmo se o app for morto antes do `finish()` (explica o "modo B sem log")
- [x] **Validação** — `npm test` ✅ 83/83 · lint ✅ 0 novos (baseline 21) · `.env.apk→.env` ✅ · `npm run build` ✅ (6.99s) · `cap sync android` ✅ (9 plugins) · `gradlew assembleDebug` ✅ BUILD SUCCESSFUL
- [ ] **Aguardando**: re-teste dos 3 modos com o APK corrigido — ver se o Start (0x07) destrava os Sets e se o modo B agora gera log; depois fixar o vencedor como padrão

---

## ✅ Concluídos (Sessão 2026-08-05c — Seletor de modo FTMS A/B/C + log em arquivo sem logcat)

- [x] **Seletor de modo de conexão FTMS** — long-press 3s (ou toque) no botão "Conectar esteira Bluetooth" do configurador de treino abre modal A/B/C; modo é usado no `connect` e exibido no badge de conexão. 1 APK com seletor (usuário confirmou; não 3 APKs)
- [x] **Estratégias** — **A** (estrito: spec, aceita result code `0x01` e `0x00` legacy), **B** (otimista: fire-and-forget, auto-Start `0x07` antes do 1º comando, Set pendente até métricas ou 2s, grant por write-ack/metrics/exaustão — estilo KS Fit/duhow), **C** (instrumentado: dump de características do serviço FTMS, lê 2ACC/2AD4/2AD5, vendor preamble WiLinktech `d18d2c10-...` com payload `01 00 0d 00 06 0b 0f 0d` antes do Request Control se a char existir)
- [x] **Mapa de result code corrigido p/ spec** — `0x01=Success`, `0x02` Op Not Supported, `0x03` Invalid Param, `0x04` Operation Failed, `0x05` Control Not Permitted, `0x00` como "Success (legacy)"; critério de sucesso aceita `0x01`/`0x00`; Request Control rejeitado com `0x04` (WiLinktech) é tolerado e segue com controle
- [x] **Log em arquivo sem logcat** — `BleSessionLog.kt` (novo): escreve em `Download/CorreLogo/ftms-modo{X}-yyyyMMdd-HHmmss.log` via MediaStore (minSdk 29, sem permissão), flush a cada 25 linhas, nome do arquivo propagado ao app (`treadmillLogFile` + `onLogFile`). Cada evento GATT/CP/CCCD/keep-alive logado
- [x] **Canal de ack real** — assinatura do **2ADA** (Fitness Machine Status) com notificação + log do opcode; CCCD escritos escalonados 100/250/450ms (WiLinktech descarta CCCD escritos em cadeia)
- [x] **Pipeline TS/Android completo** — `ble-transport.ts`/`native-ble-transport.ts`/`use-treadmill.ts` com `mode` + `logFile`; `TreadmillBlePlugin.connectTreadmill` aceita `mode`; `TreadmillFtmsManager.encodeStart()` (0x07) adicionado
- [x] **Testes** — `npm test` ✅ 83/83 (3 novos: logFile por modo, modos A/B/C no mock) · lint ✅ 0 novos (baseline 21) · `.env.apk→.env` ✅ · `npm run build` ✅ · `cap sync android` ✅ (9 plugins) · `gradlew assembleDebug` ✅ BUILD SUCCESSFUL
- [x] **Teste no device realizado** (2026-08-12) — A/C concedem controle mas Sets tomam `0x05`; B sem log. Diagnóstico e fix na seção 2026-08-12 acima

---

## ✅ Concluídos (Sessão 2026-08-05b — Fix telemetria FTMS + control point response)

- [x] **Fix speed lido como inclinação ×10** — `ftms-protocol.ts` `parseTreadmillMetrics` reescrito com flag map **padrão FTMS** (bit0 = More Data invertido; bit1 avg speed; bit2 distância 24-bit; bit3 inclinação+ramp; bit7 energia; bit8 HR; bit10 elapsed; leituras bounds-guarded). Root cause confirmado pelo diagnóstico nRF (`0x078C`) e parser duhow
- [x] **Fix Control Point response** — `TreadmillBleService.kt` + `TreadmillFtmsManager.kt`: spec `[0x80][opcode][result]` (antes lia `[1]` como result → Request Control rejeitado virava sucesso/CONTROLLED falso)
- [x] **MockTransport corrigido** — packet padrão `0x040C` (speed + distância 24-bit + incline + ramp + elapsed) e respostas `[0x80, opcode, 0x00]`
- [x] **Testes reescritos (TDD)** — `ftms-protocol.test.ts` + `ble-transport.test.ts`; `npm test` ✅ 79/79 · lint ✅ 0 novos · build ✅ 5.65s · cap sync ✅ · gradle ✅ BUILD SUCCESSFUL
- [ ] **Aguardando**: teste no device — speed manual deve aparecer como speed; inclinação manual lida; comandos não resetarem pra 0.0. **Verificar escala de inclinação** (~6× maior = BH iConcept, escala 62.5, precisa detecção `T01_XXXXX`)
- [ ] **⚠️ Novo sintoma (teste pós-fix)**: "Falha ao assumir controle da esteira" ao conectar. Hipótese principal confirmada por pesquisa: **result code Success é 0x01 (spec), nosso código usa 0x00** (mapa deslocado de 1) → nem grant passa no `== 0x00`. Alternativa: esteira WiLinktech rejeita Request Control com `0x04` de propósito (comportamento esperado, seguir mesmo assim)

---

## ✅ Concluídos (Sessão 2026-08-05 — Fix BLE error 133)

- [x] **Fix `Write failed: error 133`** (`6ed3498`, pushado) — `TreadmillBleService.kt`: fila GATT serializada (main handler, um write por vez), API 33+ `writeCharacteristic(char, value, writeType)` sem mutar `char.value`, retry 200ms (`pendingRetry`, drop após 10 tentativas), keep-alive **por idle** (renova Request Control só após 25s sem write OK, checando a cada 5s) no lugar do spam de 2s, desistência silenciosa do keep-alive após 2 falhas (sem toast), CCCD NOTIFY como fallback p/ control point sem `PROPERTY_INDICATE` (BH iConcept)
- [x] **Validação** — `compileDebugKotlin` ✓ · `.env.apk→.env` ✓ · `npm run build` ✓ (7.03s) · `cap sync android` ✓ (9 plugins) · `gradlew assembleDebug` ✓ BUILD SUCCESSFUL
- [ ] **Aguardando**: CI (firebase-deploy.yml) → baixar release `latest` → testar no device Samsung/Android 13+: conexão > 25s parado e depois mudar velocidade/inclinação sem o erro 133

---

## ✅ Concluídos (Sessão 2026-08-01b — Milestones/Conquistas COMPLETA: Tasks 7–15 + build)

- [x] **Plano completo aprovado** pelo usuário (após revisão dos testes Tasks 1–6)
- [x] **Task 7** `e8a8485` — TabBar.tsx (4 abas, ícone Tabler `run`; `ReactNode` importado de `'react'` — sem `@types/react`)
- [x] **Task 8** `533b9d4` — SessionHistory → aba Registros (remove onClose/overlay)
- [x] **Task 9** `fc2902b` — UserProfile → aba Perfil + Preferências → Tema (Escuro/Claro)
- [x] **Task 11** `25e458d` — Achievements.tsx (layout C) — antes da Task 10 (dependência)
- [x] **Task 10** `c0b8b80` — App.tsx: `activeTab`, back handler, header só logo, abas por condicional, `onExportSession`/`onDeleteSession` movidos (fonte única), TabBar no rodapé com guard de estados transientes
- [x] **Task 12** `af33509` — SessionSummary: celebração (🏆/🎖️ âmbar) após a grade 2×2
- [x] **Task 13** `fb3e4fa` — ShareCard: pill `★ Novo recorde` (4 variantes) + fix clip RouteSVG (pad 10)
- [x] **Task 14** `45ddc6b` — BLE: TreadmillBleService delay 15s + use-treadmill timeout 16s
- [x] **Task 15** — validação completa: npm test 76/76 · lint 21 (0 novos) · `Copy-Item .env.apk→.env` · `npm run build` ✓ · `cap sync android` ✓ (9 plugins) · `gradlew.bat assembleDebug` ✓ BUILD SUCCESSFUL · docs (CHANGELOG `[2026-08-01b]`, HANDOFF, TODO, spec emenda)
- [ ] **Aguardando**: push `main` → CI → release assinada → validar no device (abas, conquistas, celebração, pill, BLE 15s)

---

## ✅ Concluídos (Sessão 2026-08-01a — Milestones: spec + plano + data layer Tasks 1–6)

- [x] **Spec de Milestones/Conquistas + Tab Bar aprovado** e commitado (`1b42783`, junto com `TODO.md`)
- [x] **Decisões finais do usuário**: cor da aba ativa = accent; `prResults` transitório (só no `selectedSession` em memória); clip RouteSVG + BLE 15s **entram nesta build**
- [x] **Plano de implementação escrito** em `docs/superpowers/plans/2026-08-01-milestones.md` (15 tasks, código inline, self-review sem placeholders) — commitado em `084fc7e`
- [x] **Task 1** `50a9067` — records.ts: tipos, PR_DISTANCES, BADGE_LABELS/GROUPS, computeCrossingTime (TDD, 5 testes)
- [x] **Task 2** `2445c5d` — applySessionToRecords (PRs → longest → volume → badges; 12 testes)
- [x] **Task 3** `b897988` — recomputeRecords (delete: PRs+longest recuam; badges/volume intactos; 3 testes)
- [x] **Task 4** `7302f4c` — backfillRecords (ordem cronológica) + readRecords/saveRecords (localStorage + Firestore `data/records`, sem merge)
- [x] **Task 5** `165a60f` — PrResults + `prResults?: PrResults` em types.ts
- [x] **Task 6** `0ae24e2` — wiring no App: estado records, hook markAsCompleted, backfill no init, recompute nos 3 deletes
- [x] **Validação**: npm test 76/76 (21 novos) · lint 21 (baseline, 0 novos)
- [x] **Tasks 7–15 concluídas** em seguida (Sessão 2026-08-01b — ver seção acima)

---

## ✅ Concluídos (Sessão 2026-07-31o — APK 147 boot quebrado: ErrorBoundary renderizava undefined + fix + guard)

- [x] **APK 147 quebrou o boot de novo** (mesmo sintoma do 138): splash some → tela azul, sem erro de console.
- [x] **Causa raiz (provada por headless + teste)**: ErrorBoundary fazia `return (this as unknown as Props).children` → compila para `this.children` (undefined; React guarda em `this.props.children`) → App nunca montava, sem lançar erro.
- [x] **Correção**: `return this.props.children;` + `props: Props;` (TS sem @types/react).
- [x] **Guard**: `error-boundary.test.tsx` (renderiza children + fallback). Antes: `''` (boot morto); depois: passa.
- [x] **Validação**: npm test 55/55 · lint 21 (baseline, 0 novos) · build ✓ · cap sync ✓ · gradle ✓ · boot headless root 862 chars ✓
- [x] **Release 148 publicada** (CI run #48, versionCode 148 > 147 quebrado) — auto-update no device deve puxar e o app subir normalmente
- [ ] **Aguardando**: validar no device que o app sobe (logo + spinner → home) + teste na esteira

---

## ✅ Concluídos (Sessão 2026-07-31n — APK 138 root cause + re-aplicação dos 4 fixes + guard)

- [x] **Causa raiz do APK 138 (tela azul no boot)**: TDZ em `use-treadmill.ts` (a555426) — `clearScanTimeout` declarada depois do `useEffect(..., [clearScanTimeout])` → ReferenceError em todo render → app nunca montava. CI passou porque nenhum teste monta App/hook; tsc/vite não pegam TDZ.
- [x] **Correções #1–3 re-aplicadas verbatim** (ShareScreen/ShareCard/shareCard.ts — byte-idênticos ao a555426, conferidos por hash)
- [x] **Correção #4 re-aplicada corrigida** (ordem de hooks certa; scan indicator 11s; limpeza em connect/disconnect/catch/unmount)
- [x] **Guard de regressão**: `use-treadmill-boot.test.tsx` (probe SSR — teria falhado no 138) + `ErrorBoundary.tsx` na raiz
- [x] **Validação**: npm test 53/53 · lint 0 erros novos · build ✓ · cap sync ✓ · assembleDebug ✓
- [ ] **Aguardando**: commit + push → CI → release `latest` → validar auto-update no device (tela azul não repetir) + teste na esteira pendente

---

## ✅ Concluídos (Sessão 2026-07-31m — BLE: Set Speed/Incline não funcionavam + keep-alive real)

- [x] **Bug 1** (commit `43517e1`, já publicado como APK 142): `processNextCommand()` lia `data` mas nunca setava `char.value = data` antes de `writeCharacteristic()` — write era no-op. Também: `enableNotifications()` encadeava 2 `writeDescriptor` sem chaining; `requestControlWithRetry()` era chamado em paralelo.
- [x] **Bug 2** (commit `904e32d`, k publicado como APK 144): `setTreadmillSpeed/Incline` não verificavam `state == Controlled` — comandos eram enviados antes do Request Control success. **Fix**: agora rejeita com mensagem clara se não está controlado.
- [x] **Bug 3** (commit `904e32d`): **Control lease expiry**. Sem reenvio de Request Control, esteiras podem revogar controle após ~5-30s de silêncio. **Fix**: `startKeepAlive()` agora reenvia Request Control a cada **2s** enquanto `state == Controlled`. O método existia mas era dead code (nunca chamado, `lastCommand` nunca setado).
- [x] **Logs diagnósticos**: `onCharacteristicChanged` agora loga **opcode + resultCode** de cada Control Point response (Success / Op Code Not Supported / Invalid Parameter / Operation Failed / Control Not Permitted). Crucial para a próxima sessão na academia.
- [x] **State exposto**: `TreadmillBleService.state` agora é propriedade pública read-only (plugin precisa checar).
- [x] **Build**: `gradlew compileDebugKotlin` ✅ · `gradlew assembleRelease` ✅ (37s)
- [x] **CI run `30677054250`** succeeded; release `latest` → **versionCode 144** (3.4), APK 22 MB, auto-update disponível
- [x] **Próximo passo (user)**: testar esteira no device. **Se ainda falhar**:
  1. Instalar Logcat Reader (Play Store)
  2. Filtrar por `CorreLogo-BLE`
  3. Reproduzir problema (conectar + mudar velocidade/inclinação)
  4. Enviar log para mim — vai dizer qual `resultCode` esteira está retornando
- [x] **Simulador FTMS**: pesquisei — existe `swiftcheetah` (iOS) e `Simcline-V2/V3` (Arduino/ESP32) mas nenhum Android central. Criar simulador Android BLE peripheral — trabalho grande, não compensa vs logcat + retry.

---
## ✅ Concluídos (Sessão 2026-07-31i — Share Cards/Adesivos: implementation complete)

- [x] **Task 1**: `splits.ts` — pace por km/bloco 5km + fallback (`choosePaceBlocks`, `formatPaceShort`) — 9 testes
- [x] **Task 2**: `gradients.ts` — 6 presets + swoosh `#FF006E` — 3 testes
- [x] **Task 3**: `card-map.ts` — Web Mercator tiles `dark_all` 816×816, rota SVG, sem Leaflet — 8 testes
- [x] **Task 4**: `ShareCard.tsx` 4 variantes (A: pace | B: left | C: bottom | D: map) — 3 testes
- [x] **Task 5**: `SocialSharePlugin.kt` — `saveToGallery` (MediaStore) + `shareToWhatsApp` (intent `com.whatsapp`) — SDD reviewed
- [x] **Task 6**: `shareCard.ts` — `saveCardToGallery(blob)`, `shareToWhatsApp(blob)` wrappers TS
- [x] **Task 7**: `ShareScreen.tsx` — abas Cartões/Adesivos, carrossel 4 variantes, EditPanel inline, `@capacitor/camera@^7` Base64 photo, ações Story/WhatsApp/Mais/Salvar PNG + Copiar
- [x] **Task 8**: `SessionSummary.tsx` — substituiu modal legado por `ShareScreen`, limpeza de estado/imports mortos
- [x] **Pipeline completo validado**: `npm run build` ✅ · `npm test` (52/52) ✅ · `lint` (só 2 pré-existentes) ✅ · `cap sync` ✅ (9 plugins) · `gradlew assembleDebug` ✅

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
