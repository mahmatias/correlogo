# Architecture Decision Records (ADRs)

## ADR-001: Capacitor over React Native

**Status**: ✅ Aceito  
**Data**: 2026-01

### Contexto
Precisava de app Android nativo com acesso a: GPS, Step Counter, Health Connect, TTS, WakeLock, Notifications, Firebase Auth nativo.

### Decisão
Usar **Capacitor 7** (React + WebView + Native Plugins) ao invés de React Native.

### Alternativas
| Opção | Prós | Contras |
|-------|------|---------|
| **React Native** | Performance nativa, ecossistema grande | Reescrever todo UI, 2 codebases, plugins HC/StepCounter complexos |
| **Capacitor** | Single codebase (React), plugins Kotlin, WebView reusa web code | WebView overhead, plugins limitados |
| **PWA + TWA** | Zero native code | Sem Health Connect, GPS background, WakeLock |

### Consequências
- ✅ Single codebase (React web + APK)
- ✅ Plugins Kotlin para HC, GPS, Step Counter, TTS
- ⚠️ WebView overhead (~10-15% perf)
- ⚠️ WebView CSP restritivo (precisa config)
- ⚠️ Debug mais complexo (Chrome DevTools + logcat)

---

## ADR-002: Firebase over Custom Backend

**Status**: ✅ Aceito  
**Data**: 2026-01

### Contexto
Precisava: Auth (Google), Database (plans/sessions), Hosting, Functions (OAuth), Storage.

### Decisão
**Firebase** (Auth + Firestore + Hosting + Functions) ao invés de Node/Express + PostgreSQL + AWS/GCP custom.

### Consequências
- ✅ Zero ops (serverless)
- ✅ Offline-first (Firestore cache)
- ✅ Auth integrado (Google, email)
- ✅ Free tier generoso
- ⚠️ Vendor lock-in
- ⚠️ Firestore query limitations (no OR, complex joins)
- ⚠️ Cold starts Functions (~200ms)

---

## ADR-003: Health Connect over Samsung Health

**Status**: ✅ Aceito  
**Data**: 2026-07

### Contexto
Samsung Health SDK (AAR proprietário) vs Android Health Connect (Jetpack).

### Decisão
**Health Connect** (androidx.health.connect:connect-client:1.1.0)

### Justificativa
| Fator | Samsung Health | Health Connect |
|-------|----------------|----------------|
| Custo | Grátis (mas parceria) | Grátis (open) |
| Distribuição | Galaxy Store | Play Store (built-in Android 14+) |
| Targets | Samsung Health apenas | Strava, GymRats, Google Fit, etc |
| API | Proprietária (AAR) | Jetpack oficial (Kotlin) |
| Manutenção | Samsung decide | Google + comunidade |

### Consequências
- ✅ Uma escrita → Strava + GymRats + Google Fit
- ✅ API Kotlin moderna (coroutines, sealed classes)
- ✅ Permissões granulares (WRITE_EXERCISE, WRITE_DISTANCE)
- ⚠️ Requer Android 8+ (minSdk 26)
- ⚠️ Strava não importa non-GPS via HC (precisa Gmail API workaround)

---

## ADR-004: Strava via Gmail API (não Health Connect)

**Status**: ✅ Aceito  
**Data**: 2026-07

### Contexto
Strava **não importa** atividades non-GPS (indoor/treadmill) via Health Connect.

### Decisão
Canal separado: **Gmail API** (`gmail.send` scope) → email com anexo TCX/GPX → `stravaupload@gotoes.org`.

### Fluxo
```
Workout Complete
    │
    ├─ Health Connect → GymRats ✅ (ambos)
    │
    └─ Gmail API → stravaupload@gotoes.org
         ├─ Treadmill → TCX attachment
         └─ Outdoor → GPX attachment
```

### Consequências
- ✅ Strava recebe ambos os tipos
- ✅ Subject = título atividade no Strava
- ⚠️ Requer OAuth `gmail.send` scope (sensitive)
- ⚠️ Limite 100 emails/dia (Gmail API quota)
- ⚠️ App em "Testing" = só test users

---

## ADR-005: Web Client ID Único (Web + APK)

**Status**: ✅ Aceito  
**Data**: 2026-07

### Contexto
OAuth Google no APK via `Browser.open()` (Chrome Custom Tab) vs web.

### Decisão
**Um único Web Client ID** (`VITE_GOOGLE_WEB_CLIENT_ID`) para ambas plataformas.

### Justificativa
| Abordagem | Prós | Contras |
|-----------|------|---------|
| **Web Client ID único** | 1 credencial, 1 redirect URI, 1 consent screen | Precisa `androidScheme: 'https'` no Capacitor |
| Android Client ID separado | Nativo, SHA-1 bound | 2 credenciais, 2 consent screens, redirect URI diferente |

### Configuração
```typescript
// capacitor.config.ts
server: {
  androidScheme: 'https',
  cleartext: true
}
```

### Consequências
- ✅ Single source of truth para OAuth
- ✅ Mesmo fluxo web/APK (Chrome Custom Tab)
- ⚠️ Requer `androidScheme: 'https'` + `cleartext: true`

---

## ADR-006: ActivityResultLauncher for Health Connect Permissions

**Status**: ✅ Aceito  
**Data**: 2026-07

### Contexto
Tentativas v1.6-v1.9 usavam `startActivity(intent)` + resolução imediata `granted=true` → **nunca funcionava** (não aguardava usuário).

### Decisão
Usar `ComponentActivity.registerForActivityResult()` com `PermissionController.createRequestPermissionResultContract()`.

### Implementação
```kotlin
// HealthConnectPlugin.kt
override fun load() {
    permissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { grantedPerms ->
        val granted = grantedPerms.contains(WRITE_EXERCISE)
        pendingCall?.resolve(JSObject().put("granted", granted))
    }
}

@PluginMethod
fun requestHcPermissions(call: PluginCall) {
    pendingCall = call
    permissionLauncher?.launch(setOf(WRITE_EXERCISE, WRITE_DISTANCE))
}
```

### Consequências
- ✅ Aguarda usuário conceder/negar
- ✅ Callback com permissões reais concedidas
- ✅ Removeu 5 tentativas `startActivity()` falhas
- ⚠️ Requer `load()` chamado antes de STARTED (Capacitor garante)

---

## ADR-007: Serverless (Firebase Functions) over Express

**Status**: ✅ Aceito  
**Data**: 2026-07

### Contexto
Migração AWS EC2 (Express + PM2 + Nginx) → Firebase Hosting + Functions.

### Decisão
**Firebase Functions v2 (Node 22)** para OAuth callback + health check.

### Consequências
- ✅ Zero infra management
- ✅ Auto-scaling
- ✅ Integrado com Firebase Auth/Hosting
- ⚠️ Cold starts (~200ms)
- ⚠️ 128MB RAM limit (configurável)
- ⚠️ 60s timeout max

---

## ADR-008: Vite Only (No Express Server)

**Status**: ✅ Aceito  
**Data**: 2026-07

### Contexto
Remoção do `server.ts` (Express + Vite middleware) após migração para Firebase Hosting.

### Decisão
**Vite only** (`npm run build` → `dist/` → Firebase Hosting). Dev server via `npm run dev` (Vite dev server).

### Consequências
- ✅ Simplicidade (1 comando build)
- ✅ Firebase Hosting otimizado (CDN, SSL, rewrites)
- ✅ Cloud Functions para API dinâmica
- ⚠️ Sem SSR (não necessário para app)
- ⚠️ Dev server porta 3000 (`vite.config.ts`)

---

## ADR-009: Refresh Token via Cloud Function (not Client-Side)

**Status**: ✅ Aceito  
**Data**: 2026-07

### Contexto
O Gmail OAuth token expira após ~1h. Precisávamos de acesso permanente sem re-autorizar toda hora.

### Alternativas

| Opção | Prós | Contras |
|-------|------|---------|
| **Client-side refresh** (Google Identity Services) | Sem cloud function | GIS não disponível em WebView Android; complicado com Capacitor |
| **Cloud Function refresh** | Centralizado, client_id/secret seguros, funciona em APK | Cold start ~200ms, dependência de rede |
| **PKCE + SPA** | Sem client_secret | Requer alteração no fluxo OAuth, mais complexo |

### Decisão
**Cloud Function `refreshAuthToken`**: endpoint simples que recebe `refresh_token`, faz `POST oauth2.googleapis.com/token` e retorna novo `access_token`.

### Fluxo
1. `authCallback` já recebe `refresh_token` do Google (porque usamos `access_type=offline`)
2. Na primeira auth de cada usuário, o `refresh_token` é passado no redirect: `?token=...&refresh_token=...`
3. App salva ambos no localStorage como JSON
4. Em 401, app envia `refresh_token` para `refreshAuthToken`, recebe novo `access_token`, atualiza localStorage, retry

### Consequências
- ✅ Uma só re-autorização → acesso permanente
- ✅ `client_secret` nunca exposto no client
- ⚠️ Usuários com token antigo (sem `refresh_token`) precisam re-autorizar 1x
- ⚠️ Cold start na primeira requisição após período inativo

---

## ADR-010: AWS Decommissioned — Firebase-Only

**Status**: ✅ Aceito  
**Data**: 2026-07-31

### Contexto
Após a migração para Firebase (ADR-007/008), a instância EC2 (`correlogo.sytes.net`) ficou como legado: web app no Hosting, API nas Cloud Functions. O servidor próprio não era mais usado por ninguém — só gerava custo e superfície de manutenção.

### Decisão
**Desativar completamente a infra AWS** (EC2, PM2, Nginx, certificado Let's Encrypt, domínio `correlogo.sytes.net`). Toda a infra passa a ser **100% Firebase**:

- **Web (PWA)**: Firebase Hosting site `correlogo` → `https://correlogo.web.app`
- **API dinâmica**: Cloud Functions v2 (Node 22) — `authCallback`, `healthCheck`, `refreshAuthToken`
- **Dados**: Firestore `correlogo-prod` (rules em `firestore.rules`)
- **APK / CI**: GitHub Actions (`.github/workflows/firebase-deploy.yml`) → Release `latest` + `update-manifest.json` → auto-update no device (a partir da 3.2)

### Consequências
- ✅ Zero custo de servidor, zero ops
- ✅ `VITE_*` baked no build + `firebase deploy` = processo simples e reprodutível
- ✅ Domínio único `correlogo.web.app` (sem split brain sytes/web.app)
- ⚠️ Perde o domínio custom `correlogo.sytes.net` (pode registrar domínio próprio depois via Firebase Hosting, se quiser)
- ⚠️ Docs e AGENTS.md desatualizados (seção EC2) — corrigidos nesta sessão

---

*Última revisão: 2026-07-31*