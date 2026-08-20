import type { TrainingSession, WatchWorkout } from '../types';

const DEDUPE_WINDOW_MS = 2 * 60 * 1000;

export function dedupeImportedWorkouts(existing: TrainingSession[], workouts: WatchWorkout[]): WatchWorkout[] {
  const result = workouts.filter(w => {
    if (existing.some(s => s.id === `watch-${w.id}`)) return false;
    const wStart = w.startTimeMs;
    return !existing.some(s => {
      const sStart = new Date(s.date).getTime();
      return Math.abs(sStart - wStart) <= DEDUPE_WINDOW_MS;
    });
  });
  if (result.length < workouts.length) {
    console.log(`[watch-import] dedup: ${workouts.length} → ${result.length} (${workouts.length - result.length} filtered)`);
  }
  return result;
}

export function watchWorkoutToSession(w: WatchWorkout): TrainingSession {
  const durationSeconds = w.durationSeconds;
  return {
    id: `watch-${w.id}`,
    planId: 'watch-import',
    planName: 'Treino do relógio',
    date: new Date(w.startTimeMs).toISOString(),
    mode: 'outdoor',
    totalDurationSeconds: durationSeconds,
    totalDistanceKm: w.distanceKm,
    avgSpeedKmh: durationSeconds > 0 ? w.distanceKm / (durationSeconds / 3600) : 0,
    completed: true,
    points: [],
    source: 'watch',
  };
}
