# Arquitetura - Stack Tecnológica

## Frontend

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **React** | 19 | UI library |
| **TypeScript** | 5.x | Type safety |
| **Vite** | 6.x | Build tool + dev server |
| **Tailwind CSS** | 4.x | Utility-first styling |
| **React Router** | 7.x | SPA routing (hash mode) |
| **Lucide React** | 0.4.x | Ícones |
| **Leaflet** | 1.9.x | Mapas outdoor |
| **Recharts** | 2.x | Gráficos (lazy loaded) |
| **date-fns** | 4.x | Datas/locale pt-BR |

## Backend / Cloud

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **Firebase Auth** | 11.x | Email/password + Google OAuth |
| **Firestore** | 12.x | Plans, Sessions, Profile, Settings |
| **Firebase Functions** | 2.x (Node 22) | `authCallback`, `healthCheck` |
| **Firebase Hosting** | - | Static hosting + rewrites |

## Android / Capacitor

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **Capacitor** | 7.x | Native bridge + WebView |
| **@capacitor/app** | 8.x | Deep links, back button |
| **@capacitor/browser** | 8.x | Chrome Custom Tab OAuth |
| **@capacitor/filesystem** | 7.x | Export TCX/GPX no Android |
| **@capacitor/local-notifications** | 7.x | Notificações locais |
| **@capacitor-community/keep-awake** | 7.x | WakeLock |
| **@capacitor-community/text-to-speech** | 6.x | TTS nativo |
| **@capacitor-firebase/authentication** | 7.x | Native Google Sign-In |

## Android Native (Kotlin)

| Componente | Versão | Uso |
|------------|--------|-----|
| **AndroidX Health Connect** | 1.1.0 | ExerciseSession + Distance + Route |
| **Play Services Location** | 21.x | FusedLocationProvider |
| **Play Services Auth** | 21.x | Google Sign-In nativo |
| **Coroutines** | 1.8.x | Async no native |
| **AGP** | 8.9.1 | Android Gradle Plugin |
| **compileSdk / targetSdk** | 36 | Android 14+ |
| **minSdk** | 26 | Android 8.0+ |

## Build & Deploy

| Ferramenta | Uso |
|------------|-----|
| **npm / package.json** | Scripts de build |
| **Gradle** | Android build |
| **Firebase CLI** | Deploy hosting + functions |
| **PowerShell** | `scripts/export-apk.ps1` (auto versionCode) |

## Dependências de Produção (package.json)

```json
{
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "react-router-dom": "^7",
    "firebase": "^12",
    "leaflet": "^1.9",
    "recharts": "^2",
    "date-fns": "^4",
    "lucide-react": "^0.4",
    "@capacitor/core": "^7",
    "@capacitor/app": "^8",
    "@capacitor/browser": "^8",
    "@capacitor/filesystem": "^7",
    "@capacitor/local-notifications": "^7",
    "@capacitor-community/keep-awake": "^7",
    "@capacitor-community/text-to-speech": "^6",
    "@capacitor-firebase/authentication": "^7"
  },
  "devDependencies": {
    "vite": "^6",
    "typescript": "^5",
    "tailwindcss": "^4",
    "@types/react": "^19",
    "@types/leaflet": "^1.9"
  }
}
```

## Variáveis de Ambiente Críticas

| Arquivo | Variáveis | Origem |
|---------|-----------|--------|
| `.env.apk` | `VITE_FIREBASE_*`, `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_WEB_CLIENT_ID`, `GEMINI_API_KEY` | **APK build only** |
| `.env.dev` | Firebase dev project (`correlogo-dev-9a96a`) | Local dev only |
| `functions/.env` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Cloud Functions |
| Servidor AWS | `VITE_*` + `GOOGLE_*` | Produção web |

> ⚠️ **NUNCA** commitar `.env*`. `.gitignore` já bloqueia.

---

## Versões Fixadas (package-lock.json)

| Pacote | Versão | Motivo |
|--------|--------|--------|
| `firebase` | 12.15.0 | Compatível com Functions v2 |
| `@capacitor/*` | 7.x/8.x | Capacitor 7 compatibility |
| `leaflet` | 1.9.4 | Estável, sem breaking changes |
| `recharts` | 2.15.x | Lazy loaded, chunk separado |

---

*Última revisão: 2026-07-29*