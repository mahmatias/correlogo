# Performance Panel — Horizontal Carousel Redesign

**Date:** 2026-07-01
**Status:** Draft

## Problem

The current performance panel in `SessionSummary.tsx` shows step-by-step evaluation as a vertical list with raw pace numbers. It's information-dense but hard to scan — the user can't quickly compare steps or see distance/pace/progress at a glance.

## Design

Replace the vertical list with a **horizontal carousel of cards** (one per run step). The carousel uses native CSS `overflow-x: auto` + `scroll-snap-type: x mandatory` — zero dependencies.

### Card Contents

Each card shows:

| Field | Source | Format |
|---|---|---|
| Step name | `getStepTypeLabel(step.type)` | e.g. "Aquecimento" |
| Step # | Step index + 1 | "Step 2" |
| Distance covered | Sum of delta distances for points with `stepIndex === originalIdx` | `formatDistance()` |
| Avg speed | Mean of `speedKmh` for matching points | `X.X km/h` |
| Avg pace | `60 / avgSpeedKmh` | `formatDuration()` |
| Duration | Time in step (max - min timestamp for matching points) | `formatDuration()` |
| Progress bar | % of step completed based on `basis` | Green/yellow/gray bar |
| Status | Within target pace? | Check/X icon |

### Progress Bar Logic

- **`basis: 'distance'`** — progress = `distanceCovered / step.targetDistance`
- **`basis: 'time'`** or **undefined** — progress = `stepDuration / step.durationSeconds`
- Bar color:
  - ≥90% of target pace met → green (`#4ade80`)
  - 80-90% → yellow (`#facc15`)
  - <80% → gray (`#6b7280`)

### Scroll Hint

On mount, show a subtle animated indicator ("◀ deslize →") that fades out after 3s. On mobile, the indicator is always visible as dots below the carousel.

### Edge Cases

- **No points for a step** → show "--" for all values, 0% gray bar
- **Single step** → carousel collapses to one card, scroll hint hidden
- **Mixed basis** in same plan → progress bar automatically adapts per card
- **planSteps not available** → fall back to current `plan` prop (existing behavior)

## Data Flow

```
evaluateSessionPerformance()
  → returns extended StepEvaluation[] with:
      stepIndex, type, targetPace, actualAvgPace,
      distanceCovered, avgSpeedKmh, durationInStep,
      targetDistance, targetDuration, completed, progressPct
  → rendered as cards in SessionSummary
```

## Changes Required

### 1. `src/lib/evaluatePerformance.ts`
- Extend `StepEvaluation` interface with: `distanceCovered`, `avgSpeedKmh`, `durationInStep`, `targetDistance`, `targetDuration`, `progressPct`
- Compute new fields from `step.basis` and matching points

### 2. `src/components/SessionSummary.tsx`
- Replace lines 104-129 (vertical `evaluation.stepResults.map`) with carousel markup
- Add inline CSS for `overflow-x: auto; scroll-snap-type: x mandatory;`
- Add scroll-hint animation (useEffect + fade-out timer)
- Keep "X% dos steps concluídos no pace alvo" header and "Sugerir ajuste" button unchanged

### 3. `src/types.ts`
- No changes needed — `WorkoutStep.basis` is already defined

## Non-Goals

- No new dependencies (no `embla-carousel`, `swiper`, etc.)
- No changes to the pace graph or elevation profile (below the panel, unchanged)
- No changes to evaluation logic or `suggestAdjustment`
- No changes to map, export, or stats summary cards
