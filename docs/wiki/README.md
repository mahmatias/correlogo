# Corre Logo Wiki 🏃

Wiki técnica completa do projeto Corre Logo — app de treinos de corrida com planos personalizados, tracking GPS/esteira, exportação para Strava/GymRats via Health Connect + Gmail API.

---

## 📚 Índice

### 🏗️ Arquitetura
- [Visão Geral da Arquitetura](architecture/overview.md)
- [Stack Tecnológica](architecture/stack.md)
- [Estrutura de Pastas](architecture/folder-structure.md)
- [Decisões de Design (ADRs)](architecture/adrs.md)

### 🔐 Autenticação & Autorização
- [Firebase Auth](auth/firebase-auth.md)
- [Google OAuth (Calendar + Gmail)](auth/google-oauth.md)
- [Fluxos de Login (Web + APK)](auth/login-flows.md)
- [Deep Links & Callbacks](auth/deep-links.md)

### 🏃 Tracking de Treinos
- [WorkoutTracker - Visão Geral](tracking/workout-tracker.md)
- [Modo Esteira vs Outdoor](tracking/modes.md)
- [Timers (JS + Nativo)](tracking/timers.md)
- [GPS & Distance Calculation](tracking/gps.md)
- [TTS & Audio Focus](tracking/tts.md)
- [WakeLock & Foreground Service](tracking/wakelock.md)

### 📊 Planos & Sessões
- [Gerador de Treinos](plans/generator.md)
- [Planos Manuais & Importados](plans/manual-import.md)
- [Calendário & Agendamento](plans/calendar.md)
- [Sessões & Histórico](plans/sessions.md)

### 🔄 Sincronização & Exportação
- [Health Connect (GymRats)](sync/health-connect.md)
- [Strava via Gmail API](sync/strava-gmail.md)
- [Google Calendar](sync/google-calendar.md)
- [Export TCX/GPX/FIT](sync/export-formats.md)

### 📱 Android / Capacitor
- [Plugins Nativos](android/native-plugins.md)
- [Build & Deploy APK](android/build-apk.md)
- [Permissions](android/permissions.md)
- [Deep Links & Intents](android/deep-links.md)

### 🌐 Web / Firebase
- [Firebase Hosting](web/firebase-hosting.md)
- [Cloud Functions](web/cloud-functions.md)
- [Firestore Rules](web/firestore-rules.md)
- [PWA & Offline](web/offline.md)

### 📦 Dados & Modelos
- [TrainingSession](data/training-session.md)
- [WorkoutPlan](data/workout-plan.md)
- [TrainingProgram](data/training-program.md)
- [Profile & Settings](data/profile-settings.md)
- [ActivityPoint (Série Temporal)](data/activity-point.md)

### 🔧 Build, Deploy & CI/CD
- [Scripts de Build](build/scripts.md)
- [Pipeline APK](build/apk-pipeline.md)
- [Deploy Web](build/web-deploy.md)
- [Variáveis de Ambiente](build/env-vars.md)

### 🐛 Troubleshooting & Known Issues
- [OAuth Problems](troubleshooting/oauth.md)
- [Health Connect Permissions](troubleshooting/health-connect.md)
- [GPS & Tracking](troubleshooting/gps.md)
- [Build Failures](troubleshooting/build.md)

### 📈 Roadmap & Decisões
- [Changelog](roadmap/changelog.md)
- [Decisões Arquiteturais](roadmap/decisions.md)
- [Backlog](roadmap/backlog.md)

---

## 🚀 Quick Start para Agentes

```bash
# Dev local
npm run dev          # http://localhost:3000

# Build web
npm run build        # gera dist/

# Build APK
Copy-Item .env.apk .env -Force
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# APK em android/app/build/outputs/apk/debug/app-debug.apk
```

### Variáveis Críticas
| Arquivo | Uso |
|---------|-----|
| `.env.apk` | **Única fonte de verdade para APK** (Firebase prod `correlogo-prod`) |
| `.env.dev` | APENAS local, nunca commitado |
| `functions/.env` | Cloud Functions secrets |

---

## 🔑 Credenciais & Projetos Firebase

| Ambiente | Projeto | Uso |
|----------|---------|-----|
| **Prod (APK)** | `correlogo-prod` | Auth, Firestore, Functions, Hosting |
| **Dev (Web local)** | `correlogo-dev-9a96a` | Firestore test mode (expira 2026-07-25) |

> ⚠️ **NUNCA** copie `.env.dev` → `.env` — quebra APK e servidor prod.

---

## 📋 Convenções

- **Commits**: `tipo: descrição curta` (feat, fix, refactor, docs, chore)
- **Branches**: `feature/`, `fix/`, `refactor/`
- **Wiki**: Atualize `docs/wiki/` junto com mudanças de código
- **Mermaid** para diagramas (suportado no GitHub/GitLab)

---

## 🔗 Links Úteis

- [Produção Web](https://correlogo.web.app)
- [Firebase Console Prod](https://console.firebase.google.com/project/correlogo-prod)
- [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=correlogo-prod)
- [Health Connect Dev Guide](https://developer.android.com/guide/healthfit/health-connect)

---

*Última atualização: 2026-07-29 | Versão wiki: 1.0*