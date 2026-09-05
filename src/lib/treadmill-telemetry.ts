import type { TreadmillMetrics } from './ftms-protocol';

export interface TelemetryFrame {
  instantSpeedKmh: number;
  avgSpeedKmh?: number;
  totalDistanceMeters?: number;
  instantaneousInclinePercent?: number;
  elapsedTimeSeconds?: number;
  hasDistance: boolean;
}

export interface TelemetrySummary {
  frameCount: number;
  minSpeedKmh: number;
  maxSpeedKmh: number;
  speedAverageKmh: number;
  distanceStartMeters: number | null;
  distanceEndMeters: number | null;
  distanceDeltaMeters: number | null;
  hasDistance: boolean;
  distanceFrames: number;
  speedSamples: number;
}

/**
 * Instrumentação da telemetria FTMS da esteira.
 *
 * Acumula, em memória, as métricas cruas decodificadas de cada frame e produz
 * um resumo compacto que revela a qualidade do dado reportado pela esteira —
 * ex.: se `totalDistanceMeters` existe, é monotônico e quanto avançou; se a
 * velocidade reportada bate com o esperado; quantos frames vieram com o campo
 * de distância presente (flag bit3 do FTMS).
 *
 * É uma peça PURA e testável (não toca em FS/console) — o componente é quem
 * decide como expor o resumo (console/log). Ao validar a telemetria real da
 * esteira (P7 do grill), este acumulador revela se o odômetro é confiável
 * antes de habilitarmos a distância-odômetro (design B).
 */
export class TelemetryTracker {
  private frames: TelemetryFrame[] = [];
  private distanceStart: number | null = null;
  private distanceEnd: number | null = null;
  private distanceFrames = 0;
  private minSpeed: number | null = null;
  private maxSpeed: number | null = null;
  private speedSum = 0;

  get count(): number {
    return this.frames.length;
  }

  record(m: TreadmillMetrics): TelemetryFrame {
    const frame: TelemetryFrame = {
      instantSpeedKmh: m.instantSpeedKmh,
      avgSpeedKmh: m.averageSpeedKmh,
      totalDistanceMeters: m.totalDistanceMeters,
      instantaneousInclinePercent: m.instantaneousInclinePercent,
      elapsedTimeSeconds: m.elapsedTimeSeconds,
      hasDistance: typeof m.totalDistanceMeters === 'number',
    };

    if (this.distanceStart === null && frame.hasDistance) {
      this.distanceStart = m.totalDistanceMeters as number;
    }
    if (frame.hasDistance) {
      this.distanceEnd = m.totalDistanceMeters as number;
      this.distanceFrames += 1;
    }

    if (this.minSpeed === null || m.instantSpeedKmh < this.minSpeed) this.minSpeed = m.instantSpeedKmh;
    if (this.maxSpeed === null || m.instantSpeedKmh > this.maxSpeed) this.maxSpeed = m.instantSpeedKmh;
    this.speedSum += m.instantSpeedKmh;

    this.frames.push(frame);
    return frame;
  }

  hasOdometerHit(): boolean {
    return this.distanceFrames > 0;
  }

  odometerDeltaMeters(): number | null {
    if (this.distanceStart === null || this.distanceEnd === null) return null;
    return this.distanceEnd - this.distanceStart;
  }

  summary(): TelemetrySummary {
    const delta = this.odometerDeltaMeters();
    return {
      frameCount: this.frames.length,
      minSpeedKmh: this.minSpeed ?? 0,
      maxSpeedKmh: this.maxSpeed ?? 0,
      speedAverageKmh: this.frames.length > 0 ? this.speedSum / this.frames.length : 0,
      distanceStartMeters: this.distanceStart,
      distanceEndMeters: this.distanceEnd,
      distanceDeltaMeters: delta,
      hasDistance: this.distanceFrames > 0,
      distanceFrames: this.distanceFrames,
      speedSamples: this.frames.length,
    };
  }
}
