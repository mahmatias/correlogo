# Troubleshooting

## OAuth Issues

### `redirect_uri_mismatch`

**Sintoma**: Erro 400 "redirect_uri_mismatch" no Google consent.

**Causa**: Client ID errado (Android vs Web) ou redirect URI não autorizado.

**Fix**:
```bash
# Verificar Client ID no Google Cloud Console
# APIs & Services > Credentials > OAuth 2.0 Client IDs
# Authorized redirect URIs: https://correlogo.web.app/auth/google/callback

# No código: usar VITE_GOOGLE_WEB_CLIENT_ID (não Android Client ID)
```

### `Failed to launch com.correlogo.app://oauth`

**Sintoma**: Deep link não abre app após OAuth no APK.

**Causa**: Intent filter faltando no `AndroidManifest.xml`.

**Fix**:
```xml
<activity android:name="com.capacitorjs.plugins.capacitor.CapacitorActivity">
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="com.correlogo.app" android:host="oauth" />
    </intent-filter>
</activity>
```

### `Unauthorized` no Token Exchange

**Sintoma**: Cloud Function retorna `error=Unauthorized`.

**Causa**: `GOOGLE_CLIENT_SECRET` errado ou `redirect_uri` não bate.

**Fix**:
```bash
# Verificar functions/.env
GOOGLE_CLIENT_ID=985879764466-kd0plotbh6349qrniqv09enasnajst1i.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

# Verificar redirect_uri no Cloud Function
const redirectUri = "https://correlogo.web.app/auth/google/callback";
```

### Calendar Modal não abre após OAuth

**Sintoma**: Autoriza Google, volta pro app, mas modal não abre.

**Causa**: `pendingOAuthToken` não setado ou state prefix errado.

**Fix**:
```typescript
// App.tsx deep link handler
if (state.startsWith('c3_')) {
  localStorage.setItem('google_calendar_token', token);
  setPendingOAuthToken(token); // dispara modal
  setShowGoogleCalendarModal(true);
}
```

---

## Health Connect Issues

### Permissão nunca concedida

**Sintoma**: "Autorizar Health Connect" abre tela mas volta sem conceder.

**Causa**: `requestHcPermissions()` não aguarda callback.

**Fix**:
```kotlin
// HealthConnectPlugin.kt - use ActivityResultLauncher
permissionLauncher = registerForActivityResult(
    PermissionController.createRequestPermissionResultContract()
) { granted -> 
    pendingCall?.resolve(JSObject().put("granted", granted.contains(WRITE_EXERCISE)))
}
```

### `WRITE_DISTANCE` não concedido

**Sintoma**: HC export falha com "WRITE_DISTANCE not granted".

**Causa**: Permissão `WRITE_DISTANCE` não declarada/solicitada.

**Fix**:
```kotlin
// Manifest
<uses-permission android:name="android.permission.health.WRITE_DISTANCE" />

// Plugin permissions array
permissions = ["READ_EXERCISE", "WRITE_EXERCISE", "WRITE_DISTANCE"]
```

### Route insert fails (Outdoor)

**Sintoma**: HC export falha para outdoor, mas funciona sem rota.

**Causa**: `ExerciseRoute` insert falha (ex: pontos inválidos).

**Fix**: Route fallback no plugin
```kotlin
try {
    client.insertRecords(listOf(session, distance, route))
} catch (e: Exception) {
    // Retry sem route
    Log.w(TAG, "Route failed: ${e.message}, retrying without route")
    client.insertRecords(listOf(session, distance))
}
```

---

## GPS & Tracking Issues

### GPS não atualiza (Outdoor)

**Sintoma**: Mapa parado, distância não incrementa.

**Causa**: Permissão background não concedida ou GPS desligado.

**Fix**:
```typescript
// Verificar background permission
if (grantedForeground && !backgroundGranted) {
  showBackgroundModal(); // User deve habilitar "Allow all the time"
}
```

### Distância pula na troca de passo

**Sintoma**: Distância total salta ao trocar etapa.

**Causa**: `distRef = elapsed × speed` recalcula do zero.

**Fix**:
```typescript
// Incremental
distRef.current += deltaTime * speedKmh / 3600;
```

### Timer conta durante countdown

**Sintoma**: Timer roda durante 5s de countdown.

**Causa**: JS `setInterval` + Native timer rodando juntos.

**Fix**:
```typescript
// JS timer early return
if (countdown > 0 && mode === 'treadmill' && useNativeTimer) return;
```

---

## Build Issues

### `gradlew assembleDebug` falha

| Erro | Causa | Fix |
|------|-------|-----|
| `JAVA_HOME not set` | JDK não configurado | `$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"` |
| `Unresolved reference: HealthConnect` | Plugin não sincronizado | `npx cap sync android` |
| `Duplicate class` | Dependência duplicada | `./gradlew clean` + rebuild |

### APK não instala (`INSTALL_FAILED_VERSION_DOWNGRADE`)

**Causa**: VersionCode não incrementado.

**Fix**: `scripts/export-apk.ps1` auto-incrementa `versionCode`.

---

## Runtime Issues

### Foto do perfil não carrega (APK)

**Sintoma**: Avatar do Google não aparece no Profile.

**Causa**: CSP bloqueia `lh3.googleusercontent.com`.

**Fix**: `capacitor.config.ts`
```typescript
server: {
  androidScheme: 'https',
  captureInput: true
}
```

### Back button fecha app (não modal)

**Sintoma**: Pressionar "Voltar" no Android fecha app em vez de fechar modal.

**Causa**: `backButton` listener não checa `activePlan`.

**Fix**:
```typescript
// App.tsx
CapApp.addListener('backButton', () => {
  if (activePlan) return; // Não fecha durante treino
  if (showModal) { closeModal(); return; }
  if (lastBack > Date.now() - 2000) CapApp.exitApp();
  lastBack = Date.now();
  showFeedback('Pressione VOLTAR novamente para sair');
});
```

### Tela apaga durante treino

**Sintoma**: CPU dorme, timer para.

**Causa**: WakeLock não ativo.

**Fix**: `keepAwake()` no mount do `WorkoutTracker`, `allowSleep()` no unmount.

---

## Debug Logging

```bash
# Android logs
adb logcat -s "CorreLogo" "Tracking" "HealthConnect" "FirebaseAuth" "Chromium" "Capacitor"

# Filtrar erros
adb logcat *:E | grep -i correlogo

# Web console (Chrome DevTools)
# Abrir chrome://inspect → inspect device
```

---

*Última revisão: 2026-07-29*