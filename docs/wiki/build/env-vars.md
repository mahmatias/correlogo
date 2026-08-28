# Build - Environment Variables

## Arquivos

| Arquivo | Propósito | Commit? |
|---------|-----------|---------|
| `.env.apk` | **Produção APK** (Firebase prod + Web Client ID) | ❌ Não |
| `.env.dev` | Desenvolvimento local (Firebase dev) | ❌ Não |
| `.env.example` | Template | ✅ Sim |
| `functions/.env` | Cloud Functions secrets | ❌ Não |
| `.env` | **Gerado no build** (copia de `.env.apk` ou `.env.dev`) | ❌ Não |
| `android/app/google-services.json` | Firebase Android config (OAuth client IDs, API key) | ❌ Não — **CI secret** |

---

## .env.apk (Produção APK)

```env
# Gemini AI
GEMINI_API_KEY=

# Google OAuth (Cloud Functions)
GOOGLE_CLIENT_ID=550159999478-j2a6b9gknlo9vu4t39lpvo00bijpq0tn.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-REPLACE_WITH_YOUR_SECRET

# Firebase Config (PROD - correlogo-prod)
VITE_FIREBASE_API_KEY=AIzaSy_REPLACE_WITH_YOUR_KEY
VITE_FIREBASE_AUTH_DOMAIN=correlogo-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=correlogo-prod
VITE_FIREBASE_STORAGE_BUCKET=correlogo-prod.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=985879764466
VITE_FIREBASE_APP_ID=1:985879764466:web:5c35802bc6bd173f3f1f6b
VITE_FIREBASE_MEASUREMENT_ID=

# Google OAuth Web Client (usado por web + APK via Chrome Custom Tab)
VITE_GOOGLE_WEB_CLIENT_ID=985879764466-kd0plotbh6349qrniqv09enasnajst1i.apps.googleusercontent.com

# CARTO basemaps (API key para tiles raster light_all/dark_all)
VITE_CARTO_API_KEY=
```

> **CARTO key (2026-08-28)**: a CARTO passou a exigir key nos tiles raster (`basemaps.cartocdn.com`) — sem ela aparece o watermark "API KEY REQUIRED". Key gratuita em `https://carto.com/basemaps/apikey/`. A key é injetada em **duas** URLs: `MapComponent.tsx` (mapa do treino/resumo) e `card-map.ts`/`tileUrl` (card de compartilhamento). Não é vinculada a domínio (Origins valem; domínio informado no formulário é informativo).

---

## ⚠️ CRÍTICO: a CI builda com o secret `ENV_FILE`, não com seu `.env.apk` local

O build da CI (`firebase-deploy.yml`) cria o `.env` a partir do **secret `ENV_FILE`** do GitHub (`base64 -d <<< "${{ secrets.ENV_FILE }}" > .env`), **NÃO** do `.env.apk` local. Por isso, editar só o `.env.apk` **não atualiza o bundler no APK/site**.

**Toda vez que `.env.apk` mudar** (nova `VITE_*` ou valor), rodar:

```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content ".env.apk" -Raw))) | Out-String
# copie o base64 e rode (ou faça direto):
gh secret set ENV_FILE -b ( [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content ".env.apk" -Raw))) )
```

Sem sincronizar o secret, o bundler no APK fica sem as novas variáveis — foi exatamente o que causou o overlay do CARTO persistente no APK 178 (a key estava no `.env.apk` local, mas o secret não tinha a `VITE_CARTO_API_KEY`).

---

## .env.dev (Desenvolvimento Local)

```env
# Firebase Config (DEV - correlogo-dev-9a96a)
VITE_FIREBASE_API_KEY=AIzaSy_REPLACE_WITH_YOUR_KEY
VITE_FIREBASE_AUTH_DOMAIN=correlogo-dev-9a96a.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=correlogo-dev-9a96a
VITE_FIREBASE_STORAGE_BUCKET=correlogo-dev-9a96a.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=1:...:web:...
VITE_FIREBASE_MEASUREMENT_ID=

# Google OAuth (mesmo Web Client ID)
VITE_GOOGLE_WEB_CLIENT_ID=985879764466-kd0plotbh6349qrniqv09enasnajst1i.apps.googleusercontent.com
```

---

## functions/.env (Cloud Functions)

```env
# Google OAuth (usado no token exchange)
GOOGLE_CLIENT_ID=985879764466-kd0plotbh6349qrniqv09enasnajst1i.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX_REPLACE_WITH_YOUR_SECRET
```

---

## google-services.json (CI Secret)

**Não versionado** — contém OAuth client IDs (Android) + Firebase API key. Restaurado no CI via secret `GOOGLE_SERVICES_B64`.

### Gerar o secret (local)

```powershell
# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("android/app/google-services.json"))
```

### Configurar no GitHub

Settings → Secrets and variables → Actions → New repository secret:
- **Name**: `GOOGLE_SERVICES_B64`
- **Value**: (cole o base64 acima)

### CI Step (firebase-deploy.yml)

```yaml
- name: Restore google-services.json
  run: base64 -d <<< "${{ secrets.GOOGLE_SERVICES_B64 }}" > android/app/google-services.json
```

### .gitignore

```gitignore
# Firebase / Google
android/app/google-services.json
```

---

## Build Process

```bash
# APK Build (usa .env.apk + GOOGLE_SERVICES_B64 secret no CI)
Copy-Item .env.apk .env -Force
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug

# Dev Local (usa .env.dev)
# NOTA: .env.dev SÓ para `npm run dev`. Nunca para build/deploy.
Copy-Item .env.dev .env -Force
npm run dev
```

---

## Variáveis no Runtime (Vite)

```typescript
// Acesso no código
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
const geminiKey = import.meta.env.GEMINI_API_KEY; // Não recomendado no client!
```

> **Aviso**: Variáveis `VITE_*` são **embedded no bundle** no build. Não usar para secrets server-side.

---

## .gitignore

```gitignore
# Environment files
.env
.env.local
.env.*.local
.env.apk
.env.dev
functions/.env

# Firebase
firebase-debug.log
.firebase/

# Build
dist/
android/app/build/
android/.gradle/

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Security (CI/CD)
keystore.jks
firebase-key.json
android/app/google-services.json
```

---

## Security Checklist

- [ ] `.env.apk` **não** commitado
- [ ] `.env.dev` **não** commitado
- [ ] `functions/.env` **não** commitado
- [ ] `google-services.json` **não** commitado (tem API key + OAuth client IDs)
- [ ] `debug.keystore` **não** commitado
- [ ] `release.keystore` **não** commitado
- [ ] Secrets no GitHub/GitLab Secrets (para CI/CD)
- [ ] `GOOGLE_SERVICES_B64` configurado no GitHub Actions Secrets

---

## Troubleshooting

| Problema | Causa | Fix |
|----------|-------|-----|
| `auth/invalid-credential` | `google-services.json` com SHA-1 errado | Atualizar SHA-1 no Firebase Console |
| `redirect_uri_mismatch` | Client ID errado (Android vs Web) | Usar `VITE_GOOGLE_WEB_CLIENT_ID` |
| Firebase config vazio | `.env` não copiado antes do build | `Copy-Item .env.apk .env -Force` |
| Cloud Function 500 | `GOOGLE_CLIENT_SECRET` errado | Verificar `functions/.env` |
| CI build fail (missing .env) | `ENV_FILE` secret não configurado | Configurar no GitHub Secrets |
| CI build fail (missing google-services.json) | `GOOGLE_SERVICES_B64` secret não configurado | Configurar no GitHub Secrets |
| APK sem `VITE_*` nova (ex: overlay CARTO) | secret `ENV_FILE` desatualizado | `gh secret set ENV_FILE -b <base64 do .env.apk>` e rebuild |

---

*Última revisão: 2026-07-30*