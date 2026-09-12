export type DistanceSource = 'odometer' | 'speed-integration';

export interface DistanceFrame {
  instantSpeedKmh: number;
  totalDistanceMeters?: number;
  dtSeconds: number;
}

export interface DistanceAdvance {
  deltaKm: number;
  source: DistanceSource;
}

/**
 * Ruído máximo aceitável (em metros) num delta negativo do odômetro antes de
 * considerarmos que houve RESET do odômetro no console. Deltas negativos acima
 * disso são regressão real e flippam a fonte para integração permanente.
 */
export const ODOMETER_JITTER_TOLERANCE_M = 0.5;

/**
 * Fonte da "verdade" de distância no treino em esteira.
 *
 * Estratégia HÍBRIDA com fallback (validação 8-c confirmou a telemetria real):
 * - Quando `totalDistanceMeters` está presente no frame FTMS e se comporta de
 *   forma monotônica, o delta de distância VEM DO ODÔMETRO (distância real
 *   reportada pela esteira — inclui o que for movido em qualquer velocidade).
 * - Quando o frame não traz odômetro, OU o odômetro regride além do ruído
 *   (reset no console), cai para INTEGRAÇÃO DE VELOCIDADE (v × dt), usando a
 *   velocidade instantânea reportada quando conectado.
 *
 * A regressão é PERSISTENTE para o resto da sessão: depois de um reset, não
 * confiamos mais no odômetro (baseline do console pode ter mudado).
 *
 * Peça PURA e testável — não toca em console/FS.
 */
export class HybridDistance {
  private lastOdo: number | null = null;
  private odometerDead = false;

  get odometerActive(): boolean {
    return !this.odometerDead && this.lastOdo !== null;
  }

  advance(frame: DistanceFrame): DistanceAdvance {
    const speedDeltaKm = (frame.instantSpeedKmh / 3600) * Math.max(0, frame.dtSeconds);

    if (this.odometerDead || typeof frame.totalDistanceMeters !== 'number') {
      return { deltaKm: speedDeltaKm, source: 'speed-integration' };
    }

    if (this.lastOdo === null) {
      this.lastOdo = frame.totalDistanceMeters;
      return { deltaKm: speedDeltaKm, source: 'speed-integration' };
    }

    const odoDelta = frame.totalDistanceMeters - this.lastOdo;

    if (odoDelta < -ODOMETER_JITTER_TOLERANCE_M) {
      this.odometerDead = true;
      return { deltaKm: speedDeltaKm, source: 'speed-integration' };
    }

    this.lastOdo = frame.totalDistanceMeters;
    return { deltaKm: Math.max(0, odoDelta) / 1000, source: 'odometer' };
  }
}