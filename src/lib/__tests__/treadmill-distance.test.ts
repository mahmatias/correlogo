import { describe, it, expect } from 'vitest';
import { HybridDistance, ODOMETER_JITTER_TOLERANCE_M } from '../treadmill-distance';
import type { DistanceFrame } from '../treadmill-distance';

const speedDeltaKm = (kmh: number, dt: number) => (kmh / 3600) * dt;

describe('HybridDistance', () => {
  it('primeiro frame com odômetro só semeia o baseline e usa integração de velocidade no tick', () => {
    const h = new HybridDistance();
    const adv = h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 1000, dtSeconds: 1 });
    expect(adv.source).toBe('speed-integration');
    expect(adv.deltaKm).toBeCloseTo(speedDeltaKm(10, 1), 10);
  });

  it('com odômetro presente e monotônico, o delta vem do odômetro', () => {
    const h = new HybridDistance();
    h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 1000, dtSeconds: 1 });
    const adv = h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 1010, dtSeconds: 1 });
    expect(adv.source).toBe('odometer');
    expect(adv.deltaKm).toBeCloseTo(0.010, 10);
  });

  it('frame sem odômetro cai para integração de velocidade e não corrompe o baseline', () => {
    const h = new HybridDistance();
    h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 1000, dtSeconds: 1 });
    h.advance({ instantSpeedKmh: 9, totalDistanceMeters: 1010, dtSeconds: 1 });
    const fallback = h.advance({ instantSpeedKmh: 9, dtSeconds: 1 });
    expect(fallback.source).toBe('speed-integration');
    expect(fallback.deltaKm).toBeCloseTo(speedDeltaKm(9, 1), 10);
    const retomar = h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 1050, dtSeconds: 1 });
    expect(retomar.source).toBe('odometer');
    expect(retomar.deltaKm).toBeCloseTo(0.040, 10);
  });

  it('regressão do odômetro além do ruído (reset no console) muda para integração permanentemente', () => {
    const h = new HybridDistance();
    h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 1000, dtSeconds: 1 });
    h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 1050, dtSeconds: 1 });
    const reset = h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 0, dtSeconds: 1 });
    expect(reset.source).toBe('speed-integration');
    expect(reset.deltaKm).toBeCloseTo(speedDeltaKm(10, 1), 10);
    const posReset = h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 10, dtSeconds: 1 });
    expect(posReset.source).toBe('speed-integration');
    expect(posReset.deltaKm).toBeCloseTo(speedDeltaKm(10, 1), 10);
  });

  it('jitter negativo pequeno é tolerado (clamp a 0) e mantém a fonte odômetro', () => {
    const h = new HybridDistance();
    h.advance({ instantSpeedKmh: 8, totalDistanceMeters: 1000, dtSeconds: 1 });
    const jitter = h.advance({ instantSpeedKmh: 8, totalDistanceMeters: 999.8, dtSeconds: 1 });
    expect(jitter.source).toBe('odometer');
    expect(jitter.deltaKm).toBe(0);
    const depois = h.advance({ instantSpeedKmh: 8, totalDistanceMeters: 1009.8, dtSeconds: 1 });
    expect(depois.source).toBe('odometer');
    expect(depois.deltaKm).toBeCloseTo(0.010, 10);
  });

  it('odômetro estagnado retorna delta zero sem flipar para integração', () => {
    const h = new HybridDistance();
    h.advance({ instantSpeedKmh: 8, totalDistanceMeters: 1000, dtSeconds: 1 });
    const parado = h.advance({ instantSpeedKmh: 0, totalDistanceMeters: 1000, dtSeconds: 1 });
    expect(parado.source).toBe('odometer');
    expect(parado.deltaKm).toBe(0);
  });

  it('velocidade zero com integração retorna delta zero', () => {
    const h = new HybridDistance();
    const adv = h.advance({ instantSpeedKmh: 0, dtSeconds: 1 });
    expect(adv.deltaKm).toBe(0);
  });

  it('sem odômetro desde o início usa sempre integração de velocidade', () => {
    const h = new HybridDistance();
    const a = h.advance({ instantSpeedKmh: 6, dtSeconds: 2 });
    const b = h.advance({ instantSpeedKmh: 12, dtSeconds: 2 });
    expect(a.source).toBe('speed-integration');
    expect(a.deltaKm).toBeCloseTo(speedDeltaKm(6, 2), 10);
    expect(b.deltaKm).toBeCloseTo(speedDeltaKm(12, 2), 10);
  });

  it('dt inválido é tratado como zero (não gera distância negativa)', () => {
    const h = new HybridDistance();
    const adv = h.advance({ instantSpeedKmh: 8, dtSeconds: -1 });
    expect(adv.deltaKm).toBe(0);
  });

  it('delta acumulado em vários ticks monotônicos soma o avanço real do odômetro', () => {
    const h = new HybridDistance();
    h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 0, dtSeconds: 1 });
    h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 12, dtSeconds: 1 });
    h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 25, dtSeconds: 1 });
    h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 55, dtSeconds: 1 });
    const adv = h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 79, dtSeconds: 1 });
    expect(adv.source).toBe('odometer');
    expect(adv.deltaKm).toBeCloseTo(0.024, 10);
  });

  it('tolerância de ruído é positiva e pequena (≤ 0.5 m)', () => {
    expect(ODOMETER_JITTER_TOLERANCE_M).toBeGreaterThan(0);
    expect(ODOMETER_JITTER_TOLERANCE_M).toBeLessThanOrEqual(0.5);
  });

  it('expõe se o odômetro está ativo (baseline semeado e não-flipado)', () => {
    const h = new HybridDistance();
    expect(h.odometerActive).toBe(false);
    h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 500, dtSeconds: 1 });
    expect(h.odometerActive).toBe(true);
    h.advance({ instantSpeedKmh: 10, totalDistanceMeters: 0, dtSeconds: 1 });
    expect(h.odometerActive).toBe(false);
  });
});