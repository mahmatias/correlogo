import type { ActivityPoint } from '../types';
import { hrZone, type HrZone } from './hr-zones';

export interface HrSummary {
  avgHr: number;
  maxHr: number;
  minHr: number;
  samples: number;
  timeByZone: Record<HrZone, number>;
}

const VALID_MIN = 30;
const VALID_MAX = 240;
const MAX_DELTA_SECONDS = 10;

export function computeHrSummary(points: ActivityPoint[], hrMax: number): HrSummary | null {
  const samples: Array<{ ts: number; hr: number }> = [];
  for (const p of points) {
    if (p.heartRate && p.heartRate >= VALID_MIN && p.heartRate <= VALID_MAX) {
      samples.push({ ts: p.timestampSeconds, hr: p.heartRate });
    }
  }
  if (samples.length === 0) return null;

  const hrs = samples.map(s => s.hr);
  const avgHr = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);
  const maxHr = Math.max(...hrs);
  const minHr = Math.min(...hrs);

  const timeByZone: Record<HrZone, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (let i = 1; i < samples.length; i++) {
    const delta = Math.min(samples[i].ts - samples[i - 1].ts, MAX_DELTA_SECONDS);
    if (delta <= 0) continue;
    const zone = hrZone(samples[i].hr, hrMax);
    if (zone) timeByZone[zone] += delta;
  }

  return { avgHr, maxHr, minHr, samples: samples.length, timeByZone };
}
