import { WorkoutPlan, TrainingSession, ActivityPoint, WorkoutStep } from '../types';

export interface StepEvaluation {
  stepIndex: number;
  type: string;
  targetPace: number;
  actualAvgPace: number;
  completed: boolean;
}

export interface PerformanceEvaluation {
  stepResults: StepEvaluation[];
  totalRunSteps: number;
  completedRunSteps: number;
  completionRate: number;
  needsAdjustment: boolean;
}

export const evaluateSessionPerformance = (plan: WorkoutPlan, session: TrainingSession): PerformanceEvaluation => {
  const runSteps = plan.steps.filter((s: WorkoutStep) => s.type === 'run');
  const stepResults: StepEvaluation[] = [];
  let completedRunSteps = 0;

  runSteps.forEach((step: WorkoutStep, idx: number) => {
    // Need a way to match step to points. Assuming points have stepIndex.
    // If not, we might need another strategy, but let's assume points have stepIndex for now as per requirement.
    const points = session.points.filter(p => p.stepIndex === idx);
    
    if (points.length === 0) {
      stepResults.push({ stepIndex: idx, type: 'run', targetPace: step.targetPace || 0, actualAvgPace: 0, completed: false });
      return;
    }

    const avgSpeedKmh = points.reduce((acc, p) => acc + p.speedKmh, 0) / points.length;
    const actualAvgPace = avgSpeedKmh > 0 ? (60 / avgSpeedKmh) : 0;
    
    // Pace is min/km. Actual pace should be <= Target Pace * 1.1 (if faster is better)
    const targetPace = step.targetPace || 0;
    const completed = actualAvgPace > 0 && actualAvgPace <= targetPace * 1.10;
    
    if (completed) completedRunSteps++;
    
    stepResults.push({
      stepIndex: idx,
      type: 'run',
      targetPace,
      actualAvgPace,
      completed
    });
  });

  const completionRate = runSteps.length > 0 ? (completedRunSteps / runSteps.length) * 100 : 0;

  return {
    stepResults,
    totalRunSteps: runSteps.length,
    completedRunSteps,
    completionRate,
    needsAdjustment: runSteps.length > 0 && completionRate < 80
  };
};

export const suggestAdjustment = (plan: WorkoutPlan): WorkoutPlan => {
  const adjustedSteps = plan.steps.map(step => {
    if (step.type === 'run') {
      return {
        ...step,
        durationSeconds: Math.round(step.durationSeconds * 0.8),
        targetPace: (step.targetPace || 0) * 1.1 // Making it slower (higher pace)
      };
    }
    return step;
  });

  return {
    ...plan,
    id: crypto.randomUUID(),
    name: `${plan.name} (Ajustado)`,
    steps: adjustedSteps,
    isCompleted: false
  };
};
