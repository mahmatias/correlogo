# Migração AWS → Firebase Hosting + Cloud Functions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar o servidor AWS EC2 migrando static files + OAuth callback para Firebase Hosting + Cloud Functions (Spark plan, $0).

**Architecture:** Firebase Hosting serve o `dist/` (SPA). Uma Cloud Function única (`authCallback`) trata o Google OAuth code exchange. CSP e security headers ficam no `firebase.json`. O `server.ts` é removido.

**Tech Stack:** Firebase Hosting, Firebase Cloud Functions v2 (Node.js 18+), Vite, Capacitor

## Global Constraints

- Spark plan (grátis para sempre) — não usar recursos que excedam limites
- Domínio: `correlogo.web.app`
- Cloud Function: `onRequest` (v2), sem Express
- Secrets via `firebase functions:config:set` — nunca no código
- APK: manter Capacitor + `@capacitor/filesystem`
- Rollback: AWS EC2 continua rodando até Fase 4

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `functions/package.json` | Create | Deps da Cloud Function |
| `functions/src/index.ts` | Create | `authCallback` + `healthCheck` |
| `functions/.gitignore` | Create | Ignorar `node_modules` e `lib` |
| `firebase.json` | Replace | Hosting rewrites + headers + functions |
| `package.json` | Modify | Remover deps do server, simplificar scripts |
| `index.html` | Modify | Remover tag CSP meta |
| `src/lib/capacitor/auth.ts` | Modify | Novo domínio no redirect URI |
| `server.ts` | Delete | Substituído por Firebase Hosting + Functions |

---

### Task 1: Criar Cloud Function

**Files:**
- Create: `functions/package.json`
- Create: `functions/src/index.ts`
- Create: `functions/.gitignore`

**Interfaces:**
- Consumes: `firebase-functions/v2/https` (`onRequest`)
- Produces: `authCallback` (GET/POST, redirect), `healthCheck` (GET, JSON)

- [ ] **Step 1: Criar `functions/package.json`**

```json
{
  "name": "correlogo-functions",
  "private": true,
  "engines": { "node": "18" },
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "deploy": "firebase deploy --only functions"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^6.3.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Criar `functions/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2017",
    "skipLibCheck": true
  },
  "compileOnSave": true,
  "include": ["src"]
}
```

- [ ] **Step 3: Criar `functions/.gitignore`**

```
node_modules/
lib/
```

- [ ] **Step 4: Criar `functions/src/index.ts`**

```ts
import { onRequest } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";

export const authCallback = onRequest(async (req, res) => {
  const code = req.query.code as string;
  const state = (req.query.state as string) || "";

  if (!code) {
    return res.redirect("/?gcal_error=missing_code");
  }

  const config = functions.config().google;
  const redirectUri = "https://correlogo.web.app/auth/google/callback";

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.client_id,
        client_secret: config.client_secret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokens = (await tokenResponse.json()) as Record<string, string>;

    if (tokens.error) {
      const errorMsg = tokens.error_description || tokens.error;
      const dest = state.startsWith("c3_")
        ? `com.correlogo.app://oauth/callback?error=${encodeURIComponent(errorMsg)}`
        : `/?gcal_error=${encodeURIComponent(errorMsg)}`;
      return res.redirect(dest);
    }

    if (state.startsWith("c3_")) {
      res.redirect(
        `com.correlogo.app://oauth/callback?token=${encodeURIComponent(tokens.access_token!)}&state=${encodeURIComponent(state)}`
      );
    } else {
      res.redirect(
        `/?gcal_token=${tokens.access_token}&state=${encodeURIComponent(state)}`
      );
    }
  } catch (err: any) {
    const dest = state.startsWith("c3_")
      ? `com.correlogo.app://oauth/callback?error=${encodeURIComponent(err.message)}`
      : `/?gcal_error=${encodeURIComponent(err.message)}`;
    res.redirect(dest);
  }
});

export const healthCheck = onRequest(async (req, res) => {
  res.json({ status: "ok" });
});
```

- [ ] **Step 5: Instalar deps da Cloud Function**

Run: `cd functions && npm install`
Expected: sem erros

- [ ] **Step 6: Build da Cloud Function**

Run: `cd functions && npx tsc`
Expected: sem erros, gera `functions/lib/index.js`

- [ ] **Step 7: Commit**

```bash
git add functions/
git commit -m "feat(functions): add authCallback + healthCheck Cloud Functions"
```

---

### Task 2: Atualizar Firebase Hosting Config

**Files:**
- Replace: `firebase.json`

**Interfaces:**
- Consumes: Cloud Function names `authCallback`, `healthCheck` (do Task 1)
- Produces: hosting config pronta pra deploy

- [ ] **Step 1: Substituir `firebase.json`**

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/node_modules/**"],
    "rewrites": [
      { "source": "/auth/google/callback", "function": "authCallback" },
      { "source": "/api/health", "function": "healthCheck" },
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://lh3.googleusercontent.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self' https: wss://*.firebaseio.com; frame-src https://*.firebaseapp.com https://accounts.google.com"
          },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "X-Frame-Options", "value": "DENY" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
        ]
      }
    ]
  },
  "functions": [
    { "source": "functions", "codebase": "default" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add firebase.json
git commit -m "feat(firebase): add hosting rewrites, headers, and functions config"
```

---

### Task 3: Limpar package.json do projeto principal

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: dependências atuais do projeto
- Produz: `package.json` limpo, sem deps do server

- [ ] **Step 1: Ler `package.json` atual e remover as seguintes dependências:**

- `express`
- `helmet`
- `cors`
- `express-rate-limit`
- `google-auth-library`
- `dotenv`
- `@types/express` (devDeps)

- [ ] **Step 2: Atualizar scripts**

Substituir:
```json
"scripts": {
  "dev": "tsx server.ts",
  "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
  "start": "node dist/server.cjs",
  "lint": "tsc --noEmit",
  "build:apk": "npm run build && npx cap sync android && cd android && gradlew.bat assembleDebug && cd .. && powershell -ExecutionPolicy Bypass -File scripts/export-apk.ps1"
}
```

Por:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "tsc --noEmit",
  "build:apk": "npm run build && npx cap sync android && cd android && gradlew.bat assembleDebug && cd .. && powershell -ExecutionPolicy Bypass -File scripts/export-apk.ps1"
}
```

- [ ] **Step 3: Remover `esbuild` das devDependencies** (era usado pelo server.ts build)

- [ ] **Step 4: Rodar `npm install`**

Run: `npm install`
Expected: sem erros, `node_modules` atualizado

- [ ] **Step 5: Verificar que `npm run build` funciona**

Run: `npm run build`
Expected: `vite build` gera `dist/` sem erros

- [ ] **Step 6: Verificar que `npm run dev` inicia o Vite dev server**

Run: `npm run dev`
Expected: Vite dev server inicia na porta 5173 (ou 3000 se configurado)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json
git commit -m "refactor: remove Express server deps, simplify to Vite-only"
```

---

### Task 4: Remover server.ts e CSP meta do index.html

**Files:**
- Delete: `server.ts`
- Modify: `index.html`

**Interfaces:**
- Consumes: CSP definido no `firebase.json` (Task 2)
- Produz: `index.html` sem tag CSP, `server.ts` removido

- [ ] **Step 1: Deletar `server.ts`**

Run: `del server.ts` (Windows) ou `rm server.ts`

- [ ] **Step 2: Remover tag CSP do `index.html`**

Substituir:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data: https://lh3.googleusercontent.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self' https:" />
```

Por: *(remover a linha inteira)*

- [ ] **Step 3: Build pra verificar que nada quebrou**

Run: `npm run build`
Expected: sucesso, `dist/index.html` existe

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove server.ts and CSP meta tag (handled by Firebase Hosting)"
```

---

### Task 5: Atualizar domínio no APK

**Files:**
- Modify: `src/lib/capacitor/auth.ts`

**Interfaces:**
- Consumes: novo domínio `correlogo.web.app`
- Produz: OAuth redirect URI atualizado para APK

- [ ] **Step 1: Ler `src/lib/capacitor/auth.ts` e encontrar a linha com o redirect URI**

Procurar por: `correlogo.sytes.net` ou `APP_URL` ou `redirect_uri`

- [ ] **Step 2: Substituir o domínio**

De: `correlogo.sytes.net` ou domínio anterior
Para: `correlogo.web.app`

Exemplo (o código exato pode variar):
```ts
const REDIRECT_URI = "https://correlogo.web.app/auth/google/callback";
```

- [ ] **Step 3: Build pra verificar**

Run: `npm run build`
Expected: sucesso

- [ ] **Step 4: Commit**

```bash
git add src/lib/capacitor/auth.ts
git commit -m "feat(apk): update OAuth redirect URI to correlogo.web.app"
```

---

### Task 6: Deploy Firebase e teste

**Files:** nenhum arquivo novo — execução de deploy

**Pré-requisitos:**
- `firebase login` (usuário faz uma vez)
- `firebase functions:config:set google.client_id="..." google.client_secret="..."` (usuário faz)

- [ ] **Step 1: Configurar Functions config**

Run (usuário executa):
```bash
firebase functions:config:set google.client_id="SEU_CLIENT_ID" google.client_secret="SEU_CLIENT_SECRET"
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `dist/` criado

- [ ] **Step 3: Deploy**

Run: `firebase deploy --only hosting,functions`
Expected: deploy completo, URLs mostradas no output

- [ ] **Step 4: Testar web**

Abrir: `https://correlogo.web.app`
Expected: app carrega, login funciona

- [ ] **Step 5: Testar OAuth web**

Fluxo de login → Google Calendar → callback
Expected: redireciona de volta pro app com token

- [ ] **Step 6: Verificar que correlogo.sytes.net ainda funciona**

Abrir: `https://correlogo.sytes.net`
Expected: app continua funcionando (AWS não foi desligado)

- [ ] **Step 7: Adicionar Redirect URI no Google Cloud Console**

Usuário faz manualmente:
1. Google Cloud Console → APIs & Services → Credentials
2. Editar OAuth 2.0 Client ID
3. Adicionar `https://correlogo.web.app/auth/google/callback` em Authorized redirect URIs

---

### Task 7: Gerar e testar APK

**Files:** nenhum arquivo novo — build e teste

**Pré-requisitos:** Tasks 1-5 completas, deploy feito (Task 6)

- [ ] **Step 1: Sync Capacitor**

Run: `npx cap sync android`

- [ ] **Step 2: Build APK**

Run: `npm run build:apk`

- [ ] **Step 3: Instalar APK no device**

Run: `adb install Corre\ Logo\ v*.apk`

- [ ] **Step 4: Testar OAuth no APK**

Abrir APK → Login → Google Calendar
Expected: OAuth fluxo completo funciona com correlogo.web.app

---

### Task 8: Corte final

**Files:** nenhum — operação de infraestrutura

**Pré-requisitos:** Tasks 1-7 completas, tudo testado

- [ ] **Step 1: Confirmar que tudo funciona em correlogo.web.app**

- [ ] **Step 2: Desligar AWS EC2**

Usuário faz:
```bash
# No servidor AWS
sudo pm2 stop correlogo
# Ou desligar a instância via AWS Console
```

- [ ] **Step 3: (Opcional) Apontar correlogo.sytes.net pro Firebase**

Se quiser manter o domínio antigo:
1. DNS: apontar `correlogo.sytes.net` pra `correlogo.web.app`
2. Firebase Console → Hosting → domínio personalizado

- [ ] **Step 4: Atualizar HANDOFF.md com estado final da migração**

---

## Rollback

Se algo falhar em qualquer etapa:

1. **AWS ainda está rodando** — não foi desligado
2. Reiniciar PM2: `sudo pm2 restart correlogo` (se parou)
3. Apontar DNS de volta pra `correlogo.sytes.net` (se mudou)
4. Investigar e corrigir o problema no Firebase

## Checklist Manual (Usuário)

Antes de começar a Fase 1:
- [ ] `firebase login` autenticado
- [ ] Acesso ao Google Cloud Console
- [ ] `VITE_GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` conhecidos
- [ ] Device Android disponível pra teste de APK
