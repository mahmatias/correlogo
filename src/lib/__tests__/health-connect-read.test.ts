import { describe, it, expect } from 'vitest';
import { dedupeImportedWorkouts, watchWorkoutToSession } from '../watch-import';
import type { TrainingSession, WatchWorkout } from '../../types';

const wk = (over: Partial<WatchWorkout> = {}): WatchWorkout => ({
  id: 'hc-1', exerciseType: 'running', startTimeMs: 1_000_000, endTimeMs: 2_000_000,
  durationSeconds: 1000, distanceKm: 3.1, ...over,
});

const session = (over: Partial<TrainingSession> = {}): TrainingSession => ({
  id: 's1', planId: 'p1', planName: 'Treino', date: new Date(1_000_000).toISOString(),
  mode: 'outdoor', totalDurationSeconds: 1000, totalDistanceKm: 3.1,
  avgSpeedKmh: 10, completed: true, points: [], ...over,
});

describe('watchWorkoutToSession', () => {
  it('mapeia para TrainingSession outdoor com source watch', () => {
    const s = watchWorkoutToSession(wk({ id: 'abc' }));
    expect(s.id).toBe('watch-abc');
    expect(s.mode).toBe('outdoor');
    expect(s.source).toBe('watch');
    expect(s.planName).toBe('Treino do relógio');
    expect(s.planId).toBe('watch-import');
    expect(s.totalDistanceKm).toBe(3.1);
    expect(s.totalDurationSeconds).toBe(1000);
  });

  it('calcula avgSpeedKmh a partir de distance e duration', () => {
    const s = watchWorkoutToSession(wk({ distanceKm: 5, durationSeconds: 1800 }));
    expect(s.avgSpeedKmh).toBeCloseTo(10, 1);
  });

  it('avgSpeedKmh = 0 quando distance = 0 (SpeedRecord fallback do HC)', () => {
    const s = watchWorkoutToSession(wk({ distanceKm: 0, durationSeconds: 1800 }));
    expect(s.avgSpeedKmh).toBe(0);
  });

  it('avgSpeedKmh = 0 quando duration = 0 (divisão protegida)', () => {
    const s = watchWorkoutToSession(wk({ distanceKm: 3, durationSeconds: 0 }));
    expect(s.avgSpeedKmh).toBe(0);
    expect(s.totalDistanceKm).toBe(3);
  });
});

describe('dedupeImportedWorkouts', () => {
  it('exclui treino já importado pelo id', () => {
    const existing = [session({ id: 'watch-hc-1' })];
    expect(dedupeImportedWorkouts(existing, [wk({ id: 'hc-1' })])).toHaveLength(0);
  });
  it('exclui por horário de início ±2min', () => {
    const existing = [session({ date: new Date(1_000_000 + 120_000).toISOString() })];
    expect(dedupeImportedWorkouts(existing, [wk()])).toHaveLength(0);

    const near = [session({ date: new Date(1_000_000 + 119_000).toISOString() })];
    expect(dedupeImportedWorkouts(near, [wk()])).toHaveLength(0);
  });
  it('mantém treino sem conflito', () => {
    const existing = [session({ date: new Date(999_999_999_999).toISOString() })];
    expect(dedupeImportedWorkouts(existing, [wk({ id: 'hc-9' })])).toHaveLength(1);
  });
});
