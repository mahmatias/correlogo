# Build - Scripts

## package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "tsc --noEmit",
    "build:apk": "npm run build && npx cap sync android && cd android && gradlew.bat assembleDebug && cd .. && powershell -ExecutionPolicy Bypass -File scripts/export-apk.ps1",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## export-apk.ps1

```powershell
# scripts/export-apk.psx
param()

$buildGradle = "android/app/build.gradle"
$content = Get-Content $buildGradle -Raw

# Extrai versionName
$versionMatch = [regex]::Match($content, 'versionName "([^"]+)"')
$version = $versionMatch.Groups[1].Value

# Incrementa versionCode
$codeMatch = [regex]::Match($content, 'versionCode (\d+)')
$oldCode = [int]$codeMatch.Groups[1].Value
$newCode = $oldCode + 1

# Copia APK
$apk = "android/app/build/outputs/apk/debug/app-debug.apk"
$dest = "Corre Logo v$version.apk"
Copy-Item -Path $apk -Destination $dest -Force

# Atualiza versionCode
$content = $content -replace 'versionCode \d+', "versionCode $newCode"
Set-Content -Path $buildGradle -Value $content

Write-Host "APK exported to $dest"
Write-Host "versionCode: $oldCode -> $newCode"
```

---

## Pipeline APK Completo

```bash
# 1. Environment
Copy-Item -Path ".env.apk" -Destination ".env" -Force

# 2. Build Web
npm run build

# 3. Sync Capacitor
npx cap sync android

# 4. Build APK
cd android
./gradlew clean assembleDebug

# 5. Export
Copy-Item "app/build/outputs/apk/debug/app-debug.apk" "Corre Logo v{version}.apk"
```

---

## Gradle Config

### android/variables.gradle
```groovy
ext {
    compileSdk = 36
    targetSdk = 36
    minSdk = 26
    androidxActivityVersion = '1.9.0'
    androidxCoreVersion = '1.12.0'
}
```

### android/app/build.gradle
```groovy
android {
    compileSdk rootProject.ext.compileSdk
    defaultConfig {
        applicationId "com.correlogo.app"
        minSdk rootProject.ext.minSdk
        targetSdk rootProject.ext.targetSdk
        versionCode project.findProperty('ciVersionCode')?.toInteger() ?: 19
        versionName "3.4"
        multiDexEnabled true
    }
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
    }
}

dependencies {
    implementation "androidx.health.connect:connect-client:1.1.0"
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1"
    implementation "com.google.android.gms:play-services-location:21.0.1"
    implementation "com.google.firebase:firebase-auth:23.0.0"
}
```

---

## Capacitor Sync

```bash
npx cap sync android
# Copia dist/ → android/app/src/main/assets/public
# Atualiza plugins nativos
# Gera capacitor.config.json
```

---

## Build Outputs

| Arquivo | Localização | Tamanho |
|---------|-------------|---------|
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` | ~9 MB |
| Release APK (CI) | `android/app/build/outputs/apk/release/app-release.apk` | assinado |
| Mapping | `android/app/build/outputs/mapping/debug/mapping.txt` | - |

---

## Versioning

| Version | Code | Data | Notas |
|---------|------|------|-------|
| 3.4 | 135 | 2026-07-31 | PNG transparente (só texto) + intent IG spec |
| 3.3 | 134 | 2026-07-31 | Fix overlay mapa/modal (`relative z-0`) |
| 3.2 | 133 | 2026-07-31 | Auto-update bootstrap (`REQUEST_INSTALL_PACKAGES`) |
| 3.1 | 132 | 2026-07-31 | Fix SocialSharePlugin registrado no MainActivity |
| 3.0.2 | 131 | 2026-07-30 | Auto-update via CapacitorHttp (bypass CORS) |
| 3.0.1 | 130 | 2026-07-30 | Cache-buster + erro visível no update |
| 3.0 | 129 | 2026-07-30 | Instagram Stories + Copiar PNG modo Foto |
| 2.3 | 20 | 2026-07-30 | CI/CD GitHub Actions |
| 2.2 | 19 | 2026-07-30 | Refresh Token OAuth + FTMS UUID fix |
| 2.1 | 18 | 2026-07-29 | HC route fallback |

> `versionCode` local (debug) = 19 fixo; no **CI** é `GITHUB_RUN_NUMBER + 100` via `-PciVersionCode` (Release `latest`).

---

*Última revisão: 2026-07-31*