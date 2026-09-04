import type { ActivityPoint, TrainingSession } from '../types';

// O localStorage do Android WebView tem quota ~5MB. Cada sessão outdoor carrega
// o trail GPS (points), que domina o tamanho do JSON. Para garantir que o cache
// nunca estoure, mantemos points completos apenas nas sessões recentes e nas
// sessões local-* (pendentes de sync, que precisam do trail). As demais são
// reduzidas (downsample) para um número pequeno de amostras.
export const MAX_RECENT_FULL = 5;
export const MAX_POINTS_PER_OLD_SESSION = 200;
export const MAX_CACHE_SESSIONS = 50;

// Reduz points para no máximo `max` amostras, distribuídas uniformemente,
// sempre preservando o primeiro e o último ponto.
export function downsamplePoints(points: ActivityPoint[], max: number): ActivityPoint[] {
  if (points.length <= max) return points;
  if (max <= 0) return [];
  if (max === 1) return [points[0]];

  const step = (points.length - 1) / (max - 1);
  const sampled: ActivityPoint[] = [];
  for (let i = 0; i < max; i++) {
    sampled.push(points[Math.round(i * step)]);
  }
  return sampled;
}

export interface CacheBuildOptions {
  maxRecentFull?: number;
  maxPointsPerOldSession?: number;
  maxCacheSessions?: number;
}

// Monta a lista de sessões que deve ser gravada no localStorage:
//  - sessões local-* sempre preservadas (points completos);
//  - as `maxRecentFull` mais recentes com points completos;
//  - as demais com points reduzidos (downsample);
//  - teto de `maxCacheSessions` no total.
export function buildCacheSessions(
  sessions: TrainingSession[],
  opts: CacheBuildOptions = {},
): TrainingSession[] {
  const maxRecentFull = opts.maxRecentFull ?? MAX_RECENT_FULL;
  const maxPointsPerOldSession = opts.maxPointsPerOldSession ?? MAX_POINTS_PER_OLD_SESSION;
  const maxCacheSessions = opts.maxCacheSessions ?? MAX_CACHE_SESSIONS;

  const pending = sessions.filter((s) => s.id.startsWith('local-'));
  const remote = sessions
    .filter((s) => !s.id.startsWith('local-'))
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const cache: TrainingSession[] = [...pending];

  remote.slice(0, maxRecentFull).forEach((s) => {
    if (cache.length >= maxCacheSessions) return;
    cache.push(s);
  });

  remote.slice(maxRecentFull).forEach((s) => {
    if (cache.length >= maxCacheSessions) return;
    cache.push({
      ...s,
      points: s.points ? downsamplePoints(s.points, maxPointsPerOldSession) : s.points,
    });
  });

  return cache;
}
