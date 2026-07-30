# 5 Melhorias no Corre Logo — Implementation Plan

> **For agentic workers:** Use subagent-driven-development or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Implement 5 independent improvements: loading screen, photo CSP, APK export, reschedule cascade, audio ducking fix.

**Architecture:** 5 independent features touching Android native code, TypeScript components, and build configuration. Each task produces self-contained, testable changes.

**Tech Stack:** React + TypeScript, Capacitor Android, Kotlin/Java plugins, Gradle, Vite

**Spec:** `docs/superpowers/specs/2026-07-10-5-improvements-design.md`

## Global Constraints

- CSP meta tag in `index.html` must use `'self'` as default-src and allow `lh3.googleusercontent.com` for img-src
- Loading screen uses the existing seta-rastro SVG from the header (not a separate file)
- APK version extracted from `build.gradle` `versionName` field
- Reschedule cascade only affects plans with same `generatedFromProgramId`, ignores avulsos
- Audio ducking keeps `MAY_DUCK`, only changes `setWillPauseWhenDucked` + timer

---

### Task 1: CSP Meta Tag (Profile Photo Fix)

**Files:**
- Modify: `index.html` — add CSP meta tag

**Interfaces:** None (HTML change only)

- [ ] **Step 1: Add CSP meta tag to index.html**

Insert after the `apple-mobile-web-app-capable` meta tag:
```html
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data: https://lh3.googleusercontent.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self' https:">
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds, `dist/index.html` contains the new CSP meta tag.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: add CSP meta tag for Google profile photos in Capacitor WebView"
```

---

### Task 2: Loading Screen (Logo + Spinner)

**Files:**
- Modify: `src/App.tsx` — replace both skeleton blocks with logo+spinner screen

**Interfaces:** None (UI-only change)

- [ ] **Step 1: Find and replace the two skeleton blocks in App.tsx**

Replace the two identical skeleton sections:

Before (lines ~768-782):
```tsx
{checkingAuth || !user ? (
  checkingAuth ? (
    <div className="flex flex-col gap-4 pt-8 p-4">
      <div className="h-8 w-48 bg-bg-elevated rounded animate-pulse" />
      <div className="h-40 bg-bg-elevated rounded animate-pulse" />
      <div className="h-40 bg-bg-elevated rounded animate-pulse" />
    </div>
  ) : showSignup ? <Signup .../> : <Login .../>
) : isLoading ? (
  <div className="flex flex-col gap-4 pt-8 p-4">
    <div className="h-8 w-48 bg-bg-elevated rounded animate-pulse" />
    <div className="h-40 bg-bg-elevated rounded animate-pulse" />
    <div className="h-40 bg-bg-elevated rounded animate-pulse" />
  </div>
) : (...)}
```

After:
```tsx
{checkingAuth || !user ? (
  checkingAuth ? (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-deep p-4">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-16 h-16 mb-6" aria-hidden="true">
        <path d="M20 65 C30 65, 45 55, 55 45 C40 48, 30 45, 25 38 C40 38, 55 30, 85 20 C75 38, 60 62, 50 75 C52 65, 48 58, 42 56 C35 64, 25 65, 20 65 Z" fill="var(--color-accent)" />
        <path d="M15 50 C25 50, 35 43, 42 37 C35 39, 28 37, 25 33 C33 33, 45 27, 55 22 C48 32, 42 42, 38 48 C39 42, 36 38, 32 37 C28 44, 20 50, 15 50 Z" fill="var(--color-accent)" opacity="0.6" />
      </svg>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Corre Logo</h1>
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  ) : showSignup ? <Signup /> : <Login />
) : isLoading ? (
  <div className="flex flex-col items-center justify-center min-h-screen bg-bg-deep p-4">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-16 h-16 mb-6" aria-hidden="true">
      <path d="M20 65 C30 65, 45 55, 55 45 C40 48, 30 45, 25 38 C40 38, 55 30, 85 20 C75 38, 60 62, 50 75 C52 65, 48 58, 42 56 C35 64, 25 65, 20 65 Z" fill="var(--color-accent)" />
      <path d="M15 50 C25 50, 35 43, 42 37 C35 39, 28 37, 25 33 C33 33, 45 27, 55 22 C48 32, 42 42, 38 48 C39 42, 36 38, 32 37 C28 44, 20 50, 15 50 Z" fill="var(--color-accent)" opacity="0.6" />
    </svg>
    <h1 className="text-2xl font-bold text-text-primary mb-6">Corre Logo</h1>
    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
) : (...)}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: replace skeleton loading with logo+spinner screen"
```

---

### Task 3: APK Export Automation

**Files:**
- Create: `scripts/export-apk.ps1` — PowerShell script to extract version, copy APK, increment versionCode
- Modify: `package.json` — add `build:apk` script

**Interfaces:** None (build pipeline change)

- [ ] **Step 1: Read current android/app/build.gradle**

Confirm `versionName` and `versionCode` fields exist.

- [ ] **Step 2: Create scripts/export-apk.ps1**

```powershell
param()

$buildGradle = "android/app/build.gradle"
$content = Get-Content $buildGradle -Raw

# Extract versionName
$versionMatch = [regex]::Match($content, 'versionName "([^"]+)"')
$version = $versionMatch.Groups[1].Value

# Extract and increment versionCode
$codeMatch = [regex]::Match($content, 'versionCode (\d+)')
$oldCode = [int]$codeMatch.Groups[1].Value
$newCode = $oldCode + 1

# Copy APK to project root
$apk = "android/app/build/outputs/apk/debug/app-debug.apk"
$dest = "Corre Logo v$version.apk"
Copy-Item -Path $apk -Destination $dest -Force

# Increment versionCode in build.gradle
$content = $content -replace 'versionCode \d+', "versionCode $newCode"
Set-Content -Path $buildGradle -Value $content

Write-Host "APK exported to $dest"
Write-Host "versionCode: $oldCode -> $newCode"
```

- [ ] **Step 3: Add build:apk script to package.json**

Add to `scripts`:
```json
"build:apk": "npm run build && npx cap sync android && cd android && gradlew.bat assembleDebug && cd .. && powershell -ExecutionPolicy Bypass -File scripts/export-apk.ps1"
```

- [ ] **Step 4: Verify build:apk**

Run: `npm run build:apk`
Expected: Build + sync + assembleDebug pass. `Corre Logo v1.0.apk` appears in project root. versionCode incremented.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/export-apk.ps1
git commit -m "feat: add build:apk script with versioned APK export"
```

---

### Task 4: Audio Ducking Fix

**Files:**
- Modify: `android/app/src/main/java/com/correlogo/app/AudioFocusPlugin.kt` — `setWillPauseWhenDucked(false)` → `true`
- Modify: `src/lib/capacitor/voice.ts` — reduce timer to `max(500, text.length * 60)`

**Interfaces:** None (internal change)

- [ ] **Step 1: Read AudioFocusPlugin.kt**

Find the `requestFocus` method.

- [ ] **Step 2: Change `setWillPauseWhenDucked(false)` → `true`**

Edit the line:
```kotlin
.setWillPauseWhenDucked(true)
```

- [ ] **Step 3: Read and edit voice.ts timer**

Change:
```typescript
setTimeout(() => AudioFocus.abandonFocus(), Math.max(2000, text.length * 90));
```
To:
```typescript
setTimeout(() => AudioFocus.abandonFocus(), Math.max(500, text.length * 60));
```

- [ ] **Step 4: Build APK and verify**

Run: `npm run build:apk`
Expected: Clean assembleDebug passes.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/correlogo/app/AudioFocusPlugin.kt src/lib/capacitor/voice.ts
git commit -m "fix: audio ducking - setWillPauseWhenDucked(true) + reduce timer"
```

---

### Task 5: Reschedule Cascade

**Files:**
- Modify: `src/App.tsx` — refactor `handleDateChange`, update reschedule modal

**Interfaces:**
- Consumes: `plans` array, `updatePlansState`, `generatedFromProgramId` field on WorkoutPlan
- Produces: `handleDateChange(planId, newDate, mode)` where `mode: 'single' | 'cascade'`

- [ ] **Step 1: Add date helper functions before handleDateChange**

```tsx
const parseDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
const addDays = (date: string, days: number) => {
    const d = parseDate(date);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
```

- [ ] **Step 2: Refactor handleDateChange**

Replace the old function with:
```tsx
const handleDateChange = (planId: string, newDate: string, mode: 'single' | 'cascade' = 'single') => {
    if (!newDate) return;
    const targetPlan = plans.find(p => p.id === planId);
    if (!targetPlan || !targetPlan.scheduledDate) {
        const updated = plans.map(p => p.id === planId ? { ...p, scheduledDate: newDate } : p);
        updatePlansState(updated);
        return;
    }
    if (mode === 'single') {
        const updated = plans.map(p => p.id === planId ? { ...p, scheduledDate: newDate } : p);
        updatePlansState(updated);
        return;
    }
    const oldDate = targetPlan.scheduledDate;
    const delta = daysBetween(oldDate, newDate);
    const programId = targetPlan.generatedFromProgramId;
    const updated = plans.map(p => {
        if (p.id === planId) return { ...p, scheduledDate: newDate };
        if (programId && p.generatedFromProgramId === programId && p.scheduledDate && p.scheduledDate >= oldDate) {
            return { ...p, scheduledDate: addDays(p.scheduledDate, delta) };
        }
        return p;
    });
    updatePlansState(updated);
};
```

- [ ] **Step 3: Update the reschedule modal with two action buttons**

Replace the modal JSX:
```tsx
{reschedulePlanId && (
  <Modal open={!!reschedulePlanId} onClose={() => setReschedulePlanId(null)} title="Reagendar Treino">
    <div className="flex flex-col items-center gap-6">
      <p className="text-text-secondary text-sm text-center">
        Selecione a nova data para este treino.
      </p>
      <input
        type="date"
        defaultValue={plans.find(p => p.id === reschedulePlanId)?.scheduledDate || ''}
        autoFocus
        onChange={() => {}}
        style={{ colorScheme: 'dark' }}
        id="reschedule-date-input"
        className="w-full p-3 border border-border rounded-lg bg-bg-elevated text-text-primary text-base focus:outline-none focus:border-accent cursor-pointer"
      />
      <div className="flex flex-col gap-2 w-full">
        <Button
          variant="primary"
          className="w-full"
          onClick={() => {
            const input = document.getElementById('reschedule-date-input') as HTMLInputElement;
            if (input?.value) { handleDateChange(reschedulePlanId, input.value, 'single'); setReschedulePlanId(null); }
          }}
        >
          Reagendar apenas este
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            const input = document.getElementById('reschedule-date-input') as HTMLInputElement;
            if (input?.value) { handleDateChange(reschedulePlanId, input.value, 'cascade'); setReschedulePlanId(null); }
          }}
        >
          Reagendar este e seguintes
        </Button>
      </div>
      <Button variant="ghost" className="w-full" onClick={() => setReschedulePlanId(null)}>
        Cancelar
      </Button>
    </div>
  </Modal>
)}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add cascade reschedule mode for program workouts"
```
