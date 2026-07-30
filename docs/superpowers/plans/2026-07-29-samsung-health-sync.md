# Samsung Health Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export completed workouts from Corre Logo to Samsung Health SDK, enabling the existing Samsung Health → Strava sync.

**Architecture:** A new Capacitor plugin (`SamsungHealthPlugin.kt`) connects to the Samsung Health SDK and writes exercise data (aggregated + GPS route). A JS interface (`samsung-health.ts`) wraps the plugin calls. On workout completion, `WorkoutTracker.tsx` triggers the export and calls a callback to `App.tsx` to persist the sync status. The `TrainingSession` type gains a `syncStatus` field for tracking export state. `SessionHistory` shows sync indicators and supports manual re-export for pending/failed sessions.

**Tech Stack:** Samsung Health SDK (Kotlin), Capacitor Plugin (custom), TypeScript, React

## Global Constraints

- Samsung Health SDK requires a Samsung Developer Console account (free) and signing the APK
- One-way sync only (Corre Logo → Samsung Health)
- Health Data Agreement permission prompted on first export (auto), with fallback to manual from history
- Only Samsung devices — `isAvailable()` returns `false` on non-Samsung, export skipped silently
- Must not block workout completion — export is fire-and-forget; status saved async
- `TrainingSession.syncStatus` values: `'synced' | 'pending' | 'failed' | undefined`
- Export flow: WorkoutTracker triggers `exportWorkoutToSamsungHealth()` → result dispatched via `onSyncResult(status)` → App.tsx updates session in state + localStorage + Firestore

---

### Task 1: Android SDK Setup (Dependencies + Permissions)

**Files:**
- Modify: `android/app/build.gradle`
- Modify: `android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Produces: AAR file in `android/app/libs/` and Android permissions declared

- [ ] **Step 1: Add AAR dependency to build.gradle**

The Samsung Health SDK is distributed as a local AAR file (not a Maven artifact). Add an `*.aar` fileTree to the `dependencies` block:

```groovy
implementation fileTree(include: ['*.aar'], dir: 'libs')
```

- [ ] **Step 2: Add Samsung Health permissions to AndroidManifest.xml**

Note: `android.permission.ACTIVITY_RECOGNITION` is already declared — do NOT add it again.

Add inside `<manifest>` (after existing permissions):

```xml
<uses-permission android:name="com.samsung.android.providers.context.permission.WRITE_USE_APP_SURVEY"/>
```

Add the Samsung Health data permission meta-data inside `<application>` (before `</application>`):

```xml
<meta-data
    android:name="com.samsung.android.health.permission.read"
    android:value="com.samsung.health.step_count;com.samsung.health.exercise"/>
<meta-data
    android:name="com.samsung.android.health.permission.write"
    android:value="com.samsung.health.exercise;com.samsung.health.exercise_tracking"/>
```

- [ ] **Step 3: Sync and verify**

```bash
npx cap sync android
```

Expected: no errors, Gradle syncs the new Samsung Health dependency.

- [ ] **Step 4: Commit**

```bash
git add android/app/build.gradle android/app/src/main/AndroidManifest.xml
git commit -m "feat(samsung-health): add SDK dependency and permissions"
```

---

### Task 2: Samsung Developer Console + AAR Download

**Files:**
- Create: `docs/samsung-health-setup.md`

**Why this is Task 2:** The Samsung Health SDK (legacy, v1.5.1) is distributed as a local AAR file, not a Maven artifact. It must be downloaded from the Samsung Developer portal and placed in the project. Write the guide first so setup is documented.

- [ ] **Step 1: Create setup guide**

Create `docs/samsung-health-setup.md`:

```markdown
# Samsung Health SDK — Setup (Legacy SDK v1.5.1)

> The legacy Samsung Health SDK for Android (v1.5.1) is deprecated but fully functional.
> It does NOT require a Samsung Partnership — just a free Samsung Developer account to download the AAR.

## Prerequisites
- Samsung device with Samsung Health app installed and logged in
- Free Samsung Developer account (https://developers.samsung.com)

## Steps

1. Go to https://developer.samsung.com/health/android — click "Download SDK"
2. Download the `samsung-health-data-1.5.1.aar` file (Data package, last release Dec 2024)
3. Place it at `android/app/libs/samsung-health-data-1.5.1.aar`
   - The `android/app/libs/` directory already exists with AAR fileTree in build.gradle
4. Build APK with `gradlew assembleDebug` (uses debug key — works for dev)
5. Install APK on Samsung device
6. First export will prompt Health Data Agreement — accept it
7. Data appears in Samsung Health → then auto-syncs to Strava (if configured)

## Troubleshooting
- **AAR not found:** confirm the file is at `android/app/libs/` — the fileTree picks up any *.aar
- **Permission denied:** uninstall, reinstall, trigger export again. Samsung Health Data Agreement resets on reinstall
- **Not a Samsung device:** export is skipped silently — `isAvailable()` returns false
```

- [ ] **Step 2: Commit**

```bash
git add docs/samsung-health-setup.md
git commit -m "docs(samsung-health): add SDK setup guide with AAR instructions"
```

---

### Task 3: Native Plugin — SamsungHealthPlugin.kt

**Files:**
- Create: `android/app/src/main/java/com/correlogo/app/SamsungHealthPlugin.kt`

**Interfaces:**
- Consumes: Samsung Health SDK (`com.samsung.android.sdk.healthdata.*`)
- Produces: Capacitor plugin with `@PluginMethod` exportWorkout, isAvailable, getPermissionStatus, requestPermission
- Constraint: all insert() calls use fire-and-forget (HealthResultHolder returned, no await)

- [ ] **Step 1: Create SamsungHealthPlugin.kt**

File: `android/app/src/main/java/com/correlogo/app/SamsungHealthPlugin.kt`

```kotlin
package com.correlogo.app

import android.util.Log
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.JSObject
import com.getcapacitor.annotation.CapacitorPlugin
import com.samsung.android.sdk.healthdata.HealthConstants
import com.samsung.android.sdk.healthdata.HealthData
import com.samsung.android.sdk.healthdata.HealthDataResolver
import com.samsung.android.sdk.healthdata.HealthDataService
import com.samsung.android.sdk.healthdata.HealthDataStore
import com.samsung.android.sdk.healthdata.HealthDeviceManager
import com.samsung.android.sdk.healthdata.HealthPermissionManager
import org.json.JSONObject
import java.util.HashSet

@CapacitorPlugin(name = "SamsungHealth")
class SamsungHealthPlugin : Plugin() {

    companion object {
        private const val TAG = "CorreLogo-SHealth"
        private const val APP_ID = "correlogo_sync"
    }

    private var dataStore: HealthDataStore? = null
    private var localDeviceUuid: String? = null
    private var isConnected = false

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        try {
            val available = HealthDataService().isAvailable
            call.resolve(JSObject().apply { put("available", available) })
        } catch (e: Exception) {
            call.resolve(JSObject().apply { put("available", false) })
        }
    }

    @PluginMethod
    fun getPermissionStatus(call: PluginCall) {
        if (!ensureConnected()) {
            call.resolve(JSObject().apply { put("granted", false) })
            return
        }
        val pm = HealthPermissionManager(dataStore)
        val keys = buildPermissionKeys()
        val result = pm.isPermissionAcquired(keys)
        val granted = keys.all { result[it] == true }
        call.resolve(JSObject().apply { put("granted", granted) })
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        if (!ensureConnected()) {
            call.reject("Not connected to Samsung Health")
            return
        }
        val pm = HealthPermissionManager(dataStore)
        val keys = buildPermissionKeys()
        pm.requestPermissions(activity, keys).setResultListener { result ->
            val granted = keys.all {
                result.getResult(it) == HealthPermissionManager.PermissionResponse.SUCCESS
            }
            call.resolve(JSObject().apply { put("granted", granted) })
        }
    }

    @PluginMethod
    fun exportWorkout(call: PluginCall) {
        val data = call.getObject("workout")
        if (data == null) { call.reject("workout data is required"); return }
        if (!ensureConnected()) { call.reject("Not connected"); return }

        try {
            val resolver = HealthDataResolver(dataStore, null)
            val exerciseId = java.util.UUID.randomUUID().toString()
            insertExercise(resolver, data, exerciseId)
            insertExerciseTracking(resolver, data, exerciseId)
            call.resolve(JSObject().apply { put("success", true) })
        } catch (e: Exception) {
            Log.e(TAG, "exportWorkout failed", e)
            call.reject("Export failed: ${e.message}")
        }
    }

    private fun ensureConnected(): Boolean {
        if (isConnected && dataStore != null) return true
        return try {
            HealthDataService().initialize(activity.applicationContext)
            val lock = java.util.concurrent.CountDownLatch(1)
            val store = HealthDataStore(
                activity.applicationContext,
                object : HealthDataStore.ConnectionListener {
                    override fun onConnected() {
                        isConnected = true
                        localDeviceUuid = HealthDeviceManager(store).localDevice.uuid
                        lock.countDown()
                    }
                    override fun onConnectionFailed(e: Exception) { isConnected = false; lock.countDown() }
                    override fun onDisconnected() { isConnected = false }
                },
                APP_ID
            )
            store.connect()
            lock.await(3, java.util.concurrent.TimeUnit.SECONDS)
            dataStore = store
            isConnected
        } catch (e: Exception) {
            Log.e(TAG, "HealthDataStore connect failed", e)
            false
        }
    }

    private fun insertExercise(resolver: HealthDataResolver, data: JSONObject, exerciseId: String) {
        val healthData = HealthData()
        healthData.sourceDevice = localDeviceUuid
        healthData.putLong(HealthConstants.Exercise.START_TIME, data.optLong("startTime", 0L))
        healthData.putLong(HealthConstants.Exercise.END_TIME, data.optLong("endTime", 0L))
        healthData.putFloat(HealthConstants.Exercise.TIME_DURATION, data.optDouble("durationSeconds", 0.0).toFloat())
        healthData.putFloat(HealthConstants.Exercise.DISTANCE, (data.optDouble("distanceKm", 0.0) * 1000).toFloat())
        healthData.putFloat(HealthConstants.Exercise.MEAN_SPEED, data.optDouble("avgSpeedKmh", 0.0).toFloat())
        val exerciseType = if (data.optString("exerciseType", "treadmill") == "treadmill") 3000 else 2002
        healthData.putInt(HealthConstants.Exercise.EXERCISE_TYPE, exerciseType)
        healthData.putString(HealthConstants.Exercise.UUID, exerciseId)
        healthData.putString(HealthConstants.Exercise.CUSTOM_PACKAGE_NAME, activity.packageName)

        val insertRequest = HealthDataResolver.InsertRequest.Builder()
            .setDataType(HealthConstants.Exercise.HEALTH_DATA_TYPE)
            .build()
        insertRequest.addHealthData(healthData)
        resolver.insert(insertRequest)
    }

    private fun insertExerciseTracking(resolver: HealthDataResolver, data: JSONObject, exerciseId: String) {
        val routeArray = data.optJSONArray("route") ?: return
        val startTime = data.optLong("startTime", 0L)
        for (i in 0 until routeArray.length()) {
            val point = routeArray.getJSONObject(i)
            val healthData = HealthData()
            healthData.sourceDevice = localDeviceUuid
            healthData.putLong(HealthConstants.ExerciseTracking.TIME_OFFSET, point.optLong("timestamp", 0L) - startTime)
            healthData.putFloat(HealthConstants.ExerciseTracking.LATITUDE, point.optDouble("lat", 0.0).toFloat())
            healthData.putFloat(HealthConstants.ExerciseTracking.LONGITUDE, point.optDouble("lng", 0.0).toFloat())
            healthData.putFloat(HealthConstants.ExerciseTracking.ALTITUDE, point.optDouble("altitude", 0.0).toFloat())
            healthData.putString(HealthConstants.ExerciseTracking.EXERCISE_ID, exerciseId)

            val insertRequest = HealthDataResolver.InsertRequest.Builder()
                .setDataType(HealthConstants.ExerciseTracking.HEALTH_DATA_TYPE)
                .build()
            insertRequest.addHealthData(healthData)
            resolver.insert(insertRequest)
        }
    }

    private fun buildPermissionKeys(): HashSet<HealthPermissionManager.PermissionKey> {
        val keys = HashSet<HealthPermissionManager.PermissionKey>()
        keys.add(HealthPermissionManager.PermissionKey(
            HealthConstants.Exercise.HEALTH_DATA_TYPE, HealthPermissionManager.PermissionType.WRITE))
        keys.add(HealthPermissionManager.PermissionKey(
            HealthConstants.ExerciseTracking.HEALTH_DATA_TYPE, HealthPermissionManager.PermissionType.WRITE))
        return keys
    }
}
```

- [ ] **Step 2: Build and verify**

```bash
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"; cd android; .\gradlew assembleDebug
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/correlogo/app/SamsungHealthPlugin.kt
git commit -m "feat(samsung-health): add native Capacitor plugin"
```

---

### Task 4: JS Interface — samsung-health.ts + types update

**Files:**
- Create: `src/lib/capacitor/samsung-health.ts`
- Modify: `src/types.ts`

**Interfaces:**
- Consumes: Capacitor plugin `SamsungHealth`
- Produces: `WorkoutExport` interface, `exportWorkoutToSamsungHealth()`, `isSamsungHealthAvailable()`, `getHealthPermissionStatus()`, `requestHealthPermission()`, `SyncStatus` type
- `TrainingSession.syncStatus?: 'synced' | 'pending' | 'failed'`

- [ ] **Step 1: Add `syncStatus` to TrainingSession type**

In `src/types.ts`, add to `TrainingSession`:

```typescript
export interface TrainingSession {
  id: string;
  planId: string;
  planName: string;
  planSteps?: WorkoutStep[];
  date: string;
  mode: 'treadmill' | 'outdoor';
  trainingType?: 'time' | 'distance';
  totalDurationSeconds: number;
  totalDistanceKm: number;
  avgSpeedKmh: number;
  completed: boolean;
  points: ActivityPoint[];
  syncStatus?: 'synced' | 'pending' | 'failed';
}
```

- [ ] **Step 2: Create samsung-health.ts**

File: `src/lib/capacitor/samsung-health.ts`

```typescript
import { registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

export interface WorkoutExport {
  startTime: number;
  endTime: number;
  durationSeconds: number;
  distanceKm: number;
  exerciseType: 'treadmill' | 'running';
  avgSpeedKmh: number;
  route?: Array<{
    lat: number;
    lng: number;
    altitude?: number;
    timestamp: number;
  }>;
}

export type SyncStatus = 'synced' | 'pending' | 'failed';

interface SamsungHealthPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  getPermissionStatus(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  exportWorkout(options: { workout: WorkoutExport }): Promise<{ success: boolean }>;
}

const SamsungHealth = registerPlugin<SamsungHealthPlugin>('SamsungHealth');

export async function isSamsungHealthAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try { return (await SamsungHealth.isAvailable()).available; }
  catch { return false; }
}

export async function getHealthPermissionStatus(): Promise<boolean> {
  if (!isNative()) return false;
  try { return (await SamsungHealth.getPermissionStatus()).granted; }
  catch { return false; }
}

export async function requestHealthPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try { return (await SamsungHealth.requestPermission()).granted; }
  catch { return false; }
}

export async function exportWorkoutToSamsungHealth(data: WorkoutExport): Promise<{ success: boolean; status: SyncStatus }> {
  if (!isNative()) return { success: false, status: 'failed' };
  try {
    if (!await isSamsungHealthAvailable()) return { success: false, status: 'failed' };
    if (!await getHealthPermissionStatus()) {
      if (!await requestHealthPermission()) return { success: false, status: 'pending' };
    }
    await SamsungHealth.exportWorkout({ workout: data });
    return { success: true, status: 'synced' };
  } catch (e) {
    console.warn('[samsung-health] export failed:', e);
    return { success: false, status: 'pending' };
  }
}
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

Expected: ✓ built successfully

- [ ] **Step 4: Commit**

```bash
git add src/lib/capacitor/samsung-health.ts src/types.ts
git commit -m "feat(samsung-health): add JS interface and sync status type"
```

---

### Task 5: Export Trigger in WorkoutTracker + syncStatus callback

**Files:**
- Modify: `src/components/WorkoutTracker.tsx`

**Interfaces:**
- Consumes: `exportWorkoutToSamsungHealth()`, `WorkoutExport`, `SyncStatus` from samsung-health.ts
- Produces: `onSyncResult?: (status: SyncStatus) => void` prop
- Calls `onSyncResult(status)` after Samsung Health export completes
- New ref: `sessionStartTimeRef` for calculating start/end timestamps

- [ ] **Step 1: Add imports**

At the top of `WorkoutTracker.tsx`, add after existing imports:

```typescript
import { exportWorkoutToSamsungHealth } from '../lib/capacitor/samsung-health';
import type { WorkoutExport, SyncStatus } from '../lib/capacitor/samsung-health';
```

- [ ] **Step 2: Add `onSyncResult` to props**

Add to the `Props` interface:

```typescript
interface Props {
  plan: WorkoutPlan;
  onStop: () => void;
  mode: 'treadmill' | 'outdoor';
  markAsCompleted: (id: string, sessionStats: { points: ActivityPoint[]; distanceKm: number; timeSeconds: number; mode: 'treadmill' | 'outdoor' }) => void;
  totalWorkoutTime: number;
  isFreeTraining?: boolean;
  onSyncResult?: (status: SyncStatus) => void;
}
```

- [ ] **Step 3: Add sessionStartTimeRef**

Add after existing refs:

```typescript
const sessionStartTimeRef = useRef(Date.now());
```

- [ ] **Step 4: Add export trigger in the isWorkoutCompleted effect**

Find and replace the existing effect:

```typescript
useEffect(() => {
    if (isWorkoutCompleted && !workoutCompletedAnnouncedRef.current) {
        speak("Agora é só olhar seu relatório", true);
        workoutCompletedAnnouncedRef.current = true;
        stopNativeTimer();

        const exportData: WorkoutExport = {
            startTime: sessionStartTimeRef.current,
            endTime: Date.now(),
            durationSeconds: elapsedRef.current,
            distanceKm: distRef.current,
            exerciseType: mode === 'treadmill' ? 'treadmill' : 'running',
            avgSpeedKmh: speedRef.current,
            route: mode === 'outdoor' ? pointsRef.current
                .filter(p => p.lat && p.lon)
                .map(p => ({
                    lat: p.lat!,
                    lng: p.lon!,
                    altitude: p.altitude,
                    timestamp: sessionStartTimeRef.current + p.timestampSeconds * 1000,
                }))
                : undefined,
        };
        exportWorkoutToSamsungHealth(exportData).then(result => {
            if (onSyncResult) onSyncResult(result.status);
        });
    }
}, [isWorkoutCompleted]);
```

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

Expected: ✓ built successfully

- [ ] **Step 6: Commit**

```bash
git add src/components/WorkoutTracker.tsx
git commit -m "feat(samsung-health): add export trigger and sync result callback"
```

---

### Task 6: App.tsx Sync Flow + Session History Indicators

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/SessionHistory.tsx`

**Interfaces:**
- Consumes: `TrainingSession.syncStatus` from `src/types.ts`
- Consumes: `SyncStatus` from `src/lib/capacitor/samsung-health.ts`
- Consumes: `WorkoutExport` from `src/lib/capacitor/samsung-health.ts`
- App.tsx passes `onSyncResult` to WorkoutTracker, updates session in state + localStorage + Firestore
- SessionHistory shows sync status per card + `onExportSession` for manual re-export

- [ ] **Step 1: Add `onSyncResult` handler in App.tsx** (WorkoutTracker render section)

Where WorkoutTracker is rendered inside a route/component, pass:

```tsx
onSyncResult={(status) => {
    if (!user) return;
    setSessions(prev => {
        const updated = [...prev];
        if (updated.length === 0) return prev;
        updated[0] = { ...updated[0], syncStatus: status };
        localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
        return updated;
    });
    // Also update Firestore if session has a remote id
    setDoc(doc(getDb(), 'users', user.uid, 'sessions', session.id), { syncStatus: status }, { merge: true }).catch(() => {});
}}
```

Note: the exact prop needs to match where WorkoutTracker is rendered. Find the `markAsCompleted={...}` prop in App.tsx and add `onSyncResult` next to it. The `session.id` reference needs to be the session that was just created — use the `newSession` variable from the `markAsCompleted` callback or keep a ref to the latest session ID.

- [ ] **Step 2: Add `initialSyncStatus` to session creation**

In the `markAsCompleted` function in `App.tsx`, around line 629, update the session data:

```typescript
const sessionData: Omit<TrainingSession, 'id'> = {
    planId: id,
    planName,
    planSteps: plan?.steps ? plan.steps.map(s => ({ ...s })) : [],
    date: new Date().toISOString(),
    mode: sessionStats.mode,
    totalDurationSeconds: totalSeconds,
    totalDistanceKm: totalDistance,
    avgSpeedKmh: avgSpeed,
    completed: true,
    points: sessionStats.points,
    syncStatus: undefined,
};
```

- [ ] **Step 3: Add sync status UI in SessionHistory.tsx**

Add `onExportSession` to the `Props` interface:

```typescript
interface Props {
  sessions: TrainingSession[];
  onClose: () => void;
  onSelectSession: (session: TrainingSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onExportSession: (session: TrainingSession) => void;
}
```

Inside the session card, after the date span (or at the end of the card's top row):

```tsx
{session.syncStatus === 'synced' && (
    <span className="text-green-500 text-xs flex items-center gap-1 ml-2">
        <CheckCircle2 size={12} /> Sincronizado
    </span>
)}
{session.syncStatus === 'pending' && (
    <button
        onClick={(e) => { e.stopPropagation(); onExportSession(session); }}
        className="text-amber-500 text-xs flex items-center gap-1 ml-2 underline"
    >
        <Upload size={12} /> Pendente
    </button>
)}
{session.syncStatus === 'failed' && (
    <button
        onClick={(e) => { e.stopPropagation(); onExportSession(session); }}
        className="text-red-500 text-xs flex items-center gap-1 ml-2 underline"
    >
        <AlertTriangle size={12} /> Falhou
    </button>
)}
```

Add imports for the icons:

```typescript
import { CheckCircle2, Upload, AlertTriangle } from 'lucide-react';
```

- [ ] **Step 4: Add manual export handler in App.tsx**

In the section where SessionHistory is rendered with its props, add:

```tsx
onExportSession={async (session) => {
    const exportData: WorkoutExport = {
        startTime: new Date(session.date).getTime(),
        endTime: new Date(session.date).getTime() + session.totalDurationSeconds * 1000,
        durationSeconds: session.totalDurationSeconds,
        distanceKm: session.totalDistanceKm,
        exerciseType: session.mode === 'treadmill' ? 'treadmill' : 'running',
        avgSpeedKmh: session.avgSpeedKmh,
        route: session.mode === 'outdoor' ? session.points
            .filter(p => p.lat && p.lon)
            .map(p => ({
                lat: p.lat!,
                lng: p.lon!,
                altitude: p.altitude,
                timestamp: new Date(session.date).getTime() + (p.timestampSeconds || 0) * 1000,
            }))
            : undefined,
    };
    const result = await exportWorkoutToSamsungHealth(exportData);
    setSessions(prev => {
        const updated = prev.map(s => s.id === session.id ? { ...s, syncStatus: result.status } : s);
        localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
        return updated;
    });
    if (user) {
        setDoc(doc(getDb(), 'users', user.uid, 'sessions', session.id), { syncStatus: result.status }, { merge: true }).catch(() => {});
    }
    showFeedback(result.success ? 'success' : 'error', result.success ? 'Treino sincronizado com Samsung Health!' : 'Falha ao sincronizar. Tente novamente.');
}}
```

Add the import at the top of App.tsx:

```typescript
import { exportWorkoutToSamsungHealth } from '../lib/capacitor/samsung-health';
import type { WorkoutExport } from '../lib/capacitor/samsung-health';
```

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

Expected: ✓ built successfully

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/SessionHistory.tsx
git commit -m "feat(samsung-health): add sync flow in App and session history indicators"
```
