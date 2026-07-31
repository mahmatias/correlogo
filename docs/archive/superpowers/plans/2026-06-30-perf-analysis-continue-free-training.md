# Performance Analysis Bug Fix + Continue as Free Training — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix wrong step-index mapping in performance evaluation and allow the user to keep running past the plan end.

**Architecture:** Two independent modifications to existing files — a mapping fix in `evaluatePerformance.ts` and a state/UX change in `WorkoutTracker.tsx`.

**Tech Stack:** TypeScript, React

## Global Constraints

- No new dependencies
- No new files
- Follow existing patterns — types, naming, conventions

---

### Task 1: Fix step-index mapping in evaluatePerformance

**Files:**
- Modify: `src/lib/evaluatePerformance.ts:20-27`

**Interfaces:**
- Consumes: `WorkoutPlan`, `TrainingSession` (types unchanged)
- Produces: `PerformanceEvaluation.stepResults` now correctly maps run steps to their data

- [ ] **Step 1: Change iteration from filtered index to original plan index**

Current code:
```typescript
const runSteps = plan.steps.filter((s: WorkoutStep) => s.type === 'run');
const stepResults: StepEvaluation[] = [];
let completedRunSteps = 0;

runSteps.forEach((step: WorkoutStep, idx: number) => {
    const points = session.points.filter(p => p.stepIndex === idx);
```

Replace with map-filter that preserves the original plan step index:
```typescript
const runStepsWithOrigIdx = plan.steps
    .map((step, originalIdx) => ({ step, originalIdx }))
    .filter(({ step }) => step.type === 'run');
const stepResults: StepEvaluation[] = [];
let completedRunSteps = 0;

runStepsWithOrigIdx.forEach(({ step, originalIdx }) => {
    const points = session.points.filter(p => p.stepIndex === originalIdx);
```

- [ ] **Step 2: Run `npm run lint` to verify no type errors introduced**

Run: `npm run lint`
Expected: No new errors (the two pre-existing errors may still show).

- [ ] **Step 3: Commit**

```bash
git add src/lib/evaluatePerformance.ts
git commit -m "fix: step-index mismatch in performance evaluation

The forEach loop on filtered runSteps used the filtered array index
to look up ActivityPoint.stepIndex, but points record the original
plan step index. Map-filter preserves the original index for correct
data matching."
```

---

### Task 2: Continue as free training after plan end

**Files:**
- Modify: `src/components/WorkoutTracker.tsx:318-320` (line numbers from current file — adjust if they shift)

**Interfaces:**
- Consumes: existing props (`WorkoutPlan`, callbacks) unchanged
- Produces: `isExtended` state; updated UI when workout continues past plan end

- [ ] **Step 1: Add `isExtended` state**

Add near line 30 (the other `useState` calls):
```typescript
const [isExtended, setIsExtended] = useState(false);
```

- [ ] **Step 2: Replace plan-end completion with extension**

At line 318-320, change:
```typescript
if (isLastStep) {
  setIsWorkoutCompleted(true);
  setIsPaused(true);
}
```

To:
```typescript
if (isLastStep) {
  setIsExtended(true);
}
```

- [ ] **Step 3: Update `speak` guard to skip announcements in extended mode**

At line 233, change:
```typescript
if (!force && isFreeTraining) return;
```

To:
```typescript
if (!force && (isFreeTraining || isExtended)) return;
```

- [ ] **Step 4: Update the skip button to show the finish button in extended mode**

At the conditional block around line 525-545, change the condition so the
finish button appears both when paused AND when extended. The current code:

```tsx
{isPaused ? (
    <button onMouseDown={startFinish} ...> Finalizar treino </button>
) : (
    <button onClick={nextStep} disabled={...}> Próxima volta </button>
)}
```

Change to show the finish button when extended regardless of pause state:
```tsx
{isPaused || isExtended ? (
    <button onMouseDown={startFinish} ...> Finalizar treino </button>
) : (
    <button onClick={nextStep} disabled={...}> Próxima volta </button>
)}
```

- [ ] **Step 5: Update step label to show "Corrida Livre" when extended**

Change the step label display (around line 446) to check `isExtended`:

Current:
```tsx
<div className="text-center text-3xl font-bold text-accent-secondary mb-6 uppercase">
  {getStepTypeLabel(step.type)}
</div>
```

Add `isExtended` check:
```tsx
<div className="text-center text-3xl font-bold text-accent-secondary mb-6 uppercase">
  {isExtended ? 'Corrida Livre' : getStepTypeLabel(step.type)}
</div>
```

- [ ] **Step 6: Run `npm run lint` to verify no type errors introduced**

Run: `npm run lint`
Expected: No new errors (the two pre-existing errors may still show).

- [ ] **Step 7: Commit**

```bash
git add src/components/WorkoutTracker.tsx
git commit -m "feat: continue as free training after plan end

When the last plan step finishes, instead of showing the completion
modal, the workout continues as free training. The hold-to-finish
button replaces the skip button, and the label switches to 'Corrida
Livre'. Audio announcements stop during the extension."
```

---

### Task 3: Deploy to production

- [ ] **Step 1: Push to origin**

```bash
git push origin main
```

- [ ] **Step 2: Deploy on server via SSH**

SSH to server, pull, build, restart:
```bash
cd /opt/correlogo
git pull origin main
sudo npm run build
sudo -n bash -c 'export NODE_ENV=production; pm2 restart correlogo --update-env'
```

- [ ] **Step 3: Verify via curl**

```bash
curl -s --max-time 10 https://correlogo.sytes.net/
```

Expected: New bundle hash in `index-*.js` and `SessionSummary-*.js`.
