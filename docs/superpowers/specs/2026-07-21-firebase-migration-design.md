# Design: Migração AWS → Firebase Hosting + Cloud Functions

## Objetivo

Eliminar o servidor AWS EC2 (Ubuntu, PM2, Nginx, SSL) migrando tudo para Firebase Hosting + Cloud Functions no Spark plan (grátis para sempre).

**Domínio:** `correlogo.web.app`

## Escopo

- ✅ Static files (SPA React/Vite)
- ✅ Google OAuth callback (`/auth/google/callback`)
- ✅ CSP + security headers
- ✅ Rate limiting
- ✅ Health check
- ✅ APK atualizado com novo domínio
- ❌ Não mexe em Firestore, Auth, ou banco de dados

## O que muda

### Arquitetura

```
[ANTES]
[usuário/APK] → [AWS EC2: Nginx:443 → Express:3000]
                  ├── static files (dist/)
                  └── /auth/google/callback → token exchange

[DEPOIS]
[usuário] → [Firebase Hosting: correlogo.web.app]
              ├── static files (dist/, CDN global)
              └── /auth/google/callback → [Cloud Function]

[APK] → Google → Cloud Function → com.correlogo.app://oauth/callback?token=...
```

### Arquivos removidos

| Arquivo | Razão |
|---------|-------|
| `server.ts` | Substituído por Firebase Hosting + Cloud Function |

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `package.json` | Remover `express`, `helmet`, `cors`, `express-rate-limit`, `google-auth-library`, `dotenv`. Remover scripts `dev` (server.ts) e `build` (esbuild). Simplificar `dev` para `vite` e `build` para `vite build` |
| `index.html` | Remover tag CSP meta (hosting config sobrepõe) |
| `firebase.json` | Novo: hosting rules + functions config |
| `src/lib/capacitor/auth.ts` | Domain: `correlogo.sytes.net` → `correlogo.web.app` |
| `capacitor.config.ts` | Nenhuma mudança necessária (usa auth.ts) |

### Arquivos criados

| Arquivo | Conteúdo |
|---------|----------|
| `functions/package.json` | Deps: `firebase-functions`, `firebase-admin`. Engine: `>=18` |
| `functions/src/index.ts` | Cloud Function `authCallback`: troca code por token |

## Detalhes

### Cloud Function (`functions/src/index.ts`)

```ts
import { onRequest } from 'firebase-functions/v2/https';
import * as functions from 'firebase-functions';

export const authCallback = onRequest(async (req, res) => {
  const code = req.query.code as string;
  const state = (req.query.state as string) || '';

  if (!code) {
    return res.redirect('/?gcal_error=missing_code');
  }

  const config = functions.config().google;
  const redirectUri = 'https://correlogo.web.app/auth/google/callback';

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.client_id,
      client_secret: config.client_secret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  const tokens = await tokenResponse.json() as any;

  if (tokens.error) {
    const dest = state.startsWith('c3_')
      ? `com.correlogo.app://oauth/callback?error=${encodeURIComponent(tokens.error_description || tokens.error)}`
      : `/?gcal_error=${encodeURIComponent(tokens.error_description || tokens.error)}`;
    return res.redirect(dest);
  }

  if (state.startsWith('c3_')) {
    // APK
    res.redirect(
      `com.correlogo.app://oauth/callback?token=${encodeURIComponent(tokens.access_token)}&state=${encodeURIComponent(state)}`
    );
  } else {
    // Web
    res.redirect(`/?gcal_token=${tokens.access_token}&state=${encodeURIComponent(state)}`);
  }
});
```

### Firebase Hosting Config (`firebase.json`)

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

### Health Check (`functions/src/index.ts`)

```ts
export const healthCheck = onRequest(async (req, res) => {
  res.json({ status: 'ok' });
});
```

### Variáveis de Ambiente

| Variável | Valor | Onde |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | (atual) | `.env` local, `.env.apk` |
| `google.client_id` | (atual) | Firebase Functions config |
| `google.client_secret` | (atual) | Firebase Functions config |
| `VITE_FIREBASE_*` | (atual) | `.env` local, `.env.apk` |

```bash
# Setup da Cloud Function
firebase functions:config:set google.client_id="SEU_ID" google.client_secret="SEU_SECRET"
```

### APK Changes

`src/lib/capacitor/auth.ts`: substituir URL do callback:

```ts
// ANTES
const REDIRECT_URI = 'https://correlogo.sytes.net/auth/google/callback';

// DEPOIS
const REDIRECT_URI = 'https://correlogo.web.app/auth/google/callback';
```

## Fluxo de Migração

### Fase 1 — Preparação (local)
1. Criar `functions/package.json` + `functions/src/index.ts`
2. Atualizar `firebase.json`
3. Remover `server.ts`
4. Atualizar `package.json` (deps e scripts)
5. Remover CSP meta do `index.html`
6. Atualizar `src/lib/capacitor/auth.ts`
7. `cd functions && npm install`
8. `firebase deploy --only hosting,functions`

### Fase 2 — Deploy e Teste (Firebase)
1. `firebase deploy --only hosting,functions`
2. Testar `https://correlogo.web.app`
3. Testar OAuth (web)
4. Verificar que correlogo.sytes.net ainda funciona (AWS não foi desligado)

### Fase 3 — APK
1. `npx cap sync android`
2. `npm run build:apk`
3. Testar APK com correlogo.web.app

### Fase 4 — Corte
1. Confirmar tudo funcionando
2. Configurar Google Cloud Console: adicionar `https://correlogo.web.app/auth/google/callback` como Redirect URI
3. Desligar AWS EC2
4. Opcional: apontar correlogo.sytes.net pra Firebase via DNS

### Rollback
Se algo falhar: reiniciar PM2 na AWS, DNS volta pra correlogo.sytes.net.

## Checklist de Configuração (Usuário)

O usuário deve fazer manualmente (não automatizável):

- [ ] `firebase login` (se ainda não fez)
- [ ] `firebase functions:config:set google.client_id="..." google.client_secret="..."`
- [ ] Google Cloud Console → OAuth → adicionar `https://correlogo.web.app/auth/google/callback` como Authorized Redirect URI
- [ ] Testar OAuth web em correlogo.web.app
- [ ] Testar APK com correlogo.web.app
- [ ] Desligar AWS EC2 quando confirmar que tudo funciona
