# Changelog

## [2026-08-16] — Auditoria de vazamento de credenciais (SECURITY)

### Contexto
- Usuário reportou que a URL `github.com/mahmatias/correlogo/blob/4c3afa07…/gh_firebase_cred_base64.txt` ainda serve o arquivo. Investigação completa do vazamento do commit `4c3afa07` (30/07) em repo público.

### Achados (testados empiricamente)
- **Service account vazado** (`gh_firebase_cred_base64.txt`, key `b153831c…`): **JÁ REVOGADO** — JWT assinado com a chave (self-verifica) foi rejeitado pelo Google (`invalid_grant`), mesmo com header `kid`. O `FIREBASE_CREDENTIALS` atual usa outra chave (`7d1a5796…`, confirmado no arquivo local). Nenhuma ação.
- **Keystore vazado** (`gh_keystore_base64.txt`): **keystore ANTIGO** — rotacionado pelo CI em 30/07. Senhas nunca estiveram no repo (workflow já usava secrets). Nenhuma ação.
- **`gh_env_base64.txt`**: continha `GOOGLE_CLIENT_SECRET=GOCSPX-gw4d5…` (client `550159999478`). **Ainda VÁLIDO** mas órfão (client não usado pelo código atual). Rotação/referência de client no Console.
- **NOVO ACHADO (mais grave)**: o `WEB_CLIENT_SECRET` de **produção** (`GOCSPX-eaxIk…`, client `985879764466`) estava **hardcoded em `functions/src/index.ts:5`** no repo público — **vivo** (validado via Google OAuth). O `authCallback`/`refreshAuthToken` de Calendar/Gmail o usam.
- Repo público, **0 forks** (viabiliza purge no GitHub). O blob por SHA continua acessível após rewrite — comportamento conhecido do GitHub.

### Implementado
- `functions/src/index.ts`: `WEB_CLIENT_SECRET` hardcoded → `defineSecret("WEB_CLIENT_SECRET")` (Secret Manager), com `secrets: [WEB_CLIENT_SECRET]` nas duas functions e `WEB_CLIENT_SECRET.value()` nas trocas OAuth. Client ID permanece hardcoded (público, embutido no bundle).
- `.env.apk`: removidas vars mortas/vazadas (`GOOGLE_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID` — o código sempre prefere `VITE_GOOGLE_WEB_CLIENT_ID`).
- **Purge executado**: force-push do branch `mahmatias-patch-1` (purgado, `9eaa9f5 → e6834d2`) via clone `git-filter-repo` em `%TEMP%\opencode\correlogo-purge2`. `main` e tag `latest` já estavam limpos (não alcançavam o commit vazado). Árvore do branch verificada: sem arquivos sensíveis.
- Build validado: `functions` (`tsc`) ✅ · root `npm run build` (`.env.apk→.env`) ✅.

### Rotação executada (mesmo dia)
- **`WEB_CLIENT_SECRET` rotacionado** — novo secret (`client_secret_2_985879764466…json`, secret `GOCSPX-JoOm…`) criado via "Add a new secret" no Console → `firebase functions:secrets:set WEB_CLIENT_SECRET` (versão 1) → `firebase deploy --only functions` (3 functions v2, nodejs22; healthCheck `{"status":"ok"}`; 1º deploy falhou por Compute Engine API desabilitado — fallback não-fatal, rerun passou).
- **Testado**: Google Calendar e Gmail conectados via OAuth no app ✅.
- **Secret vazado morto**: secret antigo (`GOCSPX-eaxIk…`, exibido como `****zbbr`) **desabilitado e deletado** no Console ✅.
- Modelo usado: rotação oficial do Google Auth Platform (2 secrets simultâneos → migra → desabilita → deleta) — sem re-auth de usuários, sem rebuild do bundle (client ID inalterado).

### Concluído depois
- **Órfão morto**: client `550159999478-j2a6b9gknlo9vu4t39lpvo00bijpq0tn` (projeto `correlogo-calendar`, da era AWS) **deletado** no Console — liveness test → `deleted_client`, `GOCSPX-gw4d5…` invalidado. `.env.dev` limpo (`GOOGLE_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID` removidos).
- **Commit `61d290d`** (`fix(security): mover WEB_CLIENT_SECRET para Secret Manager`) pushado — functions + CHANGELOG + TODO + HANDOFF. CI dispara release (só docs/functions, sem mudança de web/APK).

### Pendente (ação do usuário) — Ticket de purge: CONSIDERADO RESOLVIDO (2026-08-16)
1. ~~**Ticket de suporte GitHub**~~ para purgar o commit `4c3afa07` dos refs internos (`refs/pull/1/head` ainda o alcança — não é alterável via push) e do object store (blob por SHA). **Encerrado por decisão do usuário**: o portal de suporte atual não expõe mais o fluxo de remoção de dados sensíveis (a categoria "Repositories" leva ao formulário de *deleção do repositório*; o link legado `support.github.com/contact?legacy&tags=rr-remove-data` morreu e redireciona ao formulário guiado; o formulário PIRP `support.github.com/contact/private-information` existe mas atende conteúdo de terceiros, não purge do próprio repo). **Risco aceito**: todas as credenciais rotacionadas/revogadas, 0 forks, histórico local purgado. Blob por SHA e `refs/pull/1/head` permanecem acessíveis no GitHub até eventual GC — sem ação possível do nosso lado.
2. Keystore: nenhuma ação (já rotacionado).

### Nota
- O AuthCallback de dev (`.env.dev`, client `550159999478`) já estava quebrado antes desta sessão (mismatch com o client da function) — bug pré-existente, fora do escopo.

---

## [2026-08-15] — Release 4.1: import de treinos do relógio vai ao ar

### Contexto
- O feature de relógio (integrado em 13/08) nunca tinha sido **compilado em release**: todos os commits de 13/08 usaram `[skip ci]`, então nenhuma run do CI rodou depois da build 157 (run #57, `4ac1d61` de 12/08). O APK instalado não continha o código do import.
- Esta release dispara o CI de propósito (commit sem `[skip ci]`) e avança a versão para **4.1** — é a primeira build a conter o import de relógio via Health Connect.
- > **Nota (regra de versionamento de 2026-08-15):** pela regra formalizada no mesmo dia (Major = entrega grande, ex: módulo novo inteiro), esta release *deveria* ter sido **5.0**. Ficou 4.1 por decisão explícita (exceção histórica, sem release dupla). Daqui pra frente, toda entrega grande sobe a versão antes do ponto.

### Implementado
- `android/app/build.gradle`: `versionName "4.0" → "4.1"`.
- A partir desta build, a aba **Registros** exibe o botão **"Importar relógio"** (APK Android, usuário logado) — importa treinos de corrida/esteira dos últimos 30 dias do Health Connect, com dedupe por id (`watch-*`) e por horário ±2min, badge "Relógio", salvos em localStorage + Firestore.

### Validação
- Feature validada localmente em 13/08 (`npm test` 101/101, build debug OK). Compilação release via CI (`.env.apk` → `.env` no workflow).

### Próximo
- Validar no device: permissão Health Connect real, import de treino do relógio via HC, e auto-update da build 157 → 4.1.

---

## [2026-08-14] — Backup do ambiente + receita de recuperação pós-formatação do Windows

### Implementado
- **`scripts/backup-workspace.ps1`**: gera `correlogo-backup-<data>.zip` com tudo que **não está** no repositório GitHub e é necessário para reconstruir o ambiente local: secrets do projeto (`.env`, `.env.apk`, `.env.dev`, `functions/.env`, `google-services.json`, `keystore.jks` x2, `opencode.json`, `.superpowers/`), configs do usuário (`.ssh/`, `.git-credentials`, `.gitconfig`, `.npmrc`, `gh-hosts.yml`, `firebase-tools.json`), configs do opencode (global + skills gstack/agents/opencode + `models.json` + `bin/rg.exe`) e `env-manifest.txt` (versões de node/npm/git/gh/firebase, `JAVA_HOME`, `ANDROID_HOME`, globals npm).
- **`scripts/restore-workspace.ps1`**: restaura o ZIP numa instalação limpa (copia secrets para o repo, configs de usuário, configs do opencode, define `JAVA_HOME`/`ANDROID_HOME`/`PATH` e imprime os próximos passos de build).
- **`docs/RECOVERY.md`**: receita passo a passo — instalação de ferramentas base (Git, Node, JDK 21, Android Studio, opencode, firebase-tools), restore de SSH/git/gh/firebase, clone, restore de secrets, build de validação (`npm test`/`npm run build`/`cap sync`/`gradlew assembleDebug`) e plano de emergência sem backup local.
- Backup inicial gerado e validado: `backup/correlogo-backup-20260814-211555.zip` (296 MB, 17.112 entradas, `env-manifest.txt` ancorado em Node v26.4.0 / npm 12.0.2 / Git 2.55.0 / gh 2.96.0 / firebase-tools 15.26.0).

### Observação importante
- `$env:JAVA_HOME` persistente aponta para `jdk-21.0.7.6-hotspot` (não existe); o real é `jdk-21.0.11.10-hotspot` — a receita documenta definir `JAVA_HOME` explicitamente antes de `gradlew`.

### Próximo
- Guardar o ZIP fora do computador (pendrive/nuvem). Regerar backups periodicamente com `scripts/backup-workspace.ps1`.

---

## [2026-08-13] — Integração com relógio fitness: FC via cinta BLE (0x180D), zonas Z1–Z5, import Health Connect, Insights no Perfil

### Implementado
- **Camada 0 — Fix do fluxo de permissão do Health Connect** (`HealthConnectPlugin.kt`): `createIntent` com `startActivityForResult` direto + fallback de racional (sem modal novo).
- **Camada 1 — Leitura de treinos do Health Connect**: permissões READ no manifest; `checkReadPermissions`/`requestReadPermissions`/`readWorkouts` no plugin; wrapper TS (`readWorkoutsFromHealthConnect`/`checkReadHealthPermissions`/`requestReadHealthPermission`); `WatchWorkout` em `types.ts`. Sono (sleep) fora de escopo (fase futura). Flag RR do GATT corrigido para bit 4/0x10 na spec Bluetooth SIG.
- **Camada 2 — Cinta cardíaca BLE**: `HrBleService.kt` (scan 0x180D, notify 0x2A37, parse flags 8/16-bit com range válido 30–240) + `HrBlePlugin.kt` (eventos `hrSample`/`hrScanResult`/`hrState`/`hrError`, permissões BLE) + transporte TS Mock/Native (`hr-ble.ts`) + hook `use-hr-belt.ts` (16s scan timeout, conexão simultânea com a esteira).
- **Camada 3 — Zonas**: `hr-zones.ts` (`estimateHrMax` 208−0.7×idade, Z1–Z5 com limites/cores) e `hr-summary.ts`.
- **Camada 4 — UI**:
  - `SessionSummary`: bloco de FC (média/máx/mín) + tempo por zona + gráfico recharts.
  - Histórico: badge "Relógio" para treinos importados, dedupe ±2min, empty state com CTA.
  - `UserProfile`: aba Insights (gráfico da última sessão + média/máx por treino).
  - `WorkoutTracker`: card FC ao vivo com zona colorida, TTS por zona (Z1–Z5), gravação de `heartRate` por ponto (`ActivityPoint.heartRate`).
- **Testes**: `hr-zones.test.ts` (TDD), `hr-ble.test.ts` (mock), `health-connect-read.test.ts` (mock/derivação).

### Validação
- `npm test` ✅ **101/101** · lint ✅ 0 novos (baseline 21 pré-existentes) · `.env.apk→.env` ✅ · `npm run build` ✅ (8.06s) · `cap sync android` ✅ (9 plugins) · `gradlew assembleDebug` ✅ **BUILD SUCCESSFUL** (só warnings de depreciação pré-existentes).

### Próximo
- **Validar em device**: permissão Health Connect real (abre a tela do HC); cinta cardíaca real quando o hardware chegar (scan/notify/TTS de zona); import de treino do relógio via Health Connect.

---

## [2026-08-12] — FTMS: correção do diagnóstico (0x07 É o Start) + auto-Start em todos os modos + log sempre visível

### Contexto (teste no device — esteira `A0:BB:3E:DC:25:4E`)
- Usuário testou os 3 modos. **Modos A e C**: Request Control **concedido** (`resultCode=0x01 Success`, várias vezes no keep-alive), leituras 2ACC/2AD4/2AD5 OK, mas **todo Set 0x02/0x03 → `0x05 Control Not Permitted`** — nenhum controle exercido. **Modo B: nenhum log gerado**.
- **2ACC (modo C)**: Target Setting Features = `0x0010` (só Heart Rate). **2ADA**: status `0x02` (`Stopped by Safety Key`) e `0x05` (`Target Speed Changed`). Dump do serviço: só chars FTMS padrão — **não existe** a char vendor `d18d2c10-...` (preamble WiLinktech não aplicável).

### Correção de diagnóstico (a sessão anterior estava errada — agora confirmado contra a spec)
- **`0x07` É Start/Resume** na spec FTMS (verificado: pycycling, ExFTMS e implementador com a spec PDF). Mapa: `0x04` Resistance · `0x05` **Set Target Power** · `0x06` Set HR · `0x07` **Start or Resume** · `0x08` Stop/Pause. A hipótese "trocar 0x07→0x05" da sessão 2026-08-05c **estava errada** e quebraria o Start.
- **Root cause real do `0x05 Control Not Permitted`**: a spec só permite Set Target Speed/Incline com a esteira em estado **Started**. Os modos **A e C nunca enviaram Start** (só Request Control) → Sets rejeitados. O **modo B era o único que enviava Start** — e justamente ele **não gerou log**.

### Fix
- **`TreadmillBleService.kt`** — `sendCommand`: **auto-Start (0x07) antes do primeiro Set em TODOS os modos** (antes era só no B); lógica otimista de "Set pendente até métricas/2s" permanece **exclusiva do modo B**.
- **`TreadmillBleService.kt`** — labels de Fitness Machine Status corrigidos para a tabela da spec (`0x01` Stopped/Paused by User, `0x02` **Stopped by Safety Key**, `0x04` Started/Resumed, `0x05` Target Speed Changed, `0x06` Incline, ... `0xFF` Control Permission Lost) + **hint no log** quando Set for rejeitado com `0x05` (máquina não Started; partida manual no console / safety key).
- **`BleSessionLog.kt`** — removido `IS_PENDING`: o arquivo agora fica **sempre visível** em `Download/CorreLogo/` mesmo se o app for morto antes do `finish()` (causa mais provável do "modo B sem log" — arquivo criado mas oculto por `IS_PENDING=1`).

### Validação
- `npm test` ✅ **83/83** · lint ✅ 0 novos (baseline 21 pré-existentes) · `.env.apk→.env` ✅ · `npm run build` ✅ (6.99s) · `cap sync android` ✅ (9 plugins) · `gradlew assembleDebug` ✅ **BUILD SUCCESSFUL** (só warnings de depreciação pré-existentes).

### Próximo
- **Testar de novo os 3 modos no device** com o APK novo. Esperado: o 1º Set dispara `Start/Resume (0x07)` e a esteira passa a aceitar os Sets. Se o Start for rejeitado com `0x05`, o hint no log aponta partida manual no console (safety key / exigência física). O modo B deve agora **gerar log** (arquivo sempre visível). Decidir estratégia definitiva a partir dos logs.

---

## [2026-08-05c] — Seletor de modo FTMS A/B/C + log em arquivo (diagnóstico "Falha ao assumir controle")

### Contexto
- Sintoma reportado após o fix de telemetria: **"Falha ao assumir controle da esteira"** ao conectar. Pesquisa GitHub (duhow/ftms-bridge, walkingpad-controller, NordicFTMS, python-pyftms, QZ, pycycling, etc.) concluiu: (1) mapa de result code deslocado — spec usa `0x01=Success`, código usava `0x00`; (2) família WiLinktech/KingSmith rejeita Request Control com `0x04` de propósito; (3) falta canal de ack real (2ADA).

### Decisão (usuário)
- **1 APK com seletor A/B/C** no botão "Conectar esteira Bluetooth" (não 3 APKs). Long-press de 3s (ou toque) abre o seletor. Cada modo gera **log próprio em arquivo** (`Download/CorreLogo/ftms-modoX-*.log`) — logcat trava no celular do usuário.

### Implementado
- **`BleSessionLog.kt`** (novo): log via `MediaStore.Downloads` (minSdk 29, sem permissão), nome `ftms-modo{A|B|C}-yyyyMMdd-HHmmss.log`, flush a cada 25 linhas, `IS_PENDING` para atomicidade, caminho propagado via evento `treadmillLogFile`.
- **`TreadmillBleService.kt`**:
  - Result codes corrigidos para spec (`0x01` Success, `0x02`–`0x05`; `0x00` aceito como legacy); sucesso aceita `0x01`/`0x00`; Request Control com `0x04` (WiLinktech) é tolerado e segue com controle.
  - Modo A (estrito), B (otimista: auto-Start `0x07`, Set pendente até métricas/2s, grant por write-ack, métrica ou exaustão), C (dump do serviço + leitura 2ACC/2AD4/2AD5 + vendor preamble WiLinktech `d18d2c10-c44c-11e8-a355-529269fb1459` payload `01 00 0d 00 06 0b 0f 0d` antes do Request Control se a char existir).
  - Assinatura do **2ADA** (Fitness Machine Status) + log de opcode; CCCD escalonados 100/250/450ms (WiLinktech descarta CCCD em cadeia).
  - `connect(address, mode)`, `logFilePath`, `onLogFile`, sessão de log em cada conexão.
- **`TreadmillFtmsManager.kt`**: `encodeStart()` (0x07).
- **`TreadmillBlePlugin.kt`**: `connectTreadmill` com `mode` + evento `treadmillLogFile`.
- **TS**: `BleTransport.connect(address, { mode })`, `onLogFile`, MockTransport (logFile por modo), `NativeBleTransport` (mode + listener `treadmillLogFile`), `useTreadmill` (state `mode`/`logFile`, `connect(address, mode)`).
- **`App.tsx`**: botão seletor (Wrench) com long-press 3s + modal A/B/C, badge de modo/log no estado conectado.

### Validação
- `npm test` ✅ **83/83** (10 arquivos, 3 novos) · lint ✅ 0 novos nos arquivos tocados (baseline 21 pré-existentes intacto) · `.env.apk→.env` ✅ · `npm run build` ✅ (5.51s) · `cap sync android` ✅ (9 plugins) · `gradlew assembleDebug` ✅ **BUILD SUCCESSFUL**.

### Próximo
- **Testar no device**: reproduzir a conexão com os 3 modos e enviar `Download/CorreLogo/ftms-modoX-*.log`. O log dirá se a esteira responde `0x01`, `0x04` ou nada → decidir estratégia definitiva (fixar como padrão ou detectar por device name `T01_XXXXX`/ID 2592).

---

## [2026-08-05b] — Fix telemetria FTMS: flag map padrão + control point response (speed lido como inclinação)

### Sintoma (device)
- Speed manual na esteira → app mostra **inclinação ×10** (5.0 km/h → 50%, 15.0 → 150%); speed no app sempre 0.0; mudar inclinação na esteira não é lido; comando pelo app aparece na barra e reseta para 0.0.

### Root cause
- **Parse de `0x2ACD` com flag map inventado** (`ftms-protocol.ts` + `TreadmillFtmsManager.kt`): bit0 tratado como "speed presente" quando é **More Data invertido** (0 = speed presente); bit2 tratado como inclinação quando é Total Distance (24-bit). Com flags reais `bit0=0, bit2=1`, o parser pulava o speed e lia **os bytes do speed como inclinação** ÷10 → 5.0 km/h = raw 500 → 50%. Speed nunca era parseado → barra resetava pra 0.0. Confirmado contra diagnóstico nRF (`DIAGNOSTICO-FTMS-NRF.md`, flags `0x078C`) e parser de referência duhow/ftms-bridge.
- **Control Point response com campos trocados** (`TreadmillBleService` + `TreadmillFtmsManager`): spec é `[0x80][requested opcode][result]`; código lia `[1]` como result. Request Control rejeitado pela esteira era tratado como sucesso (CONTROLLED falso → comandos enviados sem controle real, sem mensagem de erro).

### Fix
- **`src/lib/ftms-protocol.ts`** — `parseTreadmillMetrics` reescrito com o flag map padrão FTMS (bit0 More Data, bit1 avg speed, bit2 distância 24-bit, bit3 inclinação+ramp, bit7 energia, bit8 HR, bit10 elapsed...) + leituras bounds-guarded; `parseControlPointResponse` com opcode/result corretos.
- **`src/lib/ble-transport.ts`** — MockTransport emitindo packet padrão (flags `0x040C`, speed+distance 24-bit+incline+ramp+elapsed) e respostas de control point `[0x80, opcode, 0x00]` corretas.
- **`TreadmillBleService.kt`** — resultCode = `value[2]`, requestedOpcode = `value[1]`.
- **`TreadmillFtmsManager.kt`** — `parseControlPointResponse` (swap) e `parseMetrics` (flag map correto; código morto mantido consistente).
- **Testes reescritos** (TDD, red→green) com o layout correto.

### Validação
- `npm test` ✅ **79/79** (10 arquivos) · lint ✅ 0 novos nos arquivos tocados (baseline 21) · `.env.apk→.env` ✅ · `npm run build` ✅ (5.65s) · `cap sync android` ✅ · `compileDebugKotlin` ✅ · `gradlew assembleDebug` ✅ BUILD SUCCESSFUL.

### Commits
- `git log` — commit de fix da telemetria + docs wiki.

### Próximo
- **Testar no device**: speed manual na esteira deve aparecer como speed correto; inclinação manual deve ser lida; comandos do app devem refletir e não resetar pra 0.0. **Atenção à escala de inclinação**: se a inclinação aparecer ~6× maior que a real (BH iConcept usa escala proprietária 62.5, não ÷10), avisar — precisa de detecção por device name `T01_XXXXX`. Ver HANDOFF.

---

## [2026-08-05] — Fix BLE error 133 (GATT 0x85): fila serializada + keep-alive por idle + retry 200ms

### O que entrou
- **`TreadmillBleService.kt`** — combate ao `Write failed: error 133` (GATT_ERROR 0x85) no controle de velocidade/inclinação em Samsung/Android 13+:
  - **Fila GATT serializada**: `sendCommand` → `handler.post { processNextCommand() }` (main thread); um único write por vez via `isWriting`, sem recursão direta e sem corrida entre keep-alive (IO) e comandos do plugin (main). Fila tipada `QueuedCommand(data, isKeepAlive, attempts)`.
  - **API 33+**: usa `g.writeCharacteristic(char, value, writeType)` (retorna `BluetoothStatusCodes`), sem compartilhar/mutar `char.value` — causa conhecida de 133 em Samsung API 33+. Fallback deprecated mantido para <33.
  - **Write type dinâmico**: `WRITE_TYPE_DEFAULT` se a char tem `PROPERTY_WRITE`, senão `WRITE_TYPE_NO_RESPONSE`.
  - **Retry 200ms**: se `writeCharacteristic` retorna ≠ `SUCCESS`, re-enfileira o comando (`pendingRetry`) e tenta de novo via `handler.postDelayed(200ms)`, drop após `MAX_GATT_WRITE_ATTEMPTS = 10` com log (não dropa mais na 1ª falha).
  - **Keep-alive por idle**: coroutine checa a cada `KEEP_ALIVE_CHECK_INTERVAL_MS = 5s` e renova Request Control (`isKeepAlive=true`) **somente** se `now - lastSuccessfulWriteMs >= KEEP_ALIVE_RENEW_AFTER_IDLE_MS = 25s` — acabou o spam de write a cada 2s. `lastSuccessfulWriteMs` atualizado no sucesso de `onCharacteristicWrite`.
  - **Desistência silenciosa do keep-alive**: 2 falhas consecutivas de write de keep-alive → `stopKeepAlive()` **sem toast** (evita envenenar o link GATT); falha de comando do usuário → `onError` ("Write failed: $status").
  - **CCCD do control point**: NOTIFY (0x0001) se a char não tem `PROPERTY_INDICATE` (fallback p/ esteiras BH iConcept que usam NOTIFY), INDICATE (0x0002) caso contrário.
  - Log de properties (WRITE/WRITE_NO_RESPONSE/INDICATE) no `onServicesDiscovered`.

### Validação
- `.env.apk`→`.env` ✅ · `npm run build` ✅ (Vite 7.03s) · `npx cap sync android` ✅ (9 plugins) · `compileDebugKotlin` ✅ · `gradlew assembleDebug` ✅ **BUILD SUCCESSFUL**.

### Commits
- `6ed3498` fix(ble): error 133 — queue GATT serializada + keep-alive por idle + retry 200ms + API 33 write.

### Próximo
- Aguardar CI (firebase-deploy.yml) → baixar release `latest` → testar no device (Samsung/Android 13+): manter conexão > 25s sem comando, depois mudar velocidade/inclinação e confirmar que o erro 133 não reaparece. Logs: `Write result [keep-alive]` a cada 5s e `renewing Request Control after Xs idle`.

---

## [2026-08-01b] — Milestones/Conquistas completa: tab bar 4 abas, Conquistas, celebração, pill/clip e BLE 15s (Tasks 7–15)

### O que entrou
- **`src/components/TabBar.tsx`** (novo): tab bar inferior fixa (4 abas Treinos/Registros/Conquistas/Perfil, ícone corredor Tabler `run` inline, acento ativo, escondida em fluxos transientes via condição no App).
- **`src/components/Achievements.tsx`** (novo): aba Conquistas layout C — destaques (recordes · conquistas · km totais), lista RECORDES (11 distâncias, `—` para ausentes, link para o resumo), grade de BADGES (medalha/lock, data de desbloqueio), "Como os recordes funcionam".
- **`src/App.tsx`**: navegação por `activeTab` (`TabId`); back handler prioriza modais e depois volta para `treinos`; header só logo + saudação; abas Registros/Conquistas/Perfil renderizadas por condicional; `SessionHistory`/`UserProfile` agora são abas (removidos overlays `showHistory`/`showUserProfile`); `onExportSession`/`onDeleteSession` movidos para a aba Registros (fonte única).
- **`src/components/SessionHistory.tsx`**: vira aba **Registros** (remove `onClose`/invólucro modal; cabeçalho "Registros").
- **`src/components/UserProfile.tsx`**: vira aba **Perfil** (remove `open`/`onClose`; effect roda no mount; salvar não fecha) + nova seção **Preferências → Tema** (Escuro/Claro via `onToggleTheme`).
- **`src/components/SessionSummary.tsx`**: bloco de celebração após a grade 2×2 — "Novos recordes" (🏆) + "Conquistas desbloqueadas" (🎖️, pills âmbar), só quando há novidade (`session.prResults`).
- **`src/components/ShareCard.tsx`**: pill âmbar `★ Novo recorde: X km · tempo [+N]` (top:200, zIndex 30, pointer-events none) nas 4 variantes não-transparentes; **fix do clip**: RouteSVG normaliza com pad interno de 10 (traçado/círculos não tocam mais as bordas).
- **`TreadmillBleService.kt`** (delay 10s→**15s**) + **`use-treadmill.ts`** (setTimeout 11s→**16s**): scan BLE com mais folga para esteiras demoradas.

### Validação
- `npm test` ✅ **76/76** (10 arquivos) · `npm run lint` ✅ **21 erros pré-existentes, 0 novos** (TabBar/Achievements/App/ShareCard/UserProfile/SessionSummary/use-treadmill limpos).
- Build: `.env.apk`→`.env` ✅ · `npm run build` ✅ (Vite 6.34s) · `npx cap sync android` ✅ (9 plugins) · `gradlew assembleDebug` ✅ **BUILD SUCCESSFUL** (28s, JAVA_HOME 21).

### Commits (`[skip ci]`)
- `e8a8485` TabBar · `533b9d4` SessionHistory→Registros · `fc2902b` UserProfile→Perfil+Tema · `25e458d` Achievements · `c0b8b80` App tabs · `af33509` celebração Summary · `fb3e4fa` pill+clip · `45ddc6b` BLE 15s.

### Próximo
- Push para `main` → CI (build + release assinada) → validar no device: abas, conquistas, celebração no resumo, pill no ShareCard, scan BLE com 15s. Figurinha Stories e demais pendências seguem no TODO.md.

---

## [2026-08-01a] — Milestones/Conquistas: camada de dados (records) completa (Tasks 1–6)

### O que entrou
- **`src/lib/records.ts`** (novo, TDD): camada de dados pura e testável do Milestones — `PR_DISTANCES` (1/2/3/4/5/10/15/21/30/35/42), `BADGE_LABELS`/`BADGE_GROUPS` (PT-BR, 4 grupos), `computeCrossingTime` (interpolação do tempo ao cruzar distância nos `points`), `applySessionToRecords` (PRs → longest → volume monotônico → badges, ordem do spec), `emptyRecords`, `recomputeRecords` (PRs + longest do zero em delete; **não toca** badges/volume), `backfillRecords` (ordem cronológica, `backfilled=true`), `readRecords`/`saveRecords` (localStorage `correlogo:records:{uid}` primeiro + Firestore `users/{uid}/data/records` sem merge, coberto por `firestore.rules`).
- **`src/types.ts`**: `PrResults` + campo transitório `prResults?: PrResults` em `TrainingSession` (nunca persistido; só na sessão recém-completada em memória).
- **`src/App.tsx`**: estado `records`; hook no `markAsCompleted` (anexa `prResults` ao `selectedSession` via `setSelectedSession({ ...newSession, prResults })`); backfill na 1ª execução (no `finally` do load, antes de `setIsLoading(false)`); recompute nos 3 caminhos de delete (`uncompletePlan`, `deletePlan` com `sessionsToKeep`, `onDeleteSession` do histórico).

### Validação
- `npm test` ✅ 76/76 (21 novos em `records.test.ts`; baseline era 55) · `npm run lint` ✅ 21 erros pré-existentes, **0 novos** (records.ts/types.ts sem erros; App.tsx só nas linhas 352/874–890 pré-existentes).

### Build
- `npm run build` **não** rodado ainda (pré-condição: `Copy-Item .env.apk → .env`; a feature ainda não é visível — Tasks 7–15 pendentes). `gradlew` idem.

### Commits
- `50a9067` core types/PR distances/crossing · `2445c5d` applySessionToRecords · `b897988` recomputeRecords · `7302f4c` backfill + persistência · `165a60f` PrResults no tipo · `0ae24e2` wiring no App.

### Próximo
- Tasks 7–15 do plano (`docs/superpowers/plans/2026-08-01-milestones.md`): TabBar, Achievements, abas Registros/Conquistas/Perfil, celebração no resumo, pill no ShareCard, fix clip RouteSVG, timeout BLE 15s. **Aguardando aprovação do usuário para continuar.**

---

## [2026-07-31m] — APK 147 (148 na próxima) voltou a quebrar boot: ErrorBoundary renderizava `this.children` (undefined)

### Sintoma
- Após auto-update para o 147, splash some e a tela fica azul vazia (mesmo sintoma do 138). Root do React vazio, **sem erro de console** (o boot JavaScript roda, mas o App nunca monta).

### Root cause
- O `ErrorBoundary` novo (sessão anterior) fazia `return (this as unknown as Props).children;`. Sem `@types/react`, o `Component` é `any`, e o cast TS é removido no runtime → o código compila para **`this.children`**, que **não existe** no React (class components guardam children em **`this.props.children`**). Resultado: o boundary renderiza `undefined` → o `<App/>` nunca monta → root vazio. Retornar `undefined` de um boundary **não lança erro** — por isso o boot roda, o render é chamado, e nada aparece, sem nada no console.
- **Por que passou no CI/validação da sessão anterior**: nenhum teste montava o ErrorBoundary; o headless do CI só roda `npm run build` (não testa boot em browser).

### Correção
- `src/components/ErrorBoundary.tsx`: `return this.props.children;` (e declaração `props: Props;` para o TS sem `@types/react`).

### Guard de regressão
- **`src/lib/__tests__/error-boundary.test.tsx`** (novo, 2 testes):
  1. renderiza children (falhava com `''` — é exatamente o boot morto);
  2. renderiza o fallback quando há erro no state.
- Validação headless (Chrome headless + harness com `window.onerror`/`unhandledrejection`): **antes** root vazio 0 bytes; **depois** root 862 chars com logo + spinner e log `"[CorreLogo-JS] App componente renderizado"`.

### Build
- `npm test` ✅ 55/55 (+2 guard) · `npm run lint` ✅ 21 erros (baseline pré-existente, **0 novos**) · `npm run build` ✅ · `npx cap sync android` ✅ (9 plugins) · `gradlew assembleDebug` ✅ (4s) · boot headless ✅

---

## [2026-07-31l] — Causa raiz do APK 138 encontrada + re-aplicação dos 4 fixes + guard de regressão

### Root cause (fecha o TBD da entrada 2026-07-31k)
- **APK 138 (a555426) não subia por TDZ (temporal dead zone)** em `src/lib/use-treadmill.ts`: a `const clearScanTimeout = useCallback(...)` era declarada **depois** do `useEffect(..., [clearScanTimeout])` que a referencia no deps array. O deps array é avaliado durante o render, antes da const ser inicializada → `ReferenceError: Cannot access 'clearScanTimeout' before initialization` em **todo** render do App.
- `useTreadmill()` é chamado incondicionalmente no topo do `App.tsx` → React nunca montava → `#root` vazio → só o `body` com `background-color: var(--bg-deep)` (#0A0A14). Sintoma no device: splash → fundo azul → sem logo/spinner. Determinístico em qualquer device.
- **Por que o CI não pegou**: nenhum teste monta o App ou o hook; `tsc`/`vite` não detectam TDZ (erro de runtime); `gradlew` só empacota o web build.
- **Correções #1–3 eram inocentes** (ShareScreen/ShareCard/shareCard.ts são lazy via `SessionSummary`). O revert `a57d42b` (APK 139) descartou 3 fixes bons junto com o #4 quebrado.

### Re-aplicado
1. **#1 GPS-aware filter** (`ShareScreen.tsx`) — verbatim do a555426
2. **#2 sticker PNG 3×** (`shareCard.ts` + `ShareScreen.tsx`) — verbatim
3. **#3 map clipping 60→132px** (`ShareCard.tsx`) — verbatim
4. **#4 BLE scan indicator** (`use-treadmill.ts`) — **corrigido**: `scanTimeoutRef`/`clearScanTimeout` agora declarados **antes** do `useEffect` que os usa (fim do TDZ); timeout 11s (= nativo 10s + margem); limpeza em connect/disconnect/catch/unmount

### Guard de regressão
- **`src/lib/__tests__/use-treadmill-boot.test.tsx`** — renderiza um probe com `useTreadmill()` via `renderToStaticMarkup` (react-dom/server, zero deps novas). No código do 138 **estoura**; agora passa.
- **`src/components/ErrorBoundary.tsx`** — error boundary na raiz (`main.tsx`) com fallback visível (logo + mensagem + botão "Recarregar") em vez de fundo azul silencioso em futuros erros de boot.

### Build
- `npm test` ✅ (53/53, +1 guard) · `npm run lint` ✅ (0 erros novos; baseline pré-existente intacto) · `npm run build` ✅ · `npx cap sync android` ✅ (9 plugins) · `gradlew assembleDebug` ✅ (22s)

---

## [2026-07-31k] — Revert: APK 138 quebrou no device (tela branca/loading)

### Reverted
- **a555426** "fix: 4 device-test feedback issues" (4 files, +67/-29) via `git revert` in a57d42b. Device reported white screen / stuck on loading after auto-update from versionCode 136 → 138. Reverted to the previously published code at 4ac2f5a (Task 8 wiring, versionCode 136).
- This session had applied:
  1. GPS-aware variant filter in ShareScreen
  2. Sticker PNG supersampling 3×
  3. Map clipping margins 60 px → 132 px lateral
  4. BLE scan indicator persistence (10 s)
- Root cause of the white screen still TBD. None of the 4 changes touched the bundle entry, app initialization, or service worker, but the symptoms indicate something went wrong post-build (or on the device). Diagnose in a follow-up session before re-applying the fixes individually.

### Build
- npm run build ✓ (5.5s) · npm test ✓ (52/52) · gradlew assembleDebug ✓ (16s).
- Next CI run will publish a new release (versionCode ~139) with the reverted code; auto-update should replace the broken APK 138 with a working build.

---


## [2026-07-31j] — Share cards: 4 device-test fixes (GPS filter, sticker 3x, map clipping, BLE scan indicator)

### Fixed
1. **GPS-aware variants in ShareScreen** (`src/components/ShareScreen.tsx`)
   - `sessionHasMap(session)` helper returns true only if GPS samples exist (`routePoints?.length > 0` or `distance > 0.5 km`)
   - `variants` array filtered via `useMemo` to hide variant D (map) when no GPS
   - `cardIndex` auto-corrected to stay within bounds when session was previously mapped
   - Sticker map checkbox disabled when `!sessionHasMap`

2. **Sticker PNG supersampling 3×** (`src/lib/shareCard.ts`, `src/components/ShareScreen.tsx`)
   - `captureCard(element, scale?)` parameterized (default 2)
   - New `captureSticker(element)` with scale=3
   - `onStickerSave` now uses `runAction(..., mode='sticker')` for crisp rendering at small sizes

3. **Map clipping in cards B (pace/left) and C (bottom)** (`src/components/ShareCard.tsx`)
   - `RouteSVG` margins adjusted from 60px → 132px lateral (matching `CardMap` variant D) so the route no longer overflows the visible area on the smaller cards

4. **Treadmill BLE scan indicator persistence** (`src/lib/use-treadmill.ts`)
   - Added `scanTimeoutRef` + `clearScanTimeout`
   - `scan()` sets state to `SCANNING` and only resets after 10.5s (matches `TreadmillBleService.startScan` native 10s timeout), on `connect`/`disconnect`, or on unmount
   - Result: the UI "Searching..." spinner is now visible during the full native scan window instead of flickering off

### Build
- `npm test` ✅ (52/52) · `npm run build` ✅ · `gradlew assembleDebug` ✅ (16s)
- CI run `30668697053` succeeded; release `latest` updated to **versionCode 138** (3.4), APK 22 MB

---

## [2026-07-31i] — Share Cards/Adesivos: implementation complete (Tasks 1–8)

### Added
- **`src/lib/splits.ts`** — pace por km / bloco 5km + fallback total (`choosePaceBlocks`, `formatPaceShort`) — Task 1 (9 tests)
- **`src/lib/gradients.ts`** — 6 presets de gradiente (`GRADIENT_PRESETS`) + swoosh `#FF006E` — Task 2 (3 tests)
- **`src/lib/card-map.ts`** — Web Mercator tiles `dark_all` (816×816), rota SVG, sem Leaflet — Task 3 (8 tests)
- **`src/components/ShareCard.tsx`** — 4 variantes (A: pace | B: left | C: bottom | D: map), logo 60px uniforme, grid 2×3, stat col/row — Task 4 (3 tests)
- **`src/lib/shareCard.ts`** — `saveCardToGallery(blob)`, `shareToWhatsApp(blob)` wrappers TS — Task 6
- **`src/components/ShareScreen.tsx`** — nova tela modal: abas Cartões/Adesivos, carrossel 4 variantes, EditPanel inline (stats checkboxes, 6 presets, foto via `@capacitor/camera@^7` Base64), ações Story/WhatsApp/Mais/Salvar PNG + Copiar (stickers) — Task 7
- **`android/app/src/main/java/com/correlogo/app/SocialSharePlugin.kt`** — `saveToGallery` (MediaStore Pictures/CorreLogo) + `shareToWhatsApp` (intent `com.whatsapp`) — Task 5 (SDD reviewed, minSdk bumped to 29)

### Changed
- **`android/variables.gradle`** — `minSdkVersion` **26 → 29** (API 29) — drops Android 8/9 support; decision from Task 5 review (MediaStore APIs only on API 29+)
- **`src/components/SessionSummary.tsx`** — replaced legacy share modal with `ShareScreen`; removed dead state (`cardVariant`, `showStats`, `shareTarget`, `captureReady`, `sharing`, `cardCaptureRef`) and imports (`ShareCard`, `extractCardData`, `captureCard`, `shareImage`, `copyCardToClipboard`, `SHARE_TARGETS`)

### Build
- Full pipeline validated:
  - `npm run build` ✅ (6.28s, 2388 modules)
  - `npm test` ✅ (52 tests, 7 files)
  - `npm run lint` ✅ (only 2 pre-existing errors)
  - `npx cap sync android` ✅ (9 plugins including `@capacitor/camera@7.0.5`)
  - `gradlew assembleDebug` ✅ (20s, 343 tasks)

---

## [2026-07-31h] — Android minSdk bump to 29 (API 29 / Android 10)

### Changed
- **`android/variables.gradle`** — `minSdkVersion` **26 → 29** (drops Android 8.0/9.0 support). Decision made after Task 5 review found `saveToGallery` uses MediaStore APIs (`VOLUME_EXTERNAL_PRIMARY`, `RELATIVE_PATH`, `IS_PENDING`) only available on API 29+. The alternative (legacy path + WRITE_EXTERNAL_STORAGE runtime permission) was rejected in favor of a clean minSdk bump.

### Build
- `npm run build` ✅ · `npx cap sync android` ✅ · `gradlew assembleDebug` ✅ (full pipeline validated)

---

## [2026-07-31g] — Share Cards/Adesivos: mock aprovado + spec de design (docs only, `[skip ci]`)

### Added
- **Mock interativo** `mockups/share-cards.html` (v1→v6) com os 4 cards de compartilhamento (stats+pace / stats esquerda / stats embaixo / mapa real), proporções aprovadas: canvas 1080×1920, área útil do story y 350–1650, logo uniforme 60px (swoosh `#FF006E` + CORRE + LOGO), mapa do card 4 em 816×816 com tiles CARTO `dark_all`, 6 presets de gradiente.
- **Spec de design** `docs/superpowers/specs/2026-07-31-share-cards-design.md` (primeira spec na pasta nova `docs/superpowers/specs/`): arquitetura em camadas (`splits.ts` pace por km/5km, `card-map.ts` Web Mercator sem Leaflet, `ShareScreen.tsx` abas Cartões/Adesivos + EditPanel inline, `saveToGallery`/`shareToWhatsApp` no `SocialSharePlugin.kt`, `@capacitor/camera@^7`), workflows, testes e considerações.
- **Plano de implementação** `docs/superpowers/plans/2026-07-31-share-cards.md` (8 tasks TDD bite-sized, código completo por passo): Task 1 `splits.ts`, Task 2 `gradients.ts`, Task 3 `card-map.ts`, Task 4 `ShareCard.tsx` 4 variantes, Task 5 nativo Kotlin (`saveToGallery`/`shareToWhatsApp`), Task 6 wrappers TS, Task 7 `ShareScreen.tsx` + `@capacitor/camera@^7`, Task 8 wiring em `SessionSummary.tsx` + pipeline completo.

### Fixed (decidido via spike, pré-implementação)
- **CORS dos tiles CARTO + dom-to-image validado** (harness + CDP): `canvas not-tainted`, tiles renderizam na captura → card 4 pode usar tiles `<img>` + SVG no DOM, sem Leaflet.
- **`@capacitor/share` não aceita `packageName`** (verificado no `.d.ts`) → WhatsApp por intent nativa `package="com.whatsapp"` em método novo `shareToWhatsApp` + fallback share sheet.

### Build
- Docs-only. `npm run build` ✅ (2381) · `npm test` ✅ (29/29) na sessão anterior (2026-07-31f). Commit com `[skip ci]`.

---

## [2026-07-31e] — Housekeeping: auditoria de limpeza (docs archive + resíduos AWS + deps mortas)

### Removed (repo hygiene)
- **Resíduos da era AWS**: `install_server.sh`, `server.err`, `server.log`, `dist.tar.gz`, `cert/` (pasta vazia), `Corre Logo v2.2.apk` (10 MB), `metadata.json` (manifest AppX órfão, 0 referências).
- **Segredos de CI em disco**: `gh_env_base64.txt`, `gh_firebase_cred_base64.txt`, `gh_keystore_base64.txt` (gitignored, agora apagados).
- **Cache commitado por engano**: `.firebase/hosting.ZGlzdA.cache` removido do git + `.firebase/` adicionado ao `.gitignore`.
- **Debug artifacts**: `docs/Download/` (7 exports de logcat 2026-07-30) + `docs/Download.zip` + `logs/`.
- **Deps mortas**: `autoprefixer` (Tailwind v4 faz prefixing nativo) e `tsx` (transitiva do vite, 0 scripts usam) removidos do `package.json`. `react-is` foi **mantido** — o build provou que o `recharts` o importa em runtime.

### Moved (arquivado)
- Docs históricas da raiz `docs/` → **`docs/archive/`** (git mv preserva histórico): `analise-skills-para-apps.md`, `AUDITORIA-TECNICA-3-FEATURES.md`, `CORRECOES-PRONTAS.md`, `color-proposal.html`, `PROMPTS-PARA-AGENTE-IA.md`, `ui-audit-report.md`, `agent-reference-SHARE-FTMS-UPDATE.md`, `gerador-treinos-technical.md`, `registro-e-exportacao-atividades.md`, `samsung-health-setup.md`, `tcx.md`, `mockup-workout.html`, `superpowers/`, `FTMS-Bluetooth-Esteiras/` (+zip), `GitHub-Actions-Firebase-APK/` (+zip), `.firecrawl/` → `docs/archive/firecrawl-research/`.
- Links atualizados: `docs/wiki/tracking/ftms.md`, `docs/wiki/architecture/folder-structure.md`, `HANDOFF.md`, `TODO.md`.

### Build
- `npm install --legacy-peer-deps` ✅ (conflito de peer `firebase@11 vs 12` pré-existente) · `npm run build` ✅ (2381 módulos) · `npm test` ✅ (29/29) · `npx cap sync android` ✅ (plugins intactos, `android/` sem diff)
- Lint `tsc --noEmit` mantém 2 erros **pré-existentes** (não relacionados): `treadmill-machine.ts(85)` e `vite.config.ts(6)`.

---

### Fixed
- **Bug (Copiar imagem)**: a imagem copiada, "apesar de ter fundo transparente", tinha uma cor — o card variante **Foto (d)** renderizava um véu `bg-black/30` sobre o fundo `transparent` (linha 235 do `ShareCard.tsx`). O PNG capturado saía com uma camada preta a 30%. Removido o véu → **apenas o texto tem opacidade, todo o resto é opacidade 0**.
- **Bug (Instagram Stories)**: o story abria no Instagram, mas a imagem entrava na **camada mais baixa** (como foto de fundo), não como figurinha. Duas causas no `SocialSharePlugin.kt`:
  1. O PNG de sticker não era transparente (mesmo véu `bg-black/30`) — a Meta exige PNG **com transparência** no `interactive_asset_uri`; sem transparência o Instagram trata o asset como imagem de fundo.
  2. Em modo sticker-only o plugin setava só `intent.type` **sem** o data URI principal (`setDataAndType`), e não havia `setPackage("com.instagram.android")`.
- **Fix do plugin**: intent agora sempre com `setPackage(INSTAGRAM_PACKAGE)`, `setDataAndType(primaryUri, "image/png")` (primary = background se existir, senão o próprio sticker), `addFlags(FLAG_GRANT_READ_URI_PERMISSION)`, extras `background_image_uri` + `interactive_asset_uri`, e `grantUriPermission` para o Instagram no sticker. Conforme o spec oficial da Meta.

### Changed
- `android/app/build.gradle` — `versionName` 3.3 → **"3.4"**

### Build
- `npm run build` ✅ · `npx cap sync android` ✅ · `gradlew assembleDebug` ✅ (APK debug verificado com o chunk novo)

### Próximo teste (device)
1. Compartilhar → Foto → **Copiar imagem** → colar: só o texto visível, fundo 100% transparente
2. Compartilhar → Foto → **Instagram Stories** → o PNG deve entrar como **figurinha** (camada superior, arrastável), não como fundo
3. (Observação) o `drop-shadow` nos valores mantém uma sombra suave junto ao texto — se quiser zero sombra, é uma linha a mais

---


### Fixed
- **Bug visual**: no relatório de treinos com mapa, ao clicar em **Compartilhar**, o **mapa (somente ele)** ficava por cima do novo modal de compartilhamento.
- **Causa raiz**: o raiz do `MapComponent` tinha `relative` **sem z-index** → não criava stacking context. O Leaflet aplica `z-index: 400` nos panes e `1000` nos controles, que passavam a resolver contra o stacking context mais próximo — a raiz do `SessionSummary` (`fixed inset-0 z-50`). O modal de compartilhamento (`z-[60]`) vive no **mesmo** stacking context → os z-index do Leaflet (400/1000) vencem o `z-60`. Por isso apenas o mapa ficava por cima (o restante do relatório é z-auto, fica abaixo).
- **Fix**: `relative z-0` no raiz do `MapComponent` — `z-index: 0` em elemento posicionado **cria** stacking context e confina todos os z-index do Leaflet dentro do mapa. O modal (`z-60`), sendo irmão no contexto da raiz do resumo, passa a renderizar acima. Mesmo fix vale para o `WorkoutTracker` (usa o mesmo componente).

### Changed
- `android/app/build.gradle` — `versionName` 3.2 → **"3.3"**

### Build
- `npm run build` ✅ · `npx cap sync android` ✅ · `gradlew assembleDebug` ✅

---


### Contexto
- Na 3.1 o usuário viu o prompt de atualização pela primeira vez, tocou em **Baixar**, a barra de progresso **não andou**, o modal fechou **sem toast** e o app **não atualizou**. O botão manual "Verificar atualizações" no perfil "só rodava" sem achar update.
- Diagnóstico: o modal do `UpdatePrompt` só fecha no sucesso (`setUpdateInfo(null)` após `downloadApkAndInstall`) → download + `writeFile` + `getUri` + `startActivity` resolveram; a falha é na etapa de **instalação**. O Android 8+ bloqueia a instalação de APK por um app que **não tem `REQUEST_INSTALL_PACKAGES`** — e o manifest nunca teve essa permissão.

### Fixed
- **`AndroidManifest.xml`**: adicionado `<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/>` — destrava a instalação programática do auto-update **a partir da 3.2** (a 3.2 é o bootstrap: precisa ser instalada na mão **uma última vez**; depois, as versões futuras instalam sozinhas).
- **`ApkInstallerPlugin.kt`**:
  - `canRequestPackageInstalls()` → verifica se "instalar apps desconhecidos" está habilitado para o Corre Logo
  - `openInstallSettings()` → abre `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` com `package:` URI
  - `installApk` agora faz pre-check nativo e rejeita com **`INSTALL_BLOCKED`** quando a permissão está desligada (defesa extra além do check no JS)
- **`update-checker.ts`**:
  - `canInstallApk()` + `openInstallSettings()` (wrappers do plugin)
  - `downloadApkAndInstall` **sem** o callback `_onProgress` (era código morto — `CapacitorHttp` não expõe progresso de blob; barra de % ficava em 0% fixo e parecia travada)
  - **Validação do APK baixado**: o base64 precisa começar com `UEsD` (magic `PK\x03\x04` do ZIP/APK) — download corrompido/incompleto agora falha com mensagem real em vez de instalar lixo
- **`UpdatePrompt.tsx`**: barra de % trocada por **progresso indeterminado** ("Baixando… aguarde"); nova tela de **permissão de instalação** com botão **"Permitir"** que abre as configurações do sistema e botão "Agora não".
- **`App.tsx`**:
  - `onUpdate` pré-checa `canInstallApk()` antes de baixar — se negado, mostra a tela de permissão em vez de baixar 8MB à toa
  - `onUpdateAvailable` → o botão do perfil agora **abre o mesmo modal** em vez de baixar direto (resolvido o "só roda e não acha update": o download de 8.4MB sem feedback parecia travado)
- **`UserProfile.tsx`**: botão "Verificar atualizações" repassa o update via `onUpdateAvailable`; se não houver handler, mostra toast simples.

### Changed
- `android/app/build.gradle` — `versionName` 3.1 → **"3.2"**

### Build
- `npm run build` ✅ · `npx cap sync android` ✅ · `gradlew assembleDebug` ✅

### Próximo teste (device)
1. **Instalar a 3.2 na mão (bootstrap — última vez)**
2. Rodar → auto-update deve baixar e instalar sozinho quando a 3.3+ sair
3. Validar Instagram Stories (deep link direto + sticker) e Copiar imagem (fix da 3.1)

---


### Fixed
- **Compartilhar → Foto → Instagram Stories abria o share sheet do Android em vez do deep link `ADD_TO_STORY`, e o Copiar imagem dava "Erro ao copiar imagem"** — causa raiz real encontrada em **`capacitor.plugins.json`** (asset gerado pelo annotation processor): ele indexa **apenas os plugins de biblioteca** (8); nenhum plugin Kotlin local do app é incluído (sem `kapt`). Por isso todo plugin Kotlin é registrado manualmente em `MainActivity.load()` — e o **`SocialSharePlugin` foi esquecido na v3.0**. No device: `SocialShare.shareToInstagram` → "not implemented on android" → `'fallback'` → share sheet; `copyImageToClipboard` → "not implemented" → toast de erro. Explica #1 e #2 juntos.
- **Fix 1 (o principal)**: `MainActivity.java` agora registra `registerPlugin(SocialSharePlugin.class)` — o deep link passa a abrir o composer do Stories **direto** com o PNG como sticker (`interactive_asset_uri`).
- **Fix 2 (necessário, mas não suficiente)**: o secret `ENV_FILE` do GitHub Actions **não continha `VITE_FACEBOOK_APP_ID`** → APK do CI buildado com App ID vazio → `shareToInstagramStories()` retornava `'fallback'` **antes** de tocar no plugin (confirmado extraindo `SessionSummary-BJzWAPCK.js` do release 3.0.2). Secret atualizado para o base64 do `.env.apk`; APK 3.1 local validado com o App ID no bundle.
- **`SocialSharePlugin.kt` endurecido**: `sourceUriForPath()` aceita `file://`, caminho absoluto **e** `content://`; fallback para `context.cacheDir`; `Log.e` nos rejects.
- **Instrumentação diagnóstica**: `SessionSummary.tsx` mostra a mensagem real do erro no toast de copy (temporário) + `console.error`; `shareCard.ts` loga o reject do Instagram.

### Changed
- `android/app/build.gradle` — `versionName` 3.0.2 → **"3.1"**

### Build
- `npm run build` ✅ · `npx cap sync android` ✅ · `gradlew assembleDebug` ✅

### Próximo teste (device)
1. Compartilhar → Foto → Instagram Stories → deve abrir o composer do Stories **direto** (sem share sheet), com o PNG como **sticker** (`interactive_asset_uri`)
2. Copiar imagem → se ainda der erro, o toast mostra o motivo real
3. Bônus: auto-update 3.0.2 → 3.1 (release nova deve aparecer e instalar via `ApkInstaller`)

---

## [2026-07-30j] — v3.0.2: Auto-update definitivo — CapacitorHttp nativo (bypass CORS)

### Fixed
- **Causa raiz real do auto-update quebrado**: o GitHub Releases **não envia `Access-Control-Allow-Origin`** no download dos assets e a WebView do Android impõe CORS → todo `fetch` para `releases/download/latest/...` falhava com "Failed to fetch" (mascarado como "App já está na versão mais recente"). Por isso o auto-update **nunca** funcionou no device (atualizações sempre foram manuais/App Distribution).
- **`checkForUpdate`** agora usa `CapacitorHttp.get()` (`@capacitor/core`, HTTP nativo via OkHttp — imune a CORS) no Android para ler o manifest; mantém `fetch` no web. Timeouts nativos (`connectTimeout`/`readTimeout`).
- **`downloadApkAndInstall`** usa `CapacitorHttp.get({ responseType: 'blob' })` — download nativo (sem CORS), `resp.data` já vem em base64, escreve direto no `Filesystem.Cache` (remove FileReader/streaming).
- Evidência: headers do `releases/download/latest/update-manifest.json` confirmam ACAO ausente; `raw.githubusercontent.com` e o servidor próprio seriam alternativas com ACAO, mas `CapacitorHttp` mantém o GitHub como fonte única e conserta manifest + APK juntos.

### Changed
- `android/app/build.gradle` — `versionName` 3.0.1 → **"3.0.2"**

### Build
- `npm run build` ✅ · `npx cap sync android` ✅ · `gradlew assembleDebug` ✅

### Observação
- **`correlogo.sytes.net` (AWS EC2) está fora do ar** — "Impossível conectar ao servidor remoto". Web app indisponível; app Android não depende do servidor (Firebase ok). Verificar `pm2`/Nginx/Security Group no EC2.

---

## [2026-07-30i] — v3.0.1: Fix auto-update — cache-buster + erro visível + versão instalada na tela

### Fixed
- **Auto-update não pegava 3.0** — `checkForUpdate` retornava `null` em **qualquer** falha (rede, timeout, manifest stale no cache do CDN/WebView) e a UI reportava "App já está na versão mais recente". Agora:
  - **Cache-buster** `?v=${Date.now()}` na URL do manifest + `cache: 'no-store'` — evita redirect/assets stale do GitHub CDN e cache da WebView
  - Retorno `UpdateCheckResult { update, error? }` — falha de rede/HTTP/manifest inválido é exibida como **erro real** no toast, não mais mascarada como "up to date"
  - Seção "Atualização do app" agora mostra **Versão instalada: X (build Y)** — diagnóstico visual imediato
- `App.tsx`: log `console.warn('[update-check]', error)` no auto-check de login

### Changed
- `android/app/build.gradle` — `versionName` 3.0 → **"3.0.1"**

### Build
- `npm run build` ✅ · `npx cap sync android` ✅ · `gradlew assembleDebug` ✅ · `vitest` ✅ (29 testes)

---

## [2026-07-30h] — v3.0: Instagram Stories Direto (native plugin) + Copiar PNG Modo Foto

### Added
- **`SocialSharePlugin.kt`** (Capacitor native plugin): `shareToInstagram()` usa o intent oficial `com.instagram.share.ADD_TO_STORY` — abre o composer de Stories do Instagram direto (sem passar pelo share sheet do Android)
  - Card completo como **background asset** (modos Gradiente/Vidro/Mapa)
  - PNG transparente como **sticker** (`interactive_asset_uri`) no modo Foto — usuário põe a própria foto como base no Instagram
  - Extra `source_application` (Facebook App ID) obrigatório pela Meta desde jan/2023
  - `copyImageToClipboard()` — copia o PNG transparente (modo Foto) para o clipboard via FileProvider + `ClipData.newUri`; usuário cola como adesivo em qualquer app
- **Botão "Copiar imagem"** no `SessionSummary` — visível apenas no modo Foto (variante D), ação imediata sem abrir o modal de share
- Fallback automático para share sheet genérica se a intent do Instagram falhar ou `VITE_FACEBOOK_APP_ID` vazio

### Changed
- `src/lib/shareCard.ts` — `shareImage(blob, filename, target, instagramMode)` com `instagramMode: 'background' | 'sticker'`; `copyCardToClipboard(blob)`; `VITE_FACEBOOK_APP_ID` lido do env
- `android/app/build.gradle` — `versionName` "2.2" → **"3.0"**
- `.env.apk` / `.env.dev` / `.env.example` — novo `VITE_FACEBOOK_APP_ID=1604373561408021`

### Build
- `npm run build` ✅ · `npx cap sync android` ✅ · `gradlew assembleDebug` ✅ (BUILD SUCCESSFUL in 33s)
- Deploy via CI (push na main) — release `latest` com `app-release.apk` + `update-manifest.json`

---

## [2026-07-30g] — ShareCard v2: Instagram Stories, Variant Foto, 2× DPI Capture

### Added
- **Instagram Stories sharing**: new share target selector in modal (Native Android vs Instagram Stories) — `shareImage(target: 'native' | 'instagram-stories')`
- **Variant D ("Foto")**: stats-only transparent card (1080×1920), semi-transparent black overlay, huge text (`text-7xl`/`text-8xl`), drop-shadow — designed to overlay on user photos
- **2× high-DPI capture**: `dom-to-image-more` renders at 2160×3840 internally, downscales to 1080×1920 — much sharper PNGs
- **ShareCard variant selector** now includes 4 options: Gradiente / Vidro / Mapa / Foto

### Fixed
- **Map variant (C) z-index**: route SVG now sits behind gradient overlay + stats (was rendering on top)
- **Stat text sizes increased** across all variants:
  - A: `text-5xl`→`text-6xl` values, `text-sm`→`text-base` labels
  - B: `text-4xl`→`text-5xl`, `text-sm`→`text-base`
  - C: `text-3xl`→`text-4xl`, `text-xs`→`text-sm`
  - D: new — `text-8xl` values, `text-xl` labels
- **Preview scaling**: preview now scales correctly at 200px width

### Changed
- `captureCard()` now uses fixed 1080×1920 with `scale=2` (was reading element rect)
- `shareImage()` accepts `target` param for Instagram Stories intent

---

## [2026-07-30f] — Health Connect checkPermissions + Treino Livre Timer + CI if:always + google-services.json via Secret

### Added
- **Health Connect `checkPermissions()`** — native Kotlin `@PluginMethod fun checkHcPermissions()` reads `getGrantedPermissions()` for `WRITE_EXERCISE`; JS `checkHealthPermissions()` wrapper; called on `UserProfile` mount so status shows "Conectado" immediately if already granted
- **Treino livre timer fix** — "Tempo Restante" block now guarded by `!isFreeTraining`; free training shows "Tempo Decorrido" + distance instead of `86400 - lapSeconds`
- **CI `if: always()`** on "Upload APK to GitHub Release" step — runs even when Firebase Distribution fails (independent distribution channels)

### Changed
- **`google-services.json` removed from git** — added to `.gitignore`, restored in CI via `GOOGLE_SERVICES_B64` secret (base64 decoded to `android/app/google-services.json` before build). Stops GitGuardian false positives on OAuth client IDs / API keys in repo history.

### Files modified
- `android/app/src/main/java/com/correlogo/app/HealthConnectPlugin.kt` — new `checkHcPermissions()` method
- `src/lib/capacitor/health-connect.ts` — `checkHealthPermissions()` export
- `src/components/UserProfile.tsx` — imports + calls `checkHealthPermissions()` on mount
- `src/components/WorkoutTracker.tsx` — free training timer guard
- `.github/workflows/firebase-deploy.yml` — `if: always()` on release upload step + `Restore google-services.json` step
- `.gitignore` — added `android/app/google-services.json`

---

## [2026-07-30e] — Fix CI autoupdate: `latest` release nunca deve ser deletado

### Fixed
- **Autoupdate quebrado**: CI rodava `gh release delete latest -y` antes de `gh release create`, mas se o create falhasse, o release `latest` desaparecia completamente → `update-manifest.json` retornava 404 → app nunca via update.
- **Novo padrão**: `git tag -f latest HEAD` + `git push --force` garante tag no commit atual. `gh release upload --clobber` atualiza assets sem deletar o release. `gh release create` só como fallback na primeira execução.

### Build
- Commit `b245d50` com fix do CI — CI vai rodar com o workflow corrigido.

---

## [2026-07-30d] — ShareCard: Compartilhar Estatísticas em Redes Sociais

### Added
- **ShareCard system**: 3 variantes de card (1080×1920) para Instagram Stories:
  - **Estilo A (Gradiente)**: fundo gradiente purple→pink→orange, stats centrados grandes
  - **Estilo B (Vidro)**: fundo escuro com painel glass-morphism, stats minimalistas
  - **Estilo C (Mapa)**: fundo mapa (grid + SVG polyline da rota), stats em bottom sheet
- **Stats selecionáveis**: checkboxes para distância, duração, pace, velocidade, data, tipo, treino, logo
- **Botão "Compartilhar"** no `SessionSummary` → modal com seletor de estilo + preview + share sheet nativa
- **`shareCard.ts`**: geração PNG via `dom-to-image-more`, save no cache, share via `@capacitor/share`
- **`ShareCard.tsx`**: componente de card vector SVG para rota (variante C), sem dependência de Leaflet

### Deps
- `dom-to-image-more` ^3.10.2
- `@capacitor/share` ^7.0.4

### Build
- Web build limpo ✅

---

## [2026-07-30c] — Release Keystore SHA-1 + Auto Version Code CI

### Fixed
- **Google Sign-In "No Credentials available"**: CI/CD APK era assinado com release keystore cujo SHA-1 (`B4:56:92:B8:F1:3B:9B:FC:23:DA:38:87:AC:6B:79:8D:CC:35:B4:BA`) não estava registrado no Firebase Console. Adicionado manualmente. `google-services.json` re-baixado agora inclui ambos os hashes (debug + release).
- **`android/app/keystore.jks`** — novo release keystore criado, secrets GitHub atualizados via `gh secret set`.

### Added
- **Auto-increment versionCode na CI**: cada workflow run usa `$GITHUB_RUN_NUMBER + 100` como `versionCode`, passado via `-PciVersionCode`. Releases duplicados não sobreescrevem o mesmo ID. `android/app/build.gradle` usa `project.findProperty('ciVersionCode')?.toInteger() ?: 19` como fallback.

### Changed
- `.github/workflows/firebase-deploy.yml` — novo step "Compute version code", `-PciVersionCode` no gradle
- `android/app/build.gradle` — `versionCode` dinâmico via `ciVersionCode` property
- `android/app/google-services.json` — segundo OAuth client com novo certificate_hash
- `src/lib/gmailApi.ts` — exporta `isGmailConnected()` e `disconnectGmail()`

### Build validation
- Pipeline CI/CD passou limpo 🟢 (APK 2.2, release update)

## [2026-07-30b] — GitHub Actions CI/CD + Build Automation

### Added
- **`.github/workflows/firebase-deploy.yml`** — GitHub Actions workflow adaptado para Capacitor:
  - Trigger: push na `main` + `workflow_dispatch`
  - Node.js 20 + JDK 17 + Android SDK
  - Cria `.env` do secret `ENV_FILE` (conteúdo do `.env.apk`)
  - `npm ci` → `npm run build` → `npx cap sync android`
  - Build `assembleRelease` com injeção de signing via `-Pandroid.injected.signing.*`
  - Deploy para Firebase App Distribution via CLI (grupo "testers")
  - Cleanup de `keystore.jks` e `firebase-key.json` (always)
- **`RELEASE_NOTES.txt`** — template de release notes
- **`.gitignore`** — entradas `keystore.jks` e `firebase-key.json`

### Files created
- `.github/workflows/firebase-deploy.yml`
- `RELEASE_NOTES.txt`

### Files modified
- `.gitignore` — added `keystore.jks`, `firebase-key.json`

### Build validation
- `npm run build` ✅

## [2026-07-30a] — Refresh Token OAuth + Fixes

### Added: Refresh Token OAuth (autorização permanente)
- **Cloud function** (`functions/src/index.ts`): `authCallback` agora devolve `refresh_token` no redirect (além do `access_token`)
- **Cloud function** (`functions/src/index.ts`): novo endpoint `POST refreshAuthToken` — troca `refresh_token` por novo `access_token`
- **`gmailApi.ts`**: token armazenado como JSON `{access_token, refresh_token}` (compatível com token string antigo)
- **`gmailApi.ts`**: `sendMessage()` tenta refresh automático ao receber 401 (usa `refresh_token` → nova `access_token` → retry)
- **`gmailApi.ts`**: `getValidAccessToken()` também faz refresh se `refresh_token` existir
- **`App.tsx`**: deep link handler captura `refresh_token` nos callbacks nativo e web

### Fixed: FTMS UUID
- `TreadmillBleService.kt:23` — UUID `FTMS_MEASUREMENT_CHAR` corrigido de `00002a63` (0x2A63, Cycling Power Control Point) para `00002acd` (0x2ACD, Treadmill Data). Causava `getCharacteristic()` retornar null e erro "Required FTMS characteristics not found" mesmo com timing de conexão correto.
- **Build**: `npm run build` ✅ → `npx cap sync android` ✅ → `gradlew assembleDebug` ✅

### Fixed: Strava auto-save feedback
- `WorkoutTracker.tsx` — `showFeedback` adicionado como prop, passado de `App.tsx`
- Auto-save exibe toast de sucesso/erro do Strava (antes era fire-and-forget silencioso)
- `App.tsx` — `showFeedback` passado na renderização do `WorkoutTracker`

### Changed
- `functions/src/index.ts` — `authCallback` inclui `refresh_token` no redirect; novo endpoint `refreshAuthToken`
- `src/lib/gmailApi.ts` — `getStoredToken()` (JSON `{access_token, refresh_token}`), `refreshAccessToken()`, `getValidAccessToken()` com refresh, `sendMessage()` com retry 401+refresh
- `src/components/WorkoutTracker.tsx` — nova prop `showFeedback`, Strava send exibe toast
- `src/App.tsx` — deep link handler captura `refresh_token`, `showFeedback` passado ao WorkoutTracker

### Files modified
- `functions/src/index.ts`
- `src/lib/gmailApi.ts`
- `src/components/WorkoutTracker.tsx`
- `src/App.tsx`
- `android/app/.../TreadmillBleService.kt`

### Build validation
- `npm run build` ✅ → `npx cap sync android` ✅ → `gradlew assembleDebug` ✅

## [2026-07-29j] — BLE Permission Fix + Diagnostic Analysis

### Added
- `TreadmillBlePlugin.kt:113-136` — `requestBlePermissions()`: método `@PluginMethod` que solicita `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT` (Android 12+) ou `ACCESS_FINE_LOCATION` (Android <12) via `pluginRequestPermissions()`
- `handleRequestPermissionsResult()`: resolve a PluginCall pendente com status `granted`/`denied`
- `permissions.ts` — `requestBlePermissions()` chamado em `requestAllPermissions()` no startup do app (ao lado de `POST_NOTIFICATIONS` + `ACTIVITY_RECOGNITION`)

### Fixed
- **BLE permission nunca solicitada**: O `@CapacitorPlugin` declarava `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT` no alias `bluetooth`, mas `requestPermissionForAlias("bluetooth")` não disparava o diálogo. Substituído por `pluginRequestPermissions()` explícito com `handleRequestPermissionsResult()`.
- **UUID Treadmill Diagnostic**: Confirmado via nRF Connect logs que a esteira (WiLinktech VISION ID 2592, firmware V10.23.17) implementa FTMS completo com UUID 0x1826. Características 0x2ACD, 0x2ACC, 0x2AD9, 0x2ADA, 0x2AD4, 0x2AD5 todas presentes e funcionando.

### Diagnostic (correção pendente)
- UUID `FTMS_MEASUREMENT_CHAR` (`00002a63`) não corresponde ao Treadmill Data da esteira (`0x2ACD`). [Corrigido em 2026-07-30a]

### Changed
- `TreadmillBlePlugin.kt` — rewrite: `startBleScan` usa `checkBlePermissions()` (não mais `requestPermissionForAlias`), adicionado `requestBlePermissions` method + `handleRequestPermissionsResult` override
- `src/lib/capacitor/permissions.ts` — `requestAllPermissions()` chama `TreadmillBle.requestBlePermissions()` no native

### Files modified
- `android/app/.../TreadmillBlePlugin.kt`
- `src/lib/capacitor/permissions.ts`

### Build validation
- `npm run build` ✅ → `npx cap sync android` ✅

## [2026-07-29g] — Strava via Gmail API (TCX/GPX + OAuth)

### What changed
Strava upload channel implemented: email with TCX (treadmill) or GPX (outdoor) attachment → `stravaupload@gotoes.org`, using Gmail API with `gmail.send` scope.

### Added
- `src/lib/gmailApi.ts` — complete Gmail OAuth + send service:
  - `startGmailOAuth()` — opens Google consent via `Browser.open()` (same pattern as Calendar)
  - `listenForGmailCallback()` — handles deep link with `gm_` state prefix
  - `sendWorkoutToStravaViaEmail(session)` — builds MIME email with TCX/GPX attachment, base64url encodes, POSTs to Gmail API `users.messages.send`
  - Token persisted in localStorage (`gmail_strava_token`), auto-refresh on 401
- **Deep link handler** in `App.tsx`: differentiates Gmail (`gm_`) vs Calendar (`c3_`) via state prefix — Gmail tokens stored separately, no Calendar modal opens

### Changed
- `App.tsx` `onExportSession` — after HC export, also sends to Strava via `sendWorkoutToStravaViaEmail()`
- `WorkoutTracker.tsx` `handleSaveAndSync` — after HC sync, constructs `TrainingSession` and calls `sendWorkoutToStravaViaEmail()` (fire-and-forget)

### Generators reused
- `generateTCX()` / `generateGPX()` from `src/lib/exportUtils.ts` (existing, unchanged) — generate file content, `gmailApi.ts` wraps in MIME multipart/mixed

### Build validation
- `npm run build` ✅ → `npx cap sync android` ✅ → `gradlew assembleDebug` ✅
- APK: `app-debug.apk` (versionCode 19, versionName "2.2")

## [2026-07-29f] — Proper ActivityResultLauncher Permission Flow (v2.0)

### Root Cause Fix
O problema de permissão nunca ser concedida era mais profundo do que `setPackage`:
- **`requestHcPermissions()`** usava `startActivity(intent)` e resolvia `granted=true` **antes** do usuário interagir com a tela de permissão
- Como nunca esperava o resultado, `exportWorkout()` sempre encontrava `WRITE_EXERCISE` não concedido
- As 5 tentativas de fallback com `startActivity()` eram todas igualmente quebradas — nenhuma aguardava retorno

### What changed
- **`HealthConnectPlugin.kt`**: registra `ActivityResultLauncher` via `ComponentActivity.registerForActivityResult()` no `load()` (quando o lifecycle está em CREATED, antes de STARTED — requisito do AndroidX)
- **`requestHcPermissions()`**: usa `permLauncher.launch(permissions)` e **aguarda o callback** com o conjunto real de permissões concedidas
- **Callback resolve** com `granted=true` apenas se `WRITE_EXERCISE` estiver no resultado
- **Removidas** todas as 5 tentativas `startActivity()` com resolução imediata — eram pseudo-fixes
- **Removido** `permContract` (substituído pelo launcher), `tryOpenIntent()`, imports de `Intent`/`Uri`
- **`exportWorkout()`**: rejeita com mensagem clara se permissão não concedida (sem tentar reabrir tela — abertura de tela é responsabilidade do `requestHcPermissions()`)
- **Versão**: v2.0 (versionCode 11)

### Files modified
- `android/app/src/main/java/com/correlogo/app/HealthConnectPlugin.kt` — rewrite completo
- `android/app/build.gradle` — versionCode 10→11, versionName "1.1"→"2.0"

### Build validation
- `npm run build` ✅ → `npx cap sync android` ✅ → `gradlew assembleDebug` ✅
- APK: `Corre Logo v2.0.apk`

## [2026-07-29e] — Permission Check Before Export + Real Feedback

- **`exportWorkout()` agora verifica permissões de verdade** antes de chamar `insertRecords()`: usa `c.permissionController.getGrantedPermissions()` para checar se `WRITE_EXERCISE` está concedido
- **Se não houver permissão**: reabre a tela de permissão do Health Connect e rejeita o call com `"WRITE_EXERCISE not granted"`
- **Mensagem de erro mais clara**: "Falha ao sincronizar. Verifique as permissões do Health Connect e tente novamente."
- **APK v1.8**: 8.4 MB, `Corre Logo v1.8.apk`

## [2026-07-29d] — Multi-Attempt Permission Intent + Package Visibility

- **Adicionado `<queries>` no AndroidManifest.xml**: declara pacote `com.google.android.apps.healthdata` e schema `health-connect://` — resolve restrição de visibilidade do Android 11+
- **5 tentativas de abrir tela de permissão**: (1) PermissionController → (2) deep link `health-connect://permissions` → (3) lançamento por package name → (4) Play Store → (5) app settings
- **Helper `tryOpenIntent()`**: captura `ActivityNotFoundException` de forma limpa e tenta próxima tentativa
- **APK v1.7**: 8.4 MB, `Corre Logo v1.7.apk`

## [2026-07-29c] — Permission Flow Refactoring

- **Fix `requestHcPermissions`**: Capacitor 7 usa `ActivityResultLauncher` internamente, tornando `handleOnActivityResult` não confiável. Substituído por `activity.startActivity(intent)` direto, sem aguardar resultado.
- **Removido dead code**: `handleOnActivityResult()`, `pendingPermCall`, `PERMISSION_REQUEST`
- **Fallback chain**: Health Connect permission screen via `PermissionController` → Play Store → app settings
- **APK v1.6**: 8.4 MB, `Corre Logo v1.6.apk`

## [2026-07-29b] — Health Connect Pivot (substitui Samsung Health)

**Strategic pivot:** Samsung Health was replaced by Android Jetpack Health Connect (`androidx.health.connect:connect-client:1.1.0`). Both Strava and GymRats natively support Health Connect — write once, cover both targets. No partnership needed, free, part of Android Jetpack.

### Added
- `HealthConnectPlugin.kt` — Capacitor plugin wrapping `HealthConnectClient`, `PermissionController`, `ExerciseSessionRecord`, `DistanceRecord`, `ExerciseRoute`
- `health-connect.ts` — JS wrapper exporting `exportWorkoutToHealthConnect()` with same `WorkoutExport`/`SyncStatus` interface

### Changed
- `variables.gradle` — `compileSdk=36`, `targetSdk=36`, `minSdk=26` (HC requires 26+)
- `build.gradle` — AGP `8.7.2→8.9.1`, added `connect-client:1.1.0` + `kotlinx-coroutines-android:1.8.1`
- `AndroidManifest.xml` — removed Samsung Health meta-data + `WRITE_USE_APP_SURVEY`, added `android.permission.health.READ_EXERCISE` + `WRITE_EXERCISE`
- `WorkoutTracker.tsx` + `App.tsx` — imports swapped to health-connect

### Removed
- `SamsungHealthPlugin.kt` — replaced by `HealthConnectPlugin.kt`
- `samsung-health.ts` — replaced by `health-connect.ts`
- Samsung AAR fileTree comment from build.gradle

### Build
- `npm run build` ✅ → `npx cap sync android` ✅ → `gradlew assembleDebug` ✅

## [2026-07-29] — Samsung Health Full Integration (7 Tasks)

### Bug Fixes (committed earlier in session)

#### Bug #1: Timer counting during countdown
- **Root cause:** Dual-timer conflict — JS `setInterval` and native timer `Handler` both writing to `elapsedSeconds`/`lapSeconds`
- **Fix:** JS timer returns early for treadmill+native timer mode; native timer acts as sole source of truth

#### Bug #2: Total distance jumping on step change
- **Root cause:** `distRef.current = elapsed * dPerSec` recalculated total distance FROM SCRATCH each frame
- **Fix:** Incremental accumulation via `prevElapsedRef` — `distRef.current += delta * dPerSec`

#### Bug #3: Half-lap/half-workout TTS not firing
- **Root cause:** `lapSeconds` captured in `onTimerTick` closure was stale (created once at listener registration)
- **Fix:** Use `lapElapsed` local variable or ref-based calculation

#### Bug #4: Music volume not restoring after TTS
- **Root cause:** `setWillPauseWhenDucked(true)` contradicted `MAY_DUCK`; Android cached this and never restored volume
- **Fix:** Removed `setWillPauseWhenDucked(true)` from `AudioFocusPlugin.kt`
- **Commit:** `ac25c51`

### Samsung Health — 7 SDD Tasks

#### Task 1 — Android SDK Setup
- **build.gradle:** Added AAR fileTree (`*.aar` in `libs/`) merged both `fileTree` lines into one
- **AndroidManifest.xml:** Added `WRITE_USE_APP_SURVEY` permission + Samsung Health read/write meta-data
- **libs/ dir:** Created `android/app/libs/` with `.gitkeep` for AAR placement
- **Gson removed** (out of scope), `fileTree` merged, AAR doc comment added
- **Commits:** `046a4d4`, `5eb8315`

#### Task 2 — SDK Setup Guide
- **Created:** `docs/samsung-health-setup.md` — instructions to download AAR from Samsung Developer
- **Commit:** `8c9f3ea`

#### Task 3 — Native Capacitor Plugin (SamsungHealthPlugin.kt)
- **Created:** `android/app/src/main/java/com/correlogo/app/SamsungHealthPlugin.kt` — wrapping Old SDK v1.5.1
- **Methods:** `isAvailable()`, `getPermissionStatus()`, `requestPermission()`, `exportWorkout()`
- **API adaptation:** Uses `HealthData.put*()` (ContentValues-based), `addHealthData()` pattern, `setSourceDevice()`. Fire-and-forget `resolver.insert()`.
- **Fix:** Added missing `import com.getcapacitor.JSObject`
- **Build:** Fails on missing AAR (all errors `Unresolved reference 'samsung'` — zero Kotlin syntax errors)
- **Commit:** `1c33473`

#### Task 4 — JS Interface + Types
- **Created:** `src/lib/capacitor/samsung-health.ts` — `WorkoutExport`, `SyncStatus`, `exportWorkoutToSamsungHealth()`, `isSamsungHealthAvailable()`, `getHealthPermissionStatus()`, `requestHealthPermission()`
- **Modified:** `src/types.ts` — added `syncStatus?: 'synced' | 'pending' | 'failed'` to `TrainingSession`
- **Build:** Clean (no TS errors)
- **Commit:** `b93d04f`

#### Task 5 — Export Trigger in WorkoutTracker
- **Modified:** `src/components/WorkoutTracker.tsx` — added `onSyncResult` prop, `sessionStartTimeRef`, Samsung Health export when `isWorkoutCompleted` becomes true
- **Build:** Clean
- **Commit:** `d10a6e1`

#### Task 6 — Sync Flow in App + Session History
- **Modified:** `src/App.tsx` — `onSyncResult` handler updates session by `latestSessionIdRef`, `onExportSession` handler for manual re-export, `syncStatus: undefined` in session creation
- **Modified:** `src/components/SessionHistory.tsx` — sync status indicators (synced/pending/failed) with icons + manual re-export buttons
- **Build:** Clean
- **Commit:** `449ae69`

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

## [2026-07-29i] — Bluetooth FTMS Treadmill Control (Matrix T600x)

### Added
- **Native Android BLE plugin** — `TreadmillBlePlugin.kt` + `TreadmillBleService.kt` + `MatrixFtmsManager.kt`:
  - Full FTMS GATT state machine (9 states: DISCONNECTED → ACTIVE_SESSION_CONTROLLED)
  - Matrix Request Control handshake (opcode 0x00 → indication 0x80)
  - `SetSpeed` (0x02) / `SetIncline` (0x03) com encoding LITTLE_ENDIAN UINT16/SINT16
  - Keep-alive heartbeat a cada 3s (re-escreve velocidade atual)
  - Telemetry parsing do Treadmill Data (0x2ACD): speed, distance, incline, elapsed time
  - Indication response parser (success/opcode not supported/invalid parameter)
- **`treadmill-ble.ts`** — TypeScript interface + wrapper functions (native only)
- **`mock-treadmill-engine.ts`** — Simulador manual para desenvolvimento web
- **`treadmill-connection.ts`** — Hook `useTreadmill()` que abstrai nativo + mock
- **`TreadmillPanel.tsx`** — Componente UI: scan/connect, telemetria ao vivo, controles de velocidade/inclinação
- **Integração WorkoutTracker**: auto-ajuste de velocidade via BLE quando step muda + quando usuário ajusta manualmente
- Permissões BLE no `AndroidManifest.xml` + feature flag `android.hardware.bluetooth_le`

### Changed
- `MainActivity.java` — registrado `TreadmillBlePlugin`

## [2026-07-29h] — Fix web interface TDZ error

### Fixed
- **TDZ (Temporal Dead Zone) crash** — `Uncaught ReferenceError: Cannot access 'ei' before initialization` at `App.tsx:134`. O `useEffect` do back button stack (não commitado) referenciou `planToUncomplete` no array de dependências 505 linhas antes da declaração `const`. Movido `useState(planToUncomplete)` da linha ~639 para linha 94.
- **showBackgroundPrompt duplicado** — removido entry extra (aparecia 3x no corpo do effect e 2x na dependency array).

## [2026-06-18]
- Fixed: Dark mode preference persistence (now correctly loads from Firebase or system preference).
- Fixed: Workout completion logic, including automatic confirmation prompt and state resetting.
- Fixed: Issue preventing starting a new workout after finishing one, by ensuring proper component re-initialization via the `key` prop on `WorkoutTracker` in `App.tsx`.
- Improved: State management in `WorkoutTracker.tsx` to prevent re-render errors when finishing workouts.
- Improved: Firestore integration test logging to verify data saving.
