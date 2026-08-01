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

import {
  applySessionToRecords,
  emptyRecords,
  type Records,
} from '../records';
import type { TrainingSession } from '../../types';

function session(over: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 's1', planId: 'p1', planName: 'Treino', date: '2026-08-01T10:00:00.000Z',
    mode: 'outdoor', totalDurationSeconds: 1800, totalDistanceKm: 5,
    avgSpeedKmh: 10, completed: true, points: [],
    ...over,
  };
}

describe('applySessionToRecords', () => {
  it('grava PR novo com crossing interpolado', () => {
    const s = session({ points: pts([0, 5], [0, 1800]) });
    const { records, newPrs } = applySessionToRecords(s, emptyRecords());
    expect(records.prs['5']).toMatchObject({ timeSeconds: 1800, sessionId: 's1' });
    expect(newPrs).toContainEqual({ distKm: 5, timeSeconds: 1800 });
  });

  it('não sobrescreve PR pior', () => {
    const current: Records = {
      ...emptyRecords(),
      prs: { '5': { timeSeconds: 1500, sessionId: 's0', date: '2026-07-01', mode: 'outdoor' } },
    };
    const s = session({ points: pts([0, 5], [0, 1800]) });
    const { records, newPrs } = applySessionToRecords(s, current);
    expect(records.prs['5'].timeSeconds).toBe(1500);
    expect(newPrs).not.toContainEqual({ distKm: 5, timeSeconds: 1800 });
  });

  it('substitui PR melhor e gera newPrs', () => {
    const current: Records = {
      ...emptyRecords(),
      prs: { '5': { timeSeconds: 1500, sessionId: 's0', date: '2026-07-01', mode: 'outdoor' } },
    };
    const s = session({ points: pts([0, 5], [0, 1200]) });
    const { records, newPrs } = applySessionToRecords(s, current);
    expect(records.prs['5'].timeSeconds).toBe(1200);
    expect(newPrs).toContainEqual({ distKm: 5, timeSeconds: 1200 });
  });

  it('usa estimativa proporcional quando não há points', () => {
    const s = session({ points: [], totalDurationSeconds: 1800, totalDistanceKm: 5 });
    const { records } = applySessionToRecords(s, emptyRecords());
    expect(records.prs['5'].timeSeconds).toBeCloseTo(1800, 3);
    expect(records.prs['10']).toBeUndefined();
  });

  it('sessão abaixo da distância não gera PR', () => {
    const s = session({ points: pts([0, 3], [0, 1200]), totalDistanceKm: 3 });
    const { records, newPrs } = applySessionToRecords(s, emptyRecords());
    expect(records.prs['5']).toBeUndefined();
    expect(newPrs.some(p => p.distKm === 5)).toBe(false);
  });

  it('desbloqueia firstRun apenas uma vez', () => {
    const s1 = session({ id: 'a', points: pts([0, 3], [0, 1200]), totalDistanceKm: 3 });
    const r1 = applySessionToRecords(s1, emptyRecords());
    expect(r1.records.badges.firstRun).toEqual({ unlockedAt: s1.date, sessionId: 'a' });
    expect(r1.newBadges.some(b => b.id === 'firstRun')).toBe(true);

    const s2 = session({ id: 'b', points: pts([0, 3], [0, 900]), totalDistanceKm: 3 });
    const r2 = applySessionToRecords(s2, r1.records);
    expect(r2.records.badges.firstRun.sessionId).toBe('a');
    expect(r2.newBadges.some(b => b.id === 'firstRun')).toBe(false);
  });

  it('desbloqueia complete5k/10k/21k/42k com >=', () => {
    const s10 = session({ id: 'a', points: pts([0, 10], [0, 3600]), totalDistanceKm: 10 });
    const r1 = applySessionToRecords(s10, emptyRecords());
    expect(r1.records.badges.complete5k).toBeDefined();
    expect(r1.records.badges.complete10k).toBeDefined();
    expect(r1.records.badges.complete21k).toBeUndefined();
    expect(r1.records.badges.complete42k).toBeUndefined();

    const s21 = session({ id: 'b', points: pts([0, 21.1], [0, 7600]), totalDistanceKm: 21.1 });
    const r2 = applySessionToRecords(s21, r1.records);
    expect(r2.records.badges.complete21k).toBeDefined();
    expect(r2.records.badges.complete42k).toBeUndefined();

    const s42 = session({ id: 'c', points: pts([0, 42.2], [0, 15200]), totalDistanceKm: 42.2 });
    const r3 = applySessionToRecords(s42, r2.records);
    expect(r3.records.badges.complete42k).toBeDefined();
  });

  it('badges de distância são evolutivas (longest)', () => {
    const s5 = session({ id: 'a', points: pts([0, 5], [0, 1500]), totalDistanceKm: 5 });
    const r1 = applySessionToRecords(s5, emptyRecords());
    expect(r1.records.badges.longest5).toBeDefined();
    expect(r1.records.badges.longest10).toBeUndefined();

    const s10 = session({ id: 'b', points: pts([0, 10], [0, 3600]), totalDistanceKm: 10 });
    const r2 = applySessionToRecords(s10, r1.records);
    expect(r2.records.badges.longest10).toBeDefined();
    expect(r2.records.badges.longest21).toBeUndefined();
  });

  it('badges de volume por thresholds cumulativos', () => {
    const s5 = session({ id: 'a', points: pts([0, 5], [0, 1500]), totalDistanceKm: 5 });
    const r1 = applySessionToRecords(s5, emptyRecords());
    expect(r1.records.totalVolumeKm).toBeCloseTo(5, 6);
    expect(r1.records.badges.volume10).toBeUndefined();

    const s6 = session({ id: 'b', points: pts([0, 6], [0, 2100]), totalDistanceKm: 6 });
    const r2 = applySessionToRecords(s6, r1.records);
    expect(r2.records.totalVolumeKm).toBeCloseTo(11, 6);
    expect(r2.records.badges.volume10).toBeDefined();
  });

  it('badges de ritmo por avgPace (duração / distância)', () => {
    const s8 = session({ id: 'a', points: [], totalDurationSeconds: 2400, totalDistanceKm: 5 });
    const r1 = applySessionToRecords(s8, emptyRecords());
    expect(r1.records.badges.pace8).toBeDefined();
    expect(r1.records.badges.pace7).toBeUndefined();

    const s5 = session({ id: 'b', points: [], totalDurationSeconds: 1500, totalDistanceKm: 5 });
    const r2 = applySessionToRecords(s5, r1.records);
    for (const p of [8, 7, 6, 5]) expect(r2.records.badges[`pace${p}`]).toBeDefined();
  });

  it('newBadges só nos desbloqueios da sessão', () => {
    const s1 = session({ id: 'a', points: pts([0, 3], [0, 1200]), totalDistanceKm: 3 });
    const r1 = applySessionToRecords(s1, emptyRecords());
    expect(r1.newBadges.some(b => b.id === 'firstRun')).toBe(true);

    // Sessão mais lenta (avgPace 600s/km > 8:00) e mesma distância: nenhum novo badge
    const s2 = session({ id: 'b', points: pts([0, 3], [0, 1800]), totalDistanceKm: 3 });
    const r2 = applySessionToRecords(s2, r1.records);
    expect(r2.newBadges).toHaveLength(0);
  });

  it('longestDistance acompanha a maior distância', () => {
    const s5 = session({ id: 'a', points: pts([0, 5], [0, 1500]), totalDistanceKm: 5 });
    const r1 = applySessionToRecords(s5, emptyRecords());
    expect(r1.records.longestDistance).toMatchObject({ km: 5, sessionId: 'a' });

    const s3 = session({ id: 'b', points: pts([0, 3], [0, 1200]), totalDistanceKm: 3 });
    const r2 = applySessionToRecords(s3, r1.records);
    expect(r2.records.longestDistance?.km).toBe(5);
  });
});

import { recomputeRecords } from '../records';

describe('recomputeRecords', () => {
  it('após delete do melhor, o PR cai para o próximo', () => {
    const s1 = session({ id: 'a', points: pts([0, 5], [0, 1500]) });
    const s2 = session({ id: 'b', points: pts([0, 5], [0, 1800]) });
    const r = applySessionToRecords(s1, applySessionToRecords(s2, emptyRecords()).records).records;
    expect(r.prs['5'].timeSeconds).toBe(1500);

    const next = recomputeRecords([s2], r);
    expect(next.prs['5']).toMatchObject({ timeSeconds: 1800, sessionId: 'b' });
  });

  it('longestDistance recua após delete do recorde', () => {
    const s10 = session({ id: 'a', points: pts([0, 10], [0, 3600]), totalDistanceKm: 10 });
    const s6 = session({ id: 'b', points: pts([0, 6], [0, 2100]), totalDistanceKm: 6 });
    const base = applySessionToRecords(s6, applySessionToRecords(s10, emptyRecords()).records).records;

    const next = recomputeRecords([s6], base);
    expect(next.longestDistance?.km).toBeCloseTo(6, 6);
    expect(next.longestDistance?.sessionId).toBe('b');
  });

  it('badges e totalVolumeKm permanecem intactos', () => {
    const s1 = session({ id: 'a', points: pts([0, 5], [0, 1500]) });
    const s2 = session({ id: 'b', points: pts([0, 5], [0, 1800]) });
    const base = applySessionToRecords(s2, applySessionToRecords(s1, emptyRecords()).records).records;
    const badgesBefore = { ...base.badges };
    const volumeBefore = base.totalVolumeKm;

    const next = recomputeRecords([s2], base);
    expect(next.badges).toEqual(badgesBefore);
    expect(next.totalVolumeKm).toBe(volumeBefore);
    expect(next.backfilled).toBe(base.backfilled);
  });
});
