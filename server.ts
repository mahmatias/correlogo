import "dotenv/config";
import express from "express";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";

const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

async function startServer() {
  const app = express();
  const PORT = 3000;

  const CSP_DIRECTIVES = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com", "https://accounts.google.com", "https://*.gstatic.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    imgSrc: [
      "'self'", "data:",
      "https://*.tile.openstreetmap.org",
      "https://*.basemaps.cartocdn.com",
      "https://server.arcgisonline.com",
      "https://lh3.googleusercontent.com",
    ],
    connectSrc: [
      "'self'",
      "https://*.firebaseio.com",
      "https://identitytoolkit.googleapis.com",
      "https://*.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://firestore.googleapis.com",
      "https://firebasestorage.googleapis.com",
      "wss://*.firebaseio.com",
      "ws://localhost:24678",
      "https://accounts.google.com",
    ],
    frameSrc: ["https://*.firebaseapp.com", "https://accounts.google.com"],
    defaultSrc: ["'self'", "https:", "http:", "data:", "blob:"],
    objectSrc: ["'self'", "blob:"],
    scriptSrcElem: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://apis.google.com", "https://*.gstatic.com"],
    imgSrc: [
      "'self'", "data:", "blob:",
      "https://*.tile.openstreetmap.org",
      "https://*.basemaps.cartocdn.com",
      "https://server.arcgisonline.com",
      "https://lh3.googleusercontent.com",
    ],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    mediaSrc: ["'self'"],
    formAction: ["'self'"],
  };

  app.use(helmet({
    contentSecurityPolicy: { directives: CSP_DIRECTIVES },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  }));
  app.use(cors({ origin: process.env.NODE_ENV === "production" ? "https://correlogo.sytes.net" : true }));
  app.use(express.json({ limit: "100kb" }));

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // OAuth callback page — exchanges code for token, then redirects back to app
  app.get("/auth/google/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code) {
        return res.redirect('/?gcal_error=missing_code');
      }

      const redirectUri = `${process.env.APP_URL || `http://localhost:${PORT}`}/auth/google/callback`;

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      const tokens = await tokenResponse.json();
      if (tokens.error) {
        return res.redirect(`/?gcal_error=${encodeURIComponent(tokens.error_description || tokens.error)}`);
      }

      const stateStr = typeof state === 'string' ? state : '';
      const isCapacitor = stateStr.startsWith('c3_');

      if (isCapacitor) {
        // Native Angular/Capacitor app — redirect to custom scheme so the app receives the token.
        return res.redirect(
          `com.correlogo.app://oauth/callback?token=${encodeURIComponent(tokens.access_token)}&state=${encodeURIComponent(stateStr)}`
        );
      }

      res.redirect(`/?gcal_token=${tokens.access_token}&gcal_state=${stateStr}`);
    } catch (err: any) {
      const state = req.query.state;
      const isCapacitor = typeof state === 'string' && state.startsWith('c3_');
      const dest = isCapacitor
        ? `com.correlogo.app://oauth/callback?error=${encodeURIComponent(err.message)}`
        : `/?gcal_error=${encodeURIComponent(err.message)}`;
      res.redirect(dest);
    }
  });

  // Capacitor custom-scheme cache for native Google Calendar sync
  app.get("/auth/google/callback/cache", async (req, res) => {
    const { token, state } = req.query;
    if (!token) return res.status(400).send("missing token");
    res.redirect(`com.correlogo.app://oauth/callback?token=${encodeURIComponent(String(token))}&state=${encodeURIComponent(String(state || ''))}`);
  });

  // Exchange Google OAuth code for token (POST API for existing flow)
  app.post("/auth/google/callback", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: "Code required" });
      }

      const redirectUri = `${process.env.APP_URL || `http://localhost:${PORT}`}/auth/google/callback`;

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      const tokens = await tokenResponse.json();
      if (tokens.error) {
        return res.status(400).json({ error: tokens.error_description });
      }

      res.json({ access_token: tokens.access_token });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
