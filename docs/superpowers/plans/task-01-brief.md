# Task 1: Fix step-index mapping in evaluatePerformance

**Files:**
- Modify: `src/lib/evaluatePerformance.ts:20-27`

**Steps:**

1. Change the iteration from filtered index to original plan index.
2. Run `npm run lint` to verify no type errors introduced.
3. Commit.

## Before code (current state):

```typescript
const runSteps = plan.steps.filter((s: WorkoutStep) => s.type === 'run');
const stepResults: StepEvaluation[] = [];
let completedRunSteps = 0;

runSteps.forEach((step: WorkoutStep, idx: number) => {
    const points = session.points.filter(p => p.stepIndex === idx);
```

## After code:

```typescript
const runStepsWithOrigIdx = plan.steps
    .map((step, originalIdx) => ({ step, originalIdx }))
    .filter(({ step }) => step.type === 'run');
const stepResults: StepEvaluation[] = [];
let completedRunSteps = 0;

runStepsWithOrigIdx.forEach(({ step, originalIdx }) => {
    const points = session.points.filter(p => p.stepIndex === originalIdx);
```

The rest of the forEach body (avg speed calc, targetPace, completed, push to results) stays identical.

**Verify:** `npm run lint` should show no new errors (two pre-existing errors in WorkoutTracker.tsx and vite.config.ts may still appear).

**Commit message:**
```
fix: step-index mismatch in performance evaluation
```

Important: read the full current file before editing — the line numbers are approximate. Change ONLY the forEach loop. Do not touch anything else.
