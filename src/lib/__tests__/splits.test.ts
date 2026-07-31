import { describe, it, expect } from 'vitest';
import { pacePerKm, pacePerGroup, choosePaceBlocks, formatPaceShort } from '../splits';
import type { ActivityPoint, TrainingSession } from '../../types';

// 5km com 1 ponto a cada 500m, pace uniforme 5:00/km (150s por 0.5km)
function uniformPoints(totalKm: number, paceSec = 300, stepKm = 0.5): ActivityPoint[] {
  const pts: ActivityPoint[] = [];
  const steps = Math.ceil(totalKm / stepKm);
  for (let i = 0; i <= steps; i++) {
    const dist = Math.min(i * stepKm, totalKm);
    pts.push({
      timestampSeconds: dist * paceSec,
      speedKmh: 60 / (paceSec / 60),
      distanceKm: dist,
      stepIndex: 0,
    });
  }
  return pts;
}

describe('pacePerKm', () => {
  it('bucketa por km com pace uniforme (5:00/km)', () => {
    const blocks = pacePerKm(uniformPoints(5), 10);
    expect(blocks).toHaveLength(5);
    for (const b of blocks) {
      expect(b.paceSeconds).toBeCloseTo(300, 0);
    }
    expect(blocks.map(b => b.label)).toEqual(['KM 1', 'KM 2', 'KM 3', 'KM 4', 'KM 5']);
  });

  it('funciona em esteira (pontos sem lat/lon)', () => {
    const blocks = pacePerKm(uniformPoints(3), 10);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].paceSeconds).toBeCloseTo(300, 0);
  });

  it('cobre km parcial final (3.2km -> 4 blocos)', () => {
    const blocks = pacePerKm(uniformPoints(3.2), 10);
    expect(blocks).toHaveLength(4);
    expect(blocks[3].paceSeconds).toBeCloseTo(300, 0);
  });

  it('retorna null de pace quando o bloco não tem pontos suficientes', () => {
    const pts: ActivityPoint[] = [
      { timestampSeconds: 0, speedKmh: 10, distanceKm: 0, stepIndex: 0 },
      { timestampSeconds: 300, speedKmh: 10, distanceKm: 1, stepIndex: 0 },
      { timestampSeconds: 600, speedKmh: 10, distanceKm: 3, stepIndex: 0 },
    ];
    const blocks = pacePerKm(pts, 10);
    expect(blocks[0].paceSeconds).toBeCloseTo(300, 0);
    expect(blocks[1].paceSeconds).toBeNull();
  });
});

describe('pacePerGroup', () => {
  it('agrupa 12.4km em blocos 1-5, 6-10, 11', () => {
    const blocks = pacePerGroup(uniformPoints(12.4), 5, 10);
    expect(blocks.map(b => b.label)).toEqual(['1-5', '6-10', '11']);
    for (const b of blocks) expect(b.paceSeconds).toBeCloseTo(300, 0);
  });
});

describe('choosePaceBlocks', () => {
  it('usar pacePerKm para até 5km', () => {
    const session: TrainingSession = {
      id: 's1', planId: 'p1', planName: 'Treino', date: '2026-07-31', mode: 'outdoor',
      totalDurationSeconds: 1500, totalDistanceKm: 5, avgSpeedKmh: 12, completed: true,
      points: uniformPoints(5),
    };
    const blocks = choosePaceBlocks(session);
    expect(blocks).toHaveLength(5);
    expect(blocks[0].label).toBe('KM 1');
  });

  it('usar pacePerGroup acima de 5km', () => {
    const session: TrainingSession = {
      id: 's2', planId: 'p1', planName: 'Longa', date: '2026-07-31', mode: 'outdoor',
      totalDurationSeconds: 3720, totalDistanceKm: 12.4, avgSpeedKmh: 12, completed: true,
      points: uniformPoints(12.4),
    };
    const blocks = choosePaceBlocks(session);
    expect(blocks[0].label).toBe('1-5');
  });

  it('fallback para total quando não há points', () => {
    const session: TrainingSession = {
      id: 's3', planId: 'p1', planName: 'Treino', date: '2026-07-31', mode: 'outdoor',
      totalDurationSeconds: 1500, totalDistanceKm: 5, avgSpeedKmh: 12, completed: true,
      points: [],
    };
    const blocks = choosePaceBlocks(session);
    expect(blocks).toEqual([{ label: 'GERAL', paceSeconds: 300 }]);
  });
});

describe('formatPaceShort', () => {
  it("formata 300s como 5'00\"", () => {
    expect(formatPaceShort(300)).toBe("5'00\"");
    expect(formatPaceShort(292)).toBe("4'52\"");
  });
});
