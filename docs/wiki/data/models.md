# Data Models - Tipos Centrais

## TrainingSession

```typescript
interface TrainingSession {
  id: string;                         // UUID ou 'local-<timestamp>'
  planId: string;                     // FK para WorkoutPlan
  planName: string;                   // Denormalizado (plano pode ser deletado)
  planSteps?: WorkoutStep[];          // Snapshot dos passos
  date: string;                       // ISO 8601 date (YYYY-MM-DD)
  mode: 'treadmill' | 'outdoor';
  trainingType?: 'time' | 'distance'; // Legacy
  totalDurationSeconds: number;
  totalDistanceKm: number;
  avgSpeedKmh: number;
  completed: boolean;
  points: ActivityPoint[];            // Série temporal completa
  syncStatus?: 'synced' | 'pending' | 'failed';
}
```

## ActivityPoint (um ponto por segundo)

```typescript
interface ActivityPoint {
  timestampSeconds: number;   // Segundos desde início do treino
  speedKmh: number;           // Velocidade instantânea
  distanceKm: number;         // Distância acumulada
  stepIndex: number;          // Qual passo do plano estava ativo
  lat?: number;               // Só outdoor
  lon?: number;               // Só outdoor
  altitude?: number;          // Opcional
  heartRate?: number;         // Futuro: sensor BLE
  cadence?: number;           // Futuro: acelerômetro
}
```

## WorkoutPlan

```typescript
interface WorkoutPlan {
  id: string;                   // UUID
  name: string;
  steps: WorkoutStep[];
  blocks?: StepBlock[];         // Repetições (ex: 3x [corrida, caminhada])
  isCompleted?: boolean;
  programName?: string;
  activityName?: string;
  activityNumber?: string;
  manual?: boolean;             // Criado manualmente vs gerado
  scheduledDate?: string;       // YYYY-MM-DD
  isRaceMarker?: boolean;       // Marcador visual calendário
  generatedFromProgramId?: string;
}
```

## WorkoutStep

```typescript
interface WorkoutStep {
  id: string;
  type: 'warmup' | 'run' | 'rest' | 'cooldown';
  durationSeconds: number;
  targetPace?: number;          // min/km
  targetDistance?: number;      // km
  basis?: 'time' | 'distance';  // default: 'time'
}
```

## StepBlock

```typescript
interface StepBlock {
  repeat: number;
  steps: WorkoutStep[];
}
```

## TrainingProgram

```typescript
interface TrainingProgram {
  id: string;
  name: string;
  goal: {
    raceDistance: 'none' | '5k' | '10k' | '21k' | '42k';
    targetPace?: number;
    targetDistance?: number;
  };
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  referenceRace: { distanceKm: number; timeSeconds: number };
  daysOfWeek: number[];         // 0=Dom ... 6=Sáb
  mode: 'outdoor' | 'treadmill' | 'both';
  raceDate?: string;
  weeks: ProgramWeek[];
  createdAt: number;
}
```

## ProgramWeek

```typescript
interface ProgramWeek {
  weekNumber: number;
  phase: TrainingPhase;
  isRecoveryWeek: boolean;
  plans: WorkoutPlan[];
}
```

## TrainingPhase

```typescript
type TrainingPhase = 'base' | 'build' | 'peak' | 'taper';
```

## ProfileData

```typescript
interface ProfileData {
  displayName: string;
  dob: string | null;           // YYYY-MM-DD
  gender: string | null;
  city: string | null;
  state: string | null;
  photoURL: string | null;
  weightInKg: number | null;
  updatedAt?: number;
}
```

## SettingsData

```typescript
interface SettingsData {
  isDarkMode: boolean;
  distanceUnit: 'km' | 'mi';
  paceUnit: 'per_km' | 'per_mi';
  weightUnit: 'kg' | 'lb';
}
```

## Sync Types (Health Connect / Gmail)

```typescript
// src/lib/capacitor/health-connect.ts
interface WorkoutExport {
  startTime: number;        // Date.now() início
  endTime: number;          // Date.now() fim
  durationSeconds: number;
  distanceKm: number;
  exerciseType: 'treadmill' | 'running';
  avgSpeedKmh: number;
  route?: RoutePoint[];     // Só outdoor
}

interface RoutePoint {
  lat: number;
  lng: number;
  altitude?: number;
  timestamp: number;        // Date.now()
}

type SyncStatus = 'synced' | 'pending' | 'failed';
```

## Gmail API Types

```typescript
// src/lib/gmailApi.ts
interface GmailSendResult {
  success: boolean;
  error?: string;
}
```

## Firestore Collections

```
users/{uid}/
├── data/
│   ├── profile          # ProfileData
│   └── settings         # SettingsData
├── plans/{planId}       # WorkoutPlan
├── sessions/{sessionId} # TrainingSession
└── programs/{programId} # TrainingProgram
```

## Regras de Persistência

| Dado | Local | Firestore | Sync |
|------|-------|-----------|------|
| Plans | `correlogo:plans:{uid}` | `users/{uid}/plans` | Merge (local + remote) |
| Sessions | `correlogo:sessions:{uid}` | `users/{uid}/sessions` | `local-*` prefix → upload; cache com downsample dos points (2026-09-04) |
| Profile | `correlogo:profile:{uid}` | `users/{uid}/data/profile` | Last write wins |
| Settings | `correlogo:settings:{uid}` | `users/{uid}/data/settings` | Last write wins |
| Dark Mode | `correlogo:darkMode:{uid}` | - | Local only |

---

*Última revisão: 2026-09-04*