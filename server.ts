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
    scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
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
    ],
    frameSrc: ["https://*.firebaseapp.com", "https://accounts.google.com"],
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

  // Exchange Google OAuth code for access token
  app.post("/auth/google/callback", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: "Code required" });
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${process.env.APP_URL}/auth/google/callback`,
        }),
      });

      const tokens = await tokenResponse.json();
      if (tokens.error) {
        return res.status(400).json({ error: tokens.error_description });
      }

      res.json({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
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
