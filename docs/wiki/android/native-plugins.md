# Android - Native Plugins

## Plugin Registration (MainActivity.java)

```java
// android/app/src/main/java/com/correlogo/app/MainActivity.java
package com.correlogo.app;

import android.os.Bundle;
import com.capacitorjs.plugins.capacitor.CapacitorActivity;
import com.correlogo.app.HealthConnectPlugin;
import com.correlogo.app.TrackingPlugin;
import com.correlogo.app.PermissionsPlugin;
import com.correlogo.app.AudioFocusPlugin;

public class MainActivity extends CapacitorActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Registra plugins nativos
        registerPlugin(HealthConnectPlugin.class);
        registerPlugin(TrackingPlugin.class);
        registerPlugin(PermissionsPlugin.class);
        registerPlugin(AudioFocusPlugin.class);
    }
}
```

---

## Plugin Structure

Cada plugin segue padrão Capacitor 7:

```kotlin
// Template
@CapacitorPlugin(name = "PluginName", permissions = [...])
class PluginName : Plugin() {
    
    override fun load() {
        // Registra ActivityResultLauncher se necessário
    }
    
    @PluginMethod
    fun methodName(call: PluginCall) {
        // Lógica síncrona ou assíncrona
        call.resolve(JSObject().put("key", "value"))
        // ou call.reject("error message")
    }
}
```

---

## Plugins Implementados

| Plugin | Métodos | Permissions | Eventos |
|--------|---------|-------------|---------|
| `HealthConnectPlugin` | `isAvailable`, `requestHcPermissions`, `exportWorkout` | `health.READ_EXERCISE`, `health.WRITE_EXERCISE`, `health.WRITE_DISTANCE` | — |
| `TrackingPlugin` | `startTracking`, `stopTracking`, `getStepCount`, `openAppSettings`, `startNativeTimer`, `pauseNativeTimer`, `resumeNativeTimer`, `stopNativeTimer`, `startKeepAlive`, `stopKeepAlive` | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `ACTIVITY_RECOGNITION` | `locationUpdate`, `stepUpdate`, `timerTick` |
| `PermissionsPlugin` | `requestAllPermissions` | `POST_NOTIFICATIONS`, `ACTIVITY_RECOGNITION` | — |
| `AudioFocusPlugin` | `requestAudioFocus`, `abandonFocus`, `abandonAudioFocusOnPause` | — | — |
| `TreadmillBlePlugin` | `startBleScan`, `stopBleScan`, `connectToDevice`, `disconnectDevice`, `requestControl`, `setSpeed`, `setIncline`, `startWorkout`, `requestBlePermissions` | `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` (alias `bluetooth`) | `bleDeviceFound`, `bleStateChange`, `bleTelemetry`, `bleError` |
| `FirebaseAuth` | `signInWithGoogle`, `signOut`, `getCurrentUser` | — | `authStateChange` |

---

## Capacitor Config

```json
// capacitor.config.ts
{
  "appId": "com.correlogo.app",
  "appName": "Corre Logo",
  "webDir": "dist",
  "server": {
    "androidScheme": "https",
    "cleartext": true
  },
  "plugins": {
    "FirebaseAuthentication": {
      "skipNativeAuth": true,
      "providers": ["google.com"]
    },
    "Browser": {
      "windowName": "_self"
    },
    "SplashScreen": {
      "launchShowDuration": 0
    }
  }
}
```

---

## AndroidManifest.xml Essentials

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.correlogo.app">

    <!-- Permissões -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    <uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_HEALTH" />
    <uses-permission android:name="android.permission.health.READ_EXERCISE" />
    <uses-permission android:name="android.permission.health.WRITE_EXERCISE" />
    <uses-permission android:name="android.permission.health.WRITE_DISTANCE" />

    <!-- Health Connect provider visibility -->
    <queries>
        <package android:name="com.google.android.apps.healthdata" />
        <intent>
            <action android:name="android.health.action.SHOW_PERMISSIONS" />
        </intent>
    </queries>

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.AppCompat.NoActionBar">
        
        <!-- Google Services -->
        <meta-data android:name="com.google.android.gms.version"
                   android:value="@integer/google_play_services_version" />
        
        <!-- Deep Link -->
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
        
        <!-- HC Rationale Activity -->
        <activity
            android:name=".PermissionsRationaleActivity"
            android:exported="true"
            android:theme="@style/Theme.Transparent">
            <intent-filter>
                <action android:name="android.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </activity>
        
        <!-- Capacitor Plugins -->
        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id"
                   android:value="@string/default_notification_channel_id" />
    </application>
</manifest>
```

---

## Build Config

```gradle
// android/variables.gradle
ext {
    compileSdkVersion = 36
    targetSdkVersion = 36
    minSdkVersion = 26
    androidxActivityVersion = '1.9.0'
    androidxAppCompatVersion = '1.7.0'
    androidxCoreVersion = '1.13.0'
    googlePlayServicesAuthVersion = '21.2.0'
    googlePlayServicesLocationVersion = '21.2.0'
    healthConnectVersion = '1.1.0'
    coroutinesVersion = '1.8.1'
}

// android/app/build.gradle
android {
    compileSdk = rootProject.ext.compileSdkVersion
    defaultConfig {
        applicationId "com.correlogo.app"
        minSdk = rootProject.ext.minSdkVersion
        targetSdk = rootProject.ext.targetSdkVersion
        versionCode 19
        versionName "2.2"
    }
    
    signingConfigs {
        debug {
            storeFile file('../debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
}

dependencies {
    implementation "androidx.health.connect:connect-client:$healthConnectVersion"
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:$coroutinesVersion"
    implementation "com.google.android.gms:play-services-location:$googlePlayServicesLocationVersion"
    implementation "com.google.android.gms:play-services-auth:$googlePlayServicesAuthVersion"
    implementation "androidx.activity:activity-ktx:$androidxActivityVersion"
    // ... Capacitor deps
}
```

---

## Capacitor 7 Migration Notes

| Mudança | Antes (Cap 6) | Agora (Cap 7) |
|---------|---------------|---------------|
| Plugin registration | `registerPlugin(Plugin.class)` | Mesma, mas `load()` lifecycle |
| ActivityResult | `handleOnActivityResult` | `registerForActivityResult()` no `load()` |
| Permissions | `requestPermissions()` | `ActivityResultContracts.RequestMultiplePermissions()` |
| WebView | `androidScheme: 'http'` | `androidScheme: 'https'` + `cleartext: true` |

---

### TreadmillBlePlugin (Kotlin)

```kotlin
// android/app/.../TreadmillBlePlugin.kt
@CapacitorPlugin(name = "TreadmillBle", permissions = [
    Permission(alias = "bluetooth", strings = ["BLUETOOTH_SCAN", "BLUETOOTH_CONNECT"])
])
class TreadmillBlePlugin : Plugin() { ... }
```

### TreadmillBleService (GATT State Machine)

| State | Transition |
|-------|-----------|
| `DISCONNECTED` → scanning | `startBleScan` |
| Scanning → resolving | Device found with FTMS UUID (0x1826) |
| `RESOLVING` → `CONNECTING` | `connectGatt` |
| `CONNECTING` → `SERVICE_DISCOVERY` | `onConnectionStateChange(CONNECTED)` |
| `SERVICE_DISCOVERY` → `TREADMILL_DATA_FOUND` | `onServicesDiscovered` |
| `TREADMILL_DATA_FOUND` → `TREADMILL_DATA_CHAR_FOUND` | Get Treadmill Data char (0x2ACD) |
| `TREADMILL_DATA_CHAR_FOUND` → `CONTROL_POINT_FOUND` | Get Control Point char (0x2AD9) |
| `CONTROL_POINT_FOUND` → `READY` | Enable CCCD notifications |
| `READY` → `ACTIVE_SESSION` | `requestControl` handshake |
| `ACTIVE_SESSION` → `ACTIVE_SESSION_CONTROLLED` | Control granted response |

**Keep-alive**: Renovação de `Request Control` **por idle** — checa a cada 5s e só reenvia se `now - lastSuccessfulWriteMs >= 25s` (corrige GATT error 133; ver `docs/wiki/tracking/ftms.md`).

> ⚠️ A tabela de estados acima reflete a implementação antiga (pré-2026-08). O código atual usa `BleState.Disconnected → Connecting → Discovering → Ready → Controlled` com fila de writes serializada — ver `docs/wiki/tracking/ftms.md`.

**UUIDs**:
- Service: `00001826-0000-1000-8000-00805f9b34fb` (FTMS)
- Treadmill Data: `00002acd-0000-1000-8000-00805f9b34fb` (notification)
- Control Point: `00002ad9-0000-1000-8000-00805f9b34fb` (write/response)
- Treadmill Status: `00002acc-0000-1000-8000-00805f9b34fb`
- Speed Setting: `00002ad4-0000-1000-8000-00805f9b34fb` (write)
- Incline Setting: `00002ad5-0000-1000-8000-00805f9b34fb` (write)

---

*Última revisão: 2026-07-30*