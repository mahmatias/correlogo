# Milestones / Conquistas + Tab Bar + Fixes BLE/Clip — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar recordes pessoais (PRs) por distância e badges de conquista com tab bar inferior de 4 abas (Treinos / Registros / Conquistas / Perfil), celebração no resumo da sessão, pill de recorde no ShareCard — e, nesta build, também o fix do clip do traçado no ShareCard e o timeout BLE de 15s.

**Architecture:** Camada de dados pura e testável em `src/lib/records.ts` (interpolação de crossing time, `applySessionToRecords`, `recomputeRecords`, `backfillRecords`, persistência Firestore + localStorage). UI em camadas: `TabBar.tsx` (navegação), `Achievements.tsx` (aba Conquistas), celebração em `SessionSummary.tsx`, pill em `ShareCard.tsx`, `SessionHistory`/`UserProfile` viram abas. Wiring central em `App.tsx` (estado `activeTab`, `records`, hooks em `markAsCompleted`/deletes/init).

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind v4, vitest, Firebase (Firestore), lucide-react, Capacitor (BLE nativo Kotlin).

## Global Constraints

- Commits frequentes com `[skip ci]` no subject (repo usa CI firewall que gera release a partir de push em `main`).
- Baseline: testes 55/55 passando; lint (`tsc --noEmit`) com 21 erros pré-existentes que **não devem aumentar**.
- Comandos: testes `npm test` (= `vitest run`), lint `npm run lint` (= `tsc --noEmit`), build `npm run build` (= `vite build`).
- **Nunca** copiar `.env.dev` para `.env`. Antes de `npm run build`: `Copy-Item -Path ".env.apk" -Destination ".env" -Force`.
- Kotlin: único arquivo nativo permitido é `android/app/src/main/java/com/correlogo/app/TreadmillBleService.kt` (plugin custom). Antes de `gradlew`: `$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"`.
- `crypto.randomUUID()` (não `uuid`). Sem deps novas.
- Não commitar `app-release-v*.apk` untracked na raiz nem `.env`.
- Spec: `docs/superpowers/specs/2026-08-01-milestones-design.md`.
- **Emenda aprovada pelo usuário (2026-08-01):** os 2 itens "fora de escopo" do spec entram nesta build: (a) fix do clip do traçado no ShareCard (RouteSVG pad interno), (b) timeout BLE de 10s → 15s (`TreadmillBleService.kt` + `use-treadmill.ts`).
- Semântica de dados (do spec): `prs`/`longestDistance` recomputam em delete; badges e `totalVolumeKm` são permanentes/monotônicos; `prResults` é transitório (só na sessão recém-completada, em memória, nunca persistido).
- Resolução de sessão no toque de recorde/badge: se `sessionId` não existir no estado → toast `showFeedback('error', 'Atividade não encontrada')`.

---

### Task 1: `src/lib/records.ts` — tipos, constantes e `computeCrossingTime`

**Files:**
- Create: `src/lib/records.ts`
- Test: `src/lib/__tests__/records.test.ts`

**Interfaces:**
- Produces: `PR_DISTANCES: number[]` (= `[1,2,3,4,5,10,15,21,30,35,42]`), `BADGE_LABELS: Record<string,string>`, `BADGE_GROUPS`, interfaces `PrRecord`, `BadgeRecord`, `PrResult`, `BadgeResult`, `Records`, e `computeCrossingTime(points: ActivityPoint[], distKm: number): number | null`. Tasks 2–4 reusam estes.

- [ ] **Step 1: Write the failing test**

Crie `src/lib/__tests__/records.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../records'`.

- [ ] **Step 3: Write minimal implementation**

Crie `src/lib/records.ts` (import apenas de `ActivityPoint` nesta task; `TrainingSession` entra na Task 2):

```ts
import type { ActivityPoint } from '../types';

export const PR_DISTANCES = [1, 2, 3, 4, 5, 10, 15, 21, 30, 35, 42];

export interface PrRecord {
  timeSeconds: number;
  sessionId: string;
  date: string;
  mode: 'treadmill' | 'outdoor';
}

export interface BadgeRecord {
  unlockedAt: string;
  sessionId: string;
}

export interface PrResult {
  distKm: number;
  timeSeconds: number;
}

export interface BadgeResult {
  id: string;
  label: string;
}

export interface Records {
  prs: Record<string, PrRecord>;
  longestDistance: {
    km: number;
    timeSeconds: number;
    sessionId: string;
    date: string;
    mode: 'treadmill' | 'outdoor';
  } | null;
  totalVolumeKm: number;
  badges: Record<string, BadgeRecord>;
  backfilled: boolean;
}

export const BADGE_LABELS: Record<string, string> = {
  firstRun: '1ª corrida',
  complete5k: 'Completei 5 km',
  complete10k: 'Completei 10 km',
  complete21k: 'Completei 21 km',
  complete42k: 'Completei 42 km',
  longest5: 'Maior distância · 5 km',
  longest10: 'Maior distância · 10 km',
  longest21: 'Maior distância · 21 km',
  longest42: 'Maior distância · 42 km',
  volume10: 'Acumulei 10 km',
  volume50: 'Acumulei 50 km',
  volume100: 'Acumulei 100 km',
  volume500: 'Acumulei 500 km',
  volume1000: 'Acumulei 1000 km',
  pace8: 'Ritmo ≤ 8:00',
  pace7: 'Ritmo ≤ 7:00',
  pace6: 'Ritmo ≤ 6:00',
  pace5: 'Ritmo ≤ 5:00',
};

export const BADGE_GROUPS: { id: string; label: string; ids: string[] }[] = [
  { id: 'corridas', label: 'Corridas', ids: ['firstRun', 'complete5k', 'complete10k', 'complete21k', 'complete42k'] },
  { id: 'distancia', label: 'Distância', ids: ['longest5', 'longest10', 'longest21', 'longest42'] },
  { id: 'volume', label: 'Volume', ids: ['volume10', 'volume50', 'volume100', 'volume500', 'volume1000'] },
  { id: 'ritmo', label: 'Ritmo', ids: ['pace8', 'pace7', 'pace6', 'pace5'] },
];

export function computeCrossingTime(points: ActivityPoint[], distKm: number): number | null {
  if (points.length < 2) return null;
  for (let i = 0; i < points.length; i++) {
    if (points[i].distanceKm >= distKm) {
      if (i === 0) return points[0].timestampSeconds;
      const prev = points[i - 1];
      const curr = points[i];
      const segDist = curr.distanceKm - prev.distanceKm;
      if (segDist <= 0) return null;
      const frac = (distKm - prev.distanceKm) / segDist;
      return prev.timestampSeconds + frac * (curr.timestampSeconds - prev.timestampSeconds);
    }
  }
  return null;
}
```

(Nota: o `TrainingSession` do import é adicionado na Task 2 — nesta task o import é apenas `ActivityPoint`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (todos os novos + baseline).

- [ ] **Step 5: Commit**

```bash
git add src/lib/records.ts src/lib/__tests__/records.test.ts
git commit -m "feat(records): core types, PR distances and computeCrossingTime [skip ci]"
```

---

### Task 2: `applySessionToRecords`

**Files:**
- Modify: `src/lib/records.ts` (adicionar `applySessionToRecords`)
- Test: `src/lib/__tests__/records.test.ts`

**Interfaces:**
- Consumes: `PR_DISTANCES`, `BADGE_LABELS`, `computeCrossingTime`, `Records`, `PrRecord`, `PrResult`, `BadgeResult`, `TrainingSession`, `ActivityPoint`.
- Produces: `applySessionToRecords(session: TrainingSession, current: Records): { records: Records; newPrs: PrResult[]; newBadges: BadgeResult[] }` — mutação em clone, na ordem do spec (PRs → longest → volume → badges).

- [ ] **Step 1: Write the failing test**

Adicione ao final de `src/lib/__tests__/records.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `emptyRecords` e `applySessionToRecords` não exportados.

- [ ] **Step 3: Write minimal implementation**

Adicione a `src/lib/records.ts` (e o `emptyRecords` + import `TrainingSession`):

```ts
import type { ActivityPoint, TrainingSession } from '../types';

export function emptyRecords(): Records {
  return { prs: {}, longestDistance: null, totalVolumeKm: 0, badges: {}, backfilled: false };
}

export function applySessionToRecords(
  session: TrainingSession,
  current: Records,
): { records: Records; newPrs: PrResult[]; newBadges: BadgeResult[] } {
  const next: Records = {
    prs: { ...current.prs },
    longestDistance: current.longestDistance ? { ...current.longestDistance } : null,
    totalVolumeKm: current.totalVolumeKm,
    badges: { ...current.badges },
    backfilled: current.backfilled,
  };
  const newPrs: PrResult[] = [];
  const newBadges: BadgeResult[] = [];

  for (const D of PR_DISTANCES) {
    let crossing = computeCrossingTime(session.points, D);
    if (crossing === null && session.totalDistanceKm >= D && session.totalDurationSeconds > 0) {
      crossing = session.totalDurationSeconds * (D / session.totalDistanceKm);
    }
    if (crossing === null) continue;
    const existing = next.prs[String(D)];
    if (!existing || crossing < existing.timeSeconds) {
      next.prs[String(D)] = { timeSeconds: crossing, sessionId: session.id, date: session.date, mode: session.mode };
      newPrs.push({ distKm: D, timeSeconds: crossing });
    }
  }

  const isLongest = !next.longestDistance || session.totalDistanceKm > next.longestDistance.km;
  if (isLongest) {
    next.longestDistance = {
      km: session.totalDistanceKm,
      timeSeconds: session.totalDurationSeconds,
      sessionId: session.id,
      date: session.date,
      mode: session.mode,
    };
  }

  next.totalVolumeKm = next.totalVolumeKm + session.totalDistanceKm;

  const unlock = (id: string) => {
    if (next.badges[id]) return;
    next.badges[id] = { unlockedAt: session.date, sessionId: session.id };
    newBadges.push({ id, label: BADGE_LABELS[id] });
  };

  if (!next.badges.firstRun) unlock('firstRun');
  for (const t of [5, 10, 21, 42]) {
    if (session.totalDistanceKm >= t) unlock(`complete${t}k`);
  }
  for (const t of [5, 10, 21, 42]) {
    if (isLongest && next.longestDistance && next.longestDistance.km >= t) unlock(`longest${t}`);
  }
  for (const t of [10, 50, 100, 500, 1000]) {
    if (next.totalVolumeKm >= t) unlock(`volume${t}`);
  }
  if (session.totalDistanceKm > 0) {
    const avgPace = session.totalDurationSeconds / session.totalDistanceKm;
    for (const p of [8, 7, 6, 5]) {
      if (avgPace <= p * 60) unlock(`pace${p}`);
    }
  }

  return { records: next, newPrs, newBadges };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/records.ts src/lib/__tests__/records.test.ts
git commit -m "feat(records): applySessionToRecords with PRs, longest, volume and badges [skip ci]"
```

---

### Task 3: `recomputeRecords`

**Files:**
- Modify: `src/lib/records.ts`
- Test: `src/lib/__tests__/records.test.ts`

**Interfaces:**
- Consumes: `computeCrossingTime`, `PR_DISTANCES`, `Records`, `TrainingSession`, `emptyRecords`.
- Produces: `recomputeRecords(sessions: TrainingSession[], current: Records): Records` — recalcula `prs` e `longestDistance` do zero (ordem cronológica por `date`); **não toca** `badges`/`totalVolumeKm`; mantém `backfilled`.

- [ ] **Step 1: Write the failing test**

Adicione ao final de `src/lib/__tests__/records.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `recomputeRecords` não exportado.

- [ ] **Step 3: Write minimal implementation**

Adicione a `src/lib/records.ts`:

```ts
export function recomputeRecords(sessions: TrainingSession[], current: Records): Records {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  let prs: Records['prs'] = {};
  let longestDistance: Records['longestDistance'] = null;

  for (const s of sorted) {
    for (const D of PR_DISTANCES) {
      let crossing = computeCrossingTime(s.points, D);
      if (crossing === null && s.totalDistanceKm >= D && s.totalDurationSeconds > 0) {
        crossing = s.totalDurationSeconds * (D / s.totalDistanceKm);
      }
      if (crossing !== null) {
        const existing = prs[String(D)];
        if (!existing || crossing < existing.timeSeconds) {
          prs[String(D)] = { timeSeconds: crossing, sessionId: s.id, date: s.date, mode: s.mode };
        }
      }
    }
    if (!longestDistance || s.totalDistanceKm > longestDistance.km) {
      longestDistance = { km: s.totalDistanceKm, timeSeconds: s.totalDurationSeconds, sessionId: s.id, date: s.date, mode: s.mode };
    }
  }

  return {
    prs,
    longestDistance,
    totalVolumeKm: current.totalVolumeKm,
    badges: current.badges,
    backfilled: current.backfilled,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/records.ts src/lib/__tests__/records.test.ts
git commit -m "feat(records): recomputeRecords for deletes (PRs + longest) [skip ci]"
```

---

### Task 4: `backfillRecords` e persistência

**Files:**
- Modify: `src/lib/records.ts`
- Test: `src/lib/__tests__/records.test.ts`

**Interfaces:**
- Consumes: `applySessionToRecords`, `emptyRecords`, `Records`, `TrainingSession`.
- Produces:
  - `backfillRecords(sessions: TrainingSession[]): Records` — aplica em ordem cronológica e seta `backfilled = true`.
  - `readRecords(uid: string): Promise<Records | null>` — localStorage `correlogo:records:{uid}` primeiro; senão `getDoc(users/{uid}/data/records)`; `null` se ambos ausentes. (Não testado — wrapper de IO; cobrir em lint/typecheck.)
  - `saveRecords(uid: string, records: Records): Promise<void>` — `localStorage.setItem` + `setDoc(..., records)` sem merge. (Não testado.)

- [ ] **Step 1: Write the failing test**

Adicione ao final de `src/lib/__tests__/records.test.ts`:

```ts
import { backfillRecords } from '../records';

describe('backfillRecords', () => {
  it('aplica em ordem cronológica mesmo com lista fora de ordem', () => {
    const older = session({ id: 'old', date: '2026-06-01T10:00:00.000Z', points: pts([0, 10], [0, 3600]), totalDistanceKm: 10 });
    const newer = session({ id: 'new', date: '2026-07-01T10:00:00.000Z', points: pts([0, 5], [0, 1500]), totalDistanceKm: 5 });
    const records = backfillRecords([newer, older]);

    expect(records.backfilled).toBe(true);
    expect(records.totalVolumeKm).toBeCloseTo(15, 6);
    expect(records.longestDistance?.km).toBeCloseTo(10, 6);
    expect(records.longestDistance?.sessionId).toBe('old');
    expect(records.badges.firstRun).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `backfillRecords` não exportado.

- [ ] **Step 3: Write minimal implementation**

Adicione a `src/lib/records.ts`:

```ts
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb } from './firebase';

export function backfillRecords(sessions: TrainingSession[]): Records {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  let records = emptyRecords();
  for (const s of sorted) {
    records = applySessionToRecords(s, records).records;
  }
  return { ...records, backfilled: true };
}

export async function readRecords(uid: string): Promise<Records | null> {
  const cached = localStorage.getItem(`correlogo:records:${uid}`);
  if (cached) {
    try {
      return JSON.parse(cached) as Records;
    } catch { /* cache corrompido */ }
  }
  try {
    const snap = await getDoc(doc(getDb(), 'users', uid, 'data', 'records'));
    if (snap.exists()) return snap.data() as Records;
  } catch { /* offline */ }
  return null;
}

export async function saveRecords(uid: string, records: Records): Promise<void> {
  localStorage.setItem(`correlogo:records:${uid}`, JSON.stringify(records));
  try {
    await setDoc(doc(getDb(), 'users', uid, 'data', 'records'), records);
  } catch (e) {
    console.warn('Falha ao salvar records no Firestore (mantido apenas localmente):', e);
  }
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npm test`
Expected: PASS.

Run: `npm run lint`
Expected: SÓ os 21 erros pré-existentes (nenhum novo).

- [ ] **Step 5: Commit**

```bash
git add src/lib/records.ts src/lib/__tests__/records.test.ts
git commit -m "feat(records): backfill, readRecords and saveRecords persistence [skip ci]"
```

---

### Task 5: `prResults` em `TrainingSession`

**Files:**
- Modify: `src/types.ts:87-104`

**Interfaces:**
- Consumes: nada.
- Produces: `PrResults` (interface exportada) + campo opcional `prResults?: PrResults` em `TrainingSession`. Task 6 anexa no `markAsCompleted`; Tasks 12/13 leem `session.prResults`.

- [ ] **Step 1: Apply edit**

Adicione em `src/types.ts` logo acima de `TrainingSession`:

```ts
export interface PrResults {
  newPrs: { distKm: number; timeSeconds: number }[];
  newBadges: { id: string; label: string }[];
}
```

E dentro de `TrainingSession`, após `gmailSyncStatus?: SyncStatus;`:

```ts
  prResults?: PrResults;
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run lint`
Expected: SÓ os 21 erros pré-existentes.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): prResults transient field on TrainingSession [skip ci]"
```

---

### Task 6: Wiring dos records em `App.tsx`

**Files:**
- Modify: `src/App.tsx` — imports (~linha 7–30), estado (após 88), init (no `finally` ~316), `markAsCompleted` (684–763), `uncompletePlan` (661–682), `deletePlan` deleção de sessões (630–649), `onDeleteSession` (982–992).

**Interfaces:**
- Consumes: `applySessionToRecords`, `emptyRecords`, `readRecords`, `saveRecords`, `recomputeRecords`, `backfillRecords` (de `./lib/records`), tipo `Records`, `PrResults` (de `./types`).
- Produces: estado `records: Records | null`; `prResults` transitório no `selectedSession` pós-completar; recompute em todos os 3 caminhos de delete.

- [ ] **Step 1: Imports**

Em `src/App.tsx`, na linha do import de `./types` (10), adicione `PrResults` ao import e adicione logo após o import de `./lib/firebase` (linha 27):

```ts
import { applySessionToRecords, emptyRecords, readRecords, saveRecords, recomputeRecords, backfillRecords, type Records } from './lib/records';
```

- [ ] **Step 2: Estado**

Após `const [showUserProfile, setShowUserProfile] = useState(false);` (linha 88), adicione:

```ts
const [records, setRecords] = useState<Records | null>(null);
```

- [ ] **Step 3: Init backfill (no `finally` do load, antes de `setIsLoading(false)` ~316)**

Dentro do bloco `finally {` existente (que começa ~295), imediatamente antes de `setIsLoading(false);` (linha 316), adicione:

```ts
          try {
            const allSessions: TrainingSession[] = JSON.parse(localStorage.getItem(localSessionsKey) || '[]');
            const existing = await readRecords(user.uid);
            const recs = existing ?? backfillRecords(allSessions);
            if (!existing) await saveRecords(user.uid, recs);
            setRecords(recs);
          } catch (e) {
            console.error('Erro ao carregar recordes:', e);
          }
```

- [ ] **Step 4: `markAsCompleted` — restruturar corpo `if (user)` (698–763)**

Substitua o bloco inteiro desde `try {` (linha 718) até `latestSessionIdRef.current = newSession.id;` (linha 741) pelo seguinte (mantém as linhas de `showFeedback` internas):

```ts
        let newSession: TrainingSession;
        try {
            console.log("Salvando sessão no Firestore:", { planId: id, ...sessionStats });
            const docRef = await addDoc(collection(getDb(), 'users', user.uid, 'sessions'), stripUndefined(sessionData));
            showFeedback('success', 'Treino salvo com sucesso!');
            newSession = { id: docRef.id, ...sessionData };
        } catch (e) {
            console.error("Erro ao salvar sessão no Firestore (mantida apenas localmente):", e);
            showFeedback('error', 'Falha ao salvar treino no servidor. Dados mantidos localmente.');
            const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            newSession = { id: localId, ...sessionData };
        }

        let prResults: PrResults = { newPrs: [], newBadges: [] };
        try {
            const base = (await readRecords(user.uid)) ?? emptyRecords();
            const { records: next, newPrs, newBadges } = applySessionToRecords(newSession, base);
            await saveRecords(user.uid, next);
            setRecords(next);
            prResults = { newPrs, newBadges };
        } catch (e) {
            console.error("Erro ao atualizar recordes:", e);
        }

        setSessions(s => {
          const updated = [newSession, ...s];
          localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
          return updated;
        });
        setSelectedSession({ ...newSession, prResults });
        latestSessionIdRef.current = newSession.id;
```

- [ ] **Step 5: `uncompletePlan` (661–682) — recompute após deletar**

Substitua o corpo do `if (sessionToDelete) { ... }` (linhas 669–676) por:

```ts
            const sessionToDelete = sessions.find(s => s.planId === plan.id);
            if (sessionToDelete) {
                await deleteDoc(doc(getDb(), 'users', user.uid, 'sessions', sessionToDelete.id));
                const updatedSessions = sessions.filter(si => si.id !== sessionToDelete.id);
                setSessions(updatedSessions);
                localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updatedSessions));
                const recs = await readRecords(user.uid);
                if (recs) {
                    const next = recomputeRecords(updatedSessions, recs);
                    await saveRecords(user.uid, next);
                    setRecords(next);
                }
            }
```

- [ ] **Step 6: `deletePlan` — recompute ao deletar plano com sessões (linhas 644–645)**

Após `localStorage.setItem(...)` (linha 645), adicione:

```ts
            const recs = await readRecords(user.uid);
            if (recs) {
                const next = recomputeRecords(sessionsToKeep, recs);
                await saveRecords(user.uid, next);
                setRecords(next);
            }
```

- [ ] **Step 7: `onDeleteSession` (982–992) — recompute ao apagar sessão do histórico**

Substitua o callback inteiro por:

```ts
                onDeleteSession={(sessionId) => {
                  const updated = sessions.filter(si => si.id !== sessionId);
                  setSessions(updated);
                  if (user) {
                    localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
                    if (!sessionId.startsWith('local-')) {
                      deleteDoc(doc(getDb(), 'users', user.uid, 'sessions', sessionId)).catch(() => {});
                    }
                    readRecords(user.uid)
                      .then(recs => {
                        if (!recs) return;
                        const next = recomputeRecords(updated, recs);
                        return saveRecords(user.uid, next).then(() => setRecords(next));
                      })
                      .catch(e => console.error("Erro ao recomputar recordes:", e));
                  }
                  showFeedback('success', 'Sessão removida do histórico.');
                }}
```

- [ ] **Step 8: Verify typecheck**

Run: `npm run lint`
Expected: SÓ os 21 erros pré-existentes.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat(records): wire records into complete, delete and init flows [skip ci]"
```

---

### Task 7: `TabBar.tsx`

**Files:**
- Create: `src/components/TabBar.tsx`

**Interfaces:**
- Produces: `export type TabId = 'treinos' | 'registros' | 'conquistas' | 'perfil'`; `export default function TabBar({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void })`. Task 10 consome.

- [ ] **Step 1: Write the component**

Crie `src/components/TabBar.tsx`:

```tsx
import { List, Trophy, User } from 'lucide-react';

export type TabId = 'treinos' | 'registros' | 'conquistas' | 'perfil';

function RunIcon({ size = 18, strokeWidth = 1.75 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 4a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" />
      <path d="M4 17l5 1l.75 -1.5" />
      <path d="M15 21l0 -4l-4 -3l1 -6" />
      <path d="M7 12l0 -3l5 -1l3 3l3 1" />
    </svg>
  );
}

const TABS: { id: TabId; label: string; renderIcon: (s: number) => React.ReactNode }[] = [
  { id: 'treinos', label: 'Treinos', renderIcon: (s) => <RunIcon size={s} /> },
  { id: 'registros', label: 'Registros', renderIcon: (s) => <List size={s} /> },
  { id: 'conquistas', label: 'Conquistas', renderIcon: (s) => <Trophy size={s} /> },
  { id: 'perfil', label: 'Perfil', renderIcon: (s) => <User size={s} /> },
];

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 mx-auto w-full max-w-xl border-t border-border bg-bg-surface/95 backdrop-blur">
      <div className="grid grid-cols-4">
        {TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`flex flex-col items-center gap-1 py-2.5 ${isActive ? 'text-accent' : 'text-text-muted'}`}
            >
              {t.renderIcon(18)}
              <span className="text-[8px] font-semibold tracking-wide">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run lint`
Expected: SÓ os 21 erros pré-existentes.

- [ ] **Step 3: Commit**

```bash
git add src/components/TabBar.tsx
git commit -m "feat(tabs): TabBar with 4 tabs and Tabler run icon [skip ci]"
```

---

### Task 8: `SessionHistory` → aba Registros

**Files:**
- Modify: `src/components/SessionHistory.tsx:1-52` (imports, Props, wrapper), `:122` (fecho).

**Interfaces:**
- Consumes: `onSelectSession` (continua).
- Produces: componente renderizável como aba — **remove** `onClose` da Props; remove invólucro modal; cabeçalho "Registros". Task 10 renderiza.

- [ ] **Step 1: Props — remover `onClose`**

Em `src/components/SessionHistory.tsx`, substitua a interface `Props` (linhas 7–13):

```ts
interface Props {
  sessions: TrainingSession[];
  onSelectSession: (session: TrainingSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onExportSession?: (session: TrainingSession, target?: 'gmail' | 'hc') => void;
}
```

E a assinatura (linha 33):

```ts
export default function SessionHistory({ sessions, onSelectSession, onDeleteSession, onExportSession }: Props) {
```

- [ ] **Step 2: Remover invólucro de modal**

Substitua as linhas 47–52 (o `return (` + `<div className="fixed inset-0...">` + botão Voltar + `h2`) por:

```tsx
  return (
    <div className="text-text-primary">
        <h2 className="text-2xl font-bold mb-6 text-center">Registros</h2>
```

Remova `ArrowLeft` do import da linha 1:

```ts
import { Calendar, ClipboardList, Trash2, CheckCircle2, Mail, Play, AlertTriangle } from 'lucide-react';
```

No final (linha 122), o `</div>` existente já fecha o wrapper — **não** adicione fechamento extra; apenas confira que o JSX fechou (o `return (` no Step 2 abriu `<div className="text-text-primary">` e a linha 122 `</div>` fecha).

- [ ] **Step 3: Verify typecheck**

Run: `npm run lint`
Expected: SÓ os 21 erros pré-existentes. (Se `onClose` for usado em `App.tsx` nesta linha, será ajustado na Task 10.)

- [ ] **Step 4: Commit**

```bash
git add src/components/SessionHistory.tsx
git commit -m "refactor(sessions): SessionHistory becomes Registros tab [skip ci]"
```

---

### Task 9: `UserProfile` → aba Perfil + linha Tema

**Files:**
- Modify: `src/components/UserProfile.tsx` — Props (15–35), effect (55–99), save (116–159), render (163–177 e 408–411).

**Interfaces:**
- Consumes: de App — `user`, `initialProfile`, `initialSettings`, `isLightMode`, `onToggleTheme` (novo), `showFeedback`, `onSaved`, `onUpdateAvailable`.
- Produces: componente renderizável como aba (remove `open`/`onClose`); nova seção "Preferências → Tema". Task 10 renderiza.

- [ ] **Step 1: Props**

Substitua `interface UserProfileProps` (15–24):

```ts
interface UserProfileProps {
  user: User;
  initialProfile: ProfileData | null;
  initialSettings: SettingsData | null;
  isLightMode: boolean;
  onToggleTheme: () => void;
  showFeedback: (type: 'success' | 'error', message: string) => void;
  onSaved: (profile: ProfileData, settings: SettingsData) => void;
  onUpdateAvailable?: (update: UpdateInfo) => void;
}
```

E a assinatura (26–35):

```ts
export default function UserProfile({
  user,
  initialProfile,
  initialSettings,
  isLightMode,
  onToggleTheme,
  showFeedback,
  onSaved,
  onUpdateAvailable,
}: UserProfileProps) {
```

- [ ] **Step 2: Effect — rodar no mount (remover `if (!open)` e dep `[open]`)**

Na linha 56, substitua `if (!open) return;` por:

```ts
    // mount: carrega estado inicial do perfil
```

E na linha 99, substitua a dep `[open]` por:

```ts
  }, []);
```

- [ ] **Step 3: Save — não chamar `onClose()`**

Na linha 154, remova a linha `onClose();`.

- [ ] **Step 4: Render — trocar Modal por div + cabeçalho**

Substitua as linhas 163–177:

```tsx
  return (
    <div className="text-text-primary">
      <h2 className="text-2xl font-bold mb-6 text-center">Perfil</h2>
      <div className="flex justify-center mb-4">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt="Avatar"
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center text-xl font-bold">
            {initial.toUpperCase()}
          </div>
        )}
      </div>
```

E o fecho (linhas 408–411) — substitua:

```tsx
      <Button variant="primary" className="w-full mt-4" onClick={handleSave}>Salvar</Button>
      <Button variant="danger" className="w-full mt-4" onClick={() => { signOut(getAuth()); }}>Sair da conta</Button>
    </div>
  );
}
```

- [ ] **Step 5: Seção Preferências → Tema**

Após o campo de unidades de peso (logo após o bloco que contém `setWeightUnit`/seletor de peso — encontre o fecho `</div>` logo antes do bloco `{/* Conexões */}` ou do primeiro `p-3 rounded-lg border` de conexões), adicione:

```tsx
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-text-secondary mb-2">Preferências</h3>
        <div className="p-3 rounded-lg border border-border">
          <div className="text-sm text-text-primary mb-2">Tema</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { if (!isLightMode) onToggleTheme(); }}
              className={`p-2 rounded-lg text-sm font-medium ${!isLightMode ? 'bg-accent text-white' : 'bg-bg-elevated text-text-secondary'}`}
            >
              Escuro
            </button>
            <button
              type="button"
              onClick={() => { if (isLightMode) onToggleTheme(); }}
              className={`p-2 rounded-lg text-sm font-medium ${isLightMode ? 'bg-accent text-white' : 'bg-bg-elevated text-text-secondary'}`}
            >
              Claro
            </button>
          </div>
        </div>
      </div>
```

Remova `Modal` do import da linha 5 (mantendo `Button`).

- [ ] **Step 6: Verify typecheck**

Run: `npm run lint`
Expected: SÓ os 21 erros pré-existentes (o uso no `App.tsx` será corrigido na Task 10).

- [ ] **Step 7: Commit**

```bash
git add src/components/UserProfile.tsx
git commit -m "feat(profile): UserProfile becomes Perfil tab with theme switch [skip ci]"
```

---

### Task 10: App.tsx — tabs (`activeTab`, header, back, TabBar)

> **Ordem de execução:** esta task usa `Achievements` (Task 11). Execute a **Task 11 primeiro**, depois a Task 10. (Numeradas na ordem de edição do documento, mas a dependência é: 11 → 10.)

**Files:**
- Modify: `src/App.tsx` — imports, estado (84, 88 → `activeTab`), back handler (135–141), header (1230–1273), render do `else` final (1228–1567), renders globais (1569–1580), TabBar no fim (após `</main>` ~1645).

**Interfaces:**
- Consumes: `TabBar` + `TabId` (Task 7), `SessionHistory` (Task 8), `UserProfile` (Task 9), `Achievements` (Task 11, já criado).

- [ ] **Step 1: Estado — substituir `showHistory`/`showUserProfile` por `activeTab`**

Substitua a linha 84 `const [showHistory, setShowHistory] = useState(false);` e a linha 88 `const [showUserProfile, setShowUserProfile] = useState(false);` por:

```ts
const [activeTab, setActiveTab] = useState<TabId>('treinos');
```

- [ ] **Step 2: Back handler (135–141)**

Na construção de `actions`, substitua as linhas:

```ts
    if (showHistory) actions.push(() => setShowHistory(false));
    if (showUserProfile) actions.push(() => setShowUserProfile(false));
```

por (a ação de troca de aba é a de menor prioridade → push **antes** das demais; remova também estas duas linhas):

Insira logo após `const actions: Array<() => void> = [];` (linha 125):

```ts
    if (activeTab !== 'treinos') actions.push(() => setActiveTab('treinos'));
```

E na dep array (linha 141), substitua `showHistory, showUserProfile` por `activeTab`.

- [ ] **Step 3: Header — remover botões (1239–1269)**

Substitua o bloco do header (linhas 1230–1273) por:

```tsx
              <div className="sticky top-0 z-10 bg-bg-deep px-4 pb-2 pt-4">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                    Corre Logo
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-7 h-7" aria-hidden="true">
                      <path d="M20 65 C30 65, 45 55, 55 45 C40 48, 30 45, 25 38 C40 38, 55 30, 85 20 C75 38, 60 62, 50 75 C52 65, 48 58, 42 56 C35 64, 25 65, 20 65 Z" fill="var(--color-accent)" />
                      <path d="M15 50 C25 50, 35 43, 42 37 C35 39, 28 37, 25 33 C33 33, 45 27, 55 22 C48 32, 42 42, 38 48 C39 42, 36 38, 32 37 C28 44, 20 50, 15 50 Z" fill="var(--color-accent)" opacity="0.6" />
                    </svg>
                  </h1>
                </div>
                <p className="text-text-secondary mt-1">Olá, <strong>{greetingName}</strong></p>
              </div>
```

> `BarChart2` continua importado (usado na linha ~1452); **não** remover do import da linha 7.

- [ ] **Step 4: Tab content no `else` final**

Envolva o conteúdo da home: imediatamente após o fecho do header `</div>` (fim do Step 3), substitua a linha 1275 `<div className="px-4 pb-4">` por:

```tsx
              {activeTab === 'treinos' && (
              <div className="px-4 pb-4">
```

E feche a condicional no fecho da home (`</div>` da linha 1490, logo antes do `</>` da 1491):

```tsx
              </div>
              )}
```

- [ ] **Step 5: Abas Registros/Conquistas/Perfil**

Logo após o `)}` do Step 4 (antes do `{planToUncomplete && ...}` da linha 1493), adicione:

```tsx
              {activeTab === 'registros' && (
                <div className="px-4 pb-4">
                  <SessionHistory
                    sessions={sessions}
                    onSelectSession={(s) => setSelectedSession(s)}
                    onDeleteSession={(sessionId) => {
                      const updated = sessions.filter(si => si.id !== sessionId);
                      setSessions(updated);
                      if (user) {
                        localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
                        if (!sessionId.startsWith('local-')) {
                          deleteDoc(doc(getDb(), 'users', user.uid, 'sessions', sessionId)).catch(() => {});
                        }
                        readRecords(user.uid)
                          .then(recs => {
                            if (!recs) return;
                            const next = recomputeRecords(updated, recs);
                            return saveRecords(user.uid, next).then(() => setRecords(next));
                          })
                          .catch(e => console.error("Erro ao recomputar recordes:", e));
                      }
                      showFeedback('success', 'Sessão removida do histórico.');
                    }}
                    onExportSession={async (session, target) => { /* mover o callback de export da linha 993 para cá */ }}
                  />
                </div>
              )}
              {activeTab === 'conquistas' && (
                <div className="px-4 pb-4">
                  <Achievements
                    records={records}
                    sessions={sessions}
                    onOpenSession={(sessionId) => {
                      const found = sessions.find(s => s.id === sessionId);
                      if (found) setSelectedSession(found);
                      else showFeedback('error', 'Atividade não encontrada');
                    }}
                  />
                </div>
              )}
              {activeTab === 'perfil' && (
                <div className="px-4 pb-4">
                  <UserProfile
                    user={user!}
                    initialProfile={profile}
                    initialSettings={settings}
                    isLightMode={isLightMode}
                    onToggleTheme={toggleDarkMode}
                    showFeedback={showFeedback}
                    onSaved={handleProfileSaved}
                    onUpdateAvailable={setUpdateInfo}
                  />
                </div>
              )}
```

> O `onExportSession` atual (linhas 993–1046) **não deve ser duplicado**: mova o callback inteiro do bloco `{showHistory && (...)}` (linhas 977–1048) para cá. O `onDeleteSession` deste Step 5 substitui o do Step 7 da Task 6 (remova o da Task 6 — eles são o mesmo handler, agora posicionado aqui). Simplificação: **a Task 6 Step 7 deve ser ignorada** se o callback for movido inteiro para cá; o plano mantém o handler aqui como fonte única.

- [ ] **Step 6: Remover o bloco `{showHistory && ...}` e `{showUserProfile && ...}`**

Remova as linhas 977–1048 (o bloco `{showHistory && (<SessionHistory .../>)}`) e as linhas 1569–1580 (o bloco `{showUserProfile && (...)}`), transferindo o callback `onExportSession` e `onDeleteSession` para o Step 5.

- [ ] **Step 7: TabBar no rodapé**

Após o `</main>` (linha 1645), antes do `</div>` final (1646), adicione:

```tsx
      {user && !isLoading && !activePlan && !selectedSession && !isEditing && !showGenerator && !programToReview && !showGoogleCalendarModal && !showSignup && !showBackgroundPrompt && !workoutToStart && !planToDelete && !planToUncomplete && !reschedulePlanId && !updateInfo && !showPlanSheet && (
        <TabBar active={activeTab} onChange={setActiveTab} />
      )}
```

- [ ] **Step 8: Imports**

Adicione aos imports do App:

```ts
import TabBar, { type TabId } from './components/TabBar';
import Achievements from './components/Achievements';
```

- [ ] **Step 9: Verify typecheck**

Run: `npm run lint`
Expected: SÓ os 21 erros pré-existentes.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx
git commit -m "feat(tabs): 4-tab navigation with per-tab rendering [skip ci]"
```

---

### Task 11: `Achievements.tsx` — aba Conquistas (layout C)

**Files:**
- Create: `src/components/Achievements.tsx`

**Interfaces:**
- Consumes: `Records`, `PR_DISTANCES`, `BADGE_LABELS`, `BADGE_GROUPS` (de `../lib/records`); `formatDistance`, `formatDuration` (de `../types`); lucide `Trophy`, `Medal`, `Lock`, `ChevronRight`.
- Produces: `export default function Achievements({ records, sessions, onOpenSession }: { records: Records | null; sessions: TrainingSession[]; onOpenSession: (sessionId: string) => void })`. A Task 10 consome (importa e renderiza como aba Conquistas).

- [ ] **Step 1: Write the component**

Crie `src/components/Achievements.tsx`:

```tsx
import { Trophy, Medal, Lock, ChevronRight } from 'lucide-react';
import type { TrainingSession } from '../types';
import { formatDistance, formatDuration } from '../types';
import { PR_DISTANCES, BADGE_LABELS, BADGE_GROUPS, type Records } from '../lib/records';

interface AchievementsProps {
  records: Records | null;
  sessions: TrainingSession[];
  onOpenSession: (sessionId: string) => void;
}

export default function Achievements({ records, sessions, onOpenSession }: AchievementsProps) {
  const prCount = Object.keys(records?.prs ?? {}).length;
  const badgeCount = Object.keys(records?.badges ?? {}).length;
  const totalKm = records?.totalVolumeKm ?? 0;

  return (
    <div className="text-text-primary">
      <h2 className="text-2xl font-bold mb-6 text-center">Conquistas</h2>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="p-3 rounded-xl bg-bg-surface border border-border text-center">
          <div className="text-2xl font-bold text-accent">{prCount}</div>
          <div className="text-xs text-text-muted">Recordes</div>
        </div>
        <div className="p-3 rounded-xl bg-bg-surface border border-border text-center">
          <div className="text-2xl font-bold text-accent">{badgeCount}</div>
          <div className="text-xs text-text-muted">Conquistas</div>
        </div>
        <div className="p-3 rounded-xl bg-bg-surface border border-border text-center">
          <div className="text-2xl font-bold text-accent">{totalKm.toFixed(1)}</div>
          <div className="text-xs text-text-muted">Km totais</div>
        </div>
      </div>

      <h3 className="font-bold mb-3">Recordes</h3>
      <div className="space-y-2 mb-6">
        {PR_DISTANCES.map((D) => {
          const pr = records?.prs?.[String(D)];
          return (
            <button
              key={D}
              type="button"
              disabled={!pr}
              onClick={() => pr && onOpenSession(pr.sessionId)}
              className={`w-full flex items-center justify-between p-3 rounded-xl bg-bg-surface border border-border text-left ${pr ? 'hover:bg-bg-elevated' : 'opacity-60 cursor-default'}`}
            >
              <span className="font-semibold">{formatDistance(D)}</span>
              {pr ? (
                <span className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{formatDuration(Math.round(pr.timeSeconds))}</span>
                  <span className="text-text-muted">{new Date(pr.date).toLocaleDateString()}</span>
                  <span className="text-xs text-text-muted">{pr.mode === 'treadmill' ? 'Esteira' : 'Rua'}</span>
                  <ChevronRight size={16} className="text-text-muted" />
                </span>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </button>
          );
        })}
      </div>

      <h3 className="font-bold mb-3">Conquistas</h3>
      <div className="space-y-4 mb-6">
        {BADGE_GROUPS.map((group) => (
          <div key={group.id}>
            <h4 className="text-sm font-semibold text-text-secondary mb-2">{group.label}</h4>
            <div className="grid grid-cols-3 gap-2">
              {group.ids.map((id) => {
                const badge = records?.badges?.[id];
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!badge}
                    onClick={() => badge && onOpenSession(badge.sessionId)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-center ${
                      badge
                        ? 'bg-bg-surface border-border text-accent'
                        : 'bg-bg-elevated border-transparent text-text-muted opacity-60 cursor-default'
                    }`}
                  >
                    {badge ? <Medal size={20} /> : <Lock size={16} />}
                    <span className="text-[10px] leading-tight text-text-primary">{BADGE_LABELS[id]}</span>
                    {badge && <span className="text-[9px] text-text-muted">{new Date(badge.unlockedAt).toLocaleDateString()}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <h3 className="font-bold mb-3">Como os recordes funcionam</h3>
      <div className="flex flex-wrap gap-2">
        {PR_DISTANCES.map((D) => (
          <span key={D} className="px-3 py-1 rounded-full bg-bg-surface border border-border text-xs text-text-secondary">
            {formatDistance(D)}
          </span>
        ))}
      </div>
    </div>
  );
}
```

> `sessions` é recebido via props para futura resolução local; a resolução do `sessionId` é feita em `App.tsx` (Task 10). Para evitar "unused var" no lint, use `sessions` no topo (ex.: `const sessionCount = sessions.length;` não necessário — o TypeScript não acusa props não usadas; aceite se `tsc` reclamar de `sessions` não usado: adicione `void sessions;` dentro do componente).

- [ ] **Step 2: Verify typecheck**

Run: `npm run lint`
Expected: SÓ os 21 erros pré-existentes.

- [ ] **Step 3: Commit**

```bash
git add src/components/Achievements.tsx
git commit -m "feat(achievements): Conquistas tab layout C with PRs and badges [skip ci]"
```

---

### Task 12: `SessionSummary` — bloco de celebração

**Files:**
- Modify: `src/components/SessionSummary.tsx` — imports (linha 1) e inserção após a grade 2×2 (~linha 155), antes de "Desempenho vs Plano".

**Interfaces:**
- Consumes: `session.prResults?: PrResults` (Task 5), `formatDistance`, `formatDuration` (de `../types`), lucide `Trophy`, `Medal`.
- Produces: bloco "Novos recordes" + "Conquistas desbloqueadas" renderizado **só** quando há novidade.

- [ ] **Step 1: Import icons**

Em `src/components/SessionSummary.tsx` linha 1, adicione `Trophy, Medal` ao import de `lucide-react`.

- [ ] **Step 2: Insert celebration block**

Encontre o fecho da grade 2×2 (o `</div>` que fecha o grid de 2 colunas, imediatamente antes do bloco "Desempenho vs Plano" — localize `Desempenho vs Plano` no JSX e insira **antes** do `<h3>`/bloco correspondente). Insira:

```tsx
        {session.prResults && (session.prResults.newPrs.length > 0 || session.prResults.newBadges.length > 0) && (
          <div className="p-4 rounded-xl mb-6 bg-bg-surface">
            {session.prResults.newPrs.length > 0 && (
              <div className="mb-3">
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <Trophy className="text-amber-400" size={18} />
                  Novos recordes
                </h3>
                <div className="space-y-1">
                  {session.prResults.newPrs.map((pr) => (
                    <div key={pr.distKm} className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{formatDistance(pr.distKm)}</span>
                      <span className="text-text-secondary">{formatDuration(Math.round(pr.timeSeconds))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {session.prResults.newBadges.length > 0 && (
              <div>
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <Medal className="text-amber-400" size={18} />
                  Conquistas desbloqueadas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {session.prResults.newBadges.map((b) => (
                    <span key={b.id} className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ background: '#241b0e', border: '1px solid #7a5610', color: '#f5b942' }}>
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run lint`
Expected: SÓ os 21 erros pré-existentes.

- [ ] **Step 4: Commit**

```bash
git add src/components/SessionSummary.tsx
git commit -m "feat(summary): celebration block for new PRs and badges [skip ci]"
```

---

### Task 13: `ShareCard` — pill de recorde + fix do clip do traçado

**Files:**
- Modify: `src/components/ShareCard.tsx` — `RouteSVG` (134–163) e pill (novo) nas variantes pace/left/bottom/map.

**Interfaces:**
- Consumes: `session.prResults?: PrResults`, `formatDistance`, `formatDuration` (já importados na linha 3).
- Produces: `NewPrPill` interno; RouteSVG com pad interno de 10.

- [ ] **Step 1: Fix do clip do traçado (pad interno)**

Em `RouteSVG` (linhas 145–148), substitua o mapeamento de `points`:

```ts
  const points = pts.map(p => ({
    x: 10 + ((p.lon! - minLon) / w) * 80,
    y: 10 + ((maxLat - p.lat!) / h) * 80,
  }));
```

> `viewBox="0 0 100 100"` permanece — com pad de 10, o traçado nunca toca as bordas do SVG.

- [ ] **Step 2: Componente `NewPrPill`**

Adicione após o componente `Blobs` (após a linha 125):

```tsx
function NewPrPill({ session }: { session: TrainingSession }) {
  const prs = session.prResults?.newPrs;
  if (!prs || prs.length === 0) return null;
  const [first] = prs;
  const extra = prs.length > 1 ? ` · +${prs.length - 1}` : '';
  return (
    <div style={{ position: 'absolute', top: 200, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 30, pointerEvents: 'none' }}>
      <div style={{ background: '#241b0e', border: '1px solid #7a5610', color: '#f5b942', borderRadius: 999, padding: '10px 22px', fontSize: 24, fontWeight: 700, whiteSpace: 'nowrap' }}>
        ★ Novo recorde: {formatDistance(first.distKm)} · {formatDuration(Math.round(first.timeSeconds))}{extra}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Renderizar a pill nas 4 variantes**

Em cada variante não-transparente (`pace` ~285, `left` ~300, `bottom` ~314, `map` ~329), logo após a abertura do `<div className={...} style={rootStyle}>`, adicione:

```tsx
        <NewPrPill session={session} />
```

(4 inserções idênticas; a variante `transparent`/sticker **não** recebe pill.)

- [ ] **Step 4: Verify typecheck + tests**

Run: `npm test`
Expected: PASS (inclui `ShareCard.test.ts`).

Run: `npm run lint`
Expected: SÓ os 21 erros pré-existentes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ShareCard.tsx
git commit -m "feat(sharecard): new PR pill and fix route clip with internal padding [skip ci]"
```

---

### Task 14: Timeout BLE — 10s → 15s

**Files:**
- Modify: `android/app/src/main/java/com/correlogo/app/TreadmillBleService.kt:287`
- Modify: `src/lib/use-treadmill.ts:103-108`

**Interfaces:**
- Produces: scan nativo com 15s; timeout JS de 16s (15s + margem).

- [ ] **Step 1: Kotlin — timeout do scan**

Em `TreadmillBleService.kt`, linha 287, substitua:

```kotlin
                delay(10000)
```

por:

```kotlin
                delay(15000)
```

- [ ] **Step 2: Hook — timeout JS**

Em `use-treadmill.ts`, linhas 103–108, substitua o comentário e o timeout:

```ts
    // Caso o plugin nativo não emita um evento "scan finished", manter o estado SCANNING visível
    // até o timeout nativo (15s em TreadmillBleService.startScan) + pequena margem.
    scanTimeoutRef.current = setTimeout(() => {
      if (transportTypeRef.current) {
        setState('DISCONNECTED');
      }
    }, 16000);
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run lint`
Expected: SÓ os 21 erros pré-existentes.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/correlogo/app/TreadmillBleService.kt src/lib/use-treadmill.ts
git commit -m "fix(ble): extend scan timeout to 15s native and 16s hook [skip ci]"
```

---

### Task 15: Validação completa + docs + commit final

**Files:**
- Modify: `CHANGELOG.md`, `HANDOFF.md`, `TODO.md`, `docs/superpowers/specs/2026-08-01-milestones-design.md` (emenda dos 2 itens), `docs/superpowers/plans/2026-08-01-milestones.md` (marcar steps concluídos).

**Interfaces:**
- Consumes: tudo.

- [ ] **Step 1: Suíte completa**

```powershell
npm test
npm run lint
```

Expected: todos PASS; lint com exatamente os mesmos 21 erros pré-existentes (0 novos).

- [ ] **Step 2: Build web + Capacitor + APK**

```powershell
Copy-Item -Path ".env.apk" -Destination ".env" -Force
npm run build
npx cap sync android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
cd android
gradlew assembleDebug
cd ..
```

Expected: build Vite sem erros; `[info] Found N Capacitor plugins for android`; APK debug gerado.

- [ ] **Step 3: Atualizar docs**

- `CHANGELOG.md`: entrada para Milestones/Conquistas + tab bar + fixes (clip RouteSVG, timeout BLE).
- `HANDOFF.md`: descrever o que foi feito, contexto técnico, impacto; remover os 2 itens da lista de pausados (agora concluídos).
- `TODO.md`: marcar Milestones/Conquistas como concluído; remover fix clip/timeout BLE de pausados.
- Spec: mover os 2 itens de "Fora de escopo" para "Decisões aprovadas" (emenda de 2026-08-01).

- [ ] **Step 4: Commit final**

```bash
git status
git diff --stat
git add -A
git commit -m "feat(milestones): PRs, badges, tab bar and BLE/clip fixes [skip ci]"
```

Confirme que `app-release-v139.apk` (untracked na raiz) **não** foi commitado (`git rm --cached` se necessário / adicionar ao `.gitignore` se ainda não estiver).

---

## Self-Review

**Cobertura do spec:**
- `computeCrossingTime` (interpolação, `i===0`, null) → Task 1. ✅
- `applySessionToRecords` (PRs, fallback, longest, volume, badges, `newBadges`) → Task 2. ✅
- `recomputeRecords` (delete) → Task 3. ✅
- `backfillRecords` (ordem cronológica) + `readRecords`/`saveRecords` (localStorage + Firestore, sem merge) → Task 4. ✅
- `prResults` transitório (não persistido; anexado ao `selectedSession`) → Tasks 5 e 6. ✅
- Wiring `markAsCompleted` + 3 caminhos de delete (uncomplete, deletePlan, onDeleteSession) → Task 6/10. ✅
- TabBar 4 abas (ícone Tabler `run`, acento ativo, escondida em transientes) → Tasks 7 e 10. ✅
- SessionHistory → Registros; UserProfile → Perfil + Tema; header só logo; back → Tasks 8, 9, 10. ✅
- Achievements layout C (destaques, RECORDES 11 linhas com `—`, grade BADGES, "Como os recordes funcionam") → Task 11. ✅
- Celebração no SessionSummary (Trophy/Medal âmbar) → Task 12. ✅
- Pill no ShareCard (âmbar, `★ Novo recorde: X km · tempo [+N]`, top:200) → Task 13. ✅
- Fix clip RouteSVG (pad) + timeout BLE → Tasks 13 e 14 (emenda aprovada). ✅
- Testes do spec (todos os casos) → Tasks 1–4 (vitest), baseline mantido. ✅

**Placeholders:** nenhum "TBD"/"implement later" — todo código está inline. ✅

**Consistência de tipos:** `PrResults` (types.ts) e `applySessionToRecords` retornam `newPrs`/`newBadges` estruturalmente idênticos; `TabId` usado em `App.tsx` e `TabBar`; `Records`/`PR_DISTANCES`/`BADGE_LABELS`/`BADGE_GROUPS` consistentes entre records.ts, Achievements e App. ✅
