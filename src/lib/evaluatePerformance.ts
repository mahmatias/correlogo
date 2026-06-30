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
  const runStepsWithOrigIdx = plan.steps
    .map((step, originalIdx) => ({ step, originalIdx }))
    .filter(({ step }) => step.type === 'run');
  const stepResults: StepEvaluation[] = [];
  let completedRunSteps = 0;

  runStepsWithOrigIdx.forEach(({ step, originalIdx }) => {
    const points = session.points.filter(p => p.stepIndex === originalIdx);
    
    if (points.length === 0) {
      stepResults.push({ stepIndex: originalIdx, type: 'run', targetPace: step.targetPace || 0, actualAvgPace: 0, completed: false });
      return;
    }

    const avgSpeedKmh = points.reduce((acc, p) => acc + p.speedKmh, 0) / points.length;
    const actualAvgPace = avgSpeedKmh > 0 ? (60 / avgSpeedKmh) : 0;
    
    const targetPace = step.targetPace || 0;
    const completed = actualAvgPace > 0 && actualAvgPace <= targetPace * 1.10;
    
    if (completed) completedRunSteps++;
    
    stepResults.push({
      stepIndex: originalIdx,
      type: 'run',
      targetPace,
      actualAvgPace,
      completed
    });
  });

  const completionRate = runStepsWithOrigIdx.length > 0 ? (completedRunSteps / runStepsWithOrigIdx.length) * 100 : 0;

  return {
    stepResults,
    totalRunSteps: runStepsWithOrigIdx.length,
    completedRunSteps,
    completionRate,
    needsAdjustment: runStepsWithOrigIdx.length > 0 && completionRate < 80
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
