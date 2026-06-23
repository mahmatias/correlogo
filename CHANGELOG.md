# Changelog

## [2026-06-21]
- Infra: Migrated production hosting to AWS EC2 (Ubuntu), domain `correlogo.sytes.net`.
- Fixed: Node process was accidentally running in dev mode (missing `NODE_ENV=production`), causing `server.ts` to mount the Vite dev middleware/HMR instead of serving the static build.
- Fixed: Production build had stale Firebase config baked in because `.env` was edited after the last build; required `npm run build` + `pm2 restart` to take effect (Vite env vars are compile-time, not runtime).
- Added: PM2 process management (`correlogo`), registered with systemd so the app survives reboots.
- Added: Nginx as a reverse proxy (port 80/443 → 3000), removing the need for a port number in the public URL.
- Added: SSL certificate via Let's Encrypt/Certbot, with automatic HTTP→HTTPS redirect and renewal.
- Added: Explicit Nginx block denying access to `.env`/`.git` files, as defense-in-depth on top of Express's existing behavior.
- Security: Removed public inbound access to port 3000 from the EC2 Security Group; the app is now only reachable via 80/443 through Nginx.
- Changed: `vite.config.ts` now sets `server.allowedHosts: ['correlogo.sytes.net']` to allow the dev server to respond to that host (prevents the "Blocked request... not allowed" error).

## [2026-06-18]
- Fixed: Dark mode preference persistence (now correctly loads from Firebase or system preference).
- Fixed: Workout completion logic, including automatic confirmation prompt and state resetting.
- Fixed: Issue preventing starting a new workout after finishing one, by ensuring proper component re-initialization via the `key` prop on `WorkoutTracker` in `App.tsx`.
- Improved: State management in `WorkoutTracker.tsx` to prevent re-render errors when finishing workouts.
- Improved: Firestore integration test logging to verify data saving.
