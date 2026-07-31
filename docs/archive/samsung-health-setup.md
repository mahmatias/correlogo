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
