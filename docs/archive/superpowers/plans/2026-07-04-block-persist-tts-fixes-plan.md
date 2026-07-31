# Block Persist + TTS Fixes Implementation Plan

> **For agentic workers:** Inline execution in current session.

**Goal:** Persist block structure to Firestore, fix TTS duration units, make TTS use km/h on treadmill

**Architecture:** Add `blocks` field to WorkoutPlan (optional, backward-compat). Fix TTS by replacing colon-format `formatDurationTts` with natural-language `formatDurationSpeech`. Add mode-conditional pace/speed formatting in TTS announcements.

**Tech Stack:** TypeScript, React, Firebase/Firestore, Web Speech API

## Global Constraints

- Backward compatibility: old plans without `blocks` must still work in the editor
- Speed units on treadmill: 1 decimal place (e.g., "5,0 quilômetros por hora")
- TTS must still say "Pace X" for outdoor mode
- `stripUndefined` will strip `blocks` if undefined (Firestore-safe)

---

### Task 1: Add `StepBlock` type and `blocks` field to `WorkoutPlan`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add `StepBlock` interface**

```typescript
export interface StepBlock {
  repeat: number;
  steps: WorkoutStep[];
}
```

- [ ] **Step 2: Add `blocks?` to `WorkoutPlan`**

```typescript
export interface WorkoutPlan {
  id: string;
  name: string;
  steps: WorkoutStep[];
  blocks?: StepBlock[];       // <-- add this
  isCompleted?: boolean;
  // ... rest unchanged
```

- [ ] **Step 3: Commit**

### Task 2: Save blocks from WorkoutEditor

**Files:**
- Modify: `src/components/WorkoutEditor.tsx`

- [ ] **Step 1: Include `blocks` in `handleSave`**

Change:
```typescript
onSave({ id: initialPlan?.id || crypto.randomUUID(), name: safeName, steps: flatSteps, manual: true });
```
To:
```typescript
onSave({ id: initialPlan?.id || crypto.randomUUID(), name: safeName, steps: flatSteps, blocks: blocks, manual: true });
```

- [ ] **Step 2: Commit**

### Task 3: Fix TTS duration and add km/h on treadmill

**Files:**
- Modify: `src/components/WorkoutTracker.tsx`

- [ ] **Step 1: Replace `formatDurationTts` with `formatDurationSpeech` in step-change announcement (line 289)**

Change line 289:
```
speak(`Volta atual ${isDistBasis ? formatDistanceTts(targetDist) : formatDurationTts(stepDuration)} de ${ptType}${currentStep.targetPace ? ` Pace ${currentStep.targetPace}` : ''}`);
```
To use `formatDurationSpeech` and mode-aware pace/speed:
```
const paceTtText = currentStep.targetPace
  ? (mode === 'treadmill'
    ? ` a ${(60 / currentStep.targetPace).toFixed(1).replace('.', ',')} quilômetros por hora`
    : ` Pace ${currentStep.targetPace}`)
  : '';
speak(`Volta atual ${isDistBasis ? formatDistanceTts(targetDist) : formatDurationSpeech(stepDuration)} de ${ptType}${paceTtText}`);
```

- [ ] **Step 2: Replace `formatDurationTts` with `formatDurationSpeech` in "almost there" announcement (line 312)**

Change line 312:
```
const nextObj = nextIsDist ? formatDistanceTts(getStepTargetDistance(next)) : formatDurationTts(getStepDurationSeconds(next));
speak(`${prefix}Próxima volta: ${nextObj} de ${nextLabel}${next.targetPace ? ` Pace ${next.targetPace}` : ''}`);
```
To:
```
const nextSpeed = next.targetPace ? (60 / next.targetPace).toFixed(1).replace('.', ',') : '';
const nextPaceText = next.targetPace
  ? (mode === 'treadmill'
    ? ` a ${nextSpeed} quilômetros por hora`
    : ` Pace ${next.targetPace}`)
  : '';
const nextObj = nextIsDist ? formatDistanceTts(getStepTargetDistance(next)) : formatDurationSpeech(getStepDurationSeconds(next));
speak(`${prefix}Próxima volta: ${nextObj} de ${nextLabel}${nextPaceText}`);
```

- [ ] **Step 3: Remove dead `formatDurationTts` function (lines 262-266) and dead `speedKmh` variable (line 286)**

- [ ] **Step 4: Commit**

### Task 4: Build, commit & deploy

- [ ] **Step 1:** Build
- [ ] **Step 2:** Update CHANGELOG.md, commit all changes, push
- [ ] **Step 3:** Deploy to production
