# Agent Instructions

- **Component Re-initialization**: Always use a `key` prop (e.g., plan ID) on components that rely on internal `useEffect` hooks for mounting/state-reset logic to ensure proper cleanup and re-initialization when switching between plan instances.
- **State Management**: Avoid direct or indirect `setState` calls that can trigger infinite renders during component mounting sequences.
- **Persistence**: Verify Firestore synchronization for user-specific data (theme, plans) by using explicit logs during development.

## Production Infrastructure — Read Before Touching Build, Env, or Server Config

This app runs in production on an AWS EC2 instance (Ubuntu), reachable at `https://correlogo.sytes.net`. The setup is intentional — do not "simplify" or "fix" any of the following without first checking with the user:

- **`vite.config.ts` must keep `server.allowedHosts: ['correlogo.sytes.net']`.** Without it, Vite rejects requests with a "Blocked request... not allowed" error when accessed via the public domain. This still applies even though production runs `NODE_ENV=production` (no Vite dev server involved) — it protects local/dev usage against the same domain.
- **Never assume editing `.env` on the server is enough.** This is a Vite app: `import.meta.env.VITE_*` variables (Firebase config, etc.) are baked into the JS bundle at `npm run build` time, not read at runtime. Editing `.env` and restarting the Node process (`pm2 restart`) does **nothing** — the old build still has the old (or missing) values compiled in. Any change to a `VITE_*` variable requires `npm run build` again before the change takes effect, followed by `pm2 restart correlogo`.
- **The Node process must always run with `NODE_ENV=production`.** `server.ts` branches on this: without it, the server (even when started from the compiled `dist/server.cjs`) falls back to mounting a Vite dev middleware with HMR (opens an extra WebSocket on port 24678), which should never run in production. Always start/restart via: `sudo NODE_ENV=production pm2 restart correlogo` (or `pm2 start dist/server.cjs --name correlogo` with `NODE_ENV=production` set first).
- **Do not add a hardcoded `PORT` other than `3000` to `server.ts`** without also updating the Nginx config on the server (`/etc/nginx/sites-available/correlogo`, not part of this repo) — Nginx proxies `correlogo.sytes.net` (port 80/443) to `127.0.0.1:3000`. Changing the app's internal port silently breaks the public site.
- **Do not introduce browser `localStorage`/`sessionStorage` reliance that conflicts with Firestore as the source of truth** for plans/theme — see existing fallback pattern already in `App.tsx` (`try/catch` + `localStorage` cache, Firestore as source of truth). Keep this pattern for any new persisted data.
- **`.gitignore` already correctly excludes `.env*` (with a `!.env.example` exception), `dist/`, `node_modules/`, and logs.** Do not remove or weaken these entries — `.env` contains the Firebase API key and Gemini API key.
- See `HANDOFF.md` for the full current production deployment state (PM2, Nginx, SSL, Security Group) before suggesting any infrastructure change.

