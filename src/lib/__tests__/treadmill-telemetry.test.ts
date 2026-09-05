import { describe, it, expect } from 'vitest';
import { TelemetryTracker } from '../treadmill-telemetry';

describe('TelemetryTracker', () => {
  it('acumula frames e expõe contagem', () => {
    const t = new TelemetryTracker();
    t.record({ instantSpeedKmh: 8, totalDistanceMeters: 100 });
    t.record({ instantSpeedKmh: 9, totalDistanceMeters: 130 });
    expect(t.count).toBe(2);
  });

  it('detecta quando o odômetro (totalDistanceMeters) está presente', () => {
    const t = new TelemetryTracker();
    t.record({ instantSpeedKmh: 8 });
    expect(t.hasOdometerHit()).toBe(false);
    t.record({ instantSpeedKmh: 9, totalDistanceMeters: 100 });
    expect(t.hasOdometerHit()).toBe(true);
  });

  it('calcula o delta do odômetro entre o primeiro e o último frame', () => {
    const t = new TelemetryTracker();
    t.record({ instantSpeedKmh: 8, totalDistanceMeters: 1000 });
    t.record({ instantSpeedKmh: 9, totalDistanceMeters: 1050 });
    t.record({ instantSpeedKmh: 10, totalDistanceMeters: 1125 });
    expect(t.odometerDeltaMeters()).toBe(125);
  });

  it('retorna null de delta quando nunca veio distância', () => {
    const t = new TelemetryTracker();
    t.record({ instantSpeedKmh: 8 });
    expect(t.odometerDeltaMeters()).toBeNull();
    expect(t.summary().hasDistance).toBe(false);
  });

  it('resumo registra min/max de velocidade e distância start/end', () => {
    const t = new TelemetryTracker();
    t.record({ instantSpeedKmh: 6, totalDistanceMeters: 0 });
    t.record({ instantSpeedKmh: 14, totalDistanceMeters: 233 });
    t.record({ instantSpeedKmh: 10, totalDistanceMeters: 466 });
    const s = t.summary();
    expect(s.minSpeedKmh).toBe(6);
    expect(s.maxSpeedKmh).toBe(14);
    expect(s.distanceStartMeters).toBe(0);
    expect(s.distanceEndMeters).toBe(466);
    expect(s.distanceDeltaMeters).toBe(466);
    expect(s.distanceFrames).toBe(3);
    expect(s.speedSamples).toBe(3);
  });

  it('delta entre frames sem distância é nulo, não corrompe o acumulador', () => {
    const t = new TelemetryTracker();
    t.record({ instantSpeedKmh: 8, totalDistanceMeters: 100 });
    t.record({ instantSpeedKmh: 9 });
    t.record({ instantSpeedKmh: 10, totalDistanceMeters: 200 });
    expect(t.hasOdometerHit()).toBe(true);
    const s = t.summary();
    expect(s.distanceStartMeters).toBe(100);
    expect(s.distanceEndMeters).toBe(200);
    expect(s.distanceDeltaMeters).toBe(100);
    expect(s.distanceFrames).toBe(2);
  });

  it('summary expõe a média dos instantSpeed reportados', () => {
    const t = new TelemetryTracker();
    t.record({ instantSpeedKmh: 8 });
    t.record({ instantSpeedKmh: 10 });
    t.record({ instantSpeedKmh: 12 });
    expect(t.summary().speedAverageKmh).toBe(10);
  });

  it('summary sem frames tem média zero', () => {
    const t = new TelemetryTracker();
    expect(t.summary().speedAverageKmh).toBe(0);
  });
});
