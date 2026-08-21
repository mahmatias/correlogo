import { describe, it, expect } from 'vitest';
import { generateTCX, generateGPX, hasGpsData } from '../exportUtils';
import type { TrainingSession, ActivityPoint } from '../../types';

const session = (over: Partial<TrainingSession> = {}): TrainingSession => ({
  id: 's1', planId: 'p1', planName: 'Treino', date: new Date(1_000_000).toISOString(),
  mode: 'outdoor', totalDurationSeconds: 1000, totalDistanceKm: 3.1,
  avgSpeedKmh: 10, completed: true, points: [], ...over,
});

const gpsPoint = (ts: number): ActivityPoint => ({
  timestampSeconds: ts, speedKmh: 10, distanceKm: ts / 360, lat: -23.5, lon: -46.6,
});

const indoorPoint = (ts: number): ActivityPoint => ({
  timestampSeconds: ts, speedKmh: 10, distanceKm: ts / 360,
});

describe('hasGpsData', () => {
  it('false para sessão importada do relógio (points vazio)', () => {
    expect(hasGpsData(session())).toBe(false);
  });
  it('false para esteira mesmo com pontos (sem lat/lon)', () => {
    expect(hasGpsData(session({ mode: 'treadmill', points: [indoorPoint(0), indoorPoint(10)] }))).toBe(false);
  });
  it('true quando há ao menos um ponto com lat/lon', () => {
    expect(hasGpsData(session({ points: [indoorPoint(0), gpsPoint(10)] }))).toBe(true);
  });
});

describe('generateTCX — sessão sem pontos (watch-import/esteira)', () => {
  const tcx = generateTCX(session());

  it('emite trackpoints sintéticos com <Time> (erro Strava "time missing")', () => {
    expect(tcx).toContain('<Time>');
    const timeCount = (tcx.match(/<Time>/g) || []).length;
    expect(timeCount).toBeGreaterThan(1);
  });

  it('interpola distância do início ao fim', () => {
    expect(tcx).toContain('<DistanceMeters>0</DistanceMeters>');
    expect(tcx).toContain('<DistanceMeters>3100</DistanceMeters>');
  });

  it('não emite Position sem GPS', () => {
    expect(tcx).not.toContain('<Position>');
  });

  it('mantém totais da volta', () => {
    expect(tcx).toContain('<TotalTimeSeconds>1000</TotalTimeSeconds>');
    expect(tcx).toContain('<DistanceMeters>3100</DistanceMeters>'.replace('3100', (3.1 * 1000).toFixed(0)));
  });
});

describe('generateTCX — sessão outdoor com GPS mantém comportamento', () => {
  it('emite Position e Speed por ponto', () => {
    const s = session({ points: [gpsPoint(0), gpsPoint(10)] });
    const tcx = generateTCX(s);
    expect(tcx).toContain('<Position>');
    expect(tcx).toContain('<LatitudeDegrees>-23.5</LatitudeDegrees>');
    expect(tcx).toContain('ns3:Speed');
  });
});

describe('generateGPX', () => {
  it('só emite trkpt com coordenada + time', () => {
    const gpx = generateGPX(session({ points: [gpsPoint(0)] }));
    expect(gpx).toContain('<trkpt lat="-23.5" lon="-46.6">');
    expect(gpx).toContain('<time>');
  });
});
