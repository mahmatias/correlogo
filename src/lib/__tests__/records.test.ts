import { describe, it, expect } from 'vitest';
import { PR_DISTANCES, computeCrossingTime } from '../records';
import type { ActivityPoint } from '../../types';

function pts(distances: number[], timestamps: number[]): ActivityPoint[] {
  return distances.map((distanceKm, i) => ({
    timestampSeconds: timestamps[i],
    speedKmh: 10,
    distanceKm,
    stepIndex: 0,
  }));
}

describe('PR_DISTANCES', () => {
  it('tem as 11 distâncias do spec', () => {
    expect(PR_DISTANCES).toEqual([1, 2, 3, 4, 5, 10, 15, 21, 30, 35, 42]);
  });
});

describe('computeCrossingTime', () => {
  it('interpola linearmente entre dois pontos conhecidos', () => {
    const points = pts([0, 1, 2, 3], [0, 600, 1200, 1800]);
    expect(computeCrossingTime(points, 1.5)).toBeCloseTo(900, 3);
    expect(computeCrossingTime(points, 2.5)).toBeCloseTo(1500, 3);
  });

  it('retorna o timestamp do primeiro ponto quando i === 0', () => {
    const points = pts([3, 5], [60, 120]);
    expect(computeCrossingTime(points, 2)).toBe(60);
  });

  it('retorna null quando a distância nunca é atingida', () => {
    const points = pts([0, 3, 6], [0, 300, 600]);
    expect(computeCrossingTime(points, 10)).toBeNull();
  });

  it('retorna null com menos de 2 pontos', () => {
    expect(computeCrossingTime([], 5)).toBeNull();
    expect(computeCrossingTime(pts([3], [60]), 5)).toBeNull();
  });
});
