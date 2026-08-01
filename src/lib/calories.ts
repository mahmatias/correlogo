import type { TrainingSession } from '../types';

/**
 * Calcula o gasto calórico estimado (kcal) usando a equação metabólica ACSM para corrida.
 * 
 * Equação ACSM para corrida em terreno plano:
 * VO₂ (ml/kg/min) = 0.2 × velocidade_m_min + 3.5
 * MET = VO₂ / 3.5 = 1 + 0.952 × velocidade_kmh
 * 
 * kcal = MET × peso_kg × duração_horas
 * 
 * @param session - Sessão de treino com distância, duração e velocidade média
 * @param weightKg - Peso do usuário em kg (fallback: 70kg)
 * @returns Gasto calórico estimado em kcal (arredondado)
 */
export function calculateKcal(session: TrainingSession, weightKg: number = 70): number {
  // Calcular velocidade média em km/h
  const durationHours = session.totalDurationSeconds / 3600;
  if (durationHours <= 0) return 0;

  const speedKmh = session.avgSpeedKmh ?? (session.totalDistanceKm / durationHours);
  if (speedKmh <= 0) return 0;

  // MET = 1 + 0.952 * velocidade_kmh (ACSM running equation)
  // Clamp entre 6.0 (caminhada leve) e 15.0 (sprint)
  const met = Math.max(6.0, Math.min(15.0, 1 + 0.952 * speedKmh));

  // kcal = MET * peso_kg * horas
  const kcal = met * weightKg * durationHours;

  return Math.round(kcal);
}

/**
 * Retorna a faixa de MET baseada no pace (min/km)
 * Útil para exibição ou debug
 */
export function getMetRange(paceMinPerKm: number): { min: number; max: number } {
  const speedKmh = 60 / paceMinPerKm;
  const met = 1 + 0.952 * speedKmh;
  const clamped = Math.max(6.0, Math.min(15.0, met));
  return { min: clamped - 0.5, max: clamped + 0.5 };
}

/**
 * Formata o gasto calórico para exibição
 */
export function formatKcal(kcal: number): string {
  if (kcal >= 1000) {
    return `${(kcal / 1000).toFixed(1)}k kcal`;
  }
  return `${kcal} kcal`;
}