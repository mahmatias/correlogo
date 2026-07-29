# Arquitetura - Estrutura de Pastas

```
corre-logo/
├── .github/                          # GitHub Actions (se houver)
├── android/                          # Projeto Android nativo
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/correlogo/app/
│   │   │   │   ├── HealthConnectPlugin.kt      # HC Plugin principal
│   │   │   │   ├── TrackingPlugin.kt           # GPS + Step Counter
│   │   │   │   ├── PermissionsPlugin.kt        # Runtime permissions
│   │   │   │   ├── AudioFocusPlugin.kt         # Audio focus para TTS
│   │   │   │   ├── MainActivity.java           # Plugin registration
│   │   │   │   └── PermissionsRationaleActivity.kt # HC rationale UI
│   │   │   ├── AndroidManifest.xml
│   │   │   └── build.gradle
│   │   └── build.gradle
│   ├── variables.gradle              # compileSdk, targetSdk, minSdk
│   └── build.gradle                  # AGP, Kotlin plugin
├── functions/                        # Cloud Functions (Node 22)
│   ├── src/
│   │   └── index.ts                  # authCallback + healthCheck
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                          # GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
├── public/                           # Assets estáticos (copiados para dist/)
│   ├── favicon.ico
│   └── manifest.json                 # PWA manifest
├── scripts/
│   └── export-apk.ps1               # Auto versionCode + copy APK
├── src/
│   ├── assets/                       # Imagens, SVGs
│   ├── components/                   # Componentes React reutilizáveis
│   │   ├── ui/                       # Primitivos (Button, Modal, BottomSheet)
│   │   ├── tracking/                 # WorkoutTracker + subcomponents
│   │   ├── plans/                    # Planos, gerador, editor
│   │   ├── calendar/                 # WeekCalendar, MonthCalendar
│   │   ├── history/                  # SessionHistory, SessionSummary
│   │   ├── auth/                     # Login, Signup, UserProfile
│   │   ├── sync/                     # GoogleCalendarModal, HealthConnect
│   │   └── maps/                     # MapComponent (Leaflet)
│   ├── lib/
│   │   ├── capacitor/                # JS ↔ Native bridge
│   │   │   ├── health-connect.ts     # HC wrapper
│   │   │   ├── tracking.ts           # GPS + steps
│   │   │   ├── permissions.ts        # Runtime permissions
│   │   │   ├── tts.ts                # TTS wrapper
│   │   │   ├── wakelock.ts           # Keep awake
│   │   │   ├── platform.ts           # isNative()
│   │   │   ├── voice.ts              # TTS queue
│   │   │   ├── notifications.ts      # Local notifications
│   │   │   ├── auth.ts               # Firebase auth helpers
│   │   │   └── index.ts              # Barrel export
│   │   ├── firebase.ts               # Firebase init + persistence
│   │   ├── firebaseErrorsPtBr.ts     # Error messages PT-BR
│   │   ├── exportUtils.ts            # TCX/GPX generators
│   │   ├── gmailApi.ts               # Gmail OAuth + send
│   │   ├── ical.ts                   # iCal export
│   │   └── ...
│   ├── types.ts                      # TypeScript interfaces centrais
│   ├── App.tsx                       # Root component, state global, routing
│   ├── main.tsx                      # Entry point
│   ├── index.css                     # Tailwind + CSS vars (theme)
│   └── vite-env.d.ts
├── .env.apk                          # **APK build** - Firebase prod + Web Client ID
├── .env.dev                          # Local dev - Firebase dev
├── .env.example                      # Template
├── .gitignore
├── firebase.json                     # Hosting + Functions config
├── firestore.rules                   # Security rules
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── README.md
├── CHANGELOG.md
├── HANDOFF.md
├── TODO.md
├── AGENTS.md                         # Instruções para agentes
└── docs/
    ├── wiki/                         # ESTE WIKI
    ├── registro-e-exportacao-atividades.md
    ├── gerador-treinos-technical.md
    ├── samsung-health-setup.md
    └── superpowers/                  # Design docs + plans (legacy)
```

---

## Convenções de Nomenclatura

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Componentes | PascalCase | `WorkoutTracker.tsx` |
| Hooks | `use` + PascalCase | `useTracking.ts` |
| Utils/Services | camelCase | `exportUtils.ts` |
| Tipos/Interfaces | PascalCase | `TrainingSession` |
| Constantes | UPPER_SNAKE_CASE | `STORAGE_KEYS` |
| Arquivos de teste | `*.test.ts` | `exportUtils.test.ts` |

---

## Arquivos-Chave por Domínio

| Domínio | Arquivos Principais |
|---------|---------------------|
| **Auth** | `src/lib/capacitor/auth.ts`, `src/components/auth/*`, `functions/src/index.ts` |
| **Tracking** | `src/components/tracking/WorkoutTracker.tsx`, `android/.../TrackingPlugin.kt` |
| **Health Connect** | `src/lib/capacitor/health-connect.ts`, `android/.../HealthConnectPlugin.kt` |
| **Strava/Gmail** | `src/lib/gmailApi.ts`, `src/components/sync/*` |
| **Planos** | `src/components/plans/*`, `src/lib/trainingGenerator.ts` |
| **Build APK** | `scripts/export-apk.ps1`, `android/app/build.gradle` |

---

*Última revisão: 2026-07-29*