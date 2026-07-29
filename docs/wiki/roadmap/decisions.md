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
- ⚠️ Dev server porta 5173 (não 3000)

---

*Última revisão: 2026-07-29*