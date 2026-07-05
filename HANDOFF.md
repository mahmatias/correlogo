# Handoff

## Android Native Tracking (2026-07-04)

### TrackingService.kt
- `android/app/src/main/java/com/correlogo/app/TrackingService.kt`
- Foreground service (`startForeground`) with:
  - **GPS:** `FusedLocationProviderClient` with `Priority.PRIORITY_HIGH_ACCURACY`, 3s interval, 1s min update interval
  - **Step counter:** `Sensor.TYPE_STEP_COUNTER`, delta from initial reading, emits `stepUpdate` events
  - **Notification channel:** `tracking_channel` with Portuguese labels, `IMPORTANCE_LOW`, silent
  - Lifecycle: `onCreate` sets up sensors/callbacks, `onStartCommand` starts updates, `onDestroy` removes listeners
- Communication with plugin via `companion object { var currentPlugin: TrackingPlugin? }`

### TrackingPlugin.kt
- `android/app/src/main/java/com/correlogo/app/TrackingPlugin.kt`
- `@CapacitorPlugin(name = "Tracking")` with permissions: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `ACTIVITY_RECOGNITION`
- Methods: `startTracking()` (checks fine location, starts foreground service), `stopTracking()`, `getStepCount()`
- Events: `locationUpdate` (lat/lng/alt/accuracy/speed/timestamp), `stepUpdate` (steps)
- Set `TrackingService.currentPlugin` in `load()` — service-to-plugin bridge

### MainActivity.java
- Registers `TrackingPlugin.class` in `onCreate` via `registerPlugin()`

### Build config
- `android/build.gradle`: Kotlin plugin `org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21` added to classpath
- `android/app/build.gradle`: `kotlin-android` plugin applied, `com.google.android.gms:play-services-location:21.0.1` dependency added

### Usage from TypeScript
```typescript
// Import plugin via Capacitor
import { Tracking } from '@/plugins/tracking'; // or registerWebPlugin if JS-side needed

// Start tracking
await Tracking.startTracking();

// Listen for location updates
Tracking.addListener('locationUpdate', (data: { latitude, longitude, altitude, accuracy, speed, timestamp }) => { ... });

// Listen for step updates
Tracking.addListener('stepUpdate', (data: { steps }) => { ... });

// Stop tracking
await Tracking.stopTracking();

// Get current step count
const { steps } = await Tracking.getStepCount();
```

### Known limitations
- Web/iOS stubs not yet implemented — this is Android-only for now
- No permission request flow in the plugin itself (relies on caller having granted permissions first)

## Current Functional State (2026-07-04b)

### Calendar & Plan Rendering
- `MonthCalendar` component: full month grid, navigation < >, dot markers (accent=planned, accent-secondary=completed, amber=race), current/selected day highlight
- Collapsible via v/^ button below the week row with `max-h` + `opacity` transition animation
- `exportIcal(plans, filename?)` and `downloadIcal(plans, filename?)` in `src/lib/ical.ts` — generates RFC 5545 `.ics` with VEVENT per plan with `scheduledDate`
- "Exportar para Calendário (.ics)" button in Planos BottomSheet (appears when plans.length > 0)
- Race marker dot color: `bg-amber-500` in MonthCalendar too (same convention)

### Date Input
- **Mudança:** Date picker movido para dentro do card expandido: botão "Reagendar" (apenas se não for raceMarker) abre modal com `<input type="date" colorScheme="dark">` com `onKeyDown e.preventDefault()` para bloquear digitação manual
- Picker oculto anterior removido (`datePickerTarget`, `datePickerRef` não existem mais no App.tsx)
- "Reagendar" funciona para planos existentes também

### Month Calendar
- `MonthCalendar` em `src/components/` — props: `selectedDate`, `onSelectDate`, `plannedDates`, `completedDates`, `raceDates`
- Toggle state `showMonthCalendar` em App.tsx

### iCal Export
- `src/lib/ical.ts` — `generateIcal()` e `downloadIcal()`
- Formato: versão 2.0, DATE (all-day), SUMMARY = plan.name, DESCRIPTION = steps + total duration
- Botão no BottomSheet de Planos

### Known Issues (updated)
- Standard/ImprovePace generators still need min duration scaling (like beginner) — pendente

### Loading & Sync
- App carrega em <1.2s (cache localStorage instantâneo + Firestore paralelo com timeout de 5s)
- Dados offline (sessões com prefixo `local-*`) são sincronizados ao Firestore automaticamente na próxima conexão bem-sucedida
- Planos criados offline são mesclados com remotos ao reconectar
- Logs `[timing]` no console para diagnóstico de performance

### Firebase Projects
- **Dev** (`.env`): `correlogo-dev-9a96a` — Firestore ativado em modo teste (expira 2026-07-25)
- **Prod** (servidor AWS): `correlogo-prod` — credenciais no `.env` do servidor
- `firebase-applet-config.json` removido do git (projeto `zealous-arcanum-nwfkz` era do AI Studio e não é mais usado)

### UI Components
- `<Button>` — variantes: `primary`, `secondary`, `ghost`, `danger`; sizes: `sm`, `md`, `lg`
- `<Modal>` — backdrop centralizado com `role="dialog"` ou `role="alertdialog"`
- `<BottomSheet>` — painel que desliza de baixo com overlay (ações de plano)
- `<WeekCalendar>` — semana horizontal com 7 dias, navegação, bolinhas de status
- Todos em `src/components/`

### Known Issues
- Firestore no dev `correlogo-dev-9a96a` expira modo teste em 2026-07-25 — atualizar regras antes
- Skeleton de carregamento aparece enquanto Firestore não responde (até 5s) — reduzir timeout se necessário
- `favicon.ico` retorna 404 (cosmético, sem impacto)
- Geradores Standard/ImprovePace também devem escalar duração mínima (clampedWeeks do iniciante) — pendente

### Calendar & Plan Rendering
- `WeekCalendar` recebe `plannedDates`, `completedDates`, `raceDates` como `Set<string>`
- Marcador de prova usa bolinha `amber-500` com legenda "Prova" no calendário
- `isRaceMarker?: true` no `WorkoutPlan` oculta botões de ação, duração e input de data no card
- Planos com `isRaceMarker` mostram apenas nome "🏁 Prova" sem ações — não é clicável para iniciar/completar

### Beginner Generator Scaling
- `mapTableIndex` mapeia o índice da semana (0..N-1) para a tabela runna de 16 semanas usando interpolação linear: `Math.round(weekIdx / (totalWeeks - 1) * 15)`
- Duração mínima: 6 semanas (clamped), máxima: 52 semanas
- Para durações > 16 sem: a tabela de 16 semanas é esticada proporcionalmente ao número de semanas
- Carga regenerativa (sessões extras para dias além dos 2 da tabela runna) mantida
- Marcador de prova injetado em `generateProgram` após `assignScheduledDates`, com `scheduledDate = data.raceDate`

### Date Input
- Botão estilizado (borda, hover accent) mostra data no formato `DD/MM` ou "➕ data"
- Ao clicar, `datePickerRef` (input oculto no final do `<main>`) recebe foco via `showPicker()` com `colorScheme: dark` para o picker nativo usar tema escuro
- `datePickerTarget` (state) guarda o `plan.id` do card clicado; o `onChange` do picker oculto usa esse target para chamar `handleDateChange`
- Picker oculto posicionado off-screen (`top: -200px, left: -200px, opacity: 0`)

### Light Mode
- `.light` class no `<html>` agora também sobrescreve `--color-*` (ex: `--color-text-primary`, `--color-bg-elevated`)
- Todas as Tailwind classes (`text-text-primary`, `bg-bg-surface`, etc.) agora refletem o modo claro
- Fix: nome do app e textos que usam Tailwind utility classes estavam invisíveis no light mode por resolverem `--color-*` do tema escuro

## Key Considerations for Future Agent
- `App.tsx` gerencia todo o estado global (plans, sessions, user, theme) — persistência centralizada
- `WorkoutTracker` usa `key={sessionId}` para re-inicialização correta
- `isFreeTraining` flag + `speak(text, force)` controlam anúncios de voz no Treino Livre
- `manual: true` em planos criados no WorkoutEditor controla visibilidade do botão de deletar
- `scheduledDate?: string` ("YYYY-MM-DD") adicionado ao `WorkoutPlan` — planos sem data recebem data atual na carga
- `WeekCalendar` recebe `plannedDates`/`completedDates` como `Set<string>` (chaves "YYYY-MM-DD")
- Planos de programa ganham `scheduledDate` baseado em `raceDate` ou data atual + número da semana
- Ações de plano movidas para `BottomSheet` (Novo Treino Manual, Treino Livre, Gerador Automático, Carregar/Substituir, Apagar)
- Export JSON removido da UI (atalho); função `handleExportJson` mantida como dead code
- Sempre usar `limit(50)` em queries de sessões — documentado como regra
- Cache localStorage: chaves `correlogo:plans:{uid}`, `correlogo:sessions:{uid}`, `correlogo:darkMode:{uid}`, `correlogo:profile:{uid}`, `correlogo:settings:{uid}`

## Production Deployment State (as of 2026-06-21)

The app runs on an AWS EC2 instance (Ubuntu), domain `correlogo.sytes.net` (No-IP dynamic DNS) pointing to a static public IP. None of the following lives in this repo — it's server-side configuration — but any agent working on build/env/server-related code needs this context.

**Process management:**
- The app runs as `node /opt/correlogo/dist/server.cjs`, managed by **PM2** under the process name `correlogo`, running as `root` (matches how it was originally set up).
- Started with `NODE_ENV=production` explicitly set — without this, `server.ts` falls back to a Vite dev-middleware branch instead of serving the static `dist/` build (see `AGENTS.md`).
- PM2 is registered with systemd (`pm2-root.service`) so the app survives instance reboots. State was frozen with `pm2 save`.
- Only **one** instance should ever be running on port 3000 — there was an incident during setup where two PM2-managed instances both tried to bind port 3000, causing `EADDRINUSE` errors in the logs. If `pm2 list` ever shows more than one entry named `correlogo`, delete all and restart clean with a single `pm2 start`.

**Web server / TLS:**
- **Nginx** is installed and acts as a reverse proxy: `correlogo.sytes.net` (ports 80/443) → `127.0.0.1:3000` (the Node process).
- Config file: `/etc/nginx/sites-available/correlogo` (symlinked into `sites-enabled`). The default Nginx site was removed to avoid conflicts.
- Config includes an explicit `location ~ /\.(env|git|gitignore) { deny all; return 404; }` block, blocking sensitive files at the Nginx layer regardless of Express's SPA catch-all behavior.
- SSL via **Let's Encrypt / Certbot** (`certbot --nginx`), auto-renewal scheduled via `certbot.timer`. Certificate expires 2026-09-19 (auto-renews before that).
- HTTP (port 80) auto-redirects to HTTPS (301).

**Security Group (AWS Console):**
- Port 3000 is **no longer publicly exposed** — it was removed from inbound rules after the Nginx/SSL setup was confirmed working. Only 80, 443, and 22 (SSH) should be open to `0.0.0.0/0`.
- If a future change seems to require re-opening port 3000 publicly, that's a red flag — it means something is bypassing Nginx, which shouldn't happen.

**Build/env gotcha already hit once:** the production build had stale/missing `VITE_FIREBASE_*` values baked in because `.env` was edited *after* the last `npm run build`. Symptom was "Firebase has no API key" in the browser console despite a correct `.env` on disk. Fix was re-running `npm run build` (with `sudo`, since `/opt/correlogo` is root-owned) followed by `pm2 restart correlogo`. Keep this in mind for any future `VITE_*` env change.
