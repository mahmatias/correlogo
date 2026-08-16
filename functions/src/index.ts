import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const WEB_CLIENT_ID = "985879764466-kd0plotbh6349qrniqv09enasnajst1i.apps.googleusercontent.com";
const WEB_CLIENT_SECRET = defineSecret("WEB_CLIENT_SECRET");
const redirectUri = "https://correlogo.web.app/auth/google/callback";

export const authCallback = onRequest({ secrets: [WEB_CLIENT_SECRET] }, async (req, res) => {
  const code = req.query.code as string;
  const state = (req.query.state as string) || "";

  if (!code) {
    return res.redirect("/?gcal_error=missing_code");
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: WEB_CLIENT_ID,
        client_secret: WEB_CLIENT_SECRET.value(),
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokens = (await tokenResponse.json()) as Record<string, string>;

    const isNative = state.startsWith("c3_") || (state.startsWith("gm_") && !state.startsWith("gm_web_"));
    // gm_web_ = web callback
    if (tokens.error) {
      const errorMsg = tokens.error_description || tokens.error;
      console.error("[authCallback] Token error:", errorMsg, "state:", state);
      const dest = isNative
        ? `com.correlogo.app://oauth/callback?error=${encodeURIComponent(errorMsg)}`
        : `/?gcal_error=${encodeURIComponent(errorMsg)}`;
      return res.redirect(dest);
    }

    const refreshToken = tokens.refresh_token || "";
    if (isNative) {
      res.redirect(
        `com.correlogo.app://oauth/callback?token=${encodeURIComponent(tokens.access_token!)}&refresh_token=${encodeURIComponent(refreshToken)}&state=${encodeURIComponent(state)}`
      );
    } else {
      res.redirect(
        `/?gcal_token=${tokens.access_token}&refresh_token=${encodeURIComponent(refreshToken)}&state=${encodeURIComponent(state)}`
      );
    }
  } catch (err: any) {
    const isNative = state.startsWith("c3_") || (state.startsWith("gm_") && !state.startsWith("gm_web_"));
    console.error("[authCallback] Exception:", err.message, "state:", state);
    const dest = isNative
      ? `com.correlogo.app://oauth/callback?error=${encodeURIComponent(err.message)}`
      : `/?gcal_error=${encodeURIComponent(err.message)}`;
    res.redirect(dest);
  }
});

export const refreshAuthToken = onRequest({ secrets: [WEB_CLIENT_SECRET] }, async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    res.status(400).json({ error: "refresh_token required" });
    return;
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: WEB_CLIENT_ID,
        client_secret: WEB_CLIENT_SECRET.value(),
        refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const tokens = (await tokenResponse.json()) as Record<string, string>;
    if (tokens.error) {
      res.status(400).json({ error: tokens.error_description || tokens.error });
      return;
    }

    res.json({ access_token: tokens.access_token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export const healthCheck = onRequest(async (req, res) => {
  res.json({ status: "ok" });
});
