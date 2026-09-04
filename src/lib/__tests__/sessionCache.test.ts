import { describe, it, expect } from 'vitest';
import { downsamplePoints, buildCacheSessions } from '../sessionCache';
import type { ActivityPoint, TrainingSession } from '../../types';

function pts(n: number): ActivityPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    timestampSeconds: i,
    speedKmh: 10,
    distanceKm: i / 1000,
    stepIndex: 0,
  }));
}

function session(id: string, date: string, points: ActivityPoint[]): TrainingSession {
  return {
    id,
    planId: 'p1',
    planName: 'Treino',
    date,
    mode: 'outdoor',
    totalDurationSeconds: 3600,
    totalDistanceKm: 10,
    avgSpeedKmh: 10,
    completed: true,
    points,
  };
}

describe('downsamplePoints', () => {
  it('retorna os points intactos quando dentro do limite', () => {
    const p = pts(100);
    expect(downsamplePoints(p, 200)).toHaveLength(100);
    expect(downsamplePoints(p, 200)).toBe(p);
  });

  it('reduz para o max preservando primeiro e último', () => {
    const p = pts(1000);
    const out = downsamplePoints(p, 200);
    expect(out).toHaveLength(200);
    expect(out[0]).toBe(p[0]);
    expect(out[out.length - 1]).toBe(p[999]);
  });

  it('trata max === 1 e max === 0', () => {
    const p = pts(100);
    expect(downsamplePoints(p, 1)).toEqual([p[0]]);
    expect(downsamplePoints(p, 0)).toEqual([]);
  });
});

describe('buildCacheSessions', () => {
  it('preserva local-* com points completos sempre', () => {
    const local = session('local-1', '2026-09-01T10:00:00Z', pts(3000));
    const remote = session('r1', '2026-09-02T10:00:00Z', pts(3000));
    const out = buildCacheSessions([remote, local]);
    expect(out.find((s) => s.id === 'local-1')!.points).toHaveLength(3000);
    expect(out.find((s) => s.id === 'local-1')).toBe(local);
  });

  it('mantém points completos nas recentes e faz downsample nas antigas', () => {
    const recent = session('r1', '2026-09-02T10:00:00Z', pts(3000));
    const older = session('r2', '2026-08-01T10:00:00Z', pts(3000));
    // 5 sessões ainda mais recentes empurram r2 para fora da janela "recentes"
    const evenNewer = Array.from({ length: 4 }, (_, i) =>
      session(`rn${i}`, `2026-09-0${i + 3}T10:00:00Z`, pts(10)),
    );
    const out = buildCacheSessions([...evenNewer, recent, older]);
    expect(out.find((s) => s.id === 'r1')!.points).toHaveLength(3000);
    expect(out.find((s) => s.id === 'r2')!.points).toHaveLength(200);
  });

  it('limita a contagem total do cache', () => {
    const many = Array.from({ length: 70 }, (_, i) => session(`r${i}`, `2026-01-0${(i % 9) + 1}T10:00:00Z`, pts(10)));
    const out = buildCacheSessions(many);
    expect(out.length).toBeLessThanOrEqual(50);
  });
});
