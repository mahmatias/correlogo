# Performance Panel Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the vertical-list performance panel in SessionSummary with a horizontal carousel of rich step cards.

**Architecture:** Two-file change: (1) extend `evaluatePerformance.ts` to compute per-step metrics (distance covered, avg speed/pace, duration, progress %), (2) modify `SessionSummary.tsx` to render cards in a CSS scroll-snap carousel.

**Tech Stack:** React, TypeScript, Tailwind (via `bg-*` classes), lucide-react icons.

## Global Constraints

- No new dependencies
- Follow existing code patterns (inline CSS via className/Tailwind, lucide-react for icons)
- Use `crypto.randomUUID()` if any new IDs needed (none expected)
- Must handle steps with `basis: 'distance'` and `basis: 'time'` (or undefined)

---

### Task 1: Extend evaluatePerformance.ts with richer step metrics

**Files:**
- Modify: `src/lib/evaluatePerformance.ts` — extend `StepEvaluation` and compute new fields
- No tests (test framework not configured)

**Interfaces:**
- Consumes: Existing `WorkoutStep`, `TrainingSession`, `ActivityPoint` types from `src/types.ts`
- Produces: Extended `StepEvaluation` with all per-step metrics; updated `evaluateSessionPerformance` return

- [ ] **Step 1: Extend StepEvaluation interface**

Add these fields to `StepEvaluation` in `src/lib/evaluatePerformance.ts`:

```typescript
export interface StepEvaluation {
  stepIndex: number;
  type: string;
  targetPace: number;
  actualAvgPace: number;
  completed: boolean;
  // new fields:
  distanceCovered: number;     // km
  avgSpeedKmh: number;
  durationInStep: number;      // seconds
  targetDistance?: number;     // km (from step.targetDistance)
  targetDuration: number;      // seconds (from step.durationSeconds)
  progressPct: number;         // 0-100 based on basis
}
```

- [ ] **Step 2: Update evaluateSessionPerformance to compute new fields**

Replace the function body in `src/lib/evaluatePerformance.ts`:

```typescript
export const evaluateSessionPerformance = (plan: WorkoutPlan, session: TrainingSession): PerformanceEvaluation => {
  const runStepsWithOrigIdx = plan.steps
    .map((step, originalIdx) => ({ step, originalIdx }))
    .filter(({ step }) => step.type === 'run');
  const stepResults: StepEvaluation[] = [];
  let completedRunSteps = 0;

  runStepsWithOrigIdx.forEach(({ step, originalIdx }) => {
    const points = session.points.filter(p => p.stepIndex === originalIdx);

    if (points.length === 0) {
      stepResults.push({
        stepIndex: originalIdx,
        type: 'run',
        targetPace: step.targetPace || 0,
        actualAvgPace: 0,
        completed: false,
        distanceCovered: 0,
        avgSpeedKmh: 0,
        durationInStep: 0,
        targetDistance: step.targetDistance,
        targetDuration: step.durationSeconds,
        progressPct: 0,
      });
      return;
    }

    const avgSpeedKmh = points.reduce((acc, p) => acc + p.speedKmh, 0) / points.length;
    const actualAvgPace = avgSpeedKmh > 0 ? (60 / avgSpeedKmh) : 0;

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const distanceCovered = Math.max(0, lastPoint.distanceKm - firstPoint.distanceKm);
    const durationInStep = Math.max(0, lastPoint.timestampSeconds - firstPoint.timestampSeconds);

    let progressPct = 0;
    if (step.basis === 'distance' && step.targetDistance && step.targetDistance > 0) {
      progressPct = Math.min(100, (distanceCovered / step.targetDistance) * 100);
    } else if (step.durationSeconds && step.durationSeconds > 0) {
      progressPct = Math.min(100, (durationInStep / step.durationSeconds) * 100);
    }

    const targetPace = step.targetPace || 0;
    const completed = actualAvgPace > 0 && actualAvgPace <= targetPace * 1.10;
    if (completed) completedRunSteps++;

    stepResults.push({
      stepIndex: originalIdx,
      type: 'run',
      targetPace,
      actualAvgPace,
      completed,
      distanceCovered,
      avgSpeedKmh,
      durationInStep,
      targetDistance: step.targetDistance,
      targetDuration: step.durationSeconds,
      progressPct,
    });
  });

  const completionRate = runStepsWithOrigIdx.length > 0 ? (completedRunSteps / runStepsWithOrigIdx.length) * 100 : 0;

  return {
    stepResults,
    totalRunSteps: runStepsWithOrigIdx.length,
    completedRunSteps,
    completionRate,
    needsAdjustment: runStepsWithOrigIdx.length > 0 && completionRate < 80,
  };
};
```

- [ ] **Step 3: Commit Task 1**

```bash
git add src/lib/evaluatePerformance.ts
git commit -m "feat: extend evaluatePerformance with rich per-step metrics"
```

---

### Task 2: Replace performance panel with horizontal card carousel

**Files:**
- Modify: `src/components/SessionSummary.tsx` — replace the vertical `evaluation.stepResults.map` block with carousel markup

**Interfaces:**
- Consumes: Extended `StepEvaluation` from Task 1 (`distanceCovered`, `avgSpeedKmh`, `durationInStep`, `progressPct`, etc.)
- Produces: Rendered carousel in SessionSummary

- [ ] **Step 1: Add imports for new components**

Add these to the existing imports at the top of `SessionSummary.tsx`:

```typescript
import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { getStepTypeLabel } from '../types';
```

`useState`, `lazy`, `Suspense` are already imported — replace the existing import line to add `useEffect` and `useRef`:

```typescript
import { useState, useEffect, lazy, Suspense, useRef } from 'react';
```

- [ ] **Step 2: Replace the evaluation panel with the carousel**

Replace lines 104-129 (the `{evaluation && (...)}` block) with the carousel version:

```typescript
        {evaluation && (
          <div className="p-4 rounded-xl mb-6 bg-bg-surface">
            <h3 className="font-bold mb-4">Desempenho vs Plano</h3>
            <div className="text-sm mb-3">{evaluation.completionRate.toFixed(0)}% dos steps concluídos no pace alvo</div>

            {/* scroll hint */}
            <ScrollHint visible={evaluation.stepResults.length > 1} />

            {/* carousel track */}
            <div
              className="flex gap-3 overflow-x-auto pb-3"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {evaluation.stepResults.map((res) => {
                const stepName = getStepTypeLabel(res.type);

                const barColor = res.completed
                  ? 'bg-success'
                  : res.actualAvgPace > 0 && res.actualAvgPace <= (res.targetPace || 0) * 1.25
                    ? 'bg-warning'
                    : 'bg-text-muted';

                return (
                  <div
                    key={res.stepIndex}
                    className="flex-shrink-0 w-[220px] rounded-xl bg-bg-elevated p-4 border border-border"
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    <div className="text-xs text-text-muted uppercase mb-1">Step {res.stepIndex + 1}</div>
                    <div className="text-base font-bold text-text-primary mb-3">{stepName}</div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div>
                        <div className="text-[10px] text-text-muted">Distância</div>
                        <div className="font-semibold text-text-primary">{formatDistance(res.distanceCovered)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-muted">Veloc. Média</div>
                        <div className="font-semibold text-text-primary">
                          {res.avgSpeedKmh > 0 ? `${res.avgSpeedKmh.toFixed(1)} km/h` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-muted">Ritmo Médio</div>
                        <div className="font-semibold text-text-primary">
                          {res.actualAvgPace > 0 ? `${formatDuration(Math.round(res.actualAvgPace * 60))} /km` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-muted">Duração</div>
                        <div className="font-semibold text-text-primary">
                          {res.durationInStep > 0 ? formatDuration(Math.round(res.durationInStep)) : '—'}
                        </div>
                      </div>
                    </div>

                    {/* progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-text-muted mb-1">
                        <span>Progresso</span>
                        <span>{Math.round(res.progressPct)}%</span>
                      </div>
                      <div className="h-1.5 bg-bg-deep rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor} transition-all duration-300`}
                          style={{ width: `${res.progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* status icon */}
                    <div className="mt-2 flex justify-end">
                      {res.completed
                        ? <CheckCircle className="text-success w-4 h-4" />
                        : <XCircle className="text-danger w-4 h-4" />
                      }
                    </div>
                  </div>
                );
              })}
            </div>

            {evaluation.needsAdjustment && (
              <div className="bg-warning/10 p-3 rounded-lg text-warning text-sm mt-3">
                A progressão atual parece acelerada para você. Deseja que os próximos treinos sejam ajustados?
                <button onClick={() => plan && onSuggestAdjustment?.(suggestAdjustment(plan))} className="block mt-2 font-bold underline">
                  Sugerir ajuste nos próximos treinos
                </button>
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 3: Add ScrollHint component**

Add this before the `export default function SessionSummary` (or at the bottom of the file):

```typescript
function ScrollHint({ visible }: { visible: boolean }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!visible) { setShow(false); return; }
    const timer = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!show) return null;

  return (
    <div className="text-center text-xs text-text-muted mb-2 animate-pulse flex items-center justify-center gap-2">
      <span>◀</span>
      <span>deslize para ver mais steps →</span>
      <span style={{ transform: 'scaleX(-1)' }}>◀</span>
    </div>
  );
}
```

- [ ] **Step 4: Build check**

Run the build to verify no TypeScript errors:

```bash
npm run build
```

Expected: build succeeds (no errors).

- [ ] **Step 5: Commit Task 2**

```bash
git add src/components/SessionSummary.tsx
git commit -m "feat: replace performance panel with horizontal card carousel"
```
