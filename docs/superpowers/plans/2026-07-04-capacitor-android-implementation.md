# Capacitor Android Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Corre Logo SPA into a functional Android app with GPS background tracking, TTS, wake lock, step counter, and audio ducking.

**Architecture:** Capacitor 7 as native shell. Custom Kotlin plugins for GPS tracking + step counter + audio ducking. Official plugins for TTS, wake lock, and notifications. TypeScript wrappers in `src/lib/capacitor/` that fall back to browser APIs when not on native.

**Tech Stack:** Capacitor 7, Kotlin, React 19, Firebase

## Global Constraints

- All Capacitor features gated behind `isNativePlatform()` — browser fallback always works
- Custom plugins use `com.correlogo.app` package
- Kotlin plugins follow Capacitor `@PluginMethod` annotation pattern
- `capacitor.config.ts` with `cleartext: true` (Firebase dev)
- No Play Store publishing — personal use APK only
- `android/` directory tracked in git

---
### Task 1: Capacitor Init + Dependencies

**Files:**
- Create: `capacitor.config.ts`
- Create: `android/` (via CLI)
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install npm dependencies**

```bash
npm install @capacitor/core @capacitor/android @capacitor-community/text-to-speech @capacitor-community/keep-awake @capacitor/local-notifications
npm install -D @capacitor/cli
```

- [ ] **Step 2: Create capacitor.config.ts**

```ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.correlogo.app',
  appName: 'Corre Logo',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config',
      iconColor: '#F97316',
    },
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
```

- [ ] **Step 3: Initialize Capacitor Android project**

```bash
npx cap init CorreLogo com.correlogo.app
npx cap add android
```

This generates `android/` directory with Gradle project, `MainActivity.kt`, and `AndroidManifest.xml`.

- [ ] **Step 4: Add android/ to .gitignore exception**

Edit `.gitignore` — add a line to NOT ignore `android/` (it's not currently ignored, just confirm):

```bash
# Confirm android/ is tracked (not in .gitignore)
git check-ignore android/
# If it returns the path, add this before the last line:
```

No change needed unless `.gitignore` is blocking it. Verify with `git status`.

- [ ] **Step 5: Build + sync to verify**

```bash
npm run build
npx cap sync
```

Expected: Vite build succeeds, `android/` gets updated `dist/` assets.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: init Capacitor 7 with Android platform"
```

---
### Task 2: AndroidManifest + App Resources

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`
- Modify/Add: `android/app/src/main/res/` (icon resources)

- [ ] **Step 1: Add permissions and service declaration to AndroidManifest.xml**

Read the current `android/app/src/main/AndroidManifest.xml`, then add inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

Inside `<application>`, add before `</application>`:

```xml
<service
  android:name=".TrackingService"
  android:foregroundServiceType="location"
  android:exported="false" />
```

- [ ] **Step 2: Add launcher icon**

Generate a simple adaptive icon using Android Studio (or use a placeholder). For personal use, we can use the default Capacitor icon or generate assets:

```bash
npx capacitor-assets generate --iconBackgroundColor '#1a1a2e' --iconForegroundColor '#FF006E'
```

If `capacitor-assets` is not available, manually create `android/app/src/main/res/mipmap-*/ic_launcher.png` using the app's existing logo from `assets/`.

- [ ] **Step 3: Build check**

```bash
npx cap sync
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/AndroidManifest.xml
git commit -m "feat(android): configure permissions and foreground service"
```

---
### Task 3: Custom Tracking Plugin (Kotlin)

**Files:**
- Create: `android/app/src/main/java/com/correlogo/app/TrackingService.kt`
- Create: `android/app/src/main/java/com/correlogo/app/TrackingPlugin.kt`

- [ ] **Step 1: Create TrackingService.kt**

```kotlin
package com.correlogo.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.location.Location
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall

class TrackingService : Service(), SensorEventListener {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private lateinit var sensorManager: SensorManager
    private var stepSensor: Sensor? = null
    private var initialSteps: Float = 0f
    private var hasInitialSteps = false

    companion object {
        const val CHANNEL_ID = "tracking_channel"
        const val NOTIFICATION_ID = 1
        var currentPlugin: TrackingPlugin? = null
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        sensorManager = getSystemService(SENSOR_SERVICE) as SensorManager
        stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                for (location in locationResult.locations) {
                    emitLocation(location)
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification()
        startForeground(NOTIFICATION_ID, notification)

        val locationRequest = LocationRequest.Builder(
            android.location.Criterion.ACCURACY_FINE
        ).setIntervalMillis(3000)
         .setMinUpdateIntervalMillis(1000)
         .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Permission already checked before starting
        }

        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            Looper.getMainLooper()
        )

        stepSensor?.let { sensor ->
            sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL)
        }

        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        sensorManager.unregisterListener(this)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onSensorChanged(event: SensorEvent?) {
        event?.let {
            if (!hasInitialSteps) {
                initialSteps = it.values[0]
                hasInitialSteps = true
            }
            val steps = (it.values[0] - initialSteps).toInt().coerceAtLeast(0)
            currentPlugin?.notifySteps(steps)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun emitLocation(location: Location) {
        val obj = JSObject().apply {
            put("latitude", location.latitude)
            put("longitude", location.longitude)
            put("altitude", location.altitude)
            put("accuracy", location.accuracy)
            put("speed", location.speed)
            put("timestamp", location.time)
        }
        currentPlugin?.notifyListeners("locationUpdate", obj)
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Tracking de Treino",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Notificação persistente durante o treino"
        }
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Corre Logo")
            .setContentText("Gravando treino...")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }
}
```

- [ ] **Step 2: Create TrackingPlugin.kt**

```kotlin
package com.correlogo.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission

@CapacitorPlugin(
    name = "Tracking",
    permissions = [
        Permission(
            strings = [
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION,
                Manifest.permission.ACTIVITY_RECOGNITION
            ],
            alias = "location"
        )
    ]
)
class TrackingPlugin : Plugin() {

    private var lastSteps = 0

    override fun load() {
        super.load()
        TrackingService.currentPlugin = this
    }

    @PluginMethod
    fun startTracking(call: PluginCall) {
        val hasFineLocation = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasFineLocation) {
            call.reject("Permissão de localização não concedida")
            return
        }

        val intent = Intent(context, TrackingService::class.java)
        context.startForegroundService(intent)
        call.resolve()
    }

    @PluginMethod
    fun stopTracking(call: PluginCall) {
        val intent = Intent(context, TrackingService::class.java)
        context.stopService(intent)
        call.resolve()
    }

    @PluginMethod
    fun getStepCount(call: PluginCall) {
        val ret = JSObject().apply {
            put("steps", lastSteps)
        }
        call.resolve(ret)
    }

    fun notifySteps(steps: Int) {
        lastSteps = steps
        val obj = JSObject().apply {
            put("steps", steps)
        }
        notifyListeners("stepUpdate", obj)
    }
}
```

- [ ] **Step 3: Register plugins in MainActivity.kt**

Read and modify `android/app/src/main/java/com/correlogo/app/MainActivity.kt`:

```kotlin
package com.correlogo.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(TrackingPlugin::class.java)
    }
}
```

- [ ] **Step 4: Verify Kotlin compiles**

```bash
npx cap sync
cd android
./gradlew assembleDebug
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/correlogo/app/TrackingService.kt android/app/src/main/java/com/correlogo/app/TrackingPlugin.kt
git commit -m "feat(android): custom TrackingPlugin with foreground GPS + step counter"
```

---
### Task 4: Custom AudioFocus Plugin (Kotlin)

**Files:**
- Create: `android/app/src/main/java/com/correlogo/app/AudioFocusPlugin.kt`

- [ ] **Step 1: Create AudioFocusPlugin.kt**

```kotlin
package com.correlogo.app

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "AudioFocus")
class AudioFocusPlugin : Plugin() {

    private var audioManager: AudioManager? = null
    private var audioFocusRequest: Any? = null // AudioFocusRequest on API 26+

    override fun load() {
        super.load()
        audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }

    @PluginMethod
    fun requestFocus(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attributes)
                .build()
            audioFocusRequest = request
            audioManager?.requestAudioFocus(request)
        } else {
            @Suppress("DEPRECATION")
            audioManager?.requestAudioFocus(
                null,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
            )
        }
        call.resolve()
    }

    @PluginMethod
    fun abandonFocus(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val request = audioFocusRequest as? AudioFocusRequest
            if (request != null) {
                audioManager?.abandonAudioFocusRequest(request)
            }
        } else {
            @Suppress("DEPRECATION")
            audioManager?.abandonAudioFocus(null)
        }
        call.resolve()
    }
}
```

- [ ] **Step 2: Register AudioFocusPlugin in MainActivity.kt**

Modify `android/app/src/main/java/com/correlogo/app/MainActivity.kt`:

```kotlin
package com.correlogo.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(TrackingPlugin::class.java)
        registerPlugin(AudioFocusPlugin::class.java)
    }
}
```

- [ ] **Step 3: Build check**

```bash
npx cap sync
cd android && ./gradlew assembleDebug
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/correlogo/app/AudioFocusPlugin.kt
git commit -m "feat(android): AudioFocusPlugin for audio ducking"
```

---
### Task 5: TypeScript Capacitor Wrappers

**Files:**
- Create: `src/lib/capacitor/platform.ts`
- Create: `src/lib/capacitor/tracking.ts`
- Create: `src/lib/capacitor/voice.ts`
- Create: `src/lib/capacitor/wakeLock.ts`
- Create: `src/lib/capacitor/notifications.ts`

- [ ] **Step 1: Create platform.ts**

```ts
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
```

- [ ] **Step 2: Create tracking.ts**

```ts
import { registerPlugin } from '@capacitor/core';

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  timestamp: number;
  steps?: number;
}

export interface StepUpdate {
  steps: number;
}

export interface TrackingPlugin {
  startTracking(): Promise<void>;
  stopTracking(): Promise<void>;
  getStepCount(): Promise<{ steps: number }>;
  addListener(eventName: 'locationUpdate', listener: (data: LocationUpdate) => void): Promise<void>;
  addListener(eventName: 'stepUpdate', listener: (data: StepUpdate) => void): Promise<void>;
  removeAllListeners(): Promise<void>;
  requestPermissions(): Promise<{ location: string }>;
}

const Tracking = registerPlugin<TrackingPlugin>('Tracking');

import { isNative } from './platform';

export type TrackCallback = (point: { lat: number; lng: number; timestamp: number; steps?: number }) => void;

export async function startTracking(onPosition: TrackCallback): Promise<{ stop: () => void }> {
  if (isNative()) {
    await Tracking.requestPermissions();
    await Tracking.startTracking();

    Tracking.addListener('locationUpdate', (data) => {
      onPosition({
        lat: data.latitude,
        lng: data.longitude,
        timestamp: data.timestamp,
        steps: data.steps,
      });
    });

    return {
      stop: async () => {
        await Tracking.stopTracking();
        await Tracking.removeAllListeners();
      },
    };
  }

  // Browser fallback
  let cleanup: (() => void) | null = null;

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      onPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: pos.coords.timestamp,
      });
    },
    (err) => console.error(err),
    { enableHighAccuracy: true },
  );

  cleanup = () => navigator.geolocation.clearWatch(watchId);

  return {
    stop: () => {
      if (cleanup) cleanup();
    },
  };
}
```

- [ ] **Step 3: Create voice.ts**

```ts
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { isNative } from './platform';

let audioFocus: any = null;

export async function speak(text: string, lang = 'pt-BR') {
  if (isNative()) {
    try {
      // Request audio focus (ducking) before speaking
      const { AudioFocus } = await import('../capacitor/audioFocus');
      await AudioFocus.requestFocus();

      await TextToSpeech.speak({ text, lang, rate: 1.1 });
    } finally {
      const { AudioFocus } = await import('../capacitor/audioFocus');
      await AudioFocus.abandonFocus();
    }
  } else {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => v.lang === 'pt-BR' && v.name.toLowerCase().includes('female'));
      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  }
}

export function stopSpeaking() {
  if (isNative()) {
    TextToSpeech.stop().catch(() => {});
  } else if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
```

Wait — the `AudioFocus` import is circular since it doesn't exist yet. Let me fix this. The `voice.ts` needs to import the Capacitor plugin directly, not through a file that might not exist. Let me restructure.

Actually, `AudioFocus` would be another `registerPlugin` call. But since we want `voice.ts` to handle the ducking inline, let me just register it inside `voice.ts`:

```ts
import { registerPlugin } from '@capacitor/core';
interface AudioFocusPlugin {
  requestFocus(): Promise<void>;
  abandonFocus(): Promise<void>;
}
const AudioFocus = registerPlugin<AudioFocusPlugin>('AudioFocus');
```

- [ ] **Step 4: Create wakeLock.ts**

```ts
import { KeepAwake } from '@capacitor-community/keep-awake';
import { isNative } from './platform';

export async function keepAwake() {
  if (isNative()) {
    await KeepAwake.keepAwake();
  } else if ('wakeLock' in navigator) {
    try {
      await (navigator as any).wakeLock.request('screen');
    } catch { /* not supported */ }
  }
}

export async function allowSleep() {
  if (isNative()) {
    await KeepAwake.allowSleep();
  }
}
```

- [ ] **Step 5: Create notifications.ts**

```ts
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './platform';

export async function scheduleWorkoutReminder(title: string, body: string, date: Date) {
  if (!isNative()) return;

  await LocalNotifications.schedule({
    notifications: [
      {
        title,
        body,
        id: 1,
        schedule: { at: date },
        sound: 'default',
      },
    ],
  });
}

export async function cancelAllNotifications() {
  if (!isNative()) return;
  await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
}
```

- [ ] **Step 6: Fix voice.ts to include AudioFocus registration inline**

```ts
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

interface AudioFocusPlugin {
  requestFocus(): Promise<void>;
  abandonFocus(): Promise<void>;
}

const AudioFocus = registerPlugin<AudioFocusPlugin>('AudioFocus');

export async function speak(text: string, lang = 'pt-BR') {
  if (isNative()) {
    try {
      await AudioFocus.requestFocus();
      await TextToSpeech.speak({ text, lang, rate: 1.1 });
    } finally {
      await AudioFocus.abandonFocus();
    }
  } else {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => v.lang === 'pt-BR' && v.name.toLowerCase().includes('female'));
      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  }
}

export function stopSpeaking() {
  if (isNative()) {
    TextToSpeech.stop().catch(() => {});
  } else if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/capacitor/
git commit -m "feat: Capacitor TS wrappers for tracking, voice, wakeLock, notifications"
```

---
### Task 6: React Integration — WorkoutTracker

**Files:**
- Modify: `src/components/WorkoutTracker.tsx`

This replaces `navigator.geolocation.watchPosition` and `speechSynthesis` calls with the Capacitor wrappers.

- [ ] **Step 1: Add imports**

```ts
import { startTracking, TrackCallback } from '../lib/capacitor/tracking';
import { speak, stopSpeaking } from '../lib/capacitor/voice';
```

- [ ] **Step 2: Replace GPS watchPosition block (lines ~120-134)**

Replace the `useEffect` that sets up `watchPosition`:

```ts
useEffect(() => {
    let lastCoords: {lat: number, lng: number} | null = null;
    let lastTime: number = Date.now();
    let cleanup: (() => void) | null = null;

    const handlePosition: TrackCallback = (pos) => {
      const now = pos.timestamp;
      setCoords({ lat: pos.lat, lng: pos.lng });
      setPath(p => [...p, { ...pos, timestamp: now, altitude: undefined }]);

      if (lastCoords) {
         const R = 6371;
         const dLat = (pos.lat - lastCoords.lat) * Math.PI / 180;
         const dLon = (pos.lng - lastCoords.lng) * Math.PI / 180;
         const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                   Math.cos(lastCoords.lat * Math.PI / 180) * Math.cos(pos.lat * Math.PI / 180) *
                   Math.sin(dLon/2) * Math.sin(dLon/2);
         const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
         const d = R * c;
         
         if (d > 0.001) {
           distRef.current += d;
           lapDistRef.current += d;
           const timeDiffHours = (now - lastTime) / 3600000;
           if (timeDiffHours > 0) {
             speedRef.current = d / timeDiffHours;
           }
         }
      }
      lastCoords = { lat: pos.lat, lng: pos.lng };
      lastTime = now;
    };

    if (simulateGps) {
      import('../lib/gpsSimulator').then(({ startGpsSimulation }) => {
        cleanup = startGpsSimulation({
          originLat: -15.7975,
          originLng: -47.8919,
          onPosition: (pos: GeolocationPosition) => handlePosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: pos.coords.timestamp,
          }),
          onError: (err) => console.error(err),
        });
      });
    } else {
      startTracking(handlePosition).then((tracker) => {
        cleanup = () => tracker.stop();
      });
    }

    return () => { if (cleanup) cleanup(); };
  }, [mode, simulateGps]);
```

- [ ] **Step 3: Replace speak function (lines ~235-252)**

Replace the `speak` function body:

```ts
const speak = (text: string, force = false) => {
    if (!force && (isFreeTraining || isExtended)) return;
    voiceSpeak(text, 'pt-BR');
  };
```

And rename the import to avoid naming conflict:

```ts
import { speak as voiceSpeak, stopSpeaking } from '../lib/capacitor/voice';
```

- [ ] **Step 4: Replace `window.speechSynthesis.cancel()` calls**

Find any direct calls to `speechSynthesis.cancel()` (line 238) in the existing `speak` function — since we replaced the whole function, this is handled by the wrapper.

- [ ] **Step 5: Commit**

```bash
git add src/components/WorkoutTracker.tsx
git commit -m "feat: integrate Capacitor tracking and voice in WorkoutTracker"
```

---
### Task 7: React Integration — App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add wakeLock management on workout start/stop**

Import at top:

```ts
import { keepAwake, allowSleep } from './lib/capacitor/wakeLock';
```

In `confirmWorkoutMode`, after `setActivePlan`:

```ts
if (mode === 'outdoor') {
  keepAwake();
}
```

When workout stops (where `setActivePlan(null)` is called after `onStop`), add:

```ts
allowSleep();
```

Find the `onStop` handler — it's passed to `WorkoutTracker`:

```tsx
<WorkoutTracker 
  key={activePlan.sessionId} 
  plan={activePlan.plan} 
  mode={activePlan.mode} 
  simulateGps={activePlan.simulateGps}
  onStop={() => { 
    allowSleep();
    setActivePlan(null); 
    setIsFreeTraining(false); 
  }} 
  ...
/>
```

- [ ] **Step 2: Remove the `navigator.geolocation.getCurrentPosition` call (line 297)**

Replace:

```ts
if (mode === 'outdoor') {
  navigator.geolocation.getCurrentPosition(() => {}, (err) => console.error(err));
}
```

With removal (permission request is handled by the Capacitor tracking plugin in Task 6):

```ts
if (mode === 'outdoor') {
  // Permission request handled by tracking plugin on first startTracking
}
```

Or just delete the entire `if` block.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate wakeLock and cleanup geolocation in App"
```

---
### Task 8: Full Build + Device Test

**Files:**
- None (verification only)

- [ ] **Step 1: Full rebuild**

```bash
npm run build
npx cap sync
npx cap run android
```

Expected: App builds and installs on connected device.

- [ ] **Step 2: Verify key flows on device**
  1. Login (email/Google) works
  2. Start outdoor workout → GPS permission dialog → tracking begins
  3. Lock screen → tracking continues (verify by unlocking and checking map)
  4. TTS announcements play over music (Spotify test)
  5. Step count appears in workout summary
  6. Screen stays on during workout
  7. End workout → tracking stops, wake lock released

- [ ] **Step 3: Verify browser still works**

```bash
npm run dev
```

Expected: App runs in browser without errors (all Capacitor code falls back).

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final build adjustments for Capacitor Android"
```

---
### Task 9: Notifications (Nice-to-have)

**Files:**
- Modify: `src/lib/capacitor/notifications.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add reminder scheduling on plan creation**

In `App.tsx`, inside `updatePlansState`, after saving plans:

```ts
import { scheduleWorkoutReminder } from './lib/capacitor/notifications';

// In updatePlansState, after successful save:
if (isNative()) {
  // Schedule reminder for next incomplete plan at 9am
  const today = new Date();
  const reminderTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0);
  if (Date.now() < reminderTime.getTime()) {
    scheduleWorkoutReminder(
      '🏃 Hora de treinar!',
      'Você tem um treino programado para hoje.',
      reminderTime
    );
  }
}
```

Note: `isNative()` needs to be imported where used, or we call through the wrapper directly.

- [ ] **Step 2: Commit**

```bash
git add src/lib/capacitor/notifications.ts src/App.tsx
git commit -m "feat: workout reminder notifications"
```
