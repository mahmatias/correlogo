# Android - Deep Links & Intents

## Custom Scheme

```
com.correlogo.app://oauth/callback?token=xxx&state=c3_xxx
```

### Intent Filter (AndroidManifest.xml)

```xml
<activity
    android:name="com.capacitorjs.plugins.capacitor.CapacitorActivity"
    android:exported="true"
    android:launchMode="singleTask">
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="com.correlogo.app" android:host="oauth" />
    </intent-filter>
</activity>
```

### Verificação

```bash
# Testar deep link
adb shell am start \
  -W -a android.intent.action.VIEW \
  -d "com.correlogo.app://oauth/callback?token=test&state=c3_xxx" \
  com.correlogo.app

# Verificar intent filters
adb shell dumpsys package com.correlogo.app | grep -A 10 "com.correlogo.app"
```

---

## OAuth Callback Flow

```
1. App → Browser.open(OAuth URL + state=c3_xxx)
2. Google Consent
3. Redirect → Cloud Function (code → token)
3. Cloud Function → Redirect com.correlogo.app://oauth?token=xxx&state=c3_xxx
4. Android opens App (singleTask) → appUrlOpen event
5. App.tsx listener captures → saves token → opens modal
```

### App.tsx Listener

```typescript
useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;
  
  CapApp.addListener('appUrlOpen', ({ url }) => {
    const parsed = new URL(url);
    if (parsed.protocol === 'com.correlogo.app:' && parsed.hostname === 'oauth') {
      const token = parsed.searchParams.get('token');
      const state = parsed.searchParams.get('state');
      
      if (state?.startsWith('gm_web_')) {
        // Gmail web callback (fallback)
      } else if (state?.startsWith('gm_')) {
        localStorage.setItem('gmail_strava_token', token);
        showFeedback('success', 'Gmail conectado!');
      } else {
        // Calendar
        localStorage.setItem('google_calendar_token', token);
        setPendingOAuthToken(token);
        setShowGoogleCalendarModal(true);
      }
    }
  });
}, []);
```

---

## App Settings Deep Link

```typescript
// tracking.ts
export async function openAppSettings(): Promise<void> {
  if (isNative()) {
    await Tracking.openAppSettings(); // Native plugin
  } else {
    window.location.href = 'android-app://com.correlogo.app/android.settings.APPLICATION_DETAILS_SETTINGS';
  }
}
```

### Native Implementation

```kotlin
// TrackingPlugin.kt
@PluginMethod
fun openAppSettings(call: PluginCall) {
    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.parse("package:${context.packageName}")
    }
    context.startActivity(intent)
    call.resolve()
}
```

---

## Android App Links (HTTPS)

Para abrir `https://correlogo.web.app/...` direto no app:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="correlogo.web.app" />
</intent-filter>
```

### Digital Asset Links (assetlinks.json)

```json
// https://correlogo.web.app/.well-known/assetlinks.json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.correlogo.app",
    "sha256_cert_fingerprints": [
      "SHA256:XX:XX:XX:..."
    ]
  }
}]
```

---

## Common Intents

| Ação | Intent | Exemplo |
|------|--------|---------|
| Abrir Configurações App | `ACTION_APPLICATION_DETAILS_SETTINGS` | `Tracking.openAppSettings()` |
| Abrir Configurações GPS | `ACTION_LOCATION_SOURCE_SETTINGS` | `Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)` |
| Abrir Configurações Permissões (API 31+) | `ACTION_APPLICATION_PERMISSION_SETTINGS` | `Tracking.openAppSettings()` |
| Abrir Health Connect Permissions | `android.health.action.SHOW_PERMISSIONS` | `PermissionController` |

---

## Testing

```bash
# Testar deep link
adb shell am start -W -a android.intent.action.VIEW \
  -d "com.correlogo.app://oauth/callback?token=test&state=c3_xxx" \
  com.correlogo.app

# Verificar link handling
adb logcat -s "CorreLogo" "Capacitor" "Chrome"
```

---

*Última revisão: 2026-07-29*