# Sync - Health Connect (GymRats)

## Visão Geral

Health Connect (Android Jetpack) substitui Samsung Health. Escreve uma vez, sincroniza para **Strava** e **GymRats** automaticamente.

---

## Plugin Nativo: HealthConnectPlugin.kt

```kotlin
// android/.../HealthConnectPlugin.kt
@CapacitorPlugin(name = "HealthConnect", permissions = [
    "android.permission.health.READ_EXERCISE",
    "android.permission.health.WRITE_EXERCISE",
    "android.permission.health.WRITE_DISTANCE"
])
class HealthConnectPlugin : Plugin() {
    
    private var client: HealthConnectClient? = null
    
    override fun load() {
        // ActivityResultLauncher para permissões
        permissionLauncher = registerForActivityResult(
            PermissionController.createRequestPermissionResultContract()
        ) { granted ->
            permissionCallback?.resolve(granted.contains(WRITE_EXERCISE))
        }
    }
    
    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val available = HealthConnectClient.isApiSupported(context) &&
                       HealthConnectClient.isProviderAvailable(context)
        call.resolve(JSObject().put("available", available))
    }
    
    @PluginMethod
    fun checkHcPermissions(call: PluginCall) {
        if (!ensureClient()) {
            call.resolve(JSObject().put("granted", false))
            return
        }
        val c = client!!
        scope.launch {
            try {
                val grantedPerms = c.permissionController.getGrantedPermissions()
                val writePerm = HealthPermission.getWritePermission(ExerciseSessionRecord::class)
                val granted = writePerm in grantedPerms
                Log.d(TAG, "checkHcPermissions: WRITE_EXERCISE granted=$granted")
                call.resolve(JSObject().put("granted", granted))
            } catch (e: Exception) {
                Log.e(TAG, "checkHcPermissions error", e)
                call.resolve(JSObject().put("granted", false))
            }
        }
    }
    
    @PluginMethod
    fun requestHcPermissions(call: PluginCall) {
        val permissions = setOf(WRITE_EXERCISE, WRITE_DISTANCE)
        val granted = context.checkSelfPermission(WRITE_EXERCISE) == PERMISSION_GRANTED &&
                     context.checkSelfPermission(WRITE_DISTANCE) == PERMISSION_GRANTED
        
        if (granted) {
            call.resolve(JSObject().put("granted", true))
        } else {
            pendingCall = call
            permissionLauncher?.launch(permissions)
        }
    }
    
    @PluginMethod
    fun exportWorkout(call: PluginCall) {
        // Verifica permissões
        // Cria ExerciseSessionRecord
        // Adiciona DistanceRecord
        // Adiciona ExerciseRoute (se outdoor)
        // Insert via HealthConnectClient
    }
}
```

---

## Records Written

| Record | Tipo | Indoor | Outdoor |
|--------|------|--------|---------|
| `ExerciseSessionRecord` | Sessão | ✅ RUNNING_TREADMILL | ✅ RUNNING |
| `DistanceRecord` | Distância | ✅ | ✅ |
| `ExerciseRoute` | Rota GPS | ❌ | ✅ (pontos lat/lon/alt/time) |

### ExerciseSessionRecord

```kotlin
ExerciseSessionRecord(
    startTime = Instant.ofEpochMilli(startTime),
    endTime = Instant.ofEpochMilli(endTime),
    exerciseType = if (outdoor) RUNNING else RUNNING_TREADMILL,
    metadata = Metadata(metadataId, clientRecordId, recordingMethod)
)
```

### DistanceRecord

```kotlin
DistanceRecord(
    startTime = startInstant,
    endTime = endInstant,
    distance = Length.fromKilometers(distanceKm)
)
```

### ExerciseRoute (Outdoor)

```kotlin
ExerciseRoute(
    startTime = startInstant,
    endTime = endInstant,
    locations = points.map { ExerciseRoute.Location(
        latLon = LatLon(it.lat, it.lon),
        altitude = Length.fromMeters(it.altitude ?: 0.0),
        time = Instant.ofEpochMilli(it.timestamp)
    ) }
)
```

---

## JS Wrapper (health-connect.ts)

```typescript
// src/lib/capacitor/health-connect.ts
export async function checkHealthPermissions(): Promise<boolean | null> {
  if (!isNative()) return null;
  try { return (await HealthConnect.checkHcPermissions()).granted; }
  catch { return null; }
}

export async function exportWorkoutToHealthConnect(data: WorkoutExport): Promise<SyncResult> {
  if (!isNative()) return { success: false, status: 'failed', error: 'Apenas dispositivo nativo' };
  
  const result = await HealthConnect.exportWorkout(data);
  
  // Route fallback: tenta com rota, se falha tenta sem
  if (!result.success && data.route) {
    const retry = await HealthConnect.exportWorkout({ ...data, route: undefined });
    if (retry.success) console.warn('[HC] Route failed, saved without route');
    return retry;
  }
  
  return result;
}
```

---

## Route Fallback Logic

```kotlin
// HealthConnectPlugin.kt - exportWorkout
try {
    client.insertRecords(listOf(session, distance, route))
    call.resolve(success)
} catch (e: Exception) {
    if (route != null) {
        // Retry sem route
        Log.w(TAG, "Route insert failed: ${e.message}, retrying without route")
        client.insertRecords(listOf(session, distance))
            .addOnSuccessListener { call.resolve(success) }
            .addOnFailureListener { call.reject("export failed", it) }
    } else {
        call.reject("export failed", e)
    }
}
```

---

## Permissões Manifest

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.health.READ_EXERCISE" />
<uses-permission android:name="android.permission.health.WRITE_EXERCISE" />
<uses-permission android:name="android.permission.health.WRITE_DISTANCE" />

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

<!-- Health Connect provider visibility -->
<queries>
    <package android:name="com.google.android.apps.healthdata" />
    <intent>
        <action android:name="android.health.action.SHOW_PERMISSIONS" />
    </intent>
</queries>
```

---

## Sync Status

```typescript
interface SyncResult {
  success: boolean;
  status: 'synced' | 'pending' | 'failed';
  error?: string;
}
```

### Estados na UI

| Status | Ícone | Cor | Ação |
|--------|-------|-----|------|
| `synced` | ✅ | Verde | — |
| `pending` | ⏳ | Amarelo | Auto-retry |
| `failed` | ❌ | Vermelho | Botão "Tentar novamente" |

---

## Auto-Sync Flow

```
Workout Complete
      │
      ▼
HC Export (ExerciseSession + Distance + Route?)
      │
      ├── Success → status: 'synced' → Toast "Sincronizado!"
      │
      └── Fail (route) → Retry without route
            │
            ├── Success → status: 'synced' → Toast "Sincronizado (sem rota)"
            │
            └── Fail → status: 'failed' → Toast "Falha: {error}"
```

---

## Gmail/Strava Integration (Separado)

> **Nota**: Health Connect → Strava **não** importa treinos indoor (sem GPS).
> Strava só importa `ExerciseRoute` via HC.
> 
> **Solução**: Gmail API envia TCX/GPX anexado → `stravaupload@gotoes.org`

---

## Testing Checklist

| Cenário | Esperado |
|---------|----------|
| Esteira → HC | ExerciseSession (TREADMILL) + Distance |
| Outdoor → HC | ExerciseSession (RUNNING) + Distance + Route |
| Permissão negada | Toast "Verifique permissões" |
| Route insert fail | Retry sem route + log warning |
| Sem permissão WRITE_DISTANCE | Fail com erro claro |

---

*Última revisão: 2026-07-29*