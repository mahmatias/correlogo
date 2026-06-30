export const formatDuration = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatDistance = (distKm: number) => {
  if (distKm < 1) {
    return `${Math.round(distKm * 1000)}m`;
  } else {
    return `${distKm.toFixed(2).replace('.', ',')} km`;
  }
};

export const getStepDurationSeconds = (step: WorkoutStep): number => {
  if (step.durationSeconds) return step.durationSeconds;
  const speedKmh = 60 / (step.targetPace || 1);
  return ((step.targetDistance || 0) / speedKmh) * 3600;
};

export const formatTotalDuration = (seconds: number) => {
  const totalMins = Math.ceil(seconds / 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}hs ${mins > 0 ? mins+'min' : ''}`;
  return `${totalMins}min`;
};

export interface WorkoutStep {
  id: string;
  type: 'warmup' | 'run' | 'rest' | 'cooldown';
  durationSeconds: number;
  targetPace?: number; // min/km
  targetDistance?: number; // km
  basis?: 'time' | 'distance'; // undefined = 'time' (padrão)
}

// Tradução do tipo de etapa apenas para exibição na tela. O código interno
// (lógica de progressão, comparações, etc.) sempre trabalha com os valores
// em inglês ('warmup' | 'run' | 'rest' | 'cooldown'); esta função é o único
// lugar que converte para o nome em português mostrado ao usuário final.
const STEP_TYPE_LABELS_PT: Record<WorkoutStep['type'], string> = {
  warmup: 'Aquecimento',
  run: 'Corrida',
  rest: 'Caminhada',
  cooldown: 'Desaquecimento',
};

export const getStepTypeLabel = (type: string): string => {
  return STEP_TYPE_LABELS_PT[type as WorkoutStep['type']] ?? type;
};

export interface WorkoutPlan {
  id: string;
  name: string;
  steps: WorkoutStep[];
  isCompleted?: boolean;
  programName?: string;
  activityName?: string;
  activityNumber?: string;
  manual?: boolean;
}

export interface ActivityPoint {
  timestampSeconds: number;
  speedKmh: number;
  distanceKm: number;
  stepIndex: number;
  lat?: number;
  lon?: number;
  altitude?: number;
  heartRate?: number;
  cadence?: number;
}

export interface TrainingSession {
  id: string;
  planId: string;
  planName: string;
  planSteps?: WorkoutStep[];
  date: string;
  mode: 'treadmill' | 'outdoor';
  trainingType?: 'time' | 'distance'; // mantido para compatibilidade com sessões antigas
  totalDurationSeconds: number;
  totalDistanceKm: number;
  avgSpeedKmh: number;
  completed: boolean;
  points: ActivityPoint[];
}

export type TrainingPhase = 'base' | 'build' | 'peak' | 'taper';

export interface ProgramWeek {
  weekNumber: number;
  phase: TrainingPhase;
  isRecoveryWeek: boolean;
  plans: WorkoutPlan[];
}

export interface TrainingProgram {
  id: string;
  name: string;
  goal: {
    raceDistance: 'none' | '5k' | '10k' | '21k' | '42k';
    targetPace?: number;
    targetDistance?: number;
  };
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  referenceRace: { distanceKm: number; timeSeconds: number };
  daysOfWeek: number[];
  mode: 'outdoor' | 'treadmill' | 'both';
  raceDate?: string;
  weeks: ProgramWeek[];
  createdAt: number;
}

