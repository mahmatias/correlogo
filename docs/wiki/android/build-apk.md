# Android - Build & Deploy APK

## Pipeline Completo

```bash
# 1. Copia env de produção
Copy-Item .env.apk .env -Force

# 2. Build web
npm run build

# 3. Sync Capacitor
npx cap sync android

# 4. Build APK
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
cd android
.\gradlew assembleDebug

# 5. Exporta com nome versionado
# scripts/export-apk.ps1 extrai versionName, copia APK, incrementa versionCode
```

---

## export-apk.ps1

```powershell
# scripts/export-apk.ps1
$buildGradle = "android/app/build.gradle"
$content = Get-Content $buildGradle -Raw

$versionMatch = [regex]::Match($content, 'versionName "([^"]+)"')
$version = $versionMatch.Groups[1].Value

$codeMatch = [regex]::Match($content, 'versionCode (\d+)')
$oldCode = [int]$codeMatch.Groups[1].Value
$newCode = $oldCode + 1

$apk = "android/app/build/outputs/apk/debug/app-debug.apk"
$dest = "Corre Logo v$version.apk"
Copy-Item -Path $apk -Destination $dest -Force

$content = $content -replace 'versionCode \d+', "versionCode $newCode"
Set-Content -Path $buildGradle -Value $content

Write-Host "APK exported to $dest"
Write-Host "versionCode: $oldCode -> $newCode"
```

---

## Versionamento

| Arquivo | Campo | Atualização |
|---------|-------|-------------|
| `android/app/build.gradle` | `versionCode` | Auto-increment (+1) via `export-apk.ps1` |
| `android/app/build.gradle` | `versionName` | Manual (semver) |

### Exemplo
```
v2.0  → versionCode 11
v2.1  → versionCode 18
v2.2  → versionCode 19
```

---

## Debug Keystore

```bash
# Gera novo debug keystore
keytool -genkey -v -keystore debug.keystore -alias androiddebugkey \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass android -keypass android \
  -dname "CN=Android Debug,O=Android,C=US"

# SHA-1
keytool -list -v -keystore debug.keystore -storepass android
# SHA-1: 7E:AD:85:85:52:D9:F3:2C:59:E4:93:73:12:31:9B:28:8C:86:BE:C6
```

> Registrar SHA-1 no Firebase Console → Project Settings → Android App

---

## Google Services

```bash
# Baixar google-services.json do Firebase Console
# Projeto: correlogo-prod
# Package: com.correlogo.app
# SHA-1: 7E:AD:85:85:52:D9:F3:2C:59:E4:93:73:12:31:9B:28:8C:86:BE:C6

# Colocar em:
android/app/google-services.json
```

---

## Gradle Commands

| Comando | Descrição |
|---------|-----------|
| `.\gradlew clean` | Limpa build |
| `.\gradlew assembleDebug` | Build debug APK |
| `.\gradlew assembleRelease` | Build release APK (precisa signing config) |
| `.\gradlew installDebug` | Instala no device conectado |
| `.\gradlew dependencies` | Lista dependências |

---

## ADB Commands

```bash
# Listar devices
adb devices

# Instalar APK
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Logs
adb logcat -s "CorreLogo*" "Tracking*" "HealthConnect*"

# Desinstalar
adb uninstall com.correlogo.app

# Screenshot
adb exec-out screencap -p > screen.png
```

---

## Device Testing

```bash
# Conectar device via USB (USB Debugging on)
# Verificar device
adb devices

# Install + Launch
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.correlogo.app/com.capacitorjs.plugins.capacitor.CapacitorActivity

# Logs filtrados
adb logcat -s "CorreLogo" "Tracking" "HealthConnect" "FirebaseAuth" "Chromium" "Capacitor"
```

---

## Release Build (Futuro)

```gradle
// android/app/build.gradle
signingConfigs {
    release {
        storeFile file('release.keystore')
        storePassword '****'
        keyAlias 'release'
        keyPassword '****'
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

```bash
# Gerar release keystore
keytool -genkey -v -keystore release.keystore -alias release \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass **** -keypass **** \
  -dname "CN=Corre Logo,O=Corre Logo,C=BR"
```

---

## CI/CD (GitHub Actions - Futuro)

```yaml
# .github/workflows/android.yml
name: Android Build
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: '21', distribution: 'temurin' }
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build
      - run: npx cap sync android
      - run: cd android && ./gradlew assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
```

---

*Última revisão: 2026-07-29*