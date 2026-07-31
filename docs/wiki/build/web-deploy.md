# Build - Web Deploy

## Firebase Hosting

```bash
# Deploy
firebase deploy --only hosting

# Deploy + Functions
firebase deploy

# Apenas hosting (mais rápido)
firebase deploy --only hosting:correlogo
```

### firebase.json

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "hosting": {
    "site": "correlogo",
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
            "value": "default-src 'self'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://lh3.googleusercontent.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://securetoken.googleapis.com https://www.gstatic.com https://www.googleapis.com https://*.googleapis.com; connect-src 'self' https: wss://*.firebaseio.com https://*.googleapis.com https://*.google.com; frame-src https://*.firebaseapp.com https://accounts.google.com"
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

---

## Cloud Functions

### authCallback (OAuth Token Exchange)

```typescript
// functions/src/index.ts
export const authCallback = onRequest(async (req, res) => {
  const { code, state } = req.query;
  const isNative = state.startsWith('c3_') || state.startsWith('gm_');
  
  const tokens = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: JSON.stringify({
      client_id: WEB_CLIENT_ID,
      client_secret: WEB_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: 'https://correlogo.web.app/auth/google/callback',
    }),
  });
  
  if (isNative) {
    res.redirect(`com.correlogo.app://oauth/callback?token=${tokens.access_token}&state=${state}`);
  } else {
    res.redirect(`/?gcal_token=${tokens.access_token}&state=${state}`);
  }
});
```

### healthCheck

```typescript
export const healthCheck = onRequest((req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});
```

### refreshAuthToken

Endpoint que troca `refresh_token` por `access_token` novo (Gmail API). Recebe `{ refresh_token }` em JSON, responde `{ access_token }`.

---

## Environment Variables (Production)

| Variável | Valor | Onde |
|----------|-------|------|
| `VITE_FIREBASE_API_KEY` | `AIzaSy_REPLACE_WITH_YOUR_KEY` | `.env.apk` (baked no build) |
| `VITE_FIREBASE_AUTH_DOMAIN` | `correlogo-prod.firebaseapp.com` | idem |
| `VITE_FIREBASE_PROJECT_ID` | `correlogo-prod` | idem |
| `VITE_GOOGLE_WEB_CLIENT_ID` | `985879764466-kd0plot...` | `.env.apk` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX_REPLACE_WITH_YOUR_SECRET` | `functions/.env` |
| `GEMINI_API_KEY` | `AIza_REPLACE_WITH_YOUR_KEY` | `.env.apk` |

> **Importante**: Variáveis `VITE_*` são **baked no build** (compile-time). Mudar variável exige `npm run build` + `firebase deploy` de novo — não há `.env` em runtime no servidor (não existe mais servidor).

---

## Domains

| Ambiente | URL | Status |
|----------|-----|--------|
| **Produção (Web)** | https://correlogo.web.app | ✅ Ativo |
| **Dev Local** | http://localhost:3000 (Vite) | ✅ Dev |

> 🗑️ `correlogo.sytes.net` (AWS EC2) foi **desativado** em 2026-07-31.

---

## Deploy Checklist

- [ ] `Copy-Item .env.apk .env -Force`
- [ ] `npm run build` (sem erros)
- [ ] `firebase deploy --only hosting:correlogo` ✅
- [ ] `firebase deploy --only functions` (authCallback, healthCheck, refreshAuthToken) ✅
- [ ] Testar login Google no https://correlogo.web.app
- [ ] Testar "Testar envio para Strava" no Perfil
- [ ] Build APK → testar no device (push em `main` também dispara o CI)

---

*Última revisão: 2026-07-31*