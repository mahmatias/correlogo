# Performance Analysis Bug Fix + Continue as Free Training

## Overview

Two independent changes to the workout tracking flow: (1) fix a data-mapping bug in
`evaluateSessionPerformance` that compares real pace against the wrong plan step,
and (2) allow the user to keep running past the end of a planned workout without
immediately showing the completion modal.

---

## 1. Performance Analysis Bug Fix

### Problem

`evaluatePerformance.ts:27` filters `plan.steps` to only `type: 'run'` steps, then
iterates with `forEach((step, idx) => ...)`. The `idx` is the index inside the
**filtered** array, but `ActivityPoint.stepIndex` records the **original** plan
step index (from `WorkoutTracker.tsx:162` — `stepIndex: currentStepIndex`).

For a plan with warmup → run → walk → run → walk → run → cooldown:

| Plan index | Type    | runSteps idx | Points have stepIndex | Matches? |
|------------|---------|-------------|----------------------|----------|
| 0          | walk    | —           | 0                    | —        |
| 1          | run     | 0           | 1                    | ❌ (idx 0 ≠ 1) |
| 2          | walk    | —           | 2                    | —        |
| 3          | run     | 1           | 3                    | ❌ (idx 1 ≠ 3) |
| 4          | walk    | —           | 4                    | —        |
| 5          | run     | 2           | 5                    | ❌ (idx 2 ≠ 5) |

The first run step ends up reading walk points (step 0), giving real pace ≈8.82
for the user's walk data. The second and third run steps either read the wrong
step's data or none (0.00).

### Design

Replace the filtered `forEach` with a `map + filter` that preserves the original
step index:

```typescript
const runStepsWithOrigIdx = plan.steps
    .map((step, originalIdx) => ({ step, originalIdx }))
    .filter(({ step }) => step.type === 'run');
```

Iterate `runStepsWithOrigIdx` and use `originalIdx` to match
`ActivityPoint.stepIndex`. All other logic (`targetPace`, `actualAvgPace`,
`completed`, `completionRate`) stays identical.

### Scope

- File changed: `src/lib/evaluatePerformance.ts`
- No changes to types, other components, or session data format.
- The display in `SessionSummary.tsx` needs no changes — it already renders
  whatever `stepResults` returns.

---

## 2. Continue as Free Training After Plan Ends

### Problem

When the timer reaches the end of the last step, the app immediately shows the
"Treino Finalizado" modal (`setIsWorkoutCompleted(true)` + `setIsPaused(true)`).
The user cannot extend the workout (e.g. cool down longer, run extra distance).

### Design

When the last step completes, instead of showing the completion modal:

1. **Do not mark as completed.** Keep the timer running.
2. **Switch to free-training mode** internally (`isFreeTraining = true` pattern).
3. **The existing hold-to-finish button** (long press 2 s) becomes the only way
   to end the workout — it already calls `setIsWorkoutCompleted(true)` through
   the `finishProgress >= 100` effect.
4. **Visual changes:**
   - The step label changes to "Corrida Livre" (the `isFreeTraining` branch in
     the marquee already handles this).
   - The progress bars show total elapsed time / distance instead of step-based
     progress.
   - A subtle indicator appears: "Treino concluído. Corrida livre." (voice
     announcement `speak("", true)` if the plan just ended).
5. **Audio announcements** stop — the `speak` function gains a guard that also
   skips when `isExtended && !force`, so no automated step/pacing announcements
   fire during overtime (same behavior as `isFreeTraining`).

### State changes

Add `isExtended` boolean to `WorkoutTracker` (internal state, distinct from the
`isFreeTraining` prop passed by the parent — that indicates the user chose
"Treino Livre" on creation, while `isExtended` means the planned workout is
over and the user is now in overtime):

```typescript
const [isExtended, setIsExtended] = useState(false);
```

When the last step completes (line 318), instead of:

```typescript
setIsWorkoutCompleted(true);
setIsPaused(true);
```

Do:

```typescript
setIsExtended(true);
// keep timer running, isPaused stays false
```

The UI adapts:
- **Step label**: `isExtended ? 'Corrida Livre' : getStepTypeLabel(step.type)`
- **Progress bar**: if `isExtended`, show total elapsed bar (already works with
  `((elapsedSeconds + skippedTime) / totalWorkoutTime) * 100`)
- **Main action button**: when `isExtended`, the "Próxima volta" skip button is
  replaced by the hold-to-finish button (the same `onMouseDown={startFinish}`
  handler used in the paused state), so the user can finish at any time without
  having to pause first.
- **Pause button** stays available for manual pausing.
- **The `speak()` guard** is updated: `if (!force && (isFreeTraining || isExtended)) return`

### Edge cases

| Case | Behavior |
|------|----------|
| User extends then holds finish for 2 s | Shows normal completion modal (save/discard). Session data includes the extended time. |
| User pauses during extension | Pause button works normally |
| User refreshes page during extension | Session lost (same as today — no partial save) |
| Free training was already active | Not affected — the feature only applies to planned workouts |

### Scope

- File changed: `src/components/WorkoutTracker.tsx`
- No changes to types, SessionSummary, or data flow.
- The finish button and completion modal already exist — they are reused.

---

## Implementation Order

1. Fix the `evaluatePerformance` bug (1 file, ~5 lines changed).
2. Implement "Continue as Free Training" (1 file, ~15 lines changed).
3. No new dependencies. No new files.

## Testing

- Both changes are in core workout logic: verify by running a planned workout
  in the browser and checking the Resumo da Sessão for correct step comparison,
  and that the "Continue" flow lets you extend past the plan end.
