# Architecture Overview

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React + Capacitor)                │
├─────────────────────────────────────────────────────────────────┤
│  Web (PWA)                    │  Android APK (Capacitor)         │
│  ┌─────────────────────┐     │  ┌─────────────────────────────┐ │
│  │ React 19 + TS       │     │  │ WebView + Native Plugins     │ │
│  │ Tailwind v4         │     │  │ ┌─────────────────────────┐  │ │
│  │ Vite                │     │  │ │ HealthConnectPlugin.kt    │  │ │
│  │ Firebase JS SDK     │     │  │ │ TrackingPlugin.kt         │  │ │
│  │ Leaflet Maps        │     │  │ │ PermissionsPlugin.kt      │  │ │
│  │ Browser.open()      │     │  │ │ FirebaseAuthPlugin.kt     │  │ │
│  └─────────────────────┘     │  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
      │  Firebase   │ │   Google    │ │  Gmail API  │
      │  (Auth/DB)  │ │   OAuth     │ │  (Strava)   │
      └─────────────┘ └─────────────┘ └─────────────┘
              │               │               │
              ▼               ▼               ▼
      ┌─────────────────────────────────────────────┐
      │         Cloud Functions (Node 22)           │
      │  • authCallback (OAuth token exchange)      │
      │  • healthCheck                              │
      └─────────────────────────────────────────────┘
```

## Key Architectural Decisions

| Decisão | Justificativa | ADR |
|---------|---------------|-----|
| **React + Capacitor** | Single codebase web + Android | [ADR-001](../roadmap/decisions.md) |
| **Firebase Auth + Firestore** | Offline-first, realtime, generous free tier | [ADR-002](../roadmap/decisions.md) |
| **Health Connect (not Samsung Health)** | Cobre Strava + GymRats, Jetpack oficial, gratuito | [ADR-003](../roadmap/decisions.md) |
| **Strava via Gmail API** | Strava não importa non-GPS do HC; email attachment bypass | [ADR-004](../roadmap/decisions.md) |
| **Web Client ID para tudo** | Chrome Custom Tab (APK) + web usam mesmo fluxo OAuth | [ADR-005](../roadmap/decisions.md) |
| **Capacitor 7 + ActivityResultLauncher** | Permissões Android corretas (await user consent) | [ADR-006](../roadmap/decisions.md) |
| **Vite only (no Express)** | Firebase Hosting + Cloud Functions = serverless | [ADR-007](../roadmap/decisions.md) |
| **AWS decommissioned** | 100% Firebase (Hosting + Functions + Firestore) | [ADR-010](../roadmap/decisions.md) |

## Data Flow Overview

### 1. Authentication
```
User → Google OAuth → Cloud Function (token exchange) → Deep Link / Query Param → App
     → Firebase Auth (signInWithCredential) → onAuthStateChanged → App initialized
```

### 2. Workout Tracking
```
Start Workout → WorkoutTracker mounts
    → Native Tracking (GPS + Step Counter) → Foreground Service
    → JS Timer (countdown) + Native Timer (elapsed) → UI updates
    → Points accumulated in memory (ActivityPoint[])
    → Complete → Save Session (Firestore + localStorage)
    → Health Connect Export (ExerciseSessionRecord + DistanceRecord + Route)
    → Gmail API Send (TCX/GPX attachment) → Strava
```

### 3. Offline-First Sync
```
Local Write (localStorage) → Immediate UI
     → Firestore Write (5s timeout) → Success → localStorage update
     → Failure → Queue (local-*) → Retry on reconnect
```

### 4. OAuth Flows

| Fluxo | Client ID | Redirect URI | State Prefix | Callback |
|-------|-----------|--------------|--------------|----------|
| Calendar Web | Web | `https://correlogo.web.app/auth/google/callback` | - | `?gcal_token=...` |
| Calendar Native | Web | `https://correlogo.web.app/auth/google/callback` | `c3_` | Deep link `com.correlogo.app://oauth` |
| Gmail Web | Web | `https://correlogo.web.app/auth/google/callback` | `gm_web_` | `?gcal_token=...` |
| Gmail Native | Web | `https://correlogo.web.app/auth/google/callback` | `gm_` | Deep link `com.correlogo.app://oauth` |

## Component Architecture

```
App.tsx (Root)
├── Providers (Auth, Theme)
├── Router (implicit via state)
├── Header (sticky)
├── Main (conditionally rendered)
│   ├── Dashboard (plans, calendar, history)
│   ├── WorkoutTracker (key={planId+mode})
│   ├── WorkoutEditor
│   ├── TrainingGenerator
│   ├── SessionHistory
│   ├── SessionSummary (lazy)
│   ├── UserProfile (modal)
│   ├── GoogleCalendarModal (lazy)
│   └── ImportPlan
└── Modals/BottomSheets (portal)
```

## State Management

| Estado | Localização | Persistência |
|--------|-------------|--------------|
| Auth User | `App.tsx` + `onAuthStateChanged` | Firebase Auth |
| Plans | `App.tsx` + `localStorage` + Firestore | Dual |
| Sessions | `App.tsx` + `localStorage` + Firestore | Dual |
| Active Workout | `WorkoutTracker.tsx` (refs + state) | Memory only |
| Theme | `App.tsx` + `localStorage` | localStorage |
| Profile/Settings | `App.tsx` + `localStorage` + Firestore | Dual |

## Native ↔ JS Bridge (Capacitor)

| Plugin | Métodos JS | Eventos Nativos → JS |
|--------|------------|----------------------|
| `Tracking` | `startTracking()`, `stopTracking()`, `getStepCount()`, `openAppSettings()` | `locationUpdate`, `stepUpdate` |
| `HealthConnect` | `isAvailable()`, `requestHcPermissions()`, `exportWorkout()` | — |
| `FirebaseAuth` | `signInWithGoogle()`, `signOut()`, `getCurrentUser()` | `authStateChange` |
| `Permissions` | `requestAllPermissions()` | — |
| `Voice` (TTS) | `speak()`, `stop()` | — |
| `WakeLock` | `keepAwake()`, `allowSleep()` | — |
| `LocalNotifications` | `schedule()`, `cancel()` | `localNotificationActionPerformed` |
| `SocialShare` | `shareToInstagram()`, `copyImageToClipboard()` | — |
| `ApkInstaller` | `canRequestPackageInstalls()`, `openInstallSettings()`, `installApk()` | — |

> ⚠️ Plugins Kotlin locais **não** entram no `capacitor.plugins.json` (sem kapt). Cada um é registrado manualmente em `MainActivity.load()` — qualquer plugin novo precisa ser registrado lá.

---

*Última revisão: 2026-07-31*