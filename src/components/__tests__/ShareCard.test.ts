import { describe, it, expect } from 'vitest';
import { gridCells, statFor, extractCardData } from '../ShareCard';
import type { ShareCardData } from '../ShareCard';
import type { TrainingSession } from '../../types';

const data: ShareCardData = {
  distance: '5,00 km',
  duration: '24:52',
  pace: "4'58\" /km",
  speed: '12,1',
  date: '31 jul',
  mode: 'Rua',
  name: 'Treino de 5 km',
};

describe('gridCells', () => {
  it('segue ordem canônica e honra showStats', () => {
    expect(gridCells({ distance: true, pace: true, duration: true, speed: false, date: true, mode: true }))
      .toEqual(['distance', 'pace', 'duration', 'date', 'mode']);
  });
});

describe('statFor', () => {
  it('mapeia label e valor por key', () => {
    expect(statFor('distance', data)).toEqual({ key: 'distance', label: 'Distância', value: '5,00 km' });
    expect(statFor('speed', data)).toEqual({ key: 'speed', label: 'km/h', value: '12,1' });
    expect(statFor('duration', data)).toEqual({ key: 'duration', label: 'Tempo total', value: '24:52' });
  });
});

describe('extractCardData', () => {
  const session: TrainingSession = {
    id: 's', planId: 'p', planName: 'Treino de 5 km', date: '2026-07-31T00:00:00',
    mode: 'outdoor', totalDurationSeconds: 1492, totalDistanceKm: 5, avgSpeedKmh: 12.1,
    completed: true, points: [],
  };
  it('extrai dados com speed sem sufixo', () => {
    const d = extractCardData(session);
    expect(d.speed).toBe('12.1');
    expect(d.name).toBe('Treino de 5 km');
    expect(d.mode).toBe('Rua');
  });
});
