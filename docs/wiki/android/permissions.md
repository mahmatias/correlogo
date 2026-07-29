# Android - Permissions

## Permissions Matrix

| Permissão | Uso | Quando Solicitar |
|-----------|-----|------------------|
| `INTERNET` | API calls, Firebase | Manifest (auto) |
| `ACCESS_FINE_LOCATION` | GPS outdoor | Start outdoor workout |
| `ACCESS_COARSE_LOCATION` | Fallback GPS | Com fine |
| `ACCESS_BACKGROUND_LOCATION` | GPS em background | Após foreground granted |
| `ACTIVITY_RECOGNITION` | Step counter | Start workout |
| `POST_NOTIFICATIONS` | Local notifications | Android 13+, pós-login |
| `WAKE_LOCK` | Keep CPU awake | Manifest |
| `FOREGROUND_SERVICE` | Tracking service | Manifest |
| `FOREGROUND_SERVICE_HEALTH` | Health tracking service | Android 14+ |
| `READ_EXERCISE` / `WRITE_EXERCISE` / `WRITE_DISTANCE` | Health Connect | Profile → "Autorizar Health Connect" |

---

## Runtime Permissions Flow

```mermaid
graph TD
    A[Start Outdoor Workout] --> B{hasFineLocation?}
    B -->|No| C[requestAllPermissions]
    C --> D{granted?}
    D -->|Yes| E[showBackgroundModal]
    D -->|No| F[Toast "Permissão necessária"]
    E --> G{backgroundGranted?}
    G -->|No| H[openAppSettings]
    G -->|Yes| I[startTracking]
    I --> J[Warmup 3s]
    J --> K[Start Workout]
```

---

## PermissionsPlugin.kt

```kotlin
@CapacitorPlugin(name = "Permissions", permissions = [
    "POST_NOTIFICATIONS",
    "ACTIVITY_RECOGNITION"
])
class PermissionsPlugin : Plugin() {

    @PluginMethod
    fun requestAllPermissions(call: PluginCall) {
        val permissions = mutableListOf<String>()
        
        // Notifications (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (context.checkSelfPermission(POST_NOTIFICATIONS) != PERMISSION_GRANTED) {
                permissions.add(POST_NOTIFICATIONS)
            }
        }
        
        // Activity Recognition (Android 10+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (context.checkSelfPermission(ACTIVITY_RECOGNITION) != PERMISSION_GRANTED) {
                permissions.add(ACTIVITY_RECOGNITION)
            }
        }
        
        if (permissions.isNotEmpty()) {
            requestPermissions(call, permissions.toTypedArray())
        } else {
            call.resolve()
        }
    }
}
```

---

## Health Connect Permissions

### Plugin (HealthConnectPlugin.kt)

```kotlin
@CapacitorPlugin(name = "HealthConnect", permissions = [
    "android.permission.health.READ_EXERCISE",
    "android.permission.health.WRITE_EXERCISE",
    "android.permission.health.WRITE_DISTANCE"
])
class HealthConnectPlugin : Plugin() {
    
    override fun load() {
        // ActivityResultLauncher para HC permissions
        permissionLauncher = registerForActivityResult(
            PermissionController.createRequestPermissionResultContract()
        ) { granted: Set<String> ->
            val grantedResult = granted.contains(WRITE_EXERCISE)
            pendingCall?.resolve(JSObject().put("granted", grantedResult))
        }
    }
    
    @PluginMethod
    fun requestHcPermissions(call: PluginCall) {
        val permissions = setOf(WRITE_EXERCISE, WRITE_DISTANCE)
        val alreadyGranted = context.checkSelfPermission(WRITE_EXERCISE) == PERMISSION_GRANTED &&
                            context.checkSelfPermission(WRITE_DISTANCE) == PERMISSION_GRANTED
        
        if (alreadyGranted) {
            call.resolve(JSObject().put("granted", true))
        } else {
            pendingCall = call
            permissionLauncher?.launch(permissions)
        }
    }
}
```

### Manifest (HC Specific)

```xml
<!-- Activity para tela de permissão HC -->
<activity
    android:name=".PermissionsRationaleActivity"
    android:exported="true"
    android:theme="@style/Theme.Transparent">
    <intent-filter>
        <action android:name="android.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
        <category android:name="android.intent.category.DEFAULT" />
    </intent-filter>
</activity>

<!-- Provider visibility -->
<queries>
    <package android:name="com.google.android.apps.healthdata" />
    <intent>
        <action android:name="android.health.action.SHOW_PERMISSIONS" />
    </intent>
</queries>
```

---

## Request Flow (User Profile)

```
User abre Profile
    │
    ▼
"Autorizar Health Connect" button
    │
    ▼
requestHcPermissions()
    │
    ├─► HC Permission Screen opens
    │       │
    │       ├─ User grants WRITE_EXERCISE + WRITE_DISTANCE
    │       │       │
    │       │       ▼ Callback → granted=true → UI "Autorizado"
    │       │
    │       └─ User denies
    │               │
    │               ▼ Callback → granted=false → UI "Permissão negada"
    │
    └─► Already granted → UI "Autorizado"
```

---

## GPS Background Permission

```typescript
// tracking.ts
const checkLocationPermission = async () => {
  const result = await Permissions.checkPermissions();
  
  if (result.location !== 'granted') {
    await Permissions.requestPermissions({ location: 'when_in_use' });
  }
  
  // Background (Android 10+)
  const bgResult = await Permissions.checkPermissions();
  if (bgResult.location !== 'always') {
    setShowBackgroundModal(true); // Modal pede "Permitir o tempo todo"
  }
};

// Native plugin method
@PluginMethod
fun openAppSettings(call: PluginCall) {
    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
    intent.data = Uri.parse("package:${context.packageName}")
    context.startActivity(intent)
}
```

---

## Permission Status Check

```typescript
// src/lib/capacitor/permissions.ts
export async function getPermissionStatus(): Promise<PermissionStatus> {
  if (!isNative()) return { location: 'prompt', background: 'prompt', notifications: 'granted' };
  
  const { location, coarseLocation, backgroundLocation, activityRecognition, notifications } = 
    await Permissions.checkPermissions();
  
  return {
    location: location,
    background: backgroundLocation,
    activity: activityRecognition,
    notifications,
  };
}
```

---

## Troubleshooting

| Sintoma | Causa | Fix |
|---------|-------|-----|
| GPS não atualiza em background | `ACCESS_BACKGROUND_LOCATION` não granted | Abrir Settings → "Permitir o tempo todo" |
| Health Connect "Falha ao sincronizar" | `WRITE_DISTANCE` não granted | Profile → "Autorizar Health Connect" |
| Notificações não aparecem | `POST_NOTIFICATIONS` denied (Android 13+) | Settings → Apps → Corre Logo → Notifications |
| Step counter 0 | `ACTIVITY_RECOGNITION` denied | Reinstalar app / conceder permissão |

---

*Última revisão: 2026-07-29*