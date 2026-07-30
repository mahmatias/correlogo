# Auth - Deep Links & Callbacks

## Android Deep Link

### Intent Filter (AndroidManifest.xml)

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

### URL Format

```
com.correlogo.app://oauth/callback?token=ya29.xxx&state=c3_xxx
```

| Param | Descrição |
|-------|-----------|
| `token` | Access token OAuth |
| `refresh_token` | Refresh token (opcional, 1ª auth com `prompt=consent`) |
| `state` | Prefixo identifica fluxo: `c3_` Calendar, `gm_` Gmail nativo |
| `error` | Mensagem de erro se token exchange falhou |

---

## iOS Deep Link (Futuro)

```xml
<!-- Info.plist -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.correlogo.app</string>
    </array>
  </dict>
</array>
```

---

## Web Callback (Query Params)

```
https://correlogo.web.app/?gcal_token=ya29.xxx&state=gm_web_xxx
```

| Param | Descrição |
|-------|-----------|
| `gcal_token` | Access token (Calendar + Gmail web) |
| `gcal_error` | Erro do token exchange |
| `state` | `gm_web_` = Gmail web, `c3_` = Calendar nativo, vazio = Calendar web |

---

## App.tsx Handlers

### Native Deep Link Listener

```typescript
useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;
  
  CapApp.addListener('appUrlOpen', ({ url }) => {
    const parsed = new URL(url);
    if (parsed.protocol === 'com.correlogo.app:' && parsed.hostname === 'oauth') {
      const token = parsed.searchParams.get('token');
      const error = parsed.searchParams.get('error');
      const state = parsed.searchParams.get('state');
      
      // Priority: gm_web_ > gm_ > c3_ > default
      if (state?.startsWith('gm_web_')) {
        handleGmailWebCallback(token, state);
      } else if (state?.startsWith('gm_')) {
        handleGmailNativeCallback(token, state);
      } else {
        handleCalendarCallback(token, error, state);
      }
    }
  });
}, []);
```

### Web Query Param Handler

```typescript
useEffect(() => {
  if (Capacitor.isNativePlatform()) return;
  
  const params = new URLSearchParams(window.location.search);
  const token = params.get('gcal_token');
  const error = params.get('gcal_error');
  const state = params.get('state');
  
  if (error) return console.warn('OAuth error:', error);
  
  if (token && state?.startsWith('gm_web_')) {
    // Gmail web
    if (sessionStorage.getItem('gmail_oauth_state') === state) {
      localStorage.setItem('gmail_strava_token', token);
      sessionStorage.removeItem('gmail_oauth_state');
      showFeedback('success', 'Gmail conectado!');
    }
  } else if (token && state) {
    // Calendar web
    if (sessionStorage.getItem('gcal_oauth_state') === state) {
      localStorage.setItem('google_calendar_token', token);
      setAccessToken(token);
      setIsConnected(true);
    }
  }
  
  window.history.replaceState(null, '', window.location.pathname);
}, []);
```

---

## State Prefixes Reference

| Prefix | Platform | Feature | Handler |
|--------|----------|---------|---------|
| `c3_` | Native | Calendar | `handleCalendarCallback` |
| `gm_` | Native | Gmail/Strava | `handleGmailNativeCallback` |
| `gm_web_` | Web | Gmail/Strava | Web callback handler |
| (none) | Web | Calendar | Web callback handler |

### Deep Link Exemplo (com refresh_token)

```
com.correlogo.app://oauth/callback?token=ya29.xxx&refresh_token=1//0xxx&state=gm_abc123
```

---

## Cloud Function Routing

```typescript
const isNative = state.startsWith('c3_') || state.startsWith('gm_');
// gm_web_ = web (falls to else)

if (isNative) {
  res.redirect(`com.correlogo.app://oauth/callback?token=${token}&state=${state}`);
} else {
  res.redirect(`/?gcal_token=${token}&state=${state}`);
}
```

---

## Error Handling

### Native Error Deep Link

```
com.correlogo.app://oauth/callback?error=invalid_grant&state=c3_xxx
```

Handler mostra toast "Falha ao conectar" + abre modal correspondente.

### Web Error Query Param

```
https://correlogo.web.app/?gcal_error=invalid_grant&state=gm_web_xxx
```

Handler loga warning + limpa URL.

---

## Testing Checklist

| Cenário | Esperado |
|---------|----------|
| Calendar Web | Abre nova aba → consent → volta pro site → toast "Conectado" |
| Calendar APK | Chrome Custom Tab → consent → deep link → abre modal Calendar |
| Gmail Web | Botão "Testar" → consent → volta pro site → toast "Gmail conectado" |
| Gmail APK | Botão "Testar" → Chrome Custom Tab → consent → deep link → toast "Gmail conectado" |
| Cancelar consentimento | Toast "Falha ao conectar" / modal aberto com erro |

---

*Última revisão: 2026-07-30*