import { describe, it, expect } from 'vitest';
import { estimateHrMax, hrZone, zoneLabel, zoneColor } from '../hr-zones';
import { computeHrSummary } from '../hr-summary';
import type { ActivityPoint } from '../../types';

function point(ts: number, hr?: number): ActivityPoint {
  return { timestampSeconds: ts, speedKmh: 10, distanceKm: 0, stepIndex: 0, heartRate: hr };
}

describe('estimateHrMax', () => {
  it('estima pela fórmula 208 - 0.7*idade', () => {
    // 1990-01-01 → 36 anos → 208 - 0.7*36 = 182.8 → 183
    expect(estimateHrMax('1990-01-01')).toBe(183);
  });
  it('retorna null sem dob', () => {
    expect(estimateHrMax(null)).toBeNull();
  });
  it('retorna null com data inválida', () => {
    expect(estimateHrMax('abc')).toBeNull();
  });
});

describe('hrZone', () => {
  it('mapeia as bordas exatas (hrMax=200)', () => {
    expect(hrZone(99, 200)).toBe(1);   // < 50%
    expect(hrZone(100, 200)).toBe(1);  // = 50% → Z1
    expect(hrZone(119, 200)).toBe(1);  // < 60%
    expect(hrZone(120, 200)).toBe(2);  // = 60% → Z2
    expect(hrZone(139, 200)).toBe(2);
    expect(hrZone(140, 200)).toBe(3);  // = 70% → Z3
    expect(hrZone(159, 200)).toBe(3);
    expect(hrZone(160, 200)).toBe(4);  // = 80% → Z4
    expect(hrZone(179, 200)).toBe(4);
    expect(hrZone(180, 200)).toBe(5);  // = 90% → Z5
    expect(hrZone(200, 200)).toBe(5);  // = 100%
  });
  it('retorna null para entradas inválidas', () => {
    expect(hrZone(0, 200)).toBeNull();
    expect(hrZone(150, 0)).toBeNull();
    expect(hrZone(NaN, 200)).toBeNull();
  });
});

describe('zoneLabel / zoneColor', () => {
  it('retorna label pt-BR e cor hex para cada zona', () => {
    expect(zoneLabel(1)).toBe('Zona 1 — Recuperação');
    expect(zoneLabel(5)).toBe('Zona 5 — Máximo');
    expect(zoneColor(4)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('computeHrSummary', () => {
  it('retorna null sem amostras válidas', () => {
    expect(computeHrSummary([point(0), point(1, 0), point(2, 255)], 200)).toBeNull();
  });
  it('calcula média/máx/mín e descarta sentinelas (0/255)', () => {
    const s = computeHrSummary([point(0, 150), point(1, 170), point(2, 0), point(3, 255), point(4, 130)], 200)!;
    expect(s.avgHr).toBe(150); // (150+170+130)/3
    expect(s.maxHr).toBe(170);
    expect(s.minHr).toBe(130);
    expect(s.samples).toBe(3);
  });
  it('distribui tempo por zona usando deltas', () => {
    // hrMax=200: 150→75%→Z3, 170→85%→Z4
    const s = computeHrSummary([point(0, 150), point(10, 150), point(20, 170), point(35, 170)], 200)!;
    expect(s.timeByZone[3]).toBeCloseTo(10, 6); // deltas 10 (ts0→10)
    expect(s.timeByZone[4]).toBeCloseTo(20, 6); // deltas 10 + 10 (ts10→20, ts20→35)
  });
  it('limita delta a 10s para não inflar pausas', () => {
    const s = computeHrSummary([point(0, 150), point(100, 150)], 200)!;
    expect(s.timeByZone[3]).toBeCloseTo(10, 6);
  });
});
