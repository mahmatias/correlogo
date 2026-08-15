# RECOVERY — Reconstruir o ambiente Corre Logo após formatar o Windows

> **Objetivo**: com um Windows limpo + opencode instalado + o **ZIP de backup** (gerado
> por `scripts/backup-workspace.ps1`), voltar ao estado de desenvolvimento completo
> deste projeto (web + APK Android + Cloud Functions + deploy Firebase).

**Contrato**: o `dist/`, o APK e o deploy são 100% reconstruíveis pelo CI (GitHub
Actions) a partir dos secrets já cadastrados no repo. Este procedimento recupera a
**máquina local** de desenvolvimento.

---

## 0) Inventário do que o backup contém

O ZIP `correlogo-backup-<data>.zip` (guardar **fora do computador**: pendrive/nuvem)
contém:

| Pasta | Conteúdo | Uso |
|---|---|---|
| `project/` | `.env`, `.env.apk`, `.env.dev`, `functions/.env`, `google-services.json`, `keystore.jks` (2 cópias), `opencode.json`, `.superpowers/` | Secrets de build Firebase/Android/CI |
| `user/` | `.ssh/` (chaves git), `.git-credentials`, `.gitconfig`, `.npmrc`, `gh-hosts.yml`, `firebase-tools.json` | Auth git/gh/firebase |
| `opencode/` | `opencode.jsonc`, `package.json`, skills (`gstack`, `agents-skills`, `opencode-skills`), `models.json`, `bin/rg.exe` | Ambiente do agente |
| `env-manifest.txt` | Versões de Node/npm/git/gh/firebase, `JAVA_HOME`, `ANDROID_HOME`, remotes, globals npm | Referência de versões |

**⚠️ O ZIP contém segredos de produção. Não commitar, não compartilhar.**

**Nenhum segredo está no GitHub** (`.env*`, `keystore.jks`, `google-services.json`
são gitignored). Os secrets de CI (`ENV_FILE`, `GOOGLE_SERVICES_B64`,
`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`,
`FIREBASE_APP_ID`, `FIREBASE_CREDENTIALS`) vivem **apenas** no GitHub Settings →
Secrets and variables → Actions.

---

## 1) Ferramentas base (instalação única)

Instalar na ordem (instaladores oficiais; abrir novo terminal após cada uma):

1. **Git for Windows** — `https://git-scm.com/download/win` (2.55+)
2. **Node.js LTS** — `https://nodejs.org/` (v26.x; npm 12.x). Instalação direta, **sem** nvm/fnm.
3. **JDK 21 (Eclipse Adoptium)** — `https://adoptium.net/temurin/releases/?version=21`
   - Alvo: `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot` (ou `winget install --id EclipseAdoptium.Temurin.21.JDK`)
4. **Android Studio** — `https://developer.android.com/studio` (instala o SDK)
   - SDK alvo: `%LOCALAPPDATA%\Android\Sdk` (build-tools, platform-tools, cmdline-tools, licenses)
   - Aceitar licenças: `sdkmanager --licenses`
5. **opencode** (global) — `npm install -g opencode-ai`
6. **firebase-tools** (global) — `npm install -g firebase-tools`

Globals npm do ambiente de origem (para referência, do `env-manifest.txt`):

```
@google/gemini-cli@0.55.1  depcheck@1.4.7  firebase-tools@15.26.0
firecrawl-cli@1.20.0  opencode-ai@1.18.18  uipro-cli@2.2.3
```

---

## 2) Restaurar configs do usuário (antecipado ao clone)

Necessário **antes** de clonar (o clone usa SSH).

```powershell
# 1. Extrair o ZIP
Expand-Archive -Path "D:\backup\correlogo-backup-<data>.zip" -DestinationPath "$env:TEMP\restore" -Force

# 2. Chaves SSH (git pull/push via git@github.com:mahmatias/correlogo.git)
Copy-Item -Recurse -Force "$env:TEMP\restore\user\.ssh" "$env:USERPROFILE\.ssh"

# 3. Credenciais git + npm
Copy-Item "$env:TEMP\restore\user\.gitconfig" "$env:USERPROFILE\"
Copy-Item "$env:TEMP\restore\user\.git-credentials" "$env:USERPROFILE\"
Copy-Item "$env:TEMP\restore\user\.npmrc" "$env:USERPROFILE\"

# 4. gh CLI + firebase login
New-Item -ItemType Directory -Force "$env:USERPROFILE\AppData\Roaming\GitHub CLI" | Out-Null
Copy-Item "$env:TEMP\restore\user\gh-hosts.yml" "$env:USERPROFILE\AppData\Roaming\GitHub CLI\hosts.yml"
New-Item -ItemType Directory -Force "$env:USERPROFILE\.config\configstore" | Out-Null
Copy-Item "$env:TEMP\restore\user\firebase-tools.json" "$env:USERPROFILE\.config\configstore\firebase-tools.json"
```

Validação rápida:

```powershell
ssh -T git@github.com     # "Hi mahmatias!"
gh auth status            # conta mahmatias
firebase projects:list    # deve listar correlogo-prod
```

---

## 3) Clonar o projeto

```powershell
git clone git@github.com:mahmatias/correlogo.git D:\Trabalho\Corre-Logo
```

O repo já inclui: código, `scripts/backup-workspace.ps1`, `scripts/restore-workspace.ps1`,
`.github/workflows/firebase-deploy.yml`, `.firebaserc` e `docs/` (wiki, plans, specs).

---

## 4) Restaurar secrets + ambiente do projeto

O script `scripts/restore-workspace.ps1` faz tudo (copia secrets do zip para o repo,
restaura configs de usuário, define `JAVA_HOME`/`ANDROID_HOME`/`PATH`):

```powershell
powershell -ExecutionPolicy Bypass -File D:\Trabalho\Corre-Logo\scripts\restore-workspace.ps1 `
  -ZipPath "D:\backup\correlogo-backup-<data>.zip" -RepoRoot D:\Trabalho\Corre-Logo
```

**ATENÇÃO** (regra do AGENTS.md): se o script não copiar `.env.apk`, faça manualmente:

```powershell
Copy-Item -Path ".env.apk" -Destination ".env" -Force
```

Nunca copie `.env.dev` para `.env` (quebra autenticação em produção).

---

## 5) Instalar dependências + build de validação

Em **novo terminal** (para as variáveis de ambiente valerem):

```powershell
Set-Location D:\Trabalho\Corre-Logo

# Node 21+ para o projeto
node --version; npm --version

# Dependências (o repo usa --legacy-peer-deps)
npm ci --legacy-peer-deps

# Testes + lint + build web (pré-condição do APK)
npm test
npm run build          # gera dist/ (Firebase Hosting + base do APK)

# Sincronizar Capacitor
npx cap sync android

# APK de debug (usando o JDK real — o JAVA_HOME persistente pode apontar p/ um dir que não existe)
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot"
Set-Location android
.\gradlew assembleDebug
Set-Location ..
```

Critérios de sucesso:
- `npm test` → todos os testes PASS
- `npm run build` → `dist/` gerado sem erros
- `npx cap sync android` → "[info] Found N Capacitor plugins for android"
- `gradlew assembleDebug` → BUILD SUCCESSFUL

---

## 6) Restaurar configs do opencode (skills/plugins)

Se o script de restore já não o fez, copiar manualmente a pasta `opencode/` do zip:

```powershell
$o = "$env:TEMP\restore\opencode"
Copy-Item "$o\opencode.jsonc" "$env:USERPROFILE\.config\opencode\opencode.jsonc" -Force
Copy-Item "$o\package.json" "$env:USERPROFILE\.config\opencode\"
Copy-Item "$o\package-lock.json" "$env:USERPROFILE\.config\opencode\"
Copy-Item -Recurse -Force "$o\skills-gstack" "$env:USERPROFILE\.config\opencode\skills\gstack"
Copy-Item -Recurse -Force "$o\agents-skills" "$env:USERPROFILE\.agents\skills"
Copy-Item -Recurse -Force "$o\opencode-skills" "$env:USERPROFILE\.opencode\skills"
```

> `skills-gstack` inclui `node_modules/` no backup; se preferir, rode
> `npm install` dentro de `~/.config/opencode` para regenerar.

---

## 7) Restauração de emergência sem backup local

Se o ZIP se perdeu, o CI ainda reconstrói **tudo de produção** a partir dos secrets
do GitHub (push em `main` → `firebase-deploy.yml`). Para recuperar a máquina local
sem os secrets:

- Recriar `.env.apk`/`.env` a partir do Firebase Console (`correlogo-prod` →
  Project settings → SDK config) usando `docs/wiki/build/env-vars.md` como referência.
- Baixar `google-services.json` do Firebase Console (Android app `com.correlogo.app`).
- `keystore.jks` e senhas: **necessário o backup** — não há cópia local alternativa
  (a cópia de produção vive nos secrets de CI).

---

## Checklist final pós-restore

- [ ] `git status` limpo, `git pull` ok via SSH
- [ ] `.env` == `.env.apk` (aponta para `correlogo-prod`)
- [ ] `npm test` verde
- [ ] `npm run build` gera `dist/`
- [ ] `npx cap sync android` + `gradlew assembleDebug` ok
- [ ] `firebase projects:list` mostra `correlogo-prod`
- [ ] opencode carrega skills (`/todo`, gstack, superpowers) e lê `TODO.md`
- [ ] Regerar novo backup periodicamente: `powershell -File scripts\backup-workspace.ps1`

---

## Histórico

| Data | Mudança |
|---|---|
| 2026-08-14 | Criação (backup inicial `correlogo-backup-20260814-211555.zip`, commit do script + receita) |
