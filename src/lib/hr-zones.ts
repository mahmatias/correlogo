export type HrZone = 1 | 2 | 3 | 4 | 5;

export function estimateHrMax(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  if (age <= 0) return null;
  return Math.round(208 - 0.7 * age);
}

export function hrZone(hr: number, hrMax: number): HrZone | null {
  if (!Number.isFinite(hr) || !Number.isFinite(hrMax) || hrMax <= 0 || hr <= 0) return null;
  const pct = (hr / hrMax) * 100;
  if (pct < 60) return 1;
  if (pct < 70) return 2;
  if (pct < 80) return 3;
  if (pct < 90) return 4;
  return 5;
}

export const ZONE_LABELS: Record<HrZone, string> = {
  1: 'Zona 1 — Recuperação',
  2: 'Zona 2 — Resistência',
  3: 'Zona 3 — Aeróbico',
  4: 'Zona 4 — Limiar',
  5: 'Zona 5 — Máximo',
};

export const ZONE_COLORS: Record<HrZone, string> = {
  1: '#3b82f6', // azul
  2: '#22c55e', // verde
  3: '#eab308', // amarelo
  4: '#f97316', // laranja
  5: '#ef4444', // vermelho
};

export function zoneLabel(zone: HrZone): string {
  return ZONE_LABELS[zone];
}

export function zoneColor(zone: HrZone): string {
  return ZONE_COLORS[zone];
}
