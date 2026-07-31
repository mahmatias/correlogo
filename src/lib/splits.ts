import type { ActivityPoint, TrainingSession } from '../types';

export interface PaceBlock {
  label: string;
  paceSeconds: number | null;
}

interface KmBucket {
  startKm: number;
  endKm: number;
  pts: ActivityPoint[];
}

function bucketize(points: ActivityPoint[], blockKm: number, maxBlocks: number): KmBucket[] {
  const pts = points.filter(p => Number.isFinite(p.distanceKm) && p.distanceKm >= 0);
  if (pts.length < 2) return [];
  const totalKm = pts[pts.length - 1].distanceKm;
  if (totalKm <= 0) return [];
  const n = Math.min(maxBlocks, Math.max(1, Math.ceil(totalKm / blockKm)));
  const buckets: KmBucket[] = [];
  for (let i = 0; i < n; i++) {
    const startKm = i * blockKm;
    const endKm = i === n - 1 ? totalKm : startKm + blockKm;
    const bpts = pts.filter(p => p.distanceKm >= startKm && p.distanceKm <= endKm);
    buckets.push({ startKm, endKm, pts: bpts });
  }
  return buckets;
}

function bucketPace(bucket: KmBucket): number | null {
  const { pts } = bucket;
  if (pts.length < 2) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const dDelta = last.distanceKm - first.distanceKm;
  const tDelta = last.timestampSeconds - first.timestampSeconds;
  if (dDelta < 0.01 || tDelta <= 0) return null;
  return tDelta / dDelta;
}

export function pacePerKm(points: ActivityPoint[], maxBlocks = 10): PaceBlock[] {
  return bucketize(points, 1, maxBlocks).map(b => ({
    label: `KM ${Math.round(b.endKm)}`,
    paceSeconds: bucketPace(b),
  }));
}

export function pacePerGroup(points: ActivityPoint[], groupKm = 5, maxBlocks = 10): PaceBlock[] {
  return bucketize(points, groupKm, maxBlocks).map(b => {
    const full = Math.round(b.endKm) === Math.round(b.startKm + groupKm);
    const label = full
      ? `${Math.round(b.startKm) + 1}-${Math.round(b.endKm)}`
      : `${Math.round(b.startKm) + 1}`;
    return { label, paceSeconds: bucketPace(b) };
  });
}

export function choosePaceBlocks(session: TrainingSession): PaceBlock[] {
  const pts = session.points || [];
  const last = pts[pts.length - 1];
  const totalKm = last ? last.distanceKm : 0;
  if (pts.length >= 2 && totalKm > 0) {
    return totalKm <= 5 ? pacePerKm(pts, 10) : pacePerGroup(pts, 5, 10);
  }
  const pace = session.totalDistanceKm > 0 ? session.totalDurationSeconds / session.totalDistanceKm : null;
  return [{ label: 'GERAL', paceSeconds: pace }];
}

export function formatPaceShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}'${s.toString().padStart(2, '0')}"`;
}
