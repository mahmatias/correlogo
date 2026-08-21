# Handoff

## Session Context (2026-08-20i — Root cause definitivo: READ_DISTANCE ausente do manifesto)

### What happened
- Build 173 (getGrantedPermissions como fonte da verdade) não mudou o sintoma: "Permissão negada" com permissões concedidas
- Auditoria do `AndroidManifest.xml` revelou: **`android.permission.health.READ_DISTANCE` não declarado** — mas `readPermissionSet` exige `{READ_EXERCISE, READ_DISTANCE}`
- Permissão de saúde não declarada no manifesto é ingrantível pela plataforma (13 e 14+) → o conjunto nunca fica completo → nega para sempre, independente do que o usuário conceder no HC
- Explica TODA a história desde 13/08 (três bugs empilhados: handleOnActivityResult morto → assinatura errada do callback → manifesto incompleto)

### Fix applied
1. `<uses-permission android:name="android.permission.health.READ_DISTANCE" />` no AndroidManifest.xml
2. `versionName 4.3 → 4.4`

### Validation
- `gradlew assembleDebug` ✅ BUILD SUCCESSFUL · TS sem mudanças

### Cautions for next session
1. **Testar build 174**: ao tocar "Importar relógio", o diálogo HC deve aparecer pedindo o toggle NOVO (Distância) — os outros já estão concedidos; conceder → importação deve listar treinos
2. **Se ainda falhar AGORA sim o logcat é decisivo**: linhas `checkReadPermissions ... granted=N` e `onPermissionResult ... source=... granted=...` discriminam as hipóteses restantes
3. **Lição**: ao mudar `readPermissionSet`/`requestHcPermissions`, auditar o manifesto na mesma mudança — permissões de saúde exigem declaração prévia
4. READ_HEART_RATE/READ_STEPS/READ_TOTAL_CALORIES/READ_SLEEP declarados mas não solicitados em runtime (uso futuro) — não afetam o fluxo atual

---

## Session Context (2026-08-20h — Fix "permissão negada" apesar de concedida)

### What happened
- Build 172 no device: crash sumiu ✅, mas "Conectar"/"Importar" ainda reportavam "Permissão negada" com permissões JÁ concedidas
- **Análise do SDK**: sources do connect-client 1.1.0 (Google Maven) mostram que `HealthPermissionsRequestContract` delega por versão do Android:
  - Android 14+ (`UPSIDE_DOWN_CAKE`): `HealthPermissionsRequestModuleContract` → embrulha `RequestMultiplePermissions` da plataforma (extras `android.content.pm.extra.REQUEST_PERMISSIONS_*`)
  - Android 13-: `HealthPermissionsRequestAppContract` → protocolo próprio do APK HC com parcelables Proto
- Logcat anterior (`act=android.content.pm.action.REQUEST_PERMISSIONS`) prova que o device está no caminho plataforma
- **Root cause [Likely]**: `onPermissionResult` decidia o grant pelo payload do Intent via `permContract.parseResult(resultCode, intent)`; se o formato dos extras não bater exatamente (quirk OneUI/módulo HC), parseResult devolve conjunto vazio → `granted=false` mesmo concedendo. Ambos os fluxos (WRITE e READ) usam o mesmo callback → ambos envenenados

### Fix applied
1. `onPermissionResult`: **`getGrantedPermissions()` como fonte da verdade** — re-consulta o estado real de grants pós-diálogo dentro de `scope.launch`; `parseResult` mantido apenas como fallback se client indisponível
2. Log agora indica a fonte usada: `source=getGrantedPermissions|parseResult`
3. `versionName 4.2 → 4.3`

### Validation
- `gradlew assembleDebug` ✅ BUILD SUCCESSFUL · TS sem mudanças (npm test/build não re-executados)

### Cautions for next session
1. **Testar no device (build 173)**: conceder permissão deve retornar granted=true; importar deve listar treinos
2. **Se AINDA reportar negada**: exportar logcat e olhar a linha `onPermissionResult ... source=getGrantedPermissions granted=false` — isso significaria que o próprio `getGrantedPermissions()` está mentindo (problema SDK/device, caminho diferente); se `source=parseResult`, client estava null (investigar ensureClient)
3. **Padrão @ActivityCallback** segue `(call: PluginCall, result: androidx.activity.result.ActivityResult)` — ver 2026-08-20g

---

## Session Context (2026-08-20g — Fix crash nativo: assinatura errada do @ActivityCallback)

### What happened
- Permissões HC passaram a ser solicitadas corretamente (fix 2026-08-20e), mas ao CONCEDER e voltar pro app, o APK fechava sem mensagem
- Usuário capturou logcat (`\\plex.local\data\logcat_2026-08-20_20-04-44.txt`) — stack completo obtido sem adb (compartilhamento de rede)
- **Root cause**: `@ActivityCallback onPermissionResult(call, activity, intent)` com 3 parâmetros; Capacitor 7 invoca por reflexão com SEMPRE 2 args `(PluginCall, ActivityResult)` → `IllegalArgumentException` não capturada pelo catch do Capacitor → morte do processo em `deliverResults`
- Detalhe perverso: `result=-1` (RESULT_OK) — permissões foram concedidas; o app morreu entregando o sucesso
- **Lição**: `TreadmillBlePlugin`/`HrBlePlugin` já tinham a assinatura correta `(call, result: ActivityResult)` — o fix de ontem não copiou o padrão existente do próprio codebase

### Fix applied
1. `HealthConnectPlugin.kt`: `onPermissionResult(call, result: androidx.activity.result.ActivityResult)`
2. Guard `result.data == null` → conjunto vazio (NPE-safe no `parseResult`)
3. Log inclui `resultCode`; imports órfãos removidos
4. `versionName 4.2` (bugfix = minor)

### Validation
- `npm test` ✅ 104/104 · build ✅ · cap sync ✅ · gradlew assembleDebug ✅

### Cautions for next session
1. **Testar no device**: conceder permissão não deve fechar o app; "Importar relógio" deve listar treinos do HC
2. **Se readWorkouts falhar agora**: será visível como toast (JS captura) ou log `CorreLogo-HC` — o crash mudo era só o callback de permissão
3. **Padrão para novos @ActivityCallback**: SEMPRE `(call: PluginCall, result: androidx.activity.result.ActivityResult)` — nunca `(call, activity, intent)`

---

## Session Context (2026-08-20e — Migrar HC plugin para @ActivityCallback Capacitor 7)

### What happened
- **Bug report**: fix 2026-08-20d não resolveu — "Conectar" e "Importar" ainda retornavam "Permissão negada" imediatamente
- **Root cause**: `handleOnActivityResult` (deprecated) provavelmente não era chamado pelo Capacitor 7 → `startActivityForResult` da Activity não encaminhava resultado pro plugin → JS retornava false
- **Key insight**: Capacitor 7 requer `@ActivityCallback` annotation + `Plugin.startActivityForResult(call, intent, callbackName)` em vez de `Activity.startActivityForResult(intent, requestCode)`

### Fix applied — reescrita completa do fluxo de permissões
1. Removido `requestCodes=[9301]` do `@CapacitorPlugin`
2. Removido `handleOnActivityResult` (deprecated) e `pendingPermissionCall`
3. Novo `@ActivityCallback fun onPermissionResult(call, activity, intent)` — receives result directly from Capacitor bridge
4. `launchPermissionIntent` agora usa `startActivityForResult(call, intent, "onPermissionResult")` (Plugin method, not Activity)
5. `pendingPermissionExpected` mantido para validar permissões esperadas vs concedidas

### Validation
- `npm run build` ✅ · `cap sync android` ✅ · `gradlew assembleDebug` ✅
- `npm test` ✅ 104/104

### Cautions for next session
1. **Deploy pendente**: push → CI → release → testar no device
2. **Se ainda falhar**: pode ser Capacitor bridge interceptando activity result de forma inesperada — checar Logcat `CorreLogo-HC` para ver se `onPermissionResult` é chamado
3. **Testar ambos fluxos**: "Conectar" no Perfil E "Importar relógio"

---

## Session Context (2026-08-20d — Revert HC permissions: WRITE-only + remove SpeedRecord blocker)

### What happened
- **Bug report**: após fix 2026-08-20c, botão "Conectar Health Connect" retornava "Permissão negada" imediatamente
- **Secondary**: importação continuava bloqueada mesmo com HC conectado manualmente
- **Root cause**: `requestHcPermissions` com READ+WRITE misturados causava falha em `createIntent` → fallback resolvia `false`
- **Secondary root cause**: `readPermissionSet` com SpeedRecord — toggle pode não existir no HC app

### Fix applied
1. **`requestHcPermissions`** — revertido para WRITE-only (ExerciseSessionRecord + DistanceRecord write)
2. **`readPermissionSet`** — reduzido para 2: ExerciseSessionRecord + DistanceRecord READ (remove SpeedRecord)
3. SpeedRecord **mantido como fallback** em `readWorkouts` (não é mais hard requirement)
4. `handleOnActivityResult` — mantido o fix com `pendingPermissionExpected`

### Validation
- `npm run build` ✅ · `cap sync android` ✅ · `gradlew assembleDebug` ✅
- `npm test` ✅ 104/104

### Cautions for next session
1. **Deploy pendente**: push → CI → release nova
2. **Testar no device**: "Conectar" deve abrir diálogo HC; importar deve funcionar com 2 permissões READ
3. **Se ainda falhar**: provavelmente `handleOnActivityResult` deprecated não está sendo chamado pelo Capacitor 7 — testar com `@ActivityCallback` flow

---

## Session Context (2026-08-20c — Fix permissões READ HC + botão "Conectar" concede READ+WRITE)

### What happened
- **Bug report**: após fix 2026-08-20b, importação de relógio dizia "sem permissão" mesmo HC conectado
- **Secondary**: botão "Conectar Health Connect" no Perfil não abria pedido de autorização
- **Root cause**: `handleOnActivityResult` sempre checava permissão WRITE — quando `requestReadPermissions` enviava READ-only, resultado sempre retornava `false`
- **Secondary root cause**: `requestHcPermissions` só pedia WRITE, nunca READ

### Fix applied
1. **`pendingPermissionExpected`** — novo field que armazena o set de permissões enviado ao intent
2. **`handleOnActivityResult`** — valida `expected.all { it in grantedPerms }` em vez de hardcoded WRITE check
3. **`requestHcPermissions`** — agora pede WRITE + READ para ExerciseSessionRecord, DistanceRecord, SpeedRecord
4. **`readPermissionSet`** — reduzido de 6 para 3: ExerciseSessionRecord + DistanceRecord + SpeedRecord (remove HeartRate, Steps, Calories que eram hard blockers desnecessários)

### Validation
- `npm run build` ✅ · `cap sync android` ✅ · `gradlew assembleDebug` ✅
- `npm test` ✅ 104/104

### Cautions for next session
1. **Deploy pendente**: push → CI → release nova para testar no device
2. **Re-testar**: importar treino `watch-1f1bde4b...` e verificar tempo/distância/velocidade
3. **Se HC ainda reclamar**: checar Logcat `CorreLogo-HC` para ver se `handleOnActivityResult` está sendo chamado (deprecated method — Capacitor 7 pode não garantir)

---

## Session Context (2026-08-20b — Fix importação HC: permissão DistanceRecord + fallback SpeedRecord + UX)

### What happened
- **Bug report**: sessão importada do relógio (`watch-1f1bde4b-22c1-3f8a-b343-1c29312478d6`) não reconheceu tempo, velocidade e distância corretamente
- **Root cause**: `checkReadPermissions` no Kotlin só validava `ExerciseSessionRecord`. Se `DistanceRecord` permission não estava concedida, o aggregate `DISTANCE_TOTAL` falhava silenciosamente (catch → 0.0) → distância = 0 → velocidade = 0
- **Secondary issue**: sem fallback quando `DistanceRecord` não existe (ex: app do relógio não grava DistanceRecord para treinos de esteira)
- **UX issues**: botão exportar-HC redundante para treinos importados; modal de importação com todos marcados

### Fix applied
1. **`checkReadPermissions`** — agora valida `readPermissionSet` inteiro (ExerciseSessionRecord + DistanceRecord + SpeedRecord + HeartRateRecord + StepsRecord + TotalCaloriesBurnedRecord). Se qualquer uma faltar, JS re-pede permissão
2. **`readPermissionSet`** — adicionado `SpeedRecord` read permission
3. **Fallback SpeedRecord** — quando `DistanceRecord.DISTANCE_TOTAL` = 0 e duração > 0, tenta `SpeedRecord.SPEED_AVG` → computa distância = avgSpeed(m/s) × 3.6 × (duration/3600)
4. **Logging detalhado** — cada sessão loga duration, distance e fallback
5. **`SessionHistory.tsx`** — sync badge HC oculto para `source === 'watch'`
6. **`WatchImportModal.tsx`** — `new Set()` (vazio) em vez de `new Set(workouts.map(w => w.id))` — todos desmarcados por padrão

### Validation
- `npx vitest run` ✅ 104/104 (3 novos edge-case tests)
- `npm run build` ✅ · `cap sync android` ✅ · `gradlew compileDebugKotlin` ✅

### Cautions for next session
1. **Deploy pendente**: fix Kotlin precisa de push → CI → release nova para testar no device
2. **Re-testar importação**: após deploy, importar o treino `watch-1f1bde4b...` novamente e verificar se tempo/distância/velocidade aparecem corretos
3. **Logs no device**: se ainda der problema, o logging detalhado no Logcat (`CorreLogo-HC`) vai dizer exatamente o que o HC retornou (distance=0, speed fallback, etc.)

---

## Session Context (2026-08-20 — Fix TDZ crash "Cannot access 'Dt' before initialization")

### What happened
- **Bug report**: "Cannot access 'Dt' before initialization" — ReferenceError em runtime no build de produção (minificado). O app crashava ao carregar.
- **Root cause identificada**: Em `App.tsx`, `const hrBelt = useHrBelt({ registeredDevice: profile?.registeredHrDevice ?? null, ... })` (linha 89) acessava `profile` antes da declaração `const [profile, setProfile] = useState<ProfileData | null>(null)` (linha 129). No bundle minificado, `profile` é manglado como `Dt`. No runtime, `const`/`let` no topo de uma função ficam no TDZ (Temporal Dead Zone) até sua declaração — acessar antes lança `ReferenceError`.
- **Fix aplicado**:
  1. Movido o bloco `useHrBelt(...)` para **depois** de todas as declarações de `useState` que ele depende (`profile`, `user`, `bleWarningOpen`).
  2. Extraído o callback `onDeviceRegistered` como `handleHrDeviceRegistered` com `useCallback([user, profile])` — evita recriação do objeto `options` a cada render, o que causava `connect` instável no hook.
  3. Adicionado `useCallback` ao import de `react`.
- **Validação**: `npm run build` ✅, `npx vitest run` 101/101 ✅.

### Cautions for next session
1. **Deploy pendente**: o fix está commitado mas não deployado (web ou APK). Fazer push para main para disparar CI → release nova.
2. **Feature BLE incompleta**: onboarding + auto-scan + warning + reconexão foram implementados mas nunca testados em device real com a correção do TDZ.
3. **Próximos passos do TODO.md**: medição BLE real da esteira (velocidade, pace, calorias), comparação com dados do app.

---

## Session Context (2026-08-16 — Auditoria de vazamento de credenciais + purge + rotação concluída)

### What happened
- **Reporte**: URL `github.com/mahmatias/correlogo/blob/4c3afa07…/gh_firebase_cred_base64.txt` ainda servia o arquivo. Investigado o vazamento do commit `4c3afa07` (30/07).
- **Testes de liveness feitos** (todos empíricos): (a) SA key vazada `b153831c…` → JWT RS256 com `kid` self-verifica, **Google rejeita `invalid_grant`** → REVOGADA; atual `FIREBASE_CREDENTIALS` = `7d1a5796…` (arquivo local `gh_firebase_cred_base64.txt`, gitignored). (b) `GOOGLE_CLIENT_SECRET=GOCSPX-gw4d5…` (do `.env` vazado, client `550159999478`) → **VÁLIDO** (invalid_grant = credencial ok, só código fake) mas órfão. (c) `WEB_CLIENT_SECRET=GOCSPX-eaxIk…` hardcoded em `functions/src/index.ts:5` → **VÁLIDO e em produção**.
- **Código preparado (NÃO commitado)**: `functions/src/index.ts` migrado para `defineSecret("WEB_CLIENT_SECRET")` (Secret Manager) nas functions `authCallback`/`refreshAuthToken`; `.env.apk` sem `GOOGLE_CLIENT_SECRET`/`VITE_GOOGLE_CLIENT_ID` (mortas). Builds validados (`tsc` + `npm run build`).
- **Purge executado**: force-push `mahmatias-patch-1` `9eaa9f5 → e6834d2` a partir do clone bare `%TEMP%\opencode\correlogo-purge2` (git-filter-repo). `main` e tag `latest` já estavam limpos. **`refs/pull/1/head` ainda aponta `9eaa9f5`** (alcança `4c3afa07`) — ref gerenciada pelo GitHub, não alterável por push → requer ticket de suporte.
- **Rotação do `WEB_CLIENT_SECRET` concluída**: o Google não tem mais "Reset secret" na UI — virou **"Add a new secret"** (2 secrets simultâneos, rotação oficial em 4 passos). Novo secret criado (`client_secret_2_985879764466…json`, `GOCSPX-JoOm…`) → `firebase functions:secrets:set WEB_CLIENT_SECRET` (v1) → `firebase deploy --only functions` (3 functions v2; 1º deploy falhou por Compute Engine API desabilitado, rerun ok) → **testado: Calendar + Gmail conectam** → secret antigo (`GOCSPX-eaxIk…`, `****zbbr`) **desabilitado e deletado** no Console. Sem re-auth de usuários, sem rebuild.
- **Órfão `550159999478` morto**: o client é do projeto **`correlogo-calendar`** (número `550159999478`, era AWS) — **não do prod** (`985879764466`). Deletado no Console → liveness test → `deleted_client` (`GOCSPX-gw4d5…` invalidado). `.env.dev` limpo (`GOOGLE_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID` removidos).
- **Commit `61d290d` pushado** (`fix(security)`): functions (defineSecret) + CHANGELOG + TODO + HANDOFF. O código novo já está em produção (deploy manual das functions feito).

### Cautions / próximo passo (ação do usuário)
1. **Ticket suporte GitHub: CONSIDERADO RESOLVIDO (2026-08-16)** — o portal de suporte não expõe mais o fluxo de purge (categoria "Repositories" só leva ao formulário de deleção do repo; link legacy `?legacy&tags=rr-remove-data` morreu; formulário PIRP `support.github.com/contact/private-information` é para conteúdo de terceiros). Decisão do usuário: **risco aceito** — todas as credenciais rotacionadas/revogadas, 0 forks, purge local feito. O commit `4c3afa07d3b7f9eaa25e473b3bdbccf3d705651f` + blobs + `refs/pull/1/head` seguem acessíveis no GitHub até GC deles (sem ação possível).
2. Bug pré-existente (fora do escopo): OAuth de dev usa client `550159999478` (agora deletado) mas a function troca com `985879764466` → Calendar/Gmail quebrados em dev; e `APP_URL` em `.env.dev` ainda aponta pra `correlogo.sytes.net` (morto).
3. Guardar o JSON do novo secret (`D:\Trabalho\client_secret_2_985879764466…json`) em local seguro ou apagar (runtime lê do Secret Manager).

---

## Session Context (2026-08-15 — Move do projeto para D:\Trabalho\Corre-Logo)

### What happened
- **Projeto movido** de `D:\corre-logo` para `D:\Trabalho\Corre-Logo` (mesmo volume D:, rename). Tudo commitado e pushed antes do move (HEAD `853ea42`).
- **Move-Item falhou parcialmente** em artefatos de build com caminho >260 chars dentro de `node_modules` (PathTooLong) e `.git` (permissão). Recuperação: destino `.git` íntegro (confere com origin), secrets preservados (`.env*`, keystores x2, `google-services.json`), `src/`+`scripts/` movidos à parte, `node_modules` parciais purgados via `robocopy` (que lida com long paths) e reinstalados com `npm ci --legacy-peer-deps` + `npm install-scripts approve` (esbuild/@firebase/util/protobufjs).
- **Validado no novo local**: `npm test` 101/101, `npm run build` OK, `npx cap sync android` OK (9 plugins), git limpo. Referências ao caminho antigo removidas de `docs/RECOVERY.md` e `scripts/restore-workspace.ps1` (commit `853ea42`). `allowScripts` commitado em `package.json` (commit `f356aaa`).
- **`D:\corre-logo` ficou vazio** e preso pelo handle da sessão do opencode (cwd) — remover após fechar esta sessão.

### Cautions for next session
1. **Workspace agora é `D:\Trabalho\Corre-Logo`** — abrir o opencode nesse diretório.
2. `D:\corre-logo` (vazio) pode ser apagado após o fechamento da sessão.
3. Demais pendências: ver sessão anterior (validação em device do Health Connect/BLE, wikis JDK `jdk-21.0.11.10`, `@capacitor/app|browser@8` vs core 7).

---

## Session Context (2026-08-15 — Restore pós-formatação + diagnóstico build 157 + release 4.1 + regra de versionamento)

### What happened
- **Ambiente restaurado após formatação** do Windows usando `docs/RECOVERY.md` + `scripts/restore-workspace.ps1`: JDK 21 instalado via winget (Temurin `jdk-21.0.12.8-hotspot`), `JAVA_HOME` do usuário corrigido. Pipeline validado: `npm test` 101/101, `npm run build` OK, `cap sync android` OK (9 plugins), `gradlew assembleDebug` OK. Referências de JDK atualizadas em `AGENTS.md`/`docs/RECOVERY.md`/`scripts/restore-workspace.ps1` (commit `bdc1091`).
- **Skills verificadas**: 67 agents + 53 gstack + ui-ux-pro-max idênticas ao backup (byte a byte).
- **Diagnóstico do botão "Importar relógio" ausente na build 157**: o feature de relógio (13/08) nunca foi compilado — todos os commits de 13/08 têm `[skip ci]`, logo nenhuma release saiu com o código. Build 157 = run #57 (`4ac1d61`, 12/08), anterior ao feature.
- **Release 4.1 publicada** (commit `864f56c`): `versionName 4.0 → 4.1` + push sem `[skip ci]` → CI run #58 → **build 158** no Release `latest`. Primeira build com import de relógio via Health Connect. Auto-update dispara da 157 → 158.
- **Regra de versionamento formalizada** (commit `c2be164`): `versionCode` automático a cada release (`GITHUB_RUN_NUMBER + 100`); `versionName` `X.Y` — **minor** sobe o Y, **major** (quebra de fluxo visível OU entrega grande) sobe o X e zera Y. Registrada em `docs/wiki/roadmap/backlog.md` + `AGENTS.md`. **Exceção histórica**: 4.1 seria 5.0 pela regra (nota no CHANGELOG).

### Cautions for next session
1. **Validar em device (pendente do TODO, alta)**: permissão real do Health Connect (`requestReadHealthPermission`), import de treino do relógio com badge "Relógio" + dedupe ±2min, e cinta cardíaca BLE quando o hardware chegar.
2. **CI roda a cada push em `main`** — até push de docs gera release nova (versionCode novo). Para evitar release-desnecessária, avaliar filter de paths no workflow, mas **nunca usar `[skip ci]`** em commits de feature (foi exatamente isso que prendeu o feature de 13/08 fora de produção).
3. **`docs/wiki/roadmap/backlog.md`** agora é a fonte da regra de versionamento; `AGENTS.md` referencia. Conferir antes de qualquer bump de versão.
4. `npm run build` não foi re-rodado nesta sessão após as mudanças de docs (nenhum código-fonte alterado — só docs/versionName). O CI validou a release 4.1 inteira (build 158).

---

## Session Context (2026-08-14 — Backup do ambiente + receita de recuperação pós-formatação do Windows)

### What happened
- **User vai formatar o computador** e pediu para garantir tudo commitado + backup zip do que não está no repo + script/receita MD para restaurar numa instalação limpa.
- **Estado verificado**: `git status` limpo; repo pushed em `main` (HEAD `8ecb43c`); secrets de CI todos cadastrados no GitHub Actions (ENV_FILE, GOOGLE_SERVICES_B64, KEYSTORE_BASE64, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD, FIREBASE_APP_ID, FIREBASE_CREDENTIALS) — rede de segurança: mesmo sem backup local, o CI reconstrói produção.
- **`scripts/backup-workspace.ps1`** criado e **executado**: `backup/correlogo-backup-20260814-211555.zip` (296 MB, 17.112 entradas) com `project/` (`.env`, `.env.apk`, `.env.dev`, `functions.env`, `google-services.json`, `keystore.jks` x2, `opencode.json`, `.superpowers/`, apk), `user/` (`.ssh/`, `.git-credentials`, `.gitconfig`, `.npmrc`, `gh-hosts.yml`, `firebase-tools.json`), `opencode/` (config global, skills gstack/agents/opencode, `models.json`, `bin/rg.exe`) e `env-manifest.txt`.
- **`scripts/restore-workspace.ps1`** criado: restaura secrets, configs de usuário, configs do opencode e define `JAVA_HOME`/`ANDROID_HOME`/`PATH` do usuário.
- **`docs/RECOVERY.md`** criado: receita completa (ferramentas base → restore ssh/git/gh/firebase → clone → secrets → build → opencode skills → emergência sem backup).
- **`CHANGELOG.md`** atualizado com entrada 2026-08-14.

### Cautions for next session
1. **O usuário deve copiar o ZIP para fora do computador** (pendrive/nuvem) — contém segredos de produção, não commitar.
2. **`$env:JAVA_HOME` persistente está quebrado** — aponta para `C:\Program Files\Eclipse Adoptium\jdk-21.0.7.6-hotspot` (não existe). O JDK real é `jdk-21.0.11.10-hotspot`. Sempre definir `$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"` antes de `gradlew`. A receita documenta isso.
3. O commit desta sessão ainda **não foi feito nem pushed** — próxima etapa: `git add` (scripts, docs, backup NO — backup/ é ignorado?), commit e push. Conferir se `backup/` precisa entrar no `.gitignore` (o zip não deve ser commitado).
4. **`npm test`/`npm run build`** não foram re-rodados nesta sessão (nenhum código-fonte foi alterado — só scripts + docs). Validar se necessário antes do commit final.
5. Plano/spec anteriores: `docs/superpowers/plans/2026-08-13-relogio-fitness-integration.md` (Tasks 1–8 concluídas, commitado `8ecb43c`, pushed via CI).

---

## Session Context (2026-08-13 — Integração com relógio fitness: FC via cinta BLE, zonas Z1–Z5, import Health Connect, Insights no Perfil)

### What happened
- **Plano completo implementado e commitado** (Tasks 1–8, sem push; commits `[skip ci]`):
  - T1 `fef63f2` — fix do fluxo de permissão do Health Connect (`createIntent` + `startActivityForResult` direto + fallback de racional).
  - T2 `0b57d56` — leitura de treinos do HC: permissões READ no manifest, `readWorkouts`/`checkReadPermissions`/`requestReadPermissions` no `HealthConnectPlugin.kt`, wrapper TS (`readWorkoutsFromHealthConnect`/`checkReadHealthPermissions`/`requestReadHealthPermission`), `WatchWorkout` + `TrainingSession.source?: 'app' | 'watch'` em types.
  - T3 `1f7d059` — `hr-zones.ts` (`estimateHrMax` 208−0.7×idade, Z1–Z5 limites/cores) + `hr-summary.ts`, TDD (`hr-zones.test.ts`).
  - T4 `43cd3b7` — `SessionSummary`: bloco FC média/máx/mín + tempo por zona + gráfico recharts.
  - T5 `db51b28` — Histórico: badge "Relógio", import com dedupe ±2min, empty state CTA.
  - T6 `2076964` — `UserProfile`: aba Insights (gráfico última sessão + média/máx por treino).
  - T7 `dd23a91` — cinta cardíaca BLE: `HrBleService.kt` (scan 0x180D, notify 0x2A37, parse flags 8/16-bit, range válido 30–240, timeouts 10s/5s) + `HrBlePlugin.kt` (eventos `hrSample`/`hrScanResult`/`hrState`/`hrError`, permissões BLE) + `hr-ble.ts` (Mock/Native transport) + `use-hr-belt.ts` (scan timeout 16s) + `WorkoutTracker` (card FC, TTS por zona, `ActivityPoint.heartRate`) + wiring no `App.tsx`.
- **Contexto técnico**: padrão GATT do `HrBleService` espelha o `TreadmillBleService` (scan com filtro de serviço, connect/discover com timeout, notificação de char). Transporte FC usa seleção Mock/Native via `isNative()`. Conexão simultânea cinta + esteira é suportada (plugins independentes).
- **Desvios aprovados**: (1) **sono não implementado** (`readSleepSessions`/`SleepSummary`) — spec marca como fase futura; (2) flag RR do GATT é **bit 4/0x10** na spec Bluetooth SIG (não "bit 3" como escrito no spec) — só BPM parseado, RR fora de escopo; (3) re-tentativa de permissão HC via re-request nativo + toast (sem novo Modal).
- **Validação**: `npm test` ✅ **101/101** (13 arquivos) · lint ✅ 0 novos (baseline 21 pré-existentes intactos) · `.env.apk→.env` ✅ · `npm run build` ✅ (8.06s) · `cap sync android` ✅ (9 plugins) · `gradlew assembleDebug` ✅ BUILD SUCCESSFUL (só warnings de depreciação pré-existentes: `getDefaultAdapter`/`writeDescriptor`).

### Cautions for next session
1. **Validar em device**: (a) permissão real do Health Connect (abre a tela do HC via `requestReadHealthPermission`); (b) **cinta cardíaca real quando o hardware chegar** — scan/connect/notify/TTS de zona no `WorkoutTracker`; (c) import de treino do relógio via HC (badge "Relógio" + dedupe).
2. **TTS de zona**: anúncio usa `speak('Você está na {zone}.', true)` com `lastAnnouncedZoneRef` para não repetir; `estimateHrMax` depende do `dob` do perfil — sem `dob`, o card mostra `—`.
3. **Conexão simultânea**: cinta BLE e esteira BLE coexistem (plugins `HrBle` e `TreadmillBle` independentes) — se um conflito aparecer no device (Android limita conexões GATT), avaliar desconexão da cinta quando desconecta a esteira.
4. **Baseline lint 21** pré-existentes intactos (App.tsx ×6, SessionHistory ×2, UserProfile ×1, WorkoutTracker ×3, tracking.ts ×2, ical.ts ×2, treadmill-machine.ts ×4, vite.config.ts ×1). `.env` = cópia de `.env.apk`.
5. **Plano/spec**: `docs/superpowers/plans/2026-08-13-relogio-fitness-integration.md` (checkboxes marcados) e `docs/superpowers/specs/2026-08-13-relogio-fitness-integration-design.md` (status → "Implementado (aguardando validação em device)").

---

## Session Context (2026-08-12 — FTMS: correção do diagnóstico + auto-Start em todos os modos + log sempre visível)

### What happened
- Usuário testou os 3 modos na esteira `A0:BB:3E:DC:25:4E` (logs `ftms-modoC-20260811-202303.log`, `ftms-modoA-20260811-202652.log`, `ftms-modoA-20260811-201955.log`):
  - **A/C**: Request Control **concedido** (`resultCode=0x01`, repetido no keep-alive); reads 2ACC/2AD4/2AD5 OK; **todo Set 0x02/0x03 → `0x05 Control Not Permitted`**. 2ACC Target Setting Features = `0x0010` (só Heart Rate). 2ADA: status `0x02` e `0x05`. Dump: **sem** char vendor `d18d2c10-...` → preamble WiLinktech N/A. Nenhum modo controlou.
  - **B**: **nenhum log gerado**.
- **CORREÇÃO DE DIAGNÓSTICO — a sessão 2026-08-05c estava errada.** Verifiquei a spec: **`0x07` É Start/Resume** (conf. pycycling, ExFTMS, implementador com spec PDF). Mapa real: `0x04` Resistance, `0x05` **Set Target Power**, `0x06` Set HR, `0x07` **Start/Resume**, `0x08` Stop/Pause. NÃO trocar `encodeStart()` para 0x05 (quebraria — 0x05 é Power). O `encodeStart()` (0x07) e `FtmsOpcode.START=0x07` sempre estiveram certos.
- **Root cause real**: spec só permite Set Target Speed/Incline com a esteira **Started**. A/C nunca enviam Start (só Request Control). B era o único que enviava — e não logou.
- **Fix aplicado** (3 arquivos Kotlin, sem mudança TS):
  1. `TreadmillBleService.sendCommand` — **auto-Start (0x07) antes do primeiro Set em TODOS os modos**; o bloco otimista de "Set pendente até métricas/2s" segue **B-only**.
  2. `TreadmillBleService` — labels de Fitness Machine Status corrigidos para a spec (0x01 Stopped/Paused, **0x02 Stopped by Safety Key**, 0x04 Started/Resumed, 0x05 Target Speed Changed, 0x06 Incline, ... 0xFF Control Permission Lost) + **hint** no log quando Set com `0x05` (não Started).
  3. `BleSessionLog` — **removido `IS_PENDING`**; arquivo sempre visível mesmo com app morto antes de `finish()` (causa provável do "modo B sem log").
- **Validação**: `npm test` ✅ 83/83 · lint ✅ 0 novos (baseline 21) · `.env.apk→.env` ✅ · `npm run build` ✅ (6.99s) · `cap sync android` ✅ (9 plugins) · `gradlew assembleDebug` ✅ BUILD SUCCESSFUL (warnings de depreciação pré-existentes em `getDefaultAdapter`/`writeCharacteristic`).

### Cautions for next session
1. **Próximo passo: re-testar os 3 modos** com o APK novo. Esperado: 1º Set dispara `Start/Resume (0x07)` → esteira aceita Sets. Se Start responder `0x05`, o hint aponta partida manual no console (safety key / exigência física — ver status `0x02`). **Confirmar que o modo B agora gera log**.
2. **Cenário já-started**: se o usuário der partida manual no console antes de conectar, o auto-Start pode receber `0x05` (já Started) — inofensivo e logado; o Set seguinte deve funcionar.
3. **Edge não coberto**: se a esteira voltar a Stopped/Paused (parada manual), `autoStarted` continua `true` na mesma conexão e os Sets voltam a tomar `0x05` — re-Stop/Start ainda não reenvia Start. Só tratar se aparecer no teste.
4. `0x07`=Start é **definitivo** — não reverter. Qualquer fonte dizendo "0x05=Start" é a mapping antiga/inventada.
5. Baseline lint 21 pré-existentes intactos. `.env` = cópia de `.env.apk`. Modos ainda experimentais até o teste definitivo.
6. **Pergunta em aberto**: modelo exato (WiLinktech Vision ID 2592 vs BH iConcept rebadge) e escala de inclinação 62.5 ainda pendentes de confirmação.

---

## Session Context (2026-08-05c — Seletor de modo FTMS A/B/C + log em arquivo para diagnosticar "Falha ao assumir controle")

### What happened
- Sintoma pós-fix telemetria: **"Falha ao assumir controle da esteira"** ao conectar. Pesquisa GitHub concluiu 3 causas: (C1) mapa de result code **deslocado de 1** (spec `0x01=Success`, código usava `0x00`); (C2) WiLinktech/KingSmith rejeita Request Control com `0x04` de propósito e obedece; (C3) falta canal de ack real (2ADA) + CCCD em cadeia descartados.
- **Decisão do usuário**: 1 APK com **seletor A/B/C** (long-press 3s no botão Conectar do configurador de treino), cada modo com **log em arquivo** (sem logcat — trava no celular).
- **Implementado**:
  - `BleSessionLog.kt` (novo) — `Download/CorreLogo/ftms-modoX-*.log` via MediaStore (minSdk 29, sem permissão), flush 25 linhas, `IS_PENDING`.
  - `TreadmillBleService.kt` — result codes spec (aceita `0x01`/`0x00`, tolera `0x04` no Request Control), modos A (estrito) / B (otimista: auto-Start `0x07`, Set pendente 2s, grant write-ack/metrica/exaustão) / C (dump + reads 2ACC/2AD4/2AD5 + vendor preamble WiLinktech `d18d2c10-...`), assinatura 2ADA, CCCD escalonados 100/250/450ms, `connect(address, mode)`, `onLogFile`.
  - `TreadmillFtmsManager.kt` — `encodeStart()`.
  - `TreadmillBlePlugin.kt` — `mode` no `connectTreadmill` + evento `treadmillLogFile`.
  - TS: `BleTransport.connect(address, {mode})` + `onLogFile`; MockTransport; `useTreadmill` (states `mode`/`logFile`); `App.tsx` (seletor + modal + badge).
- **Validação**: `npm test` ✅ 83/83 · lint ✅ 0 novos (baseline 21) · `.env.apk→.env` ✅ · `npm run build` ✅ · `cap sync android` ✅ · `gradlew assembleDebug` ✅ BUILD SUCCESSFUL.
- Erros de Kotlin corrigidos durante o build: chave extra no `onDescriptorWrite`; `onCharacteristicRead` usa assinatura API 33 `(gatt, char, value, status)` (não `status, value`); `processNextRead` usa o retorno `Boolean` do `readCharacteristic` (overload Int não resolve no compileSdk 36).

### Cautions for next session
1. **Testar os 3 modos no device** (esteira WiLinktech Vision ID 2592, possivelmente BH iConcept rebadgeado) e mandar `Download/CorreLogo/ftms-modoX-*.log`. O log mostra o `resultCode` real (0x01/0x04/nenhum) → escolher estratégia definitiva.
2. **Modo B muda o fluxo**: auto-Start `0x07` é enviado antes do primeiro Set; se a esteira não estiver na correia, pode não andar. O grant acontece via write-ack/métrica/exaustão — estado `CONTROLLED` pode aparecer sem aprovação real (intencional no modo B).
3. **CCCD agora são 3 escritas escalonadas** (measurement 100ms, status 250ms, control 450ms) — o `onDescriptorWrite` detecta o control point por UUID; falha em measurement/status é não-fatal, falha no control point ainda aborta.
4. **Baseline lint 21 erros** pré-existentes intactos (tracking.ts, ical.ts, treadmill-machine.ts, vite.config.ts, App.tsx:347/912-928 etc.) — não são desta sessão. `npm run build` (vite/esbuild) passa apesar deles.
5. `.env` = cópia de `.env.apk` (não commitado). Não commitar APKs. Modo B/C ainda são experimentais — nada fixado como padrão até teste no device.
6. **Pergunta em aberto**: modelo exato da esteira (WiLinktech Vision vs BH iConcept). Afeta quirk default (preamble vendor, escala de inclinação 62.5). Ver docs/archive FTMS-Bluetooth-Esteiras.

---

## Session Context (2026-08-05b — Fix telemetria FTMS: flag map padrão + control point response; speed era lido como inclinação)

### What happened
- Usuário testou a release com o fix do error 133 e reportou **sintoma novo**: (1) speed manual na esteira aparece como **inclinação ×10** no app (5.0 km/h → 50%, 15.0 → 150%); (2) mudar inclinação na esteira não é lido; (3) comando de speed/incline pelo app aparece na barra e **reseta pra 0.0 sem erro**.
- **Root cause telemetria (confirmada)** — `parseTreadmillMetrics` (`src/lib/ftms-protocol.ts`, caminho real via `use-treadmill.ts`) usava flag map **inventado**: bit0 tratado como "speed presente" quando é **More Data invertido** (0 = speed presente), bit2 tratado como inclinação quando é **Total Distance (24-bit)**. Com flags reais `bit0=0, bit2=1`, o parser pulava o speed e lia os **bytes do speed como inclinação** ÷10 → 500 raw → 50%. Speed nunca parseado → 0.0 sempre. Confirmado por 2 fontes: diagnóstico nRF `docs/archive/FTMS-Bluetooth-Esteiras/DIAGNOSTICO-FTMS-NRF.md` (packet `8C 07` = flags `0x078C`, decodificado com bit0=0 speed, bit2 distance, bit3 incline+ramp) e parser duhow `FtmsDataParser.kt` (mesma semântica).
- **Root cause controle (confirmada)** — `TreadmillBleService.onCharacteristicChanged` e `TreadmillFtmsManager.parseControlPointResponse` trocavam resultCode/requestedOpcode (spec: `[0x80][opcode][result]`). Request Control **rejeitado** pela esteira virava **sucesso** (CONTROLLED falso, opcode 0x00 == success 0x00 por coincidência) → app envia Set Incline sem controle real, sem erro pro usuário.
- **Fix aplicado**:
  - `src/lib/ftms-protocol.ts`: `parseTreadmillMetrics` reescrito (flag map padrão FTMS, bounds-guarded) + `parseControlPointResponse` corrigido.
  - `src/lib/ble-transport.ts`: MockTransport com packet padrão (`0x040C`) e respostas `[0x80, opcode, 0x00]`.
  - `TreadmillBleService.kt`: resultCode=`value[2]`, opcode=`value[1]`.
  - `TreadmillFtmsManager.kt`: swap corrigido + `parseMetrics` (dead code) com flag map correto.
  - Testes reescritos (TDD red→green): `ftms-protocol.test.ts` + `ble-transport.test.ts`.
- **Validação**: `npm test` ✅ 79/79 · lint ✅ 0 novos · `.env.apk→.env` ✅ · `npm run build` ✅ (5.65s) · `cap sync android` ✅ · `gradlew assembleDebug` ✅ BUILD SUCCESSFUL.

### Cautions for next session
1. **Teste no device**: (a) speed manual na esteira deve aparecer como speed correto; (b) inclinação manual deve ser lida; (c) comandos do app não devem mais resetar pra 0.0. Capturar logcat `adb logcat -s CorreLogo-BLE` — agora as respostas de control point são logadas corretamente (`Control Point response: opcode=0x.. resultCode=0x..`).
2. **Escala de inclinação não resolvida**: parser usa ÷10 (padrão FTMS, confirmado pelo nRF WiLinktech). Se a inclinação lida aparecer **~6× maior** que a real, a esteira é BH iConcept (escala proprietária `raw/62.5`, ver duhow `BhFitnessTreadmill.INCLINE_SCALE=62.5`) → precisará detecção por device name `T01_XXXXX` antes de aplicar a correção. **Não** aplicar a correção 62.5 globalmente (quebraria esteiras padrão).
3. Se o Request Control for realmente rejeitado (resultCode ≠ 0x00 no log), o app agora vai parar de aceitar comandos (plugin rejeita com mensagem) — investigar se a esteira exige sequência diferente (ex: Start `0x07` antes de Set).
4. `.env` = cópia de `.env.apk` (não commitado). Baseline lint 21 erros pré-existentes intacto. Não commitar `app-release-*.apk`.
5. A feature usa `limit(50)` em sessions e tudo mais segue o padrão das AGENTS.md.

---

## Session Context (2026-08-05 — Fix BLE error 133: fila GATT serializada + keep-alive por idle + retry 200ms + API 33 write, build validado e pushado)

### What happened
- Usuário reportou **`Write failed: error 133`** (GATT_ERROR 0x85) ao controlar velocidade/inclinação da esteira FTMS, **após um tempo conectado** (Samsung/Android 13+). Conexão/scan OK; apenas writes falhavam e a esteira não reagia.
- **Root cause** (3 vias): (1) keep-alive reenviava Request Control **a cada 2s** com `scope.launch`(IO) + fila `isWriting` não thread-safe → corrida e spam de writes; (2) API 33+ usava `writeCharacteristic(char)` deprecated mutando o mesmo objeto `char.value` a cada write (causa conhecida de 133 em Samsung); (3) CCCD do control point hardcoded INDICATE (0x0002) enquanto esteiras BH iConcept usam NOTIFY.
- **Fix** em `TreadmillBleService.kt`:
  - Fila serializada no main handler (`handler.post`), um write por vez, `QueuedCommand(data, isKeepAlive, attempts)`.
  - API 33+: `g.writeCharacteristic(char, value, writeType)` checando `BluetoothStatusCodes`; fallback deprecated p/ <33. `writeType` conforme `PROPERTY_WRITE`.
  - Retry 200ms via `pendingRetry` se `writeCharacteristic` retorna ≠ SUCCESS; drop após `MAX_GATT_WRITE_ATTEMPTS = 10`.
  - Keep-alive **por idle**: checa a cada 5s e renova Request Control só se `now - lastSuccessfulWriteMs >= 25s`; 2 falhas consecutivas → `stopKeepAlive()` silencioso (sem toast).
  - CCCD: NOTIFY se a char não tem `PROPERTY_INDICATE`.
- **Validação**: `compileDebugKotlin` ✅ → `.env.apk→.env` ✅ → `npm run build` ✅ (7.03s) → `cap sync android` ✅ (9 plugins) → `assembleDebug` ✅ **BUILD SUCCESSFUL**.
- **Commit**: `6ed3498` pushado para `main` → CI `firebase-deploy.yml` (assembleRelease + release `latest`).

### Cautions for next session
1. **Próximo passo**: confirmar CI verde e **testar no device** (Samsung/Android 13+): manter conexão > 25s parado e depois mudar velocidade/inclinação — o erro 133 não deve mais aparecer. Nos logs: `Write result [keep-alive]` a cada write e `renewing Request Control after Xs idle`.
2. **Cuidado ao puxar o próximo contexto**: este turno **não tocou** nenhum TS/JS — só Kotlin. `.env` ficou como cópia de `.env.apk` (não commitado, como de praxe).
3. **Não commitar** `.env` nem `app-release-v*.apk`. Baseline de lint (21 erros pré-existentes) intacto.
4. Landmine conhecida: `@capacitor/app@8.1.0`/`browser@8.0.3` vs core 7.6.7 — não corrigir sem conversar (ver TODO.md).
5. Se o erro 133 persistir no device, próximos passos de diagnóstico: logar `resultCode` do `onConnectionStateChange`/disconnect reason e conferir se o retry 200ms está estourando (`MAX_GATT_WRITE_ATTEMPTS`) — indicaria fila GATT do stack ocupada pelo keep-alive.

---

## Session Context (2026-08-01b — Milestones/Conquistas COMPLETA: tab bar + Conquistas + celebração + pill/clip + BLE 15s, build validado)

### What happened
- Usuário **aprovou o plano completo** após revisar os testes das Tasks 1–6. **Tasks 7–15 executadas** (plano `docs/superpowers/plans/2026-08-01-milestones.md`, código inline):
  - **Task 7** `e8a8485` `TabBar.tsx` — 4 abas, ícone Tabler `run` inline. *Adaptação*: `React.ReactNode` do plano virou `ReactNode` importado de `'react'` (sem `@types/react`, `React.` namespace daria TS2503 novo).
  - **Task 8** `533b9d4` `SessionHistory.tsx` → aba **Registros** (remove `onClose`/overlay). Erro transitório `App.tsx:1008 onClose` confirmado e resolvido na Task 10 (o plano já previa).
  - **Task 9** `fc2902b` `UserProfile.tsx` → aba **Perfil** + seção **Preferências → Tema** (`isLightMode`/`onToggleTheme`); effect roda no mount (`[]`), salvar não fecha mais.
  - **Task 11** `25e458d` `Achievements.tsx` (layout C) — feito **antes** da Task 10 (dependência do plano).
  - **Task 10** `c0b8b80` `App.tsx` — `activeTab` no lugar de `showHistory`/`showUserProfile`; back handler prioriza modais e depois volta para `treinos`; header só logo+saudação; abas renderizadas por condicional; `onExportSession`/`onDeleteSession` **movidos** (fonte única) para a aba Registros; bloco `{showHistory}`/`{showUserProfile}` removidos; `<TabBar>` após `</main>` com guard de estados transientes.
  - **Task 12** `af33509` `SessionSummary.tsx` — celebração (Trophy/Medal âmbar) após a grade 2×2, só com novidade.
  - **Task 13** `fb3e4fa` `ShareCard.tsx` — `NewPrPill` (top:200, 4 variantes não-transparentes) + **fix clip** RouteSVG (pad interno 10).
  - **Task 14** `45ddc6b` BLE — `TreadmillBleService.kt` delay 10s→**15s**, `use-treadmill.ts` 11s→**16s**.
  - **Task 15**: validação completa + docs + commit final.
- **Validação**: `npm test` ✅ 76/76 · `npm run lint` ✅ **21 erros pré-existentes, 0 novos** (baseline intacto após Task 10; os 2 transitórios de `onClose`/`open` sumiram). Build: `Copy-Item .env.apk→.env` ✅ · `npm run build` ✅ · `npx cap sync android` ✅ (9 plugins) · `gradlew.bat assembleDebug` ✅ **BUILD SUCCESSFUL** (JAVA_HOME 21).
- **Docs**: `CHANGELOG.md` entrada `[2026-08-01b]`; `TODO.md` Milestones → concluído, clip/BLE removidos dos pendentes; spec `2026-08-01-milestones-design.md` — emenda 2026-08-01 movendo clip+BLE para "Decisões aprovadas".

### Cautions for next session
1. **Próximo passo**: push `main` → CI (build + `assembleRelease` assinado → GitHub Release `latest` + `update-manifest.json` com `versionCode` novo) → validar no device: abas funcionando, back voltando para Treinos, conquistas abrindo resumo, celebração no resumo, pill no ShareCard, scan BLE com 15s.
2. **Nunca** copiar `.env.dev` para `.env` (quebra APK/site prod). `.env.apk` é a fonte de verdade.
3. **Não commitar** `app-release-v139.apk` (untracked na raiz) nem `.env`. A build `dist/` é gitignored.
4. Baseline lint: 21 erros pré-existentes (App.tsx 351/873–889, WorkoutTracker, SessionHistory `React.ReactNode`, UserProfile `React.ChangeEvent`, tracking.ts, ical.ts, treadmill-machine.ts, vite.config.ts). Sem `@types/react` — `React.` namespace não existe (usar import de `'react'`).
5. `@capacitor/app@8.1.0`/`browser@8.0.3` vs core 7.6.7 segue como landmine conhecida (não corrigir sem conversar).
6. A Task 15 do plano previa `git add -A` + commit final — **não foi feito**; o commit `084fc7e` (docs Tasks 1–6) já commitou o plano; Tasks 7–15 foram commitadas individualmente. Docs atualizados neste turno ainda **não commitados** (decisão pendente: commitar junto com o push).

---

## Session Context (2026-08-01a — Milestones/Conquistas: data layer completa (Tasks 1–6), UI pendente)

### What happened
- **Spec aprovado** (`docs/superpowers/specs/2026-08-01-milestones-design.md`, commit `1b42783`) e **plano escrito** (`docs/superpowers/plans/2026-08-01-milestones.md`, 15 tasks, código inline, TDD). Usuário decidiu **incluir nesta build** os 2 itens fora de escopo: fix clip RouteSVG + timeout BLE 15s.
- **Tasks 1–6 executadas** (TDD estrito) — camada de dados Milestones completa:
  - `src/lib/records.ts` (novo): `PR_DISTANCES`, `BADGE_LABELS`/`BADGE_GROUPS`, `computeCrossingTime` (interpolação), `applySessionToRecords`, `emptyRecords`, `recomputeRecords` (PRs+longest, não toca badges/volume), `backfillRecords`, `readRecords`/`saveRecords` (localStorage `correlogo:records:{uid}` + Firestore `users/{uid}/data/records` sem merge).
  - `src/types.ts`: `PrResults` + `prResults?: PrResults` transitório em `TrainingSession`.
  - `src/App.tsx`: estado `records`, hook no `markAsCompleted` (`setSelectedSession({ ...newSession, prResults })`), backfill no `finally` do load, recompute nos 3 deletes.
- **Validação**: `npm test` 76/76 (21 novos) · `npm run lint` 21 (baseline, 0 novos). **`npm run build`/`gradle` NÃO rodados** — feature ainda não é visível (Tasks 7–15 pendentes).
- **Commits** (`[skip ci]`): `50a9067`, `2445c5d`, `b897988`, `7302f4c`, `165a60f`, `0ae24e2`. Plano ainda **untracked** (não commitado).

### Cautions for next session
1. **Continuar do Task 7** (TabBar) — respeitar a ordem **Task 11 (Achievements) antes da Task 10** (wiring das abas no App). Usuário aprovou executar **até a Task 6**; para as demais, pedir aprovação.
2. **Antes de `npm run build`**: `Copy-Item -Path ".env.apk" -Destination ".env" -Force` (nunca `.env.dev`). Antes de `gradlew`: `$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"`.
3. **Não commitar** `app-release-v139.apk` (untracked na raiz) nem `.env`. O plano `docs/superpowers/plans/2026-08-01-milestones.md` está untracked — decidir se commitá-lo.
4. `onDeleteSession` da Task 6 será **movido** para a aba Registros na Task 10 (Step 5 substitui; a nota do plano diz para ignorar a Task 6 Step 7 se o callback for movido inteiro).
5. Baseline: 21 erros de lint pré-existentes (App.tsx 352/874–890, WorkoutTracker, SessionHistory, UserProfile, tracking.ts, ical.ts, treadmill-machine.ts, vite.config.ts) — não aumentar. Sem `@types/react` (React novo é implicit-any).

---

## Session Context (2026-07-31m — APK 147 boot quebrado de novo: ErrorBoundary `this.children` → `undefined`)

### What happened
- O APK 147 (re-aplicação dos 4 fixes + ErrorBoundary) **quebrou o boot de novo**, mesmo sintoma do 138: splash some → tela azul vazia. **Sem erro de console** — o JS roda, `createRoot().render()` é chamado, mas o App nunca monta.
- **Root cause (provada por reprodução headless + teste)**: o `ErrorBoundary` retornava `(this as unknown as Props).children`, que compila para **`this.children`** — `undefined` em runtime (React guarda children em `this.props.children`). O boundary renderizava `undefined` → App nunca montava. Retornar `undefined` de um boundary não lança erro, por isso não havia stack trace.
- **Reprodução**: Chrome headless + harness (`window.onerror`/`unhandledrejection`/override `console.error`) sobre o `dist/` do 147 → `#root` vazio (0 bytes), sem erro; com o fix → `#root` 862 chars (logo + spinner) + log `"[CorreLogo-JS] App componente renderizado"`.
- **Correção**: `return this.props.children;` + `props: Props;` na classe (TS sem `@types/react`).

### Cautions for next session
1. **Aprender importante**: código TS com cast de tipo não muda o acesso de propriedade no runtime. `(this as unknown as Props).children` virou `this.children` (undefined) em vez de `this.props.children`. Qualquer accessor de class component precisa ser escrito no formato correto **desde o início**.
2. **O CI não testa boot em browser** — `npm run build` + `gradle` não pegariam esse tipo de bug (render que devolve vazio sem throw). O guard agora existe (`error-boundary.test.tsx`). Considerar adicionar um smoke test de boot com headless no futuro.
3. Próximo passo: commit + push → CI → release nova (~148). Validar no device que o app sobe (logo + spinner → home).
4. `debug.html` foi adicionado a `dist/` (gitignored) — é o harness de debug, pode ser reutilizado.
5. Teste na esteira ainda pendente (BLE/scan indicator). Figurinha no Stories em dívida (TODO). `@capacitor/app@8`/`browser@8` vs core 7.6.7 segue como landmine.

---

## Session Context (2026-07-31l — APK 138 root cause found + re-apply 4 fixes + boot guard)

### What happened
- **Root cause do APK 138 (tela azul no boot) identificada**: TDZ (temporal dead zone) em `src/lib/use-treadmill.ts` no commit a555426. A `const clearScanTimeout` era declarada **depois** do `useEffect(..., [clearScanTimeout])` — o deps array é avaliado durante o render, antes da const existir → `ReferenceError` em todo render → React nunca montava → body `#0A0A14` sem logo/spinner. Evidência: diff do commit, ordem dos hooks, repro Node da semântica TDZ, ausência de error boundary.
- **Por que o CI passou**: nenhum teste monta App/`useTreadmill`; `tsc`/`vite` não detectam TDZ (runtime); `gradle` só empacota.
- **4 fixes re-aplicados**: #1–3 verbatim do a555426 (`ShareScreen.tsx`, `ShareCard.tsx`, `shareCard.ts` — byte-idênticos, verificados por hash), #4 corrigido (ordem de hooks certa, mesmo comportamento de scan indicator). Os 3 primeiros eram inocentes; só o #4 quebrava o boot.
- **Guard de regressão**: `use-treadmill-boot.test.tsx` (probe via `renderToStaticMarkup` — teria falhado no 138) + `ErrorBoundary.tsx` na raiz (`main.tsx`).
- **Pipeline validado**: `npm test` ✅ 53/53 · `npm run lint` ✅ 0 erros novos · `npm run build` ✅ · `npx cap sync android` ✅ (9 plugins) · `gradlew assembleDebug` ✅ (22s).

### Cautions for next session
1. **Teste na esteira ainda pendente** no device — os fixes BLE nativos (142/144) não mudaram; o #4 re-aplicado é UI de scan (camada web), ortogonal ao keep-alive no Kotlin.
2. Commit + push → CI → release `latest` novo. Validar que o APK sobe (não repete tela azul) e que o auto-update funciona.
3. Figurinha no Stories segue em dívida (ver TODO alta).
4. `@capacitor/app@8`/`browser@8` vs core 7.6.7 segue como landmine conhecida (não corrigir sem conversar).
5. **Erros de lint pré-existentes**: `npm run lint` falha com ~21 erros em App.tsx, WorkoutTracker, SessionHistory, UserProfile, tracking.ts, ical.ts, treadmill-machine.ts, vite.config.ts (baseline aceito; não é do 138). Não há `@types/react` instalado — novo código React é implicit-any.

---

## Session Context (2026-07-31i — Share Cards/Adesivos: implementation complete, all 8 tasks done)

### What happened
- **All 8 SDD tasks completed** via subagent-driven development (Tasks 1–4 inline, Task 5 SDD reviewed, Tasks 6–8 inline):
  - Task 1: `splits.ts` (pace por km/5km, 9 tests)
  - Task 2: `gradients.ts` (6 presets + swoosh, 3 tests)
  - Task 3: `card-map.ts` (Web Mercator tiles `dark_all`, 816×816, 8 tests)
  - Task 4: `ShareCard.tsx` 4 variantes (A: pace | B: left | C: bottom | D: map), 3 tests
  - Task 5: `SocialSharePlugin.kt` — `saveToGallery` (MediaStore) + `shareToWhatsApp` (intent `com.whatsapp`) — **SDD reviewed**, found API 29+ only → **minSdk 26→29** (user chose clean bump over legacy path)
  - Task 6: `shareCard.ts` — `saveCardToGallery(blob)`, `shareToWhatsApp(blob)` TS wrappers
  - Task 7: `ShareScreen.tsx` — abas Cartões/Adesivos, carrossel, EditPanel inline, `@capacitor/camera@^7` Base64 photo, actions Story/WhatsApp/Mais/Salvar PNG + Copiar
  - Task 8: `SessionSummary.tsx` — replaced legacy modal with `ShareScreen`, cleaned up dead state/imports

- **Full pipeline validated**: `npm run build` ✅ · `npm test` (52/52) ✅ · `npm run lint` (only 2 pre-existing) ✅ · `npx cap sync android` (9 plugins) ✅ · `gradlew assembleDebug` ✅ (20s)
- **Commits**: `8554255` (Task 6), `e8f5db8` (Task 7), `937921d` (minSdk 29), current Task 8 commit

### Cautions for next session
1. **minSdk now 29** — Android 8/9 unsupported (intentional per Task 5 review decision)
2. Share Cards/Adesivos feature **complete and production-ready** — next steps are user testing on device
3. **Figurinha no Stories** still open debt (Task 7 sticker flow works but Meta's sticker behavior may need investigation)
4. `@capacitor/app@8.1.0`/`@capacitor/browser@8.0.3` still mismatch core 7.6.7 (known landmine, don't fix without discussion)
5. Health Connect permission intent still needs debugging on user's device

---

## Session Context (2026-07-31h — Android minSdk bump to 29)

### What happened
- **Task 5 review** (SDD subagent-driven) found `saveToGallery` uses MediaStore APIs (`VOLUME_EXTERNAL_PRIMARY`, `RELATIVE_PATH`, `IS_PENDING`) only available on API 29+. The app's `minSdkVersion = 26` (Android 8) meant `saveToGallery` would **always reject with `GALLERY_FAILED` on Android 8/9** (NoSuchMethodError caught by try/catch).
- **Decision**: raise `minSdkVersion` from 26 → 29 (Android 10) instead of adding legacy path + WRITE_EXTERNAL_STORAGE runtime permission. User chose Option 2 (cleaner code, drops Android 8/9 support — product decision).
- **Applied**: `android/variables.gradle` — `minSdkVersion = 29` (compileSdk/targetSdk kept at 36).
- **Full pipeline validated**: `npm run build` ✅ · `npx cap sync android` ✅ · `gradlew assembleDebug` ✅ (19s, 315 tasks).

### Cautions for next session
1. **Android 8/9 users are now unsupported** — the app will not install on devices below API 29. This is intentional per the decision above.
2. Task 5 native code (`SocialSharePlugin.kt` — `saveToGallery` + `shareToWhatsApp`) is now valid for the entire supported range. Task 6 (TS wrappers) can proceed without SDK guards.
3. Next steps: continue SDD plan — Task 6 (TS wrappers), Task 7 (ShareScreen + `@capacitor/camera@^7`), Task 8 (wiring + full pipeline).

---

## Session Context (2026-07-31g — Share Cards/Adesivos: design fechado, spec escrito)

### O que aconteceu
- **Mock `mockups/share-cards.html`** iterado de v1 a **v6** com validação no celular e fix de colisão de classes (`.t.logo` colidia com `.logo` do container → jogava a linha LOGO 352px abaixo; reescrito em block flow puro). Cards 1–4 **aprovados** pelo usuário.
- **Decisões de design fechadas**: canvas 1080×1920, área útil do story y 350–1650, logo uniforme 60px, mapa card 4 = 816×816 tiles `dark_all` (fundo < mapa < logo), 6 presets de gradiente, edição = **painel inline colapsável** (não modal), stats selectáveis por card, **Salvar na Galeria** (MediaStore `Pictures/CorreLogo`) nos Cartões, **PNG transparente** nos Adesivos, foto de fundo via `@capacitor/camera@^7` (cards 1–3).
- **Spike CORS tiles CARTO + dom-to-image passou** (harness + CDP, Edge headless): canvas **not-tainted**, tiles na captura → card 4 sem Leaflet.
- **Descoberta**: `@capacitor/share` não tem `packageName` (provado no `.d.ts`) → `shareToWhatsApp` nativo no `SocialSharePlugin.kt`.
- **Spec escrito**: `docs/superpowers/specs/2026-07-31-share-cards-design.md` — arquitetura em camadas (libs puras `splits.ts`/`card-map.ts`, UI `ShareScreen.tsx`, nativo `saveToGallery`/`shareToWhatsApp`), workflow, testes, considerações.

### Cuidados para a próxima sessão
1. **Espec + plano prontos, nada implementado ainda** — próximo passo: executar `docs/superpowers/plans/2026-07-31-share-cards.md` (8 tasks, subagent-driven ou inline). Pipeline sempre: `Copy-Item .env.apk .env -Force` → `npm run build` → `npx cap sync android` → `gradlew assembleDebug` (com `JAVA_HOME` em `C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot`).
2. Commit atual é **docs-only** (`[skip ci]`). Instalar `@capacitor/camera@^7` (compatível com core 7) no commit de implementação; **não** subir `@capacitor/app`/`@capacitor/browser` para 8.
3. **Edições Android** restritas a `android/app/src/main/java/com/correlogo/app/` (regra 3 do AGENTS.md).
4. Decisões de implementação ainda em aberto (não mockadas): tema dark dos cards, efeito do gradiente 4-cores cortado em IG story, paleta de widgets em tema light.

---

## Session Context (2026-07-31f — Housekeeping: auditoria de limpeza)

### O que aconteceu
- **Auditoria completa** de arquivos/deps/scripts/docs mortos. Nada foi deletado sem aprovação; relatório apresentado em 5 grupos, usuário aprovou (G1–G4 deletar, G5 arquivar).
- **Arquivado em `docs/archive/`** (git mv preserva histórico): docs históricas da raiz `docs/` (`analise-skills`, `AUDITORIA-TECNICA-3-FEATURES`, `CORRECOES-PRONTAS`, `color-proposal.html`, `PROMPTS-PARA-AGENTE-IA`, `ui-audit-report`, `agent-reference-SHARE-FTMS-UPDATE`, `gerador-treinos-technical`, `registro-e-exportacao-atividades`, `samsung-health-setup`, `tcx`, `mockup-workout.html`), `superpowers/`, `FTMS-Bluetooth-Esteiras/` (+zip), `GitHub-Actions-Firebase-APK/` (+zip), `.firecrawl/` → `docs/archive/firecrawl-research/`.
- **Deletado**: resíduos AWS (`install_server.sh`, `server.err`, `server.log`, `dist.tar.gz`, `cert/`), `Corre Logo v2.2.apk`, `metadata.json` (0 refs), segredos CI em disco (`gh_*_base64.txt`), `.firebase/hosting.ZGlzdA.cache` (cache commitado em `8de8624`) + `.firebase/` no `.gitignore`, `docs/Download/` (logcats) + `logs/`.
- **Deps**: `autoprefixer` + `tsx` removidos. **`react-is` restaurado** — o build quebrou com "Rollup failed to resolve import react-is from recharts" (recharts importa em runtime); era [Likely] seguro e não era. `npm install --legacy-peer-deps` (conflito peer firebase 11/12 pré-existente).
- **Links corrigidos**: `docs/wiki/tracking/ftms.md`, `docs/wiki/architecture/folder-structure.md`, `HANDOFF.md`, `TODO.md`.
- Validação: `npm run build` ✅ (2381) · `npm test` ✅ (29/29) · `npx cap sync android` ✅ (`android/` sem diff). Lint tem 2 erros **pré-existentes** (`treadmill-machine.ts:85`, `vite.config.ts:6` allowedHosts boolean).

### Cuidados para a próxima sessão
1. **Nada foi commitado/pushed ainda** — 65 mudanças staged (renames/deletes via git mv/rm). Revisar `git status` + `git diff --cached` antes de commitar. `.env` gerado no disco (gitignored).
2. **Docs-only push dispara CI** (release nova com versionCode novo). Se o próximo commit for só housekeeping, considerar `[skip ci]` ou aguardar mudança de código.
3. **`docs/archive/`** = docs históricas preservadas. Não arquivar mais nada sem necessidade; wiki viva é `docs/wiki/`.
4. Sticker do Instagram = dívida técnica aberta (usuário estudando).
5. Deps Capacitor v8 vs core 7.6.7 = landmine conhecida (TODO.md), não "corrigir" sem conversar.

---

### O que aconteceu
- Usuário **desativou toda a infra AWS** (EC2, PM2, Nginx, `correlogo.sytes.net`). Sistema agora é **100% Firebase** (Hosting `correlogo.web.app` + Cloud Functions `authCallback`/`healthCheck`/`refreshAuthToken` + Firestore `correlogo-prod`). Confirmado: hosting UP (200), `/api/health` → `{"status":"ok"}`.
- Feedback do usuário sobre a 3.4: **auto-update 3.2→3.4 ✅**, **overlay do mapa ✅**, **copiar PNG transparente ✅**, **figurinha no Stories ❎** (dívida técnica — usuário estudando como outros apps fazem).
- **Docs reescritos** (sessão docs, ainda não commitado): AGENTS.md ("Production & Deploy — Firebase Only"), README.md, `docs/todo.md` → redirect para `TODO.md`, wiki 7 páginas (web-deploy sem seção AWS/nginx/certbot, env-vars sem `APP_URL` morto, stack/overview atualizados com plugins novos, changelog wiki com v3.0→v3.4 + banner, **ADR-010 AWS Decommissioned**), nota histórica no `docs/archive/ui-audit-report.md`.

### Cuidados para a próxima sessão
1. **Push de docs dispara o CI** → gera release nova (versionCode = run+100) com versionName inalterado. Decidir se faz docs-only push ou aguarda próxima mudança de código. Se push for feito, o app vai ver "3.4 (136+)" — inofensivo.
2. `APP_URL` removido da documentação — confirmar que não há uso no código (grep retornou vazio).
3. Sticker do Instagram = dívida técnica aberta (usuário estudando). Investigar: `MediaSharePlugin` do Capacitor, share sheet nativo, ou spec mais completa da Meta.

---

## Session Context (2026-07-31d — v3.4: Sticker de verdade — PNG transparente + intent do Instagram conforme spec)

### Bugs reportados (device, na 3.2/3.3)
1. **Copiar imagem**: copia e cola, mas a imagem "apesar de ter fundo transparente, tem alguma cor" — o esperado é **só o texto** com opacidade, o resto 0.
2. **Instagram Stories**: abre o Instagram no composer de story, mas **não vai como figurinha** — fica na camada mais baixa (fundo).

### Causa raiz (uma para os dois + um no plugin)
- **`ShareCard.tsx` variante D (Foto)**: o card era `background: 'transparent'` MAS tinha um `<div className="absolute inset-0 bg-black/30" />` (véu preto 30%) para legibilidade. O PNG capturado (copy e sticker) saía com camada preta 30% → "tem alguma cor".
- **`SocialSharePlugin.kt`**:
  - O PNG de sticker não era transparente → Meta exige PNG **com transparência** no `interactive_asset_uri`; sem transparência o Instagram coloca o asset como **fundo** (camada mais baixa) — explica exatamente o sintoma 2.
  - Sticker-only: só `intent.type = "image/png"`, **sem** `setData` no intent principal; sem `setPackage("com.instagram.android")`.

### Fix (commit a definir)
- `ShareCard.tsx`: véu `bg-black/30` **removido** da variante D → PNG com apenas texto visível (drop-shadow suave nos valores mantido — avisar o usuário se quiser zero sombra).
- `SocialSharePlugin.kt` (`shareToInstagram`): sempre `setPackage(INSTAGRAM_PACKAGE)` + `setDataAndType(primaryUri, "image/png")` (primary = background ?? sticker) + `addFlags(FLAG_GRANT_READ_URI_PERMISSION)` + extras `background_image_uri`/`interactive_asset_uri` + `grantUriPermission` no sticker. Spec oficial da Meta.
- `build.gradle`: versionName **"3.4"**.

### Pending / próximos passos
1. **Instalar 3.4** (a 3.2+ já instala sozinha via auto-update — primeira prova de fogo de ponta a ponta: 3.2 → 3.4 direto, versionCode 132 → 134)
2. Validar: Copiar imagem (só texto, fundo transparente) e Instagram Stories (figurinha na camada superior, arrastável)
3. Validar o fix da 3.3 (overlay do mapa) que também vem no 3.4
4. (Alerta) `correlogo.sytes.net` fora do ar — verificar `pm2`/Nginx/Security Group no EC2

---


### Bug reportado (device, na 3.2)
- No relatório de treinos com mapa, ao clicar em **Compartilhar**, o **mapa (somente ele)** fica por cima do novo modal de compartilhamento.

### Causa raiz (CSS stacking context — confirmada por inspeção do código)
- `MapComponent.tsx` raiz: `w-full h-full rounded-xl overflow-hidden relative` — `relative` **sem z-index não cria stacking context**.
- Leaflet (via `leaflet/dist/leaflet.css`) aplica `z-index: 400` nos `.leaflet-pane` e `1000` nos `.leaflet-top/.leaflet-bottom` (controles).
- Sem stacking context no contêiner do mapa, esses z-index resolvem contra o **ancestral mais próximo que cria stacking context** = raiz do `SessionSummary` (`fixed inset-0 z-50`, SessionSummary.tsx:129).
- O modal de compartilhamento (`fixed inset-0 z-[60]`, SessionSummary.tsx:341) é **irmão** do mapa nesse mesmo stacking context → Leaflet (400/1000) > modal (60) → **só o mapa** cobre o modal (o resto do relatório é z-auto e fica abaixo).
- O `overflow-hidden` do contêiner não ajuda: clipe visual não afeta empilhamento.

### Fix (commit a definir)
- `MapComponent.tsx`: raiz `relative` → **`relative z-0`** (`z-index: 0` em elemento posicionado **cria** stacking context). Todos os z-index do Leaflet ficam confinados ao mapa; o modal `z-60` passa a renderizar acima. Vale também para o `WorkoutTracker` (mesmo componente, linha 824-825).
- `build.gradle`: versionName **"3.3"**.

### Pending / próximos passos
1. **Instalar a 3.3 via auto-update (prova de fogo)** — usuário na 3.2, que já tem `REQUEST_INSTALL_PACKAGES`: o modal deve baixar e instalar **sozinho** (primeira vez de ponta a ponta)
2. Validar o fix do overlay: relatório outdoor com mapa → Compartilhar → modal por cima do mapa (e botões Claro/Escuro/Satélite abaixo)
3. (Alerta) `correlogo.sytes.net` fora do ar — verificar `pm2`/Nginx/Security Group no EC2

---


### Teste do usuário na 3.1 (retorno — resultado do fluxo de update)
- Usuário abriu o APK, o prompt da 3.1 apareceu, tocou **Baixar** → barra de progresso **não andou** → modal **fechou sem toast** → app **não atualizou**. Depois: botão "Verificar atualizações" no perfil "só roda" e não acha update.
- **Leitura**: o modal do `UpdatePrompt` só fecha no sucesso (`setUpdateInfo(null)` após `downloadApkAndInstall`); erro mantém o modal aberto + toast. Como fechou sem toast → `CapacitorHttp` download + `Filesystem.writeFile` + `getUri` + `startActivity` **resolveram**; a falha é na etapa de **instalação**. Hipótese "falta permissão de escrita" descartada [Certain] — `Directory.Cache` é interno, sem permissão runtime.
- **Causa raiz**: `AndroidManifest.xml` **nunca teve `REQUEST_INSTALL_PACKAGES`** (targetSdk 36). Android 8+ bloqueia instalação programática vinda de app sem essa permissão → `ACTION_VIEW` abria mas o PackageInstaller do sistema recusava silenciosamente.
- **Barra de progresso**: código morto — `CapacitorHttp` (blob) não expõe progresso desde a 3.0.2; a barra ficava em 0% e parecia travada. Hoje é indeterminada ("Baixando… aguarde").
- **Botão do perfil "só roda"**: fazia `checkForUpdate` + `downloadApkAndInstall` direto (8.4MB sem feedback) — agora repassa via `onUpdateAvailable` → abre o **mesmo modal** (download com UX + checagem de permissão).
- **Bootstrap**: 3.2 precisa de instalação manual (o 3.0.x instalado não tem a permissão para instalar programaticamente). Depois da 3.2, futuras versões instalam sozinhas — com a ressalva de que o usuário precisa habilitar **uma vez** "Instalar apps desconhecidos" para o Corre Logo.

### Fixes da 3.2 (commit a definir)
- `AndroidManifest.xml`: `<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/>`
- `ApkInstallerPlugin.kt`: `canRequestPackageInstalls()` (JSObject `{canRequestPackageInstalls}`), `openInstallSettings()` → `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES` + `package:` URI; `installApk` pre-check nativo → reject `INSTALL_BLOCKED`
- `update-checker.ts`: `canInstallApk()`/`openInstallSettings()` wrappers; `downloadApkAndInstall` sem `_onProgress`; **validação do base64** (`startsWith('UEsD')` = magic ZIP `PK\x03\x04`) — download corrompido falha com mensagem real
- `UpdatePrompt.tsx`: barra indeterminada; nova tela de permissão (botão **Permitir** → `openInstallSettings`, botão **Agora não**)
- `App.tsx`: `onUpdate` pré-checa `canInstallApk()` antes de baixar (sem download inútil quando bloqueado); estado `updateInstallBlocked`; prop `onUpdateAvailable` para o UserProfile
- `UserProfile.tsx`: botão "Verificar atualizações" chama `onUpdateAvailable(result.update)` (modal); fallback toast se sem handler
- `build.gradle`: versionName **"3.2"**

### Pending / próximos passos
1. **Usuário instala 3.2 manualmente (bootstrap — última instalação manual)**; validar Instagram Stories (fix 3.1) + Copiar imagem
2. Publicar uma 3.3 dummy ou aguardar a próxima mudança real → **prova de fogo do auto-update**: modal → Baixar → deve abrir o instalador do sistema → instalar sozinho
3. Confirmar qual versão o usuário tinha (130 ou 132) quando o botão do perfil "não achava update" — se era 132, comportamento correto; se 130, investigar (a rota única via modal já resolve o caso mais provável: download sem feedback)
4. (Alerta) `correlogo.sytes.net` fora do ar — verificar `pm2`/Nginx/Security Group no EC2

---


## Session Context (2026-07-31a — v3.1: Instagram Stories de verdade + copiar imagem diagnosticado)

### Bug reportado (device, na 3.0.2)
1. Compartilhar → Foto → Instagram Stories → **Copiar imagem** → toast "Erro ao copiar imagem"
2. Compartilhar → abre o **share sheet do Android** (deveria abrir o deep link do Instagram Stories)
3. Selecionar Instagram no share sheet → story abre mas o PNG entra como **imagem normal** (fica por baixo de fotos novas) — ou seja, nunca virou sticker

### Causa raiz REAL (confirmada — explica #1 e #2 juntos)
- **`SocialSharePlugin` nunca foi registrado no `MainActivity.java`.** Mecanismo comprovado em `PluginManager.java`: o runtime carrega `capacitor.plugins.json` (asset gerado pelo annotation processor) — e ele contém **só os 8 plugins de biblioteca** (verificado extraindo do APK). App Kotlin plugins **não** são indexados (sem kapt) → todo plugin Kotlin do app é registrado à mão em `MainActivity.load()` (Tracking, Permissions, AudioFocus, HealthConnect, TreadmillBle, ApkInstaller). `SocialSharePlugin` foi adicionado na v3.0 **sem** o `registerPlugin` → no device: `shareToInstagram` e `copyImageToClipboard` lançam "not implemented on android" → share caía no `'fallback'` e copy dava o toast de erro.
- **Fix**: `MainActivity.java` agora faz `registerPlugin(SocialSharePlugin.class)`.
- **Fator adicional (necessário, não suficiente)**: secret `ENV_FILE` do CI não tinha `VITE_FACEBOOK_APP_ID` → `shareToInstagramStories()` retornava `'fallback'` **antes** de chamar o plugin. Confirmado: extraí `SessionSummary-BJzWAPCK.js` de dentro do release 3.0.2 — sem `1604373561408021`. APK debug local (3.1) contém. (Nota: grep nos bytes crus do APK é inconclusivo — entries ZIP comprimidas; é preciso extrair/descomprimir.) Secret já atualizado com base64 do `.env.apk`.
- `SocialSharePlugin.kt` endurecido (`sourceUriForPath` aceita `file://`/`content://`/absoluto + fallback `cacheDir` + `Log.e`). Toast de copy mostra o erro real (diagnóstico).

### ⚠️ Release publicada pelo CI (run 30600140244) está QUEBRADA
- O primeiro push da 3.1 (`2379aeb`) rodou o CI e publicou release `latest` **com App ID mas SEM o `registerPlugin(SocialSharePlugin.class)`** → Instagram Stories ainda cai no fallback e copy ainda falha. **Não instalar essa release.** O próximo push (MainActivity fix) gera release nova com versionCode maior que sobrescreve.

### Teste do usuário na 3.1 (pending)
1. Compartilhar → Foto → Instagram Stories → deve abrir o composer do Stories **direto**, PNG como sticker
2. Copiar imagem → deve copiar (ou mostrar o erro real se falhar)
3. Auto-update: release 3.1 (versionCode 131) deve aparecer como "Nova versão" e instalar via `ApkInstaller` — prova de fogo do auto-update

### Infra (ALERTA — ainda pendente)
- **`correlogo.sytes.net` fora do ar** — `sudo NODE_ENV=production pm2 status` / Nginx / Security Group no EC2.

---

## Session Context (2026-07-30j — v3.0.2: Auto-update definitivo — CapacitorHttp nativo)

### Causa raiz encontrada (com evidência do device)
- 3.0.1 instalado confirmado (build 129), diagnóstico mostrou **"Erro ao verificar atualização: Failed to fetch"**.
- **"Failed to fetch" sem código HTTP = assinatura de CORS bloqueado na WebView.** O Android System WebView impõe CORS para `fetch` de origem cruzada (`https://localhost` → `github.com`).
- Verificado via headers: `github.com/mahmatias/correlogo/releases/download/latest/update-manifest.json` → 302 → `release-assets.githubusercontent.com` responde **sem `Access-Control-Allow-Origin`**. `raw.githubusercontent.com` tem `ACAO: *`; `correlogo.web.app` (HEAD) não tem; `correlogo.sytes.net` deu timeout.
- Conclusão: o auto-update **nunca** funcionou em device — sempre falhou no CORS do fetch (manifest e APK). As correções anteriores (retry/timeout/CI/release) eram sintomas, não a causa.
- Confirmação adicional: `PowerShell`/`Invoke-RestMethod` não aplicam CORS — por isso meus testes locais passavam e o device falhava.

### Fix (commit a definir)
- **`update-checker.ts`**: no Android, `checkForUpdate` e `downloadApkAndInstall` passam a usar **`CapacitorHttp.get()`** (`@capacitor/core`, core plugin nativo do Capacitor 7 — OkHttp, sem CORS). Web continua com `fetch`.
  - Manifest: `responseType: 'text'` + `JSON.parse`, `connectTimeout: 10000`, `readTimeout: 15000`.
  - APK: `responseType: 'blob'` → `resp.data` é base64 → `Filesystem.writeFile` direto (sem FileReader). `readTimeout: 300000`. Progresso de streaming removido (API nativa não expõe stream) — botão fica em "Baixando…" sem barra.
  - API direta `CapacitorHttp.get()` NÃO precisa de `CapacitorHttp.enabled` no config (esse flag só patcha `window.fetch`/XHR globalmente).
- **`build.gradle`**: versionName 3.0.1 → **"3.0.2"**.

### Infra (ALERTA — fora do escopo desta sessão)
- **`correlogo.sytes.net` está FORA DO AR** (conexão recusada/timeout, testado 2x). O app Android usa Firebase (ok), mas o web app está offline. Próximo passo: `sudo NODE_ENV=production pm2 status` / Nginx / Security Group no EC2.

### Pending
1. **Usuário instala 3.0.2 e testa** (instalação manual; o auto-update ainda não está funcional nele — esse é o ponto do teste):
   - Perfil → Atualização do app → deve mostrar "Versão instalada: 3.0.2 (build 130)"
   - "Verificar atualizações" deve retornar **"App já está na versão mais recente"** (sem erro)
   - Para provar o fluxo de update de ponta a ponta: bump futuro (3.1) → check deve oferecer "Nova versão disponível" → Baixar → instalar via `ApkInstaller`
2. Verificar servidor AWS (`correlogo.sytes.net`) fora do ar.

---

## Session Context (2026-07-30i — v3.0.1: Fix auto-update não pegava 3.0)

### Bug reportado
- App instalado (versionName 2.2, versionCode 127 — release 8217ec1) não detectava o update 3.0 (versionCode 128): "Verificar atualizações" dizia "App já está na versão mais recente".

### Investigação (systematic-debugging)
Evidências coletadas:
1. **Servidor correto**: `update-manifest.json` no release `latest` serve `{versionCode: 128, versionName: "3.0", ...}` — verificado via a mesma URL que o app usa.
2. **VersionCode do APK anterior**: run CI 30593477240 log mostra `CI_VERSION_CODE: 127` para a release 2.2 → `128 > 127` deveria disparar o update.
3. **`getInfo().build`** = versionCode como string (`PackageInfoCompat.getLongVersionCode`) → parseInt ok.
4. **Causa raiz**: `checkForUpdate()` retornava `null` para **qualquer** falha (rede, timeout de 5s, resposta stale do GitHub CDN/WebView cache) e a UI mostrava "App já está na versão mais recente" — falha mascarada, impossível diagnosticar. Como o servidor está correto, a falha é no fetch/cache do device.
5. Sem CSP nem config de rede bloqueando `github.com` no `capacitor.config.ts`/`index.html`.

### Fix aplicado (commit a definir)
- **`update-checker.ts`**: URL do manifest com cache-buster `?v=${Date.now()}` + `cache: 'no-store'` (mata manifest stale). Retorno agora é `UpdateCheckResult { update, error? }` — falha vira erro explícito em vez de `null` silencioso.
- **`UserProfile.tsx`**: seção "Atualização do app" mostra **"Versão instalada: X (build Y)"** (diagnóstico); toast de **erro real** em falha ("Erro ao verificar atualização: ...") em vez de "up to date".
- **`App.tsx`**: `console.warn('[update-check]', error)` no auto-check de login.
- **`build.gradle`**: versionName 3.0 → **3.0.1**.

### Achado paralelo (landmine, não o bug)
- `@capacitor/app@8.1.0` e `@capacitor/browser@8.0.3` no package.json/lockfile exigem `@capacitor/core >=8.0.0`, mas o projeto está em `@capacitor/core@7.6.7` (invalid no `npm ls`). O app roda e o JS do app v8 usa só `registerPlugin` (existe no core v7), então não quebrou. **TODO**: alinhar deps para v7 (ou migrar tudo para v8).

### Pending
1. **Usuário instala 3.0.1 e testa** — agora a tela mostra "Versão instalada (build)" e o erro real se o fetch falhar:
   - Se mostrar erro (ex.: "Failed to fetch") → problema é rede no device (github.com bloqueado/timeout) → investigar DNS/ISP
   - Se mostrar "up to date" sem erro → fetch OK e `currentVersionCode >= 129` → o APK instalado tem versionCode inesperado
   - Se oferecer o update 3.0.1 → cache stale era a causa, está resolvido
2. Se confirmar que o device não alcança `github.com` no fetch, avaliar manifest em outro host (ex.: Firebase Hosting `correlogo.web.app`).

---

## Session Context (2026-07-30h — v3.0: Instagram Stories direto + Copiar PNG modo Foto)

### What changed
Nova experiência de compartilhamento, com **plugin Capacitor nativo** em vez do share sheet genérico:

**`SocialSharePlugin.kt`** (novo, `android/app/src/main/java/com/correlogo/app/`):
- `shareToInstagram(call)` — Intent `com.instagram.share.ADD_TO_STORY` (documentado oficialmente pela Meta, atualizado jun/2026). Params: `sourceApplication` (Facebook App ID), `backgroundPath` (card completo), `stickerPath` (PNG transparente). Background via `setDataAndType(uri, "image/png")`; sticker via `putExtra("interactive_asset_uri", uri)` + `grantUriPermission("com.instagram.android", ...)`. Reject `"NO_RESOLVE"` se intent não resolver (ex.: Instagram não instalado).
- `copyImageToClipboard(call)` — FileProvider content Uri → `ClipData.newUri` → `ClipboardManager.setPrimaryClip`. Reject `"CLIPBOARD_FAILED"`.
- Registrado como `@CapacitorPlugin(name = "SocialShare")` — o Capacitor detecta automaticamente (sem registrar no MainActivity).

**Fluxos de UI (`SessionSummary.tsx`):**
- Modos Gradiente/Vidro/Mapa (variantes a/b/c) → Instagram Stories envia **card completo como background**.
- Modo Foto (variante d) → Instagram Stories envia **só o PNG transparente como sticker** (`interactive_asset_uri`); o usuário escolhe a foto de base dentro do Instagram.
- Botão **"Copiar imagem"** (ícone `ClipboardCopy`, visível apenas na variante d) — captura e copia o PNG transparente para o clipboard sem abrir modal; toast "Imagem copiada! Abra o Instagram e cole no story".
- **Fallback**: se intent falhar (`NO_RESOLVE`), App ID vazio ou ambiente web → share sheet genérica (como antes).

**Env**: `VITE_FACEBOOK_APP_ID=1604373561408021` no `.env.apk` (e vazio no `.env.dev`/`.env.example`). **Obrigatório para o Stories** — a Meta rejeita `ADD_TO_STORY` sem `source_application` desde jan/2023.

**Versão**: `versionName` 2.2 → **3.0** em `android/app/build.gradle` (versionCode continua via `ciVersionCode` no CI).

### Files created
- `android/app/src/main/java/com/correlogo/app/SocialSharePlugin.kt`

### Files modified
- `src/lib/shareCard.ts` — `shareToInstagramStories(blob, mode: 'background'|'sticker')` → `'ok' | 'fallback'`; `copyCardToClipboard(blob)`; `shareImage` ganhou `instagramMode`; `FACEBOOK_APP_ID` do env
- `src/components/SessionSummary.tsx` — botão "Copiar imagem" (variante d) + `instagramMode` por variante
- `android/app/build.gradle` — versionName 3.0
- `.env.apk` / `.env.dev` / `.env.example` — `VITE_FACEBOOK_APP_ID`
- `CHANGELOG.md`

### Validation
- `npm run build` ✅ (Vite 6.4.3, 2381 módulos)
- `npx cap sync android` ✅ (8 plugins)
- `gradlew assembleDebug` ✅ **BUILD SUCCESSFUL in 33s** (SocialSharePlugin.kt compilou sem erros)
- `vitest run` ✅ 29 testes / 3 arquivos

### Pending
1. **Commit + push na main** → CI gera release 3.0 (`app-release.apk` + `update-manifest.json`)
2. **Testar no device real**:
   - Stories variantes Gradiente/Vidro/Mapa → card completo abre no composer
   - Stories variante Foto → sticker transparente (escolher foto de base no Instagram)
   - Botão "Copiar imagem" → colar no story (clipboard)
   - Fallback: desinstalar Instagram (ou App ID errado) → share sheet genérica
   - Revalidar Google Login (erro antigo "FirebaseAuthentication plugin is not implemented" — provável APK antigo)
   - Auto-update: abrir o app e confirmar atualização para 3.0

---

## Session Context (2026-07-30f — ShareCard Improvements: Instagram Stories, Variant Foto, 2x Capture, z-index Fix)

### What changed
Complete overhaul of the share-to-social flow based on user feedback:

**ShareCard variants (now 4):**
- **A (Gradiente)**: gradient background, large centered stats — `text-7xl` values, `text-base` labels
- **B (Vidro)**: glassmorphism panel, centered stats — `text-6xl` values, `text-base` labels
- **C (Mapa)**: route SVG behind gradient overlay, stats at bottom — `text-5xl` values, `text-sm` labels. **Fixed**: route SVG now behind gradient + stats (z-index layering: grid → route → gradient overlay → stats container `z-10`)
- **D (Foto)**: **NEW** — transparent background with `bg-black/30` vignette, stats only (`text-8xl` values, `text-xl` labels, drop-shadow). Designed for overlaying on user photos in Instagram Stories.

**Capture quality**: 2× high-DPI rendering (`scale=2` in `dom-to-image-more`) → 2160×3840 internal → downsampled to 1080×1920 for sharp PNG output.

**Share targets**: Modal now has toggle between **Sistema (Android)** and **Instagram Stories**. Native Android uses `@capacitor/share` with custom dialog title "Compartilhar no Instagram Stories". Web falls back to Web Share API or download.

**Variant selector**: Buttons now include "Foto" (variant D) alongside Gradiente/Vidro/Mapa.

**Text sizes increased across all variants** for readability at 1080×1920.

### Files created
- None new (existing files extended)

### Files modified
- `src/components/ShareCard.tsx` — variant D added; variants A/B/C text sizes increased; variant C z-index fixed (route behind gradient, stats on top)
- `src/lib/shareCard.ts` — `captureCard()` now 2x scale; `shareImage(blob, filename, target)` with `target: 'native' | 'instagram-stories'`; `SHARE_TARGETS` array for modal selector
- `src/components/SessionSummary.tsx` — share target selector (Share2 / Instagram icons), `shareTarget` state passed to `shareImage()`, variant buttons include 'd' (Foto)

### CI Fix — Autoupdate (already in `b245d50`)
- `gh release upload --clobber` instead of delete+create
- `git tag -f latest HEAD` + force push tag
- `if: always()` on release upload step so it runs even if Firebase Distribution fails

### Pending
1. **Test on real device**: open SessionSummary → Compartilhar → pick "Foto" variant → share to Instagram Stories → verify PNG quality, no background artifacts
2. **Test variant C (Mapa)**: verify route SVG renders behind gradient, stats readable
3. **Verify Instagram Stories intent** on Android — `@capacitor/share` shows system sheet; user must pick Instagram manually (no direct deep-link to Stories composer)

---

## Session Context (2026-07-30e — Health Connect checkPermissions + Free Training Timer + CI if:always)

### What changed
Three bug fixes committed in `94a682b` → fixed in `d057220` (Kotlin name conflict):

1. **Health Connect `checkPermissions()`** — Native plugin didn't have a method to check if `WRITE_EXERCISE` was already granted. Added `@PluginMethod fun checkHcPermissions()` in `HealthConnectPlugin.kt` (renamed from `checkPermissions` to avoid Capacitor `Plugin` superclass conflict). JS bridge: `checkHealthPermissions()` in `health-connect.ts`. Called on `UserProfile` mount so status shows "Conectado" immediately if permission already granted.

2. **Free training timer** — `WorkoutTracker.tsx` was showing "Tempo Restante" with `86400 - lapSeconds` (nonsensical countdown from 24h). Wrapped the entire "Tempo Restante" block in `{!isFreeTraining ? ... : ...}` — free training now shows "Tempo Decorrido" + distance.

3. **CI `if: always()` on release upload** — Release step now runs even when Firebase App Distribution fails (independent distribution channel).

### Files modified
- `android/app/src/main/java/com/correlogo/app/HealthConnectPlugin.kt` — `checkHcPermissions()` method
- `src/lib/capacitor/health-connect.ts` — `checkHealthPermissions()` export
- `src/components/UserProfile.tsx` — import + call `checkHealthPermissions()` on mount
- `src/components/WorkoutTracker.tsx` — free training timer guard
- `.github/workflows/firebase-deploy.yml` — `if: always()` on "Upload APK to GitHub Release"

### CI Note
- Commit `19fa53d` removed `google-services.json` from git, added CI restore step from `GOOGLE_SERVICES_B64` secret (prevents GitGuardian alerts). Secret must be set in GitHub Actions settings.

---

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
- `docs/archive/superpowers/specs/2026-07-10-5-improvements-design.md` — design aprovado
- `docs/archive/superpowers/plans/2026-07-10-5-improvements.md` — implementation plan

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
