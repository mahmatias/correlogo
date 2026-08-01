import type { ActivityPoint, TrainingSession } from '../types';

export const PR_DISTANCES = [1, 2, 3, 4, 5, 10, 15, 21, 30, 35, 42];

export interface PrRecord {
  timeSeconds: number;
  sessionId: string;
  date: string;
  mode: 'treadmill' | 'outdoor';
}

export interface BadgeRecord {
  unlockedAt: string;
  sessionId: string;
}

export interface PrResult {
  distKm: number;
  timeSeconds: number;
}

export interface BadgeResult {
  id: string;
  label: string;
}

export interface Records {
  prs: Record<string, PrRecord>;
  longestDistance: {
    km: number;
    timeSeconds: number;
    sessionId: string;
    date: string;
    mode: 'treadmill' | 'outdoor';
  } | null;
  totalVolumeKm: number;
  badges: Record<string, BadgeRecord>;
  backfilled: boolean;
}

export const BADGE_LABELS: Record<string, string> = {
  firstRun: '1ª corrida',
  complete5k: 'Completei 5 km',
  complete10k: 'Completei 10 km',
  complete21k: 'Completei 21 km',
  complete42k: 'Completei 42 km',
  longest5: 'Maior distância · 5 km',
  longest10: 'Maior distância · 10 km',
  longest21: 'Maior distância · 21 km',
  longest42: 'Maior distância · 42 km',
  volume10: 'Acumulei 10 km',
  volume50: 'Acumulei 50 km',
  volume100: 'Acumulei 100 km',
  volume500: 'Acumulei 500 km',
  volume1000: 'Acumulei 1000 km',
  pace8: 'Ritmo ≤ 8:00',
  pace7: 'Ritmo ≤ 7:00',
  pace6: 'Ritmo ≤ 6:00',
  pace5: 'Ritmo ≤ 5:00',
};

export const BADGE_GROUPS: { id: string; label: string; ids: string[] }[] = [
  { id: 'corridas', label: 'Corridas', ids: ['firstRun', 'complete5k', 'complete10k', 'complete21k', 'complete42k'] },
  { id: 'distancia', label: 'Distância', ids: ['longest5', 'longest10', 'longest21', 'longest42'] },
  { id: 'volume', label: 'Volume', ids: ['volume10', 'volume50', 'volume100', 'volume500', 'volume1000'] },
  { id: 'ritmo', label: 'Ritmo', ids: ['pace8', 'pace7', 'pace6', 'pace5'] },
];

export function computeCrossingTime(points: ActivityPoint[], distKm: number): number | null {
  if (points.length < 2) return null;
  for (let i = 0; i < points.length; i++) {
    if (points[i].distanceKm >= distKm) {
      if (i === 0) return points[0].timestampSeconds;
      const prev = points[i - 1];
      const curr = points[i];
      const segDist = curr.distanceKm - prev.distanceKm;
      if (segDist <= 0) return null;
      const frac = (distKm - prev.distanceKm) / segDist;
      return prev.timestampSeconds + frac * (curr.timestampSeconds - prev.timestampSeconds);
    }
  }
  return null;
}

export function emptyRecords(): Records {
  return { prs: {}, longestDistance: null, totalVolumeKm: 0, badges: {}, backfilled: false };
}

export function applySessionToRecords(
  session: TrainingSession,
  current: Records,
): { records: Records; newPrs: PrResult[]; newBadges: BadgeResult[] } {
  const next: Records = {
    prs: { ...current.prs },
    longestDistance: current.longestDistance ? { ...current.longestDistance } : null,
    totalVolumeKm: current.totalVolumeKm,
    badges: { ...current.badges },
    backfilled: current.backfilled,
  };
  const newPrs: PrResult[] = [];
  const newBadges: BadgeResult[] = [];

  for (const D of PR_DISTANCES) {
    let crossing = computeCrossingTime(session.points, D);
    if (crossing === null && session.totalDistanceKm >= D && session.totalDurationSeconds > 0) {
      crossing = session.totalDurationSeconds * (D / session.totalDistanceKm);
    }
    if (crossing === null) continue;
    const existing = next.prs[String(D)];
    if (!existing || crossing < existing.timeSeconds) {
      next.prs[String(D)] = { timeSeconds: crossing, sessionId: session.id, date: session.date, mode: session.mode };
      newPrs.push({ distKm: D, timeSeconds: crossing });
    }
  }

  const isLongest = !next.longestDistance || session.totalDistanceKm > next.longestDistance.km;
  if (isLongest) {
    next.longestDistance = {
      km: session.totalDistanceKm,
      timeSeconds: session.totalDurationSeconds,
      sessionId: session.id,
      date: session.date,
      mode: session.mode,
    };
  }

  next.totalVolumeKm = next.totalVolumeKm + session.totalDistanceKm;

  const unlock = (id: string) => {
    if (next.badges[id]) return;
    next.badges[id] = { unlockedAt: session.date, sessionId: session.id };
    newBadges.push({ id, label: BADGE_LABELS[id] });
  };

  if (!next.badges.firstRun) unlock('firstRun');
  for (const t of [5, 10, 21, 42]) {
    if (session.totalDistanceKm >= t) unlock(`complete${t}k`);
  }
  for (const t of [5, 10, 21, 42]) {
    if (isLongest && next.longestDistance && next.longestDistance.km >= t) unlock(`longest${t}`);
  }
  for (const t of [10, 50, 100, 500, 1000]) {
    if (next.totalVolumeKm >= t) unlock(`volume${t}`);
  }
  if (session.totalDistanceKm > 0) {
    const avgPace = session.totalDurationSeconds / session.totalDistanceKm;
    for (const p of [8, 7, 6, 5]) {
      if (avgPace <= p * 60) unlock(`pace${p}`);
    }
  }

  return { records: next, newPrs, newBadges };
}
