# Handoff

## Current Functional State
- User workout plan retrieval and persistence in Firestore is verified.
- Dark mode theme preference is persisted to Firebase and loaded on initialization.
- Workout tracker correctly handles completion, asks for confirmation, and allows starting new workouts after finishing previous ones.
- App is deployed to production on AWS EC2, reachable at `https://correlogo.sytes.net` (no port in URL), with valid SSL.

## Key Considerations for Future Agent
- When modifying `WorkoutTracker.tsx`, respect the state initialization and reset lifecycle.
- Keep Firestore interactions consolidated within the main `App.tsx` state management to avoid fragmented persistence logic.

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

