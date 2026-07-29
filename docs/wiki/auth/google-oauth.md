# Auth - Google OAuth (Calendar + Gmail)

## Visão Geral

Dois escopos OAuth separados, mesma Cloud Function:
| Feature | Scope | State Prefix | Token Key |
|---------|-------|--------------|-----------|
| Calendar | `https://www.googleapis.com/auth/calendar` | `c3_` | `google_calendar_token` |
| Gmail/Strava | `https://www.googleapis.com/auth/gmail.send` | `gm_` (APK), `gm_web_` (Web) | `gmail_strava_token` |

---

## Cloud Function: authCallback

```typescript
// functions/src/index.ts
export const authCallback = onRequest(async (req, res) => {
  const { code, state } = req.query;
  
  // Troca code por tokens
  const tokens = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: JSON.stringify({
      client_id: WEB_CLIENT_ID,
      client_secret: WEB_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: 'https://correlogo.web.app/auth/google/callback'
    })
  });
  
  // Roteamento por state prefix
  const isNative = state.startsWith('c3_') || state.startsWith('gm_');
  // gm_web_ = web callback
  
  if (tokens.error) {
    return res.redirect(isNative 
      ? `com.correlogo.app://oauth/callback?error=...`
      : `/?gcal_error=...`);
  }
  
  if (isNative) {
    res.redirect(`com.correlogo.app://oauth/callback?token=${tokens.access_token}&state=${state}`);
  } else {
    res.redirect(`/?gcal_token=${tokens.access_token}&state=${state}`);
  }
});
```

---

## Fluxo Web (Calendar + Gmail)

```
1. User clica "Conectar" no modal
2. window.location.href = Google OAuth URL
3. Google Consent → Redirect para https://correlogo.web.app/auth/google/callback
4. Cloud Function troca code → access_token
5. Redirect para /?gcal_token=...&state=...
6. App.tsx useEffect captura query params
7. Salva token no localStorage + setAccessToken()
8. Modal atualiza UI → "Conectado"
```

### GoogleCalendarModal.tsx (Web)

```typescript
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: WEB_CLIENT_ID,
  redirect_uri: 'https://correlogo.web.app/auth/google/callback',
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/calendar',
  access_type: 'offline',
  prompt: 'consent',
  state: crypto.randomUUID(), // sem prefixo = web
})}`;

window.location.href = authUrl;
```

---

## Fluxo APK/Nativo (Calendar + Gmail)

```
1. User clica "Conectar" no modal
2. Browser.open({ url: authUrl, windowName: '_self' })
   → Abre Chrome Custom Tab
2. Google Consent → Redirect para Cloud Function
3. Cloud Function troca code → access_token
4. Redirect para com.correlogo.app://oauth/callback?token=...&state=c3_xxx
5. App.tsx appUrlOpen listener captura deep link
6. Salva token no localStorage + setPendingOAuthToken()
6. Abre GoogleCalendarModal (Calendar) ou mostra toast (Gmail)
```

### GoogleCalendarModal.tsx (Native)

```typescript
const state = 'c3_' + crypto.randomUUID();
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: WEB_CLIENT_ID,
  redirect_uri: 'https://correlogo.web.app/auth/google/callback',
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/calendar',
  access_type: 'offline',
  prompt: 'consent',
  state,
})}`;

await Browser.open({ url: authUrl, windowName: '_self' });
```

---

## Deep Link Handler (App.tsx)

```typescript
useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;
  
  CapApp.addListener('appUrlOpen', ({ url }) => {
    const parsed = new URL(url);
    if (parsed.protocol === 'com.correlogo.app:' && parsed.hostname === 'oauth') {
      const token = parsed.searchParams.get('token');
      const error = parsed.searchParams.get('error');
      const state = parsed.searchParams.get('state');
      
      // Gmail web callback (gm_web_)
      if (state?.startsWith('gm_web_')) {
        const saved = sessionStorage.getItem('gmail_oauth_state');
        if (saved === state) {
          sessionStorage.removeItem('gmail_oauth_state');
          if (token) localStorage.setItem('gmail_strava_token', token);
        }
      }
      // Gmail native (gm_)
      else if (state?.startsWith('gm_')) {
        const saved = sessionStorage.getItem('gmail_oauth_state');
        if (saved === state) {
          sessionStorage.removeItem('gmail_oauth_state');
          if (token) localStorage.setItem('gmail_strava_token', token);
        }
      }
      // Calendar (c3_)
      else {
        const saved = sessionStorage.getItem('gcal_oauth_state');
        if (saved === state) {
          sessionStorage.removeItem('gcal_oauth_state');
          if (token) {
            localStorage.setItem('google_calendar_token', token);
            setPendingOAuthToken(token);
            setShowGoogleCalendarModal(true);
          }
        }
      }
    }
  }).then(s => sub = s);
  
  return () => sub?.remove();
}, []);
```

---

## Web Callback Handler (App.tsx)

```typescript
useEffect(() => {
  if (Capacitor.isNativePlatform()) return;
  
  const params = new URLSearchParams(window.location.search);
  const token = params.get('gcal_token');
  const state = params.get('state');
  
  // Gmail web (gm_web_)
  if (token && state?.startsWith('gm_web_')) {
    const saved = sessionStorage.getItem('gmail_oauth_state');
    if (saved === state) {
      sessionStorage.removeItem('gmail_oauth_state');
      localStorage.setItem('gmail_strava_token', token);
      showFeedback('success', 'Gmail conectado!');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }
  // Calendar web (sem prefixo ou c3_)
  else if (token && state) {
    const saved = sessionStorage.getItem('gcal_oauth_state');
    if (saved === state) {
      sessionStorage.removeItem('gcal_oauth_state');
      localStorage.setItem('google_calendar_token', token);
      setAccessToken(token);
      setIsConnected(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }
}, []);
```

---

## AndroidManifest.xml - Deep Link

```xml
<activity
    android:name="com.capacitorjs.plugins.capacitor.CapacitorActivity"
    android:exported="true">
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="com.correlogo.app" android:host="oauth" />
    </intent-filter>
</activity>
```

---

## Web Client ID (Usado por Ambos)

```env
# .env.apk
VITE_GOOGLE_WEB_CLIENT_ID=985879764466-kd0plotbh6349qrniqv09enasnajst1i.apps.googleusercontent.com
```

> **Importante**: Mesmo Client ID para Web + APK. O `redirect_uri` autorizado no Google Cloud Console é `https://correlogo.web.app/auth/google/callback`.

---

## Escopos & Consent Screen

| Scope | Descrição | Tipo |
|-------|-----------|------|
| `https://www.googleapis.com/auth/calendar` | Ler/escrever calendário | Sensível |
| `https://www.googleapis.com/auth/gmail.send` | Enviar e-mail | Sensível |

> Ambos precisam estar no OAuth Consent Screen > Scopes. App em "Testing" = só test users.

---

## Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| `redirect_uri_mismatch` | Client ID Android usado no web | Usar Web Client ID |
| `invalid_client` | Client Secret errado | Verificar `functions/.env` |
| `access_denied` | User cancelou ou app não verificado | Adicionar test user no Console |
| Deep link não abre | `intent-filter` faltando | Verificar AndroidManifest.xml |
| Toast não aparece | State prefix errado | Verificar `gm_` vs `gm_web_` vs `c3_` |

---

*Última revisão: 2026-07-29*