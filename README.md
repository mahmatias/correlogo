# Corre Logo 🏃

App de treinos de corrida com planos personalizados por VDOT, gerador Couch-to-5K para iniciantes, e exportação TCX/FIT/GPX para Strava. PWA com suporte offline + APK Android (Capacitor).

## Features

- **Gerador de treinos**: 3 perfis — Couch-to-5K (iniciante), melhora de pace (interpolação VDOT), periodização padrão
- **Workout tracker**: Esteira (Bluetooth FTMS) e GPS, anúncios de voz ("Caminhada", "Quase lá"), modo Treino Livre
- **Histórico completo**: Sessões salvas no Firestore com fallback localStorage
- **Exportação**: TCX, GPX e FIT (Strava via Gmail API + Health Connect/GymRats)
- **Compartilhamento**: Card do treino em 4 variantes (1080×1920) → Instagram Stories / Copiar PNG
- **Auto-update**: O APK se atualiza sozinho via GitHub Release + manifest (a partir da 3.2)
- **Design system Pôr-do-Sol**: Paleta temática com tokens CSS, dark mode, acessibilidade

## Stack

- **Frontend**: React 19 + TypeScript + Tailwind v4 + Vite
- **Backend**: Cloud Functions v2 (Node 22) — `authCallback`, `healthCheck`, `refreshAuthToken`
- **Banco**: Firestore (Firebase)
- **Autenticação**: Firebase Auth (email + Google)
- **Mapas**: Leaflet + OpenStreetMap
- **Mobile**: Capacitor 7 + plugins Kotlin custom (Tracking, Health Connect, TTS, SocialShare, ApkInstaller)
- **Deploy**: Firebase Hosting + Cloud Functions + GitHub Actions (APK release)

> ⚠️ **Toda a infra é Firebase.** AWS EC2 / `correlogo.sytes.net` foram desativados (2026-07-31).

## Desenvolvimento local

```bash
Copy-Item .env.dev .env -Force   # apenas para dev local
npm install
npm run dev                      # Vite dev server em http://localhost:3000
```

> ⚠️ Antes de qualquer `npm run build` (APK/deploy), copie `.env.apk` → `.env`, **nunca** `.env.dev` — isso apontaria o build para o projeto dev e quebraria produção.

## Produção

Deploy web + functions no Firebase:

```bash
firebase deploy --only hosting:correlogo   # web (PWA)
firebase deploy --only functions           # Cloud Functions
```

- Web live em: **https://correlogo.web.app**
- APK: push em `main` dispara o CI (`.github/workflows/firebase-deploy.yml`) → Release `latest` → auto-update no device

## Docs

- **Wiki técnica**: [`docs/wiki/`](docs/wiki/README.md)
- **Changelog**: [`CHANGELOG.md`](CHANGELOG.md)
- **Handoff**: [`HANDOFF.md`](HANDOFF.md)
- **TODO**: [`TODO.md`](TODO.md)
