# Agent Instructions

## Session Start
- **Always** read `TODO.md` first thing — it's the persistent task list (single source of truth; `docs/todo.md` é apenas um redirect).
- Add new tasks to `TODO.md` whenever the user asks. Never rely on in-memory only.

## Custom Commands
- `/todo <items>` — Adiciona itens ao `TODO.md` (definido em `.opencode/commands/todo.md`)

## Advisor Style
- Você é meu **advisor**, não meu **assistente**.
- Nunca abra com concordância. Questione meu raciocínio primeiro ou faça a pergunta que estou evitando.
- Quando eu estiver errado, diga diretamente.
- Marque [Certain], [Likely] ou [Guessing] em afirmações importantes. Nunca finja saber.
- Nunca diga "Great question" / "You're absolutely right" / "Excelente pergunta". Comece com a coisa mais útil primeiro.
- Se eu pressionar (push back), não ceda a menos que eu apresente informação genuinamente nova. Ceder por pressão social é pior que discordar com razão.
- Não peça desculpas em excesso por apontar falhas ou contradições no meu pedido — isso é trabalho, não grosseria.
- Pressuponha boa-fé técnica do usuário, mas não da proposta: critique a proposta.
- Quando uma decisão é ambígua, deixe explícito qual foi o critério de desempate usado (em vez de "escolhi X" sem justificativa).

## Changeling & Handoff
- Atualize proativamente `CHANGELOG.md` e `HANDOFF.md` após qualquer alteração, correção ou inclusão de funcionalidade, antes de encerrar o turno.
- Adicione tarefas significativas ao `TODO.md` ao final de cada sessão, com referência ao commit.
- Descreva detalhadamente o que foi feito, o contexto técnico e o impacto na aplicação para garantir total controle evolutivo do projeto.

## Build Validation
- Sempre execute `npm run build` para certificar-se de que correções e atualizações estão funcionando e isentas de erros de sintaxe ou de importação.
- **Antes de qualquer build**, copie `.env.apk` → `.env` (`Copy-Item -Path ".env.apk" -Destination ".env" -Force`). O `.env.apk` é a única fonte de verdade para o Firebase **prod** (`correlogo-prod`). **Nunca** copie `.env.dev` para `.env` — isso quebra o APK e o site em produção. `.env` nunca deve ser commitado.
- **Sincronizar o secret `ENV_FILE` da CI**: o build da CI (`firebase-deploy.yml:35`) cria o `.env` a partir do secret `ENV_FILE` do GitHub, **não** do `.env.apk` local. **Toda vez que `.env.apk` mudar** (nova `VITE_*` ou valor), rodar: `gh secret set ENV_FILE -b ( [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content ".env.apk" -Raw))) )`. Esquecer disso = variável some do APK/site em produção (ex: overlay CARTO no build 178). Ver `docs/wiki/build/env-vars.md` + `docs/wiki/roadmap/decisions.md` (ADR-011).

## UI & Component Patterns
- **Button component**: Use `<Button variant="primary|secondary|ghost|danger" size="sm|md|lg">` em vez de `<button>` raw.
- **Modal component**: Use `<Modal open onClose title>` para diálogos, com `role="alertdialog"` para confirmações destrutivas.
- **Component Re-initialization**: Always use a `key` prop (e.g., plan/session ID) on components that rely on internal `useEffect` hooks for mounting/state-reset logic.
- **State Management**: Avoid direct or indirect `setState` calls that can trigger infinite renders during component mounting sequences.
- **Skeleton loading**: Use `animate-pulse` + `bg-bg-elevated` para estados de carregamento.
- **Empty states**: Sempre incluir ícone (`lucide-react`) + CTA textual.

## Code Splitting
- **Lazy load heavy components**: Use `React.lazy(() => import(...))` + `<Suspense>` para `SessionSummary` e `MapComponent` (recharts + leaflet ≈ 700 KB).
- **fallback**: `animate-pulse` skeleton ou texto "Carregando…" no Suspense.

## Firebase Error Handling
- **Use `getFirebaseErrorPt(err)`** de `src/lib/firebaseErrorsPtBr.ts` em vez de `err.message` direto.
- Mapeamento cobre `auth/invalid-email`, `auth/user-not-found`, `auth/wrong-password`, etc.

## Save Feedback
- Use `showFeedback('success'|'error', message)` para notificações toast no canto superior direito.
- O toast desaparece automaticamente após 3s.

## Batch Operations
- Use `writeBatch(db)` do Firestore para deleções em lote (até 500 ops), nunca `for...of deleteDoc`.

## Offline Persistence
- `enableIndexedDbPersistence(dbInstance)` chamado após `initializeFirestore()` — falha silenciosa em múltiplas abas.

## Persistence & Sync
- **LocalStorage cache**: Always read from localStorage first for instant UI, then Firestore as source of truth.
  - Keys: `correlogo:plans:{uid}`, `correlogo:sessions:{uid}`, `correlogo:darkMode:{uid}`
- **Offline resilience**: Firestore queries wrapped in `Promise.race` with 5s timeout. On failure, app runs from localStorage.
- **Sync**: Sessions with `local-*` prefix IDs are auto-uploaded to Firestore on next successful connection. Plans are merged (local + remote).
- **Verify** Firestore synchronization for user-specific data by using explicit `[timing]` logs during development.
- **Always** use `limit(50)` on session queries to avoid unbounded Firestore reads.

## Dependencies
- **Avoid `uuid`**: Use `crypto.randomUUID()` (nativo, disponível em todos os browsers modernos).
- **No dead deps**: Não instalar `@google/genai`, `@vis.gl/react-google-maps`, `motion` — nunca importados no app.
- **Capacitor**: deps `@capacitor/app`/`@capacitor/browser` (v8) exigem core 8, mas o projeto está no core 7.6.7 — não "corrigir" isso sem conversar antes (ver TODO.md).

## Firebase Projects
- **Dev** (`.env.dev`): `correlogo-dev-9a96a` — Firestore em modo teste. Usado APENAS para desenvolvimento local web.
- **Prod** (`.env.apk`): `correlogo-prod` — **única fonte de verdade** para builds de APK, deploy web e Cloud Functions. Sempre copiar `.env.apk` → `.env` antes de qualquer `npm run build`.
- Não existe mais servidor próprio: **toda a infra é Firebase** (Hosting + Cloud Functions + Firestore). AWS/EC2/`correlogo.sytes.net` foram **desativados** (2026-07-31).
- `firebase-applet-config.json` foi removido do git (projeto `zealous-arcanum-nwfkz` não é mais usado)
- ⚠️ **Nunca** copiar `.env.dev` para `.env` — isso faz o APK apontar para o projeto dev, quebrando a autenticação em produção.

## Android / Capacitor — Ground Rules for Agent

Estas regras garantem que qualquer alteração minha nunca quebre o build do APK:

1. **Sempre rodar o pipeline completo após qualquer mudança que toque em:**
   - Código TS/JS (web build) — `npm run build`
   - Plugins Capacitor — `npx cap sync android` + `npm run build`
   - Kotlin/Java nativo — `gradlew assembleDebug`
   - Dependências (`npm install`) — `npm run build` + `npx cap sync`

2. **Nunca remover ou renomear dependências** sem verificar se são usadas por plugins Capacitor (ex: `@capacitor-firebase/authentication`, `@capacitor-community/text-to-speech`, `@capacitor/local-notifications`). Usar `npm ls <pkg>` antes.

3. **Nunca editar `android/` manualmente**, exceto:
   - `android/app/google-services.json` — pode ser substituído pelo oficial do Firebase Console
   - `android/app/src/main/java/com/correlogo/app/` — plugins custom
   - `android/app/src/main/AndroidManifest.xml` — permissões
   - Todo o resto é gerenciado por `npx cap sync` (qualquer edição é sobrescrita)

4. **Ao instalar novo plugin Capacitor**, ranquear:
   - `npm install` → `npx cap sync android` → `npm run build` → `gradlew assembleDebug`
   - Verificar se o plugin apareceu em `[info] Found N Capacitor plugins for android`

5. **Web app e Android compartilham o mesmo `dist/`**. Se o `vite build` falhar, o APK não sai. `npm run build` é pré-condição.

6. **Nunca `git add` sem verificar `git status` + `git diff`**. Confirmar que arquivos do Android não foram tocados indevidamente.

7. **Pipeline completo de validação** quando terminar qualquer sessão que mexa em Capacitor/Android:
   ```bash
   Copy-Item -Path ".env.apk" -Destination ".env" -Force
   npm run build && npx cap sync android && (cd android && gradlew assembleDebug)
   ```

8. **JAVA_HOME** na máquina local está em `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot` (Temurin 21.0.12.8, instalado no restore pós-formatação). Antes de `gradlew`, definir:
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot"
   ```

## Production & Deploy — Firebase Only

**Não existe mais servidor próprio.** AWS EC2 / `correlogo.sytes.net` / PM2 / Nginx foram **desativados** (2026-07-31). Toda a infra roda no Firebase:

- **Web (PWA)**: Firebase Hosting site `correlogo` → `https://correlogo.web.app` (`firebase deploy --only hosting:correlogo`). O `dist/` (build do Vite) é o public dir.
- **API dinâmica**: Cloud Functions v2 (Node 22, `functions/`) — `authCallback` (troca de código OAuth), `healthCheck`, `refreshAuthToken`. Deploy: `firebase deploy --only functions`.
- **Dados**: Firestore `correlogo-prod` (rules em `firestore.rules`).
- **CI/CD (auto-update do APK)**: push em `main` dispara `.github/workflows/firebase-deploy.yml` → build web + `assembleRelease` assinado → publica em **GitHub Release `latest`** junto com `update-manifest.json` (com `versionCode` = `GITHUB_RUN_NUMBER + 100`). O app verifica esse manifest (`releases/download/latest/update-manifest.json`) via `CapacitorHttp` e instala sozinho (a partir da 3.2).
- **`VITE_*` são baked no build**: mudar variável exige `npm run build` de novo; `firebase deploy` serve o bundle já compilado.
- **Versão atual**: checar `android/app/build.gradle` (`versionName`). Release `latest` sempre reflete o último push.
- **Versionamento (regra formalizada 2026-08-15)**: toda release de APK gera `versionCode` novo automático (`GITHUB_RUN_NUMBER + 100`) — é o que permite o auto-update. O `versionName` é manual, formato `X.Y`:
  - **Minor** (só para features pequenas/bugfix/UI): sobe o número após o ponto (`4.1` → `4.2`).
  - **Major** (quebra de fluxo visível OU entrega grande, ex: módulo novo inteiro como integração relógio/Health Connect): sobe o número antes do ponto e zera o Y (`4.2` → `5.0`).
  - Critério completo em `docs/wiki/roadmap/backlog.md` → Release Process. Sempre verificar se a mudança é major antes de commitar um bump.
- **Não usar portas hardcoded**: o Vite dev server usa porta 3000 (`vite.config.ts`, `host: 0.0.0.0`, `allowedHosts: true`). Não havia Nginx/PM2 — não há config de servidor para atualizar.
- **`.gitignore`** já exclui `.env*` (com `!.env.example`), `dist/`, `node_modules/`, logs, `keystore.jks`, `firebase-key.json`, `android/app/google-services.json` e `gh_*_base64.txt`. Não remover — `.env` contém a Firebase API key e o `gh_*` contém credenciais de CI.
- Ver `HANDOFF.md` e a wiki (`docs/wiki/`) antes de sugerir qualquer mudança de infra.
