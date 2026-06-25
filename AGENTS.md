# Agent Instructions

## UI & Component Patterns
- **Button component**: Use `<Button variant="primary|secondary|ghost|danger" size="sm|md|lg">` em vez de `<button>` raw.
- **Modal component**: Use `<Modal open onClose title>` para diálogos, com `role="alertdialog"` para confirmações destrutivas.
- **Component Re-initialization**: Always use a `key` prop (e.g., plan/session ID) on components that rely on internal `useEffect` hooks for mounting/state-reset logic.
- **State Management**: Avoid direct or indirect `setState` calls that can trigger infinite renders during component mounting sequences.
- **Skeleton loading**: Use `animate-pulse` + `bg-bg-elevated` para estados de carregamento.
- **Empty states**: Sempre incluir ícone (`lucide-react`) + CTA textual.

## Code Splitting
- **Lazy load heavy components**: Use `React.lazy(() => import(...))` + `<Suspense>` para `SessionSummary` e `MapComponent` (recharts + leaflet ≈ 700 KB).
- **fallback**: `animate-pulse` skeleton ou texto "Carregando…" no Suspense.

## Firebase Error Handling
- **Use `getFirebaseErrorPt(err)`** de `src/lib/firebaseErrorsPtBr.ts` em vez de `err.message` direto.
- Mapeamento cobre `auth/invalid-email`, `auth/user-not-found`, `auth/wrong-password`, etc.

## Save Feedback
- Use `showFeedback('success'|'error', message)` para notificações toast no canto superior direito.
- O toast desaparece automaticamente após 3s.

## Batch Operations
- Use `writeBatch(db)` do Firestore para deleções em lote (até 500 ops), nunca `for...of deleteDoc`.

## Offline Persistence
- `enableIndexedDbPersistence(dbInstance)` chamado após `initializeFirestore()` — falha silenciosa em múltiplas abas.

## Persistence & Sync
- **LocalStorage cache**: Always read from localStorage first for instant UI, then Firestore as source of truth.
  - Keys: `correlogo:plans:{uid}`, `correlogo:sessions:{uid}`, `correlogo:darkMode:{uid}`
- **Offline resilience**: Firestore queries wrapped in `Promise.race` with 5s timeout. On failure, app runs from localStorage.
- **Sync**: Sessions with `local-*` prefix IDs are auto-uploaded to Firestore on next successful connection. Plans are merged (local + remote).
- **Verify** Firestore synchronization for user-specific data by using explicit `[timing]` logs during development.
- **Always** use `limit(50)` on session queries to avoid unbounded Firestore reads.

## Dependencies
- **Avoid `uuid`**: Use `crypto.randomUUID()` (nativo, disponível em todos os browsers modernos).
- **No dead deps**: Não instalar `@google/genai`, `@vis.gl/react-google-maps`, `motion` — nunca importados no app.

## Firebase Projects
- **Dev** (`.env` local): `correlogo-dev-9a96a` — Firestore em modo teste (expira 2026-07-25)
- **Prod** (servidor AWS): `correlogo-prod` — credenciais no `.env` do servidor
- `firebase-applet-config.json` foi removido do git (projeto `zealous-arcanum-nwfkz` não é mais usado)

## Production Infrastructure — Read Before Touching Build, Env, or Server Config

This app runs in production on an AWS EC2 instance (Ubuntu), reachable at `https://correlogo.sytes.net`. The setup is intentional — do not "simplify" or "fix" any of the following without first checking with the user:

- **`vite.config.ts` must keep `server.allowedHosts: ['correlogo.sytes.net']`.** Without it, Vite rejects requests with a "Blocked request... not allowed" error when accessed via the public domain. This still applies even though production runs `NODE_ENV=production` (no Vite dev server involved) — it protects local/dev usage against the same domain.
- **Never assume editing `.env` on the server is enough.** This is a Vite app: `import.meta.env.VITE_*` variables (Firebase config, etc.) are baked into the JS bundle at `npm run build` time, not read at runtime. Editing `.env` and restarting the Node process (`pm2 restart`) does **nothing** — the old build still has the old (or missing) values compiled in. Any change to a `VITE_*` variable requires `npm run build` again before the change takes effect, followed by `pm2 restart correlogo`.
- **The Node process must always run with `NODE_ENV=production`.** `server.ts` branches on this: without it, the server (even when started from the compiled `dist/server.cjs`) falls back to mounting a Vite dev middleware with HMR (opens an extra WebSocket on port 24678), which should never run in production. Always start/restart via: `sudo NODE_ENV=production pm2 restart correlogo` (or `pm2 start dist/server.cjs --name correlogo` with `NODE_ENV=production` set first).
- **Do not add a hardcoded `PORT` other than `3000` to `server.ts`** without also updating the Nginx config on the server (`/etc/nginx/sites-available/correlogo`, not part of this repo) — Nginx proxies `correlogo.sytes.net` (port 80/443) to `127.0.0.1:3000`. Changing the app's internal port silently breaks the public site.
- **`.gitignore` already correctly excludes `.env*` (with a `!.env.example` exception), `dist/`, `node_modules/`, logs, and `firebase-applet-config.json`.** Do not remove or weaken these entries — `.env` contains the Firebase API key and Gemini API key.
- See `HANDOFF.md` for the full current production deployment state (PM2, Nginx, SSL, Security Group) before suggesting any infrastructure change.
