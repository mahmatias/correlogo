# Task 2: Continue as free training after plan end

**Files:**
- Modify: `src/components/WorkoutTracker.tsx`

**Acceptance criteria:**
- When the last plan step finishes, instead of showing the completion modal, the workout continues as free training.
- The step label changes to "Corrida Livre".
- Audio announcements stop during the extension.
- The hold-to-finish button replaces the skip button.
- The pause button still works normally during extension.

**Line numbers are APPROXIMATE** — read the actual file and understand the structure before editing.

## Steps

### Step 1: Add `isExtended` state

Near the other `useState` calls (around line 30), add:
```typescript
const [isExtended, setIsExtended] = useState(false);
```

### Step 2: Replace plan-end completion with extension

Find where `isLastStep` is checked (around line 318). Currently:
```typescript
if (isLastStep) {
  setIsWorkoutCompleted(true);
  setIsPaused(true);
}
```

Change to:
```typescript
if (isLastStep) {
  setIsExtended(true);
}
```

### Step 3: Update `speak` guard to skip announcements in extended mode

Find the `speak` function guard (around line 233). Currently:
```typescript
if (!force && isFreeTraining) return;
```

Change to:
```typescript
if (!force && (isFreeTraining || isExtended)) return;
```

### Step 4: Show the finish button in extended mode

Find the conditional for pause/finish vs skip button (around line 525). Currently:
```tsx
{isPaused ? (
    <button onMouseDown={startFinish} ...> Finalizar treino </button>
) : (
    <button onClick={nextStep} disabled={...}> Próxima volta </button>
)}
```

Change condition to:
```tsx
{isPaused || isExtended ? (
    <button onMouseDown={startFinish} ...> Finalizar treino </button>
) : (
    <button onClick={nextStep} disabled={...}> Próxima volta </button>
)}
```

### Step 5: Update step label to show "Corrida Livre" when extended

Find the step label display (around line 446). Currently:
```tsx
<div className="text-center text-3xl font-bold text-accent-secondary mb-6 uppercase">
  {getStepTypeLabel(step.type)}
</div>
```

Change to:
```tsx
<div className="text-center text-3xl font-bold text-accent-secondary mb-6 uppercase">
  {isExtended ? 'Corrida Livre' : getStepTypeLabel(step.type)}
</div>
```

### Step 6: Run `npm run lint`

No new errors expected (the two pre-existing errors in WorkoutTracker.tsx and vite.config.ts may still appear).

### Step 7: Commit

```
git add src/components/WorkoutTracker.tsx
git commit -m "feat: continue as free training after plan end"
```

**Important:** Do not touch any other file. Do not change any existing behavior besides the 5 specific changes listed above.
