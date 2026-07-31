# Share Cards / Adesivos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a tela de compartilhamento atual por uma nova tela com 4 cards (Stats+Pace, Stats esquerda, Stats embaixo, Mapa real), abas Cartões/Adesivos, edição inline e salvar na Galeria.

**Architecture:** Camadas de libs puras testáveis (`splits.ts` para pace por km/5km, `card-map.ts` para Web Mercator sem Leaflet, `gradients.ts` para presets) + componentes (`ShareCard.tsx` reescrito com 4 variantes, `ShareScreen.tsx` novo que substitui o modal atual em `SessionSummary.tsx`) + métodos nativos Kotlin (`saveToGallery`, `shareToWhatsApp` no `SocialSharePlugin.kt`). Captura por dom-to-image (spike CORS validado). Sem Leaflet no card 4.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind 4, Vite 6, Vitest 4, dom-to-image-more, `@capacitor/camera@^7`, Capacitor core 7 (não subir app/browser para 8), Kotlin/Gradle (Android).

## Global Constraints

- **Build exige**: `Copy-Item -Path ".env.apk" -Destination ".env" -Force` antes de qualquer `npm run build`. Nunca copiar `.env.dev`.
- **`npm install`** sempre com `--legacy-peer-deps` (conflito peer `firebase@11 vs 12` pré-existente).
- **`@capacitor/camera` na versão `^7`** (compatível com core 7.6.7). Não instalar `@capacitor/app`/`@capacitor/browser` 8.
- **Edições Android** apenas em `android/app/src/main/java/com/correlogo/app/` (regra 3 do AGENTS.md).
- **`JAVA_HOME`** = `C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot` antes de `gradlew`.
- **Canvas do card**: 1080×1920. Área útil do story: y 350–1650. Logo uniforme 60px (swoosh `#FF006E`). Card 4: mapa 816×816 (`left:132; top:540`), ordem z fundo < mapa < logo.
- **Sem novos deps** além de `@capacitor/camera`. Sem `uuid` (usar `crypto.randomUUID()`).
- **Sem `rg`** no ambiente — usar `Select-String`/`Get-Content` no PowerShell.
- `npm run lint` tem **2 erros pré-existentes** (`treadmill-machine.ts:85`, `vite.config.ts:6`) — não são desta feature; não corrigir e não adicionar novos.

---

### Task 1: `src/lib/splits.ts` — pace por km / por grupo de 5km

**Files:**
- Create: `src/lib/splits.ts`
- Test: `src/lib/__tests__/splits.test.ts`

**Interfaces:**
- Consumes: `TrainingSession`, `ActivityPoint` de `src/types.ts` (campos `distanceKm` cumulativo, `timestampSeconds`).
- Produces: `PaceBlock`, `pacePerKm(points, maxBlocks?)`, `pacePerGroup(points, groupKm?, maxBlocks?)`, `choosePaceBlocks(session)`, `formatPaceShort(seconds)`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/splits.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { pacePerKm, pacePerGroup, choosePaceBlocks, formatPaceShort } from '../splits';
import type { ActivityPoint, TrainingSession } from '../../types';

// 5km com 1 ponto a cada 500m, pace uniforme 5:00/km (150s por 0.5km)
function uniformPoints(totalKm: number, paceSec = 300, stepKm = 0.5): ActivityPoint[] {
  const pts: ActivityPoint[] = [];
  const steps = Math.round(totalKm / stepKm);
  for (let i = 0; i <= steps; i++) {
    pts.push({
      timestampSeconds: i * (paceSec * stepKm),
      speedKmh: 60 / (paceSec / 60),
      distanceKm: Math.min(i * stepKm, totalKm),
      stepIndex: 0,
    });
  }
  return pts;
}

describe('pacePerKm', () => {
  it('bucketa por km com pace uniforme (5:00/km)', () => {
    const blocks = pacePerKm(uniformPoints(5), 10);
    expect(blocks).toHaveLength(5);
    for (const b of blocks) {
      expect(b.paceSeconds).toBeCloseTo(300, 0);
    }
    expect(blocks.map(b => b.label)).toEqual(['KM 1', 'KM 2', 'KM 3', 'KM 4', 'KM 5']);
  });

  it('funciona em esteira (pontos sem lat/lon)', () => {
    const blocks = pacePerKm(uniformPoints(3), 10);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].paceSeconds).toBeCloseTo(300, 0);
  });

  it('cobre km parcial final (3.2km -> 4 blocos)', () => {
    const blocks = pacePerKm(uniformPoints(3.2), 10);
    expect(blocks).toHaveLength(4);
    expect(blocks[3].paceSeconds).toBeCloseTo(300, 0);
  });

  it('retorna null de pace quando o bloco não tem pontos suficientes', () => {
    const pts: ActivityPoint[] = [
      { timestampSeconds: 0, speedKmh: 10, distanceKm: 0, stepIndex: 0 },
      { timestampSeconds: 300, speedKmh: 10, distanceKm: 1, stepIndex: 0 },
      { timestampSeconds: 600, speedKmh: 10, distanceKm: 3, stepIndex: 0 },
    ];
    const blocks = pacePerKm(pts, 10);
    expect(blocks[0].paceSeconds).toBeCloseTo(300, 0);
    expect(blocks[1].paceSeconds).toBeNull();
  });
});

describe('pacePerGroup', () => {
  it('agrupa 12.4km em blocos 1-5, 6-10, 11', () => {
    const blocks = pacePerGroup(uniformPoints(12.4), 5, 10);
    expect(blocks.map(b => b.label)).toEqual(['1-5', '6-10', '11']);
    for (const b of blocks) expect(b.paceSeconds).toBeCloseTo(300, 0);
  });
});

describe('choosePaceBlocks', () => {
  it('usar pacePerKm para até 5km', () => {
    const session: TrainingSession = {
      id: 's1', planId: 'p1', planName: 'Treino', date: '2026-07-31', mode: 'outdoor',
      totalDurationSeconds: 1500, totalDistanceKm: 5, avgSpeedKmh: 12, completed: true,
      points: uniformPoints(5),
    };
    const blocks = choosePaceBlocks(session);
    expect(blocks).toHaveLength(5);
    expect(blocks[0].label).toBe('KM 1');
  });

  it('usar pacePerGroup acima de 5km', () => {
    const session: TrainingSession = {
      id: 's2', planId: 'p1', planName: 'Longa', date: '2026-07-31', mode: 'outdoor',
      totalDurationSeconds: 3720, totalDistanceKm: 12.4, avgSpeedKmh: 12, completed: true,
      points: uniformPoints(12.4),
    };
    const blocks = choosePaceBlocks(session);
    expect(blocks[0].label).toBe('1-5');
  });

  it('fallback para total quando não há points', () => {
    const session: TrainingSession = {
      id: 's3', planId: 'p1', planName: 'Treino', date: '2026-07-31', mode: 'outdoor',
      totalDurationSeconds: 1500, totalDistanceKm: 5, avgSpeedKmh: 12, completed: true,
      points: [],
    };
    const blocks = choosePaceBlocks(session);
    expect(blocks).toEqual([{ label: 'GERAL', paceSeconds: 300 }]);
  });
});

describe('formatPaceShort', () => {
  it("formata 300s como 5'00\"", () => {
    expect(formatPaceShort(300)).toBe("5'00\"");
    expect(formatPaceShort(292)).toBe("4'52\"");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/splits.test.ts`
Expected: FAIL — `Cannot find module '../splits'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/splits.ts`:

```typescript
import type { ActivityPoint, TrainingSession } from '../types';

export interface PaceBlock {
  label: string;
  paceSeconds: number | null;
}

interface KmBucket {
  startKm: number;
  endKm: number;
  pts: ActivityPoint[];
}

function bucketize(points: ActivityPoint[], blockKm: number, maxBlocks: number): KmBucket[] {
  const pts = points.filter(p => Number.isFinite(p.distanceKm) && p.distanceKm >= 0);
  if (pts.length < 2) return [];
  const totalKm = pts[pts.length - 1].distanceKm;
  if (totalKm <= 0) return [];
  const n = Math.min(maxBlocks, Math.max(1, Math.ceil(totalKm / blockKm)));
  const buckets: KmBucket[] = [];
  for (let i = 0; i < n; i++) {
    const startKm = i * blockKm;
    const endKm = i === n - 1 ? totalKm : startKm + blockKm;
    const bpts = pts.filter(p => p.distanceKm >= startKm && p.distanceKm <= endKm);
    buckets.push({ startKm, endKm, pts: bpts });
  }
  return buckets;
}

function bucketPace(bucket: KmBucket): number | null {
  const { pts } = bucket;
  if (pts.length < 2) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const dDelta = last.distanceKm - first.distanceKm;
  const tDelta = last.timestampSeconds - first.timestampSeconds;
  if (dDelta < 0.01 || tDelta <= 0) return null;
  return tDelta / dDelta;
}

export function pacePerKm(points: ActivityPoint[], maxBlocks = 10): PaceBlock[] {
  return bucketize(points, 1, maxBlocks).map(b => ({
    label: `KM ${Math.round(b.endKm)}`,
    paceSeconds: bucketPace(b),
  }));
}

export function pacePerGroup(points: ActivityPoint[], groupKm = 5, maxBlocks = 10): PaceBlock[] {
  return bucketize(points, groupKm, maxBlocks).map(b => {
    const full = Math.round(b.endKm) === Math.round(b.startKm + groupKm);
    const label = full
      ? `${Math.round(b.startKm) + 1}-${Math.round(b.endKm)}`
      : `${Math.round(b.startKm) + 1}`;
    return { label, paceSeconds: bucketPace(b) };
  });
}

export function choosePaceBlocks(session: TrainingSession): PaceBlock[] {
  const pts = session.points || [];
  const last = pts[pts.length - 1];
  const totalKm = last ? last.distanceKm : 0;
  if (pts.length >= 2 && totalKm > 0) {
    return totalKm <= 5 ? pacePerKm(pts, 10) : pacePerGroup(pts, 5, 10);
  }
  const pace = session.totalDistanceKm > 0 ? session.totalDurationSeconds / session.totalDistanceKm : null;
  return [{ label: 'GERAL', paceSeconds: pace }];
}

export function formatPaceShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}'${s.toString().padStart(2, '0')}"`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/splits.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/splits.ts src/lib/__tests__/splits.test.ts
git commit -m "feat(share): add splits lib (pace per km / 5km blocks) [skip ci]"
```

---

### Task 2: `src/lib/gradients.ts` — presets de gradiente + swoosh

**Files:**
- Create: `src/lib/gradients.ts`
- Test: `src/lib/__tests__/gradients.test.ts`

**Interfaces:**
- Consumes: nothing (constantes).
- Produces: `GradientPreset { id, label, css }`, `GRADIENT_PRESETS` (6), `LOGO_SWOOSH_PATHS` (2 strings), `LOGO_COLOR`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/gradients.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GRADIENT_PRESETS, LOGO_SWOOSH_PATHS, LOGO_COLOR } from '../gradients';

describe('GRADIENT_PRESETS', () => {
  it('exporta exatamente 6 presets', () => {
    expect(GRADIENT_PRESETS).toHaveLength(6);
  });

  it('todos têm id único, label e css linear-gradient', () => {
    const ids = new Set(GRADIENT_PRESETS.map(p => p.id));
    expect(ids.size).toBe(GRADIENT_PRESETS.length);
    for (const p of GRADIENT_PRESETS) {
      expect(p.label).toBeTruthy();
      expect(p.css).toContain('linear-gradient');
    }
  });
});

describe('logo swoosh', () => {
  it('tem 2 paths e cor #FF006E', () => {
    expect(LOGO_SWOOSH_PATHS).toHaveLength(2);
    expect(LOGO_SWOOSH_PATHS[0]).toContain('M20 65');
    expect(LOGO_COLOR).toBe('#FF006E');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/gradients.test.ts`
Expected: FAIL — `Cannot find module '../gradients'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/gradients.ts`:

```typescript
export interface GradientPreset {
  id: string;
  label: string;
  css: string;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  { id: 'rosa', label: 'Rosa', css: 'linear-gradient(160deg, #1a0533 0%, #2d1b69 38%, #e8598b 74%, #ffb347 100%)' },
  { id: 'oceano', label: 'Oceano', css: 'linear-gradient(160deg, #041229 0%, #0b3a6b 42%, #00b4d8 78%, #90e0ef 100%)' },
  { id: 'lima', label: 'Lima', css: 'linear-gradient(160deg, #0a2e12 0%, #14532d 42%, #65a30d 78%, #facc15 100%)' },
  { id: 'fogo', label: 'Fogo', css: 'linear-gradient(160deg, #1c0303 0%, #4a0e0e 42%, #dc2626 78%, #fbbf24 100%)' },
  { id: 'neon', label: 'Neon', css: 'linear-gradient(160deg, #0d0d1a 0%, #1b1035 45%, #7c3aed 80%, #f472b6 100%)' },
  { id: 'minimal', label: 'Minimal', css: 'linear-gradient(160deg, #050505 0%, #1a1a1f 100%)' },
];

export const LOGO_SWOOSH_PATHS = [
  'M20 65 C30 65, 45 55, 55 45 C40 48, 30 45, 25 38 C40 38, 55 30, 85 20 C75 38, 60 62, 50 75 C52 65, 48 58, 42 56 C35 64, 25 65, 20 65 Z',
  'M15 50 C25 50, 35 43, 42 37 C35 39, 28 37, 25 33 C33 33, 45 27, 55 22 C48 32, 42 42, 38 48 C39 42, 36 38, 32 37 C28 44, 20 50, 15 50 Z',
];

export const LOGO_COLOR = '#FF006E';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/gradients.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gradients.ts src/lib/__tests__/gradients.test.ts
git commit -m "feat(share): add gradient presets + logo swoosh [skip ci]"
```

---

### Task 3: `src/lib/card-map.ts` — Web Mercator + tiles + traçado (sem Leaflet)

**Files:**
- Create: `src/lib/card-map.ts`
- Test: `src/lib/__tests__/card-map.test.ts`

**Interfaces:**
- Consumes: nothing (puro).
- Produces: `GeoPoint { lat, lon }`, `MapView { zoom, scale, ox, oy, size }`, `TileRef { x, y, z, left, top }`, `RouteShape { d, start, end }`, `projectLatLon(lat, lon)`, `computeMapView(points, size, fit)`, `defaultView(size)`, `tilesFor(view)`, `tileUrl(t)`, `routeShape(points, view)`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/card-map.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { projectLatLon, computeMapView, defaultView, tilesFor, tileUrl, routeShape } from '../card-map';
import type { GeoPoint, MapView } from '../card-map';

describe('projectLatLon', () => {
  it('projeta (0,0) no centro do mundo', () => {
    const p = projectLatLon(0, 0);
    expect(p.x).toBeCloseTo(0.5, 6);
    expect(p.y).toBeCloseTo(0.5, 6);
  });

  it('clampa latitudes extremas em y=0 e y=1', () => {
    expect(projectLatLon(85.0511, 0).y).toBeCloseTo(0, 3);
    expect(projectLatLon(-85.0511, 0).y).toBeCloseTo(1, 3);
  });
});

describe('computeMapView', () => {
  const route: GeoPoint[] = [
    { lat: -23.5834, lon: -46.6634 },
    { lat: -23.5846, lon: -46.6524 },
  ];

  it('produz view com zoom no range [2,18] e size 816', () => {
    const view = computeMapView(route, 816, 752);
    expect(view.size).toBe(816);
    expect(view.zoom).toBeGreaterThanOrEqual(2);
    expect(view.zoom).toBeLessThanOrEqual(18);
    expect(view.scale).toBe(256 * Math.pow(2, view.zoom));
  });

  it('rota inteira fica dentro do box (offsets positivos < size)', () => {
    const view = computeMapView(route, 816, 752);
    for (const p of route) {
      const proj = projectLatLon(p.lat, p.lon);
      const sx = proj.x * view.scale - view.ox;
      const sy = proj.y * view.scale - view.oy;
      expect(sx).toBeGreaterThan(0);
      expect(sx).toBeLessThan(816);
      expect(sy).toBeGreaterThan(0);
      expect(sy).toBeLessThan(816);
    }
  });
});

describe('tilesFor / tileUrl', () => {
  it('cobre todo o box sem sobreposição de cobertura', () => {
    const view = computeMapView([
      { lat: -23.5834, lon: -46.6634 },
      { lat: -23.5846, lon: -46.6524 },
    ], 816, 752);
    const tiles = tilesFor(view);
    expect(tiles.length).toBeGreaterThan(0);
    const xs = [...new Set(tiles.map(t => t.x))].sort((a, b) => a - b);
    const ys = [...new Set(tiles.map(t => t.y))].sort((a, b) => a - b);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(3);
    for (const t of tiles) {
      expect(t.z).toBe(view.zoom);
      expect(t.left).toBe((t.x * 256 - view.ox));
      expect(t.top).toBe((t.y * 256 - view.oy));
    }
  });

  it('monta URL CARTO dark_all com subdomínio a/b/c/d', () => {
    const url = tileUrl({ x: 24272, y: 37185, z: 16, left: 0, top: 0 });
    expect(url).toMatch(/^https:\/\/[abcd]\.basemaps\.cartocdn\.com\/dark_all\/16\/24272\/37185\.png$/);
  });
});

describe('routeShape / defaultView', () => {
  const route: GeoPoint[] = [
    { lat: -23.5834, lon: -46.6634 },
    { lat: -23.5846, lon: -46.6524 },
  ];

  it('produz path M...L... e marcadores nos extremos', () => {
    const view = computeMapView(route, 816, 752);
    const shape = routeShape(route, view);
    expect(shape.d.startsWith('M')).toBe(true);
    expect(shape.d).toContain('L');
    const first = projectLatLon(route[0].lat, route[0].lon);
    expect(shape.start.x).toBeCloseTo(first.x * view.scale - view.ox, 1);
  });

  it('defaultView é zoom 12 com size preservado', () => {
    const view: MapView = defaultView(816);
    expect(view.zoom).toBe(12);
    expect(view.size).toBe(816);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/card-map.test.ts`
Expected: FAIL — `Cannot find module '../card-map'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/card-map.ts`:

```typescript
export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface MapView {
  zoom: number;
  scale: number;
  ox: number;
  oy: number;
  size: number;
}

export interface TileRef {
  x: number;
  y: number;
  z: number;
  left: number;
  top: number;
}

export interface RouteShape {
  d: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

const MAX_LAT = 85.05112878;
const TILE = 256;
const SUBDOMAINS = 'abcd';

export function projectLatLon(lat: number, lon: number): { x: number; y: number } {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const r = (clamped * Math.PI) / 180;
  return {
    x: (lon + 180) / 360,
    y: (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2,
  };
}

export function computeMapView(points: GeoPoint[], size: number, fit: number): MapView {
  const proj = points.map(p => projectLatLon(p.lat, p.lon));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of proj) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const dx = Math.max(maxX - minX, 1e-9);
  const dy = Math.max(maxY - minY, 1e-9);
  const zoom = Math.max(2, Math.min(18, Math.floor(Math.min(
    Math.log2(fit / (dx * TILE)),
    Math.log2(fit / (dy * TILE)),
  ))));
  const scale = TILE * Math.pow(2, zoom);
  return {
    zoom,
    scale,
    ox: ((minX + maxX) / 2) * scale - size / 2,
    oy: ((minY + maxY) / 2) * scale - size / 2,
    size,
  };
}

export function defaultView(size: number): MapView {
  const zoom = 12;
  const scale = TILE * Math.pow(2, zoom);
  const p = projectLatLon(-23.55, -46.63);
  return { zoom, scale, ox: p.x * scale - size / 2, oy: p.y * scale - size / 2, size };
}

export function tilesFor(view: MapView): TileRef[] {
  const tiles: TileRef[] = [];
  const tx0 = Math.floor(view.ox / TILE);
  const tx1 = Math.floor((view.ox + view.size) / TILE);
  const ty0 = Math.floor(view.oy / TILE);
  const ty1 = Math.floor((view.oy + view.size) / TILE);
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      tiles.push({ x: tx, y: ty, z: view.zoom, left: tx * TILE - view.ox, top: ty * TILE - view.oy });
    }
  }
  return tiles;
}

export function tileUrl(t: TileRef): string {
  const sub = SUBDOMAINS[(t.x + t.y) & 3];
  return `https://${sub}.basemaps.cartocdn.com/dark_all/${t.z}/${t.x}/${t.y}.png`;
}

export function routeShape(points: GeoPoint[], view: MapView): RouteShape {
  const proj = points.map(p => projectLatLon(p.lat, p.lon));
  const toSvg = (p: { x: number; y: number }) => ({
    x: p.x * view.scale - view.ox,
    y: p.y * view.scale - view.oy,
  });
  const svg = proj.map(toSvg);
  const d = svg.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
  return { d, start: svg[0], end: svg[svg.length - 1] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/card-map.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/card-map.ts src/lib/__tests__/card-map.test.ts
git commit -m "feat(share): add slippy map lib without leaflet [skip ci]"
```

---

### Task 4: Rewrite `src/components/ShareCard.tsx` — 4 variantes do mock + helpers puros

**Files:**
- Modify: `src/components/ShareCard.tsx` (rewrite completo)
- Test: `src/components/__tests__/ShareCard.test.ts`

**Interfaces:**
- Consumes: `formatDistance`, `formatDuration` e `TrainingSession` de `src/types.ts`; `PaceBlock`, `choosePaceBlocks`, `formatPaceShort` de `../lib/splits`; `GRADIENT_PRESETS`, `GradientPreset`, `LOGO_SWOOSH_PATHS`, `LOGO_COLOR` de `../lib/gradients`; `computeMapView`, `defaultView`, `tilesFor`, `tileUrl`, `routeShape` de `../lib/card-map`.
- Produces: `CardVariant` (`'pace' | 'left' | 'bottom' | 'map'`), `ShareCardData`, `StatValue`, `extractCardData(session)`, `STAT_LABELS`, `STAT_CHIP_LABELS`, `STAT_ORDER`, `gridCells(showStats)`, `statFor(key, data)`, default `ShareCard`.

> Nota de mudança: `extractCardData().speed` passa a ser apenas `12,1` (sem sufixo " km/h") — o rótulo da célula é 'km/h' agora. O modal antigo (que mostrava "Velocidade") será removido na Task 8.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/ShareCard.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/ShareCard.test.ts`
Expected: FAIL — `Cannot find module '../ShareCard'` (o arquivo de teste é novo; o `ShareCard.tsx` atual nem exporta `gridCells`).

- [ ] **Step 3: Rewrite `src/components/ShareCard.tsx`**

Replace the entire file content with:

```tsx
import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import { formatDistance, formatDuration } from '../types';
import type { TrainingSession } from '../types';
import { choosePaceBlocks, formatPaceShort } from '../lib/splits';
import type { PaceBlock } from '../lib/splits';
import { GRADIENT_PRESETS, LOGO_SWOOSH_PATHS, LOGO_COLOR } from '../lib/gradients';
import type { GradientPreset } from '../lib/gradients';
import { computeMapView, defaultView, tilesFor, tileUrl, routeShape } from '../lib/card-map';
import type { GeoPoint } from '../lib/card-map';

export type CardVariant = 'pace' | 'left' | 'bottom' | 'map';

export interface ShareCardData {
  distance: string;
  duration: string;
  pace: string;
  speed: string;
  date: string;
  mode: string;
  name: string;
}

export interface StatValue {
  key: string;
  label: string;
  value: string;
}

export function extractCardData(session: TrainingSession): ShareCardData {
  const avgPaceSeconds = session.totalDurationSeconds / (session.totalDistanceKm || 1);
  return {
    distance: formatDistance(session.totalDistanceKm),
    duration: formatDuration(session.totalDurationSeconds),
    pace: formatDuration(Math.round(avgPaceSeconds)) + ' /km',
    speed: session.avgSpeedKmh.toFixed(1),
    date: session.date
      ? new Date(session.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      : '',
    mode: session.mode === 'treadmill' ? 'Esteira' : 'Rua',
    name: session.planName || 'Corrida',
  };
}

export const STAT_ORDER = ['distance', 'pace', 'duration', 'speed', 'date', 'mode'] as const;

export const STAT_LABELS: Record<string, string> = {
  distance: 'Distância',
  pace: 'Pace',
  duration: 'Tempo total',
  speed: 'km/h',
  date: 'Data',
  mode: 'Modo',
};

export const STAT_CHIP_LABELS: Record<string, string> = {
  distance: 'Distância',
  duration: 'Duração',
  pace: 'Pace',
  speed: 'Velocidade',
  date: 'Data',
  mode: 'Modo',
  name: 'Treino',
  logo: 'Logo',
};

export function gridCells(showStats: Record<string, boolean>): string[] {
  return STAT_ORDER.filter(k => showStats[k]);
}

export function statFor(key: string, data: ShareCardData): StatValue {
  const values: Record<string, string> = {
    distance: data.distance,
    pace: data.pace,
    duration: data.duration,
    speed: data.speed,
    date: data.date,
    mode: data.mode,
  };
  return { key, label: STAT_LABELS[key] ?? key, value: values[key] ?? '' };
}

interface ShareCardProps {
  data: ShareCardData;
  variant: CardVariant;
  showStats: Record<string, boolean>;
  session: TrainingSession;
  gradient?: GradientPreset;
  photoUrl?: string | null;
  transparent?: boolean;
  className?: string;
  style?: CSSProperties;
}

function Logo() {
  return (
    <div style={{ position: 'absolute', top: 352, right: 60, width: 60, zIndex: 20, textAlign: 'center' }}>
      <svg viewBox="0 0 100 100" style={{ width: 60, height: 60, display: 'block', margin: '0 auto' }}>
        <path d={LOGO_SWOOSH_PATHS[0]} fill={LOGO_COLOR} />
        <path d={LOGO_SWOOSH_PATHS[1]} fill={LOGO_COLOR} opacity={0.6} />
      </svg>
      <div style={{ width: 60, margin: '6px auto 0', textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 600, lineHeight: 1.1 }}>
        <div style={{ fontSize: 15, letterSpacing: '0.16em', textIndent: '0.16em' }}>CORRE</div>
        <div style={{ fontSize: 16, letterSpacing: '0.30em', textIndent: '0.30em' }}>LOGO</div>
      </div>
    </div>
  );
}

function Title({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', top: 352, left: 60, width: 720, zIndex: 20, fontSize: 56, fontWeight: 800, lineHeight: 1.05 }}>
      {children}
    </div>
  );
}

function Blobs() {
  return (
    <>
      <div style={{ position: 'absolute', width: 520, height: 520, top: -140, right: -160, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ position: 'absolute', width: 640, height: 640, bottom: -260, left: -120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
    </>
  );
}

interface RouteSVGProps {
  session: TrainingSession;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

function RouteSVG({ session, stroke = 'rgba(255,255,255,0.6)', strokeWidth = 0.8, opacity = 0.6 }: RouteSVGProps) {
  const pts = (session.points || []).filter(p => p.lat !== undefined && p.lon !== undefined);
  if (pts.length < 2) return null;

  const minLat = Math.min(...pts.map(p => p.lat!));
  const maxLat = Math.max(...pts.map(p => p.lat!));
  const minLon = Math.min(...pts.map(p => p.lon!));
  const maxLon = Math.max(...pts.map(p => p.lon!));
  const w = maxLon - minLon || 1;
  const h = maxLat - minLat || 1;

  const points = pts.map(p => ({
    x: ((p.lon! - minLon) / w) * 100,
    y: ((maxLat - p.lat!) / h) * 100,
  }));

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet" style={{ opacity }}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))' }} />
      {points.length > 1 && (
        <>
          <circle cx={points[0].x} cy={points[0].y} r={2.6} fill="#22C55E" />
          <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={2.6} fill="#EF4444" />
        </>
      )}
    </svg>
  );
}

function PaceBox({ splits }: { splits: PaceBlock[] }) {
  const max = Math.max(...splits.map(s => s.paceSeconds ?? 0), 1);
  return (
    <div style={{ position: 'absolute', top: 948, left: 60, right: 60, height: 240 }}>
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '0.22em', opacity: 0.55, marginBottom: 14 }}>PACE POR KM</div>
      <div style={{ display: 'flex', gap: 26, height: 180, alignItems: 'flex-end' }}>
        {splits.map(s => {
          const pct = s.paceSeconds == null ? 20 : 20 + 80 * (s.paceSeconds / max);
          return (
            <div key={s.label} style={{ flex: '1 1 0', height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 26, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.paceSeconds == null ? '–' : formatPaceShort(s.paceSeconds)}</div>
              <div style={{ width: '100%', maxWidth: 88, height: `${pct}%`, borderRadius: '14px 14px 6px 6px', background: 'linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.35))' }} />
              <div style={{ fontSize: 20, opacity: 0.5 }}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatsGrid({ cells }: { cells: StatValue[] }) {
  return (
    <div style={{ position: 'absolute', top: 1235, left: 60, right: 60, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px 28px' }}>
      {cells.map((c, i) => (
        <div key={c.key} style={{ textAlign: ['left', 'center', 'right'][i % 3] }}>
          <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.05 }}>{c.value}</div>
          <div style={{ fontSize: 32, fontWeight: 300, opacity: 0.55, marginTop: 4 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function StatCol({ cells }: { cells: StatValue[] }) {
  return (
    <div style={{ position: 'absolute', left: 60, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 34, width: 300, padding: '40px 34px', background: 'rgba(0,0,0,0.32)', borderRadius: 24 }}>
      {cells.map(c => (
        <div key={c.key}>
          <div style={{ fontSize: 21, fontWeight: 300, opacity: 0.6 }}>{c.label}</div>
          <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function StatRow({ cells }: { cells: StatValue[] }) {
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, bottom: 270, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, zIndex: 20 }}>
      {cells.map(c => (
        <div key={c.key} style={{ background: 'rgba(0,0,0,0.34)', borderRadius: 22, padding: '26px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 300, opacity: 0.6, marginBottom: 8 }}>{c.label}</div>
          <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.1 }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

export function CardMap({ session }: { session: TrainingSession }) {
  const geo = useMemo<GeoPoint[]>(
    () => (session.points || [])
      .filter(p => p.lat !== undefined && p.lon !== undefined)
      .map(p => ({ lat: p.lat!, lon: p.lon! })),
    [session]
  );
  const view = useMemo(() => (geo.length >= 2 ? computeMapView(geo, 816, 752) : defaultView(816)), [geo]);
  const tiles = useMemo(() => tilesFor(view), [view]);
  const shape = useMemo(() => routeShape(geo, view), [geo, view]);

  return (
    <div style={{ position: 'absolute', left: 132, top: 540, width: 816, height: 816, background: '#15151f', overflow: 'hidden', zIndex: 1 }}>
      {tiles.map(t => (
        <img key={`${t.x}:${t.y}:${t.z}`} src={tileUrl(t)} alt="" style={{ position: 'absolute', left: t.left, top: t.top, width: 256, height: 256 }} />
      ))}
      {geo.length >= 2 && (
        <svg viewBox={`0 0 ${view.size} ${view.size}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 3 }}>
          <path d={shape.d} fill="none" stroke="#7c3aed" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.5))' }} />
          <circle cx={shape.start.x} cy={shape.start.y} r={14} fill="#22C55E" stroke="rgba(0,0,0,0.5)" strokeWidth={4} />
          <circle cx={shape.end.x} cy={shape.end.y} r={14} fill="#EF4444" stroke="rgba(0,0,0,0.5)" strokeWidth={4} />
        </svg>
      )}
    </div>
  );
}

function MapShade() {
  return (
    <div style={{ position: 'absolute', left: 132, top: 540, width: 816, height: 816, background: 'linear-gradient(0deg, rgba(0,0,0,0.6), transparent 42%)', pointerEvents: 'none', zIndex: 6 }} />
  );
}

export default function ShareCard({ data, variant, showStats, session, gradient = GRADIENT_PRESETS[0], photoUrl, transparent = false, className, style }: ShareCardProps) {
  const cells = gridCells(showStats).map(key => statFor(key, data));
  const showLogo = showStats.logo !== false;
  const splits = useMemo(() => choosePaceBlocks(session), [session]);
  const background = transparent ? 'transparent' : (photoUrl || gradient.css);
  const rootStyle: CSSProperties = { width: 1080, height: 1920, background, ...style };

  if (transparent) {
    const stickerCells = cells.slice(0, 4);
    return (
      <div className={`relative text-white overflow-hidden ${className || ''}`} style={rootStyle}>
        {variant === 'map' && <CardMap session={session} />}
        {variant === 'map' && <div style={{ position: 'absolute', left: 132, top: 540, width: 816, height: 816, background: 'linear-gradient(0deg, rgba(0,0,0,0.45), transparent 45%)', pointerEvents: 'none', zIndex: 6 }} />}
        {showLogo && <Logo />}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, padding: '0 64px', textAlign: 'center', zIndex: 10 }}>
          {stickerCells.map(c => (
            <div key={c.key} style={{ textShadow: '0 4px 12px rgba(0,0,0,0.6)' }}>
              <div style={{ fontSize: 96, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: 28, fontWeight: 300, opacity: 0.85, marginTop: 10 }}>{c.label}</div>
            </div>
          ))}
          {showStats.name && <div style={{ fontSize: 24, fontWeight: 600, opacity: 0.8, marginTop: 8 }}>{data.name}</div>}
        </div>
      </div>
    );
  }

  if (variant === 'pace') {
    return (
      <div className={`relative text-white overflow-hidden ${className || ''}`} style={rootStyle}>
        <Blobs />
        {showLogo && <Logo />}
        {showStats.name && <Title>{data.name}</Title>}
        <div style={{ position: 'absolute', top: 470, left: 60, right: 60, height: 450 }}>
          <RouteSVG session={session} stroke="rgba(255,255,255,0.75)" strokeWidth={5} />
        </div>
        {showStats.pace && splits.length > 0 && <PaceBox splits={splits} />}
        <StatsGrid cells={cells.slice(0, 6)} />
      </div>
    );
  }

  if (variant === 'left') {
    return (
      <div className={`relative text-white overflow-hidden ${className || ''}`} style={rootStyle}>
        <div style={{ position: 'absolute', width: 460, height: 460, top: -120, left: -140, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        {showLogo && <Logo />}
        {showStats.name && <Title>{data.name}</Title>}
        <div style={{ position: 'absolute', left: 60, right: 60, top: 470, bottom: 60 }}>
          <RouteSVG session={session} stroke="rgba(255,255,255,0.8)" strokeWidth={6} />
        </div>
        <StatCol cells={cells.slice(0, 3)} />
      </div>
    );
  }

  if (variant === 'bottom') {
    return (
      <div className={`relative text-white overflow-hidden ${className || ''}`} style={rootStyle}>
        <div style={{ position: 'absolute', width: 520, height: 520, top: -160, right: -120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        {showLogo && <Logo />}
        {showStats.name && <Title>{data.name}</Title>}
        <div style={{ position: 'absolute', left: 60, top: 470, width: 960, height: 960 }}>
          <RouteSVG session={session} stroke="rgba(255,255,255,0.8)" strokeWidth={6} />
        </div>
        <StatRow cells={cells.slice(0, 3)} />
      </div>
    );
  }

  // variant === 'map'
  return (
    <div className={`relative text-white overflow-hidden ${className || ''}`} style={rootStyle}>
      {showLogo && <Logo />}
      {showStats.name && <Title>{data.name}</Title>}
      <CardMap session={session} />
      <MapShade />
      <StatRow cells={cells.slice(0, 3)} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests + lint**

Run: `npx vitest run src/components/__tests__/ShareCard.test.ts`
Expected: PASS.

Run: `npm run lint`
Expected: apenas os 2 erros pré-existentes conhecidos (nada novo).

- [ ] **Step 5: Commit**

```bash
git add src/components/ShareCard.tsx src/components/__tests__/ShareCard.test.ts
git commit -m "feat(share): rewrite ShareCard with 4 mock-approved variants [skip ci]"
```

---

### Task 5: Native — `saveToGallery` + `shareToWhatsApp` no `SocialSharePlugin.kt`

**Files:**
- Modify: `android/app/src/main/java/com/correlogo/app/SocialSharePlugin.kt`
- Modify: `src/lib/shareCard.ts` (só a interface `SocialSharePluginInterface`)

**Interfaces:**
- Consumes: `fileForPath`/`sourceUriForPath` já existentes no plugin.
- Produces: métodos nativos `saveToGallery({ data, filename?, mimeType? }): { uri }` e `shareToWhatsApp({ imagePath }): void`; interface TS correspondente.

- [ ] **Step 1: Add native methods**

Add these imports at the top of `SocialSharePlugin.kt` (after the existing ones):

```kotlin
import android.content.ContentValues
import android.media.MediaScannerConnection
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
```

Add these methods inside the `SocialSharePlugin` class (after `copyImageToClipboard`):

```kotlin
    @PluginMethod
    fun saveToGallery(call: PluginCall) {
        val data = call.getString("data")
        val filename = call.getString("filename") ?: "corre-logo-card.png"
        val mimeType = call.getString("mimeType") ?: "image/png"
        if (data.isNullOrBlank()) {
            call.reject("data is required")
            return
        }
        val bytes = try {
            Base64.decode(data, Base64.DEFAULT)
        } catch (e: Exception) {
            call.reject("invalid base64 data")
            return
        }
        val displayName = "${System.currentTimeMillis()}_${filename.replace(" ", "_")}"
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, displayName)
            put(MediaStore.Images.Media.MIME_TYPE, mimeType)
            put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/CorreLogo")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        try {
            val collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
            val uri = activity.contentResolver.insert(collection, values)
                ?: return call.reject("gallery insert failed")
            activity.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                ?: return call.reject("gallery stream failed")
            values.clear()
            values.put(MediaStore.Images.Media.IS_PENDING, 0)
            activity.contentResolver.update(uri, values, null, null)
            MediaScannerConnection.scanFile(activity, arrayOf(uri.toString()), arrayOf(mimeType), null)
            call.resolve(mapOf("uri" to uri.toString()))
        } catch (e: Exception) {
            Log.e(TAG, "saveToGallery failed", e)
            call.reject("GALLERY_FAILED", e.message)
        }
    }

    @PluginMethod
    fun shareToWhatsApp(call: PluginCall) {
        val imagePath = call.getString("imagePath")
        if (imagePath.isNullOrBlank()) {
            call.reject("imagePath is required")
            return
        }
        val uri = sourceUriForPath(imagePath)
            ?: return call.reject("file not found: $imagePath")
        try {
            val intent = Intent(Intent.ACTION_SEND).apply {
                setPackage("com.whatsapp")
                setType("image/png")
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            activity.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "WhatsApp intent failed", e)
            call.reject("NO_RESOLVE", e.message)
        }
    }
```

- [ ] **Step 2: Update the TS interface in `src/lib/shareCard.ts`**

Replace the existing `SocialSharePluginInterface` with:

```typescript
export interface SocialSharePluginInterface {
  shareToInstagram(options: {
    backgroundPath?: string;
    stickerPath?: string;
    sourceApplication?: string;
  }): Promise<void>;
  copyImageToClipboard(options: { imagePath: string }): Promise<void>;
  saveToGallery(options: { data: string; filename?: string; mimeType?: string }): Promise<{ uri: string }>;
  shareToWhatsApp(options: { imagePath: string }): Promise<void>;
}
```

- [ ] **Step 3: Build the Android app to validate Kotlin**

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
cd android; .\gradlew.bat assembleDebug; cd ..
```
Expected: `BUILD SUCCESSFUL` (sem erros Kotlin).

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/correlogo/app/SocialSharePlugin.kt src/lib/shareCard.ts
git commit -m "feat(share): add saveToGallery + shareToWhatsApp native methods [skip ci]"
```

---

### Task 6: `src/lib/shareCard.ts` — `saveCardToGallery` + `shareToWhatsApp` wrappers

**Files:**
- Modify: `src/lib/shareCard.ts` (add functions below the existing `copyCardToClipboard`)

**Interfaces:**
- Consumes: `SocialShare` (plugin registrado), `isNative`, `saveBlobToCache` (privada existente).
- Produces: `saveCardToGallery(blob, filename?)`, `shareToWhatsApp(blob): Promise<'ok' | 'fallback'>`.

- [ ] **Step 1: Add the functions**

Append to `src/lib/shareCard.ts` (after `copyCardToClipboard`):

```typescript
async function blobToBase64(blob: Blob): Promise<string> {
  const reader = new FileReader();
  return new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function saveCardToGallery(blob: Blob, filename = 'corre-logo-card.png'): Promise<void> {
  if (isNative()) {
    const base64 = await blobToBase64(blob);
    await SocialShare.saveToGallery({ data: base64, filename, mimeType: blob.type || 'image/png' });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareToWhatsApp(blob: Blob): Promise<'ok' | 'fallback'> {
  if (!isNative()) return 'fallback';
  const saved = await saveBlobToCache(blob, 'corre-logo-whatsapp.png');
  try {
    await SocialShare.shareToWhatsApp({ imagePath: saved.uri });
    return 'ok';
  } catch (e) {
    console.error('[whatsapp]', e);
    return 'fallback';
  }
}
```

> Nota: `saveCardToGallery` também pode substituir o `base64` inline de `saveBlobToCache` — não obrigatório; se quiser, refatore `saveBlobToCache` para chamar `blobToBase64`.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: apenas os 2 erros pré-existentes (nada novo).

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: PASS (todas as suites existentes + novas de Tasks 1–4).

- [ ] **Step 4: Commit**

```bash
git add src/lib/shareCard.ts
git commit -m "feat(share): add gallery save + whatsapp share wrappers [skip ci]"
```

---

### Task 7: `src/components/ShareScreen.tsx` — nova tela (Cartões + Adesivos) + `@capacitor/camera`

**Files:**
- Create: `src/components/ShareScreen.tsx`
- Modify: `package.json` (dep `@capacitor/camera@^7`)

**Interfaces:**
- Consumes: `ShareCard`, `extractCardData`, `CardVariant`, `gridCells`, `STAT_CHIP_LABELS` (Task 4); `captureCard`, `shareImage`, `copyCardToClipboard`, `saveCardToGallery`, `shareToWhatsApp` (Tasks 5–6); `GRADIENT_PRESETS` (Task 2); `isNative`; `@capacitor/camera`.
- Produces: default `ShareScreen({ session, onClose, showFeedback? })`.

- [ ] **Step 1: Install the camera plugin**

```powershell
npm install @capacitor/camera@^7 --legacy-peer-deps
npx cap sync android
```
Expected: install OK + `[info] Found N Capacitor plugins for android` (camera presente). Não commitar `android/` se o sync só copiar plugins (verificar com `git status`).

- [ ] **Step 2: Create `src/components/ShareScreen.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, ClipboardCopy, Download, Instagram, Map as MapIcon, MessageCircle, Share2, SlidersHorizontal, X } from 'lucide-react';
import { Camera as CameraPlugin, CameraResultType, CameraSource } from '@capacitor/camera';
import ShareCard, { extractCardData, gridCells, STAT_CHIP_LABELS } from './ShareCard';
import type { CardVariant } from './ShareCard';
import { captureCard, shareImage, copyCardToClipboard, saveCardToGallery, shareToWhatsApp } from '../lib/shareCard';
import { GRADIENT_PRESETS } from '../lib/gradients';
import type { GradientPreset } from '../lib/gradients';
import Button from './Button';
import type { TrainingSession } from '../types';

const VARIANTS: CardVariant[] = ['pace', 'left', 'bottom', 'map'];
const PREVIEW_W = 324;
const CARD_SCALE = PREVIEW_W / 1080;

interface Props {
  session: TrainingSession;
  onClose: () => void;
  showFeedback?: (type: 'success' | 'error', message: string) => void;
}

const DEFAULT_STATS: Record<string, boolean> = {
  distance: true,
  duration: true,
  pace: true,
  speed: true,
  date: true,
  mode: true,
  name: true,
  logo: true,
};

type BusyState = 'idle' | 'sharing' | 'saving' | 'copying';

export default function ShareScreen({ session, onClose, showFeedback }: Props) {
  const [tab, setTab] = useState<'cards' | 'stickers'>('cards');
  const [cardIndex, setCardIndex] = useState(0);
  const [showStats, setShowStats] = useState(DEFAULT_STATS);
  const [gradient, setGradient] = useState<GradientPreset>(GRADIENT_PRESETS[0]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [stickerMap, setStickerMap] = useState(false);
  const [busy, setBusy] = useState<BusyState>('idle');
  const carouselRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  const variant = VARIANTS[cardIndex];
  const data = useMemo(() => extractCardData(session), [session]);
  const activeCells = useMemo(() => gridCells(showStats), [showStats]);
  const canSave = activeCells.length >= 2;
  const captureKey = useMemo(
    () => `${variant}-${gradient.id}-${photoUrl ?? 'none'}-${JSON.stringify(showStats)}-${tab}`,
    [variant, gradient.id, photoUrl, showStats, tab]
  );

  useEffect(() => {
    carouselRef.current?.scrollTo({ left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const scrollToIndex = (i: number) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollTo({ left: i * PREVIEW_W, behavior: 'smooth' });
  };

  const onCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / PREVIEW_W);
    const clamped = Math.max(0, Math.min(VARIANTS.length - 1, idx));
    if (clamped !== cardIndex) setCardIndex(clamped);
  };

  const toggleStat = (key: string) => {
    setShowStats(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const pickPhoto = async () => {
    try {
      const photo = await CameraPlugin.getPhoto({
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
        quality: 90,
        width: 1080,
      });
      setPhotoUrl(photo.dataUrl ?? null);
      showFeedback?.('success', 'Foto aplicada ao fundo');
    } catch (err) {
      console.error('[pick-photo]', err);
      showFeedback?.('error', 'Não foi possível carregar a foto');
    }
  };

  const runAction = async (fn: (blob: Blob) => Promise<void>, state: Exclude<BusyState, 'idle'>) => {
    const el = captureRef.current;
    if (!el) return;
    setBusy(state);
    try {
      await new Promise(r => setTimeout(r, 400));
      const blob = await captureCard(el);
      await fn(blob);
    } catch (err) {
      console.error('[share-action]', err);
      showFeedback?.('error', 'Erro ao processar imagem');
    } finally {
      setBusy('idle');
    }
  };

  const onStory = () => runAction(async blob => {
    await shareImage(blob, 'corre-logo-story.png', 'instagram-stories', 'background');
    onClose();
  }, 'sharing');

  const onWhatsApp = () => runAction(async blob => {
    const ok = await shareToWhatsApp(blob);
    if (ok === 'fallback') await shareImage(blob, 'corre-logo-card.png', 'native');
    onClose();
  }, 'sharing');

  const onMore = () => runAction(async blob => {
    await shareImage(blob, 'corre-logo-card.png', 'native');
    onClose();
  }, 'sharing');

  const onSave = () => runAction(async blob => {
    await saveCardToGallery(blob, 'corre-logo-card.png');
    showFeedback?.('success', 'Salvo na galeria');
  }, 'saving');

  const onStickerSave = () => runAction(async blob => {
    await saveCardToGallery(blob, 'corre-logo-sticker.png');
    showFeedback?.('success', 'Sticker salvo na galeria');
  }, 'saving');

  const onCopy = () => runAction(async blob => {
    await copyCardToClipboard(blob);
    showFeedback?.('success', 'Imagem copiada! Abra o Instagram e cole no story');
  }, 'copying');

  const stickerVariant: CardVariant = stickerMap ? 'map' : 'pace';

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg-deep overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onClose} className="text-text-muted p-1" aria-label="Fechar">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-bold">Compartilhar atividade</h2>
        <div className="w-7" />
      </div>

      <div className="flex gap-2 mb-4">
        {(['cards', 'stickers'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${tab === t ? 'bg-accent text-white border-accent' : 'bg-bg-elevated text-text-secondary border-border'}`}
          >
            {t === 'cards' ? 'Cartões' : 'Adesivos'}
          </button>
        ))}
      </div>

      {/* Elemento de captura oculto (fora da tela) */}
      <div key={captureKey} ref={captureRef} style={{ position: 'fixed', left: -9999, top: 0, zIndex: -1 }}>
        <ShareCard
          data={data}
          variant={tab === 'stickers' ? stickerVariant : variant}
          showStats={showStats}
          session={session}
          gradient={gradient}
          photoUrl={tab === 'stickers' ? undefined : photoUrl}
          transparent={tab === 'stickers'}
        />
      </div>

      {tab === 'cards' ? (
        <>
          {/* Carrossel */}
          <div
            ref={carouselRef}
            onScroll={onCarouselScroll}
            className="overflow-x-auto snap-x snap-mandatory no-scrollbar mb-2"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            <div style={{ display: 'flex', width: PREVIEW_W * VARIANTS.length }}>
              {VARIANTS.map((v, i) => (
                <div key={v} className="snap-center" style={{ width: PREVIEW_W, flexShrink: 0, padding: '0 4px' }}>
                  {i === cardIndex && (
                    <div style={{ aspectRatio: '9/16', overflow: 'hidden', borderRadius: 12 }}>
                      <div style={{ width: 1080, height: 1920, transform: `scale(${CARD_SCALE})`, transformOrigin: 'top left' }}>
                        <ShareCard
                          data={data}
                          variant={v}
                          showStats={showStats}
                          session={session}
                          gradient={gradient}
                          photoUrl={photoUrl}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Navegação do carrossel */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <button onClick={() => scrollToIndex(cardIndex - 1)} disabled={cardIndex === 0} className="text-text-muted disabled:opacity-30 p-1" aria-label="Anterior">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-1.5">
              {VARIANTS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToIndex(i)}
                  aria-label={`Cartão ${i + 1}`}
                  className={`w-2 h-2 rounded-full transition-colors ${i === cardIndex ? 'bg-accent' : 'bg-border'}`}
                />
              ))}
            </div>
            <button onClick={() => scrollToIndex(cardIndex + 1)} disabled={cardIndex === VARIANTS.length - 1} className="text-text-muted disabled:opacity-30 p-1" aria-label="Próximo">
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <Button variant="secondary" size="md" onClick={() => setEditing(e => !e)} className="w-full mb-2 flex items-center justify-center gap-2">
            <SlidersHorizontal className="w-4 h-4" /> {editing ? 'Ocultar edição' : 'Editar cartão'}
          </Button>

          {editing && (
            <div className="mb-3 p-3 rounded-xl bg-bg-surface space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(STAT_CHIP_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-text-primary">
                    <input
                      type="checkbox"
                      checked={showStats[key]}
                      onChange={() => toggleStat(key)}
                      className="accent-accent w-4 h-4"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div>
                <div className="text-xs font-bold text-text-secondary mb-2">Gradiente</div>
                <div className="flex gap-2 flex-wrap">
                  {GRADIENT_PRESETS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setGradient(p)}
                      aria-label={p.label}
                      title={p.label}
                      className={`w-10 h-16 rounded-lg border-2 transition-colors ${gradient.id === p.id ? 'border-accent' : 'border-border'}`}
                      style={{ background: p.css }}
                    />
                  ))}
                </div>
              </div>

              {variant !== 'map' && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="md" onClick={pickPhoto} className="flex items-center gap-2 flex-1">
                    <Camera className="w-4 h-4" /> Foto de fundo
                  </Button>
                  {photoUrl && (
                    <Button variant="ghost" size="md" onClick={() => setPhotoUrl(null)}>
                      Remover foto
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mb-2">
            <Button variant="secondary" size="lg" onClick={onStory} disabled={busy !== 'idle'} className="flex items-center justify-center gap-1">
              <Instagram className="w-5 h-5" /> Story
            </Button>
            <Button variant="secondary" size="lg" onClick={onWhatsApp} disabled={busy !== 'idle'} className="flex items-center justify-center gap-1">
              <MessageCircle className="w-5 h-5" /> WhatsApp
            </Button>
            <Button variant="secondary" size="lg" onClick={onMore} disabled={busy !== 'idle'} className="flex items-center justify-center gap-1">
              <Share2 className="w-5 h-5" /> Mais
            </Button>
          </div>

          <Button variant="primary" size="lg" onClick={onSave} disabled={busy !== 'idle' || !canSave} className="w-full flex items-center justify-center gap-2">
            <Download className="w-5 h-5" />
            {busy === 'saving' ? 'Salvando...' : 'Salvar no dispositivo'}
          </Button>
          {!canSave && <p className="text-xs text-text-muted text-center mt-1">Ative ao menos 2 estatísticas para salvar</p>}
        </>
      ) : (
        <>
          {/* Aba Adesivos */}
          <div className="flex-1 flex flex-col items-center justify-center mb-4 min-h-0">
            <div style={{ aspectRatio: '9/16', overflow: 'hidden', borderRadius: 12, maxWidth: '100%' }}>
              <div style={{ width: 1080, height: 1920, transform: `scale(${Math.min(1, 270 / 1080)})`, transformOrigin: 'top left' }}>
                <ShareCard
                  data={data}
                  variant={stickerVariant}
                  showStats={showStats}
                  session={session}
                  gradient={gradient}
                  transparent
                />
              </div>
            </div>
          </div>

          <div className="mb-3 p-3 rounded-xl bg-bg-surface space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(STAT_CHIP_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-text-primary">
                  <input
                    type="checkbox"
                    checked={showStats[key]}
                    onChange={() => toggleStat(key)}
                    className="accent-accent w-4 h-4"
                  />
                  {label}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-text-primary text-sm">
              <input
                type="checkbox"
                checked={stickerMap}
                onChange={e => setStickerMap(e.target.checked)}
                className="accent-accent w-4 h-4"
              />
              <MapIcon className="w-4 h-4" /> Incluir mapa no sticker
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" size="lg" onClick={onStickerSave} disabled={busy !== 'idle' || !canSave} className="flex items-center justify-center gap-2">
              <Download className="w-5 h-5" /> Salvar PNG
            </Button>
            <Button variant="secondary" size="lg" onClick={onCopy} disabled={busy !== 'idle'} className="flex items-center justify-center gap-2">
              <ClipboardCopy className="w-5 h-5" /> Copiar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build web**

```powershell
Copy-Item -Path ".env.apk" -Destination ".env" -Force
npm run build
```
Expected: `build` OK (sem erros de import). 

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: apenas os 2 erros pré-existentes (nada novo). Se aparecer erro novo, corrigir.

- [ ] **Step 5: Commit**

```bash
git add src/components/ShareScreen.tsx package.json package-lock.json
git commit -m "feat(share): add ShareScreen with cards/stickers tabs + camera [skip ci]"
```

> Note: `npx cap sync android` (Step 1) pode ter modificado `android/` apenas com a declaração do plugin camera. Verifique `git status`; se `android/` mudou só por causa do sync legítimo, inclua nesse commit. Se houver mudanças indevidas, reverta antes do commit.

---

### Task 8: Wire `SessionSummary.tsx` — substituir o modal antigo por `ShareScreen` + limpeza

**Files:**
- Modify: `src/components/SessionSummary.tsx`

**Interfaces:**
- Consumes: `ShareScreen` (Task 7).
- Produces: `SessionSummary` limpo, sem o modal antigo.

- [ ] **Step 1: Replace the old share modal**

In `src/components/SessionSummary.tsx`, replace the whole `{showShareModal && ( ... )}` block (lines ~328–462) with:

```tsx
{showShareModal && (
  <ShareScreen
    session={session}
    onClose={() => setShowShareModal(false)}
    showFeedback={showFeedback}
  />
)}
```

- [ ] **Step 2: Clean up now-dead state and imports**

Remove from `SessionSummary.tsx`:
- Imports: `ShareCard`, `extractCardData`, `CardVariant`, `captureCard`, `shareImage`, `copyCardToClipboard`, `SHARE_TARGETS`, e os ícones `Instagram`, `ClipboardCopy`, `Share2` (se não usados em outro lugar).
- Add import: `import ShareScreen from './ShareScreen';`
- State removido: `cardVariant`, `showStats`, `shareTarget`, `captureReady`, `sharing`, `cardCaptureRef`.
- Mantido: `showShareModal`, `setShowShareModal`.

Verificar no arquivo se `useRef` ainda é usado em outro lugar; se não, remover do import do `react`.

- [ ] **Step 3: Verify no dead references + build**

```powershell
Select-String -Path src\components\SessionSummary.tsx -Pattern "cardVariant|showStats|shareTarget|captureReady|cardCaptureRef|SHARE_TARGETS|captureCard|ShareCard"
```
Expected: sem ocorrências.

```powershell
Copy-Item -Path ".env.apk" -Destination ".env" -Force
npm run build
```
Expected: `build` OK.

- [ ] **Step 4: Full validation pipeline**

```powershell
npm test
npm run lint
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
npx cap sync android
cd android; .\gradlew.bat assembleDebug; cd ..
```
Expected: testes PASS · lint só com os 2 erros pré-existentes · `BUILD SUCCESSFUL`.

- [ ] **Step 5: Update session docs + commit**

Atualize `CHANGELOG.md`, `HANDOFF.md` e `TODO.md` (marque a tarefa "Implementar Share Cards/Adesivos" como concluída). Depois:

```bash
git add src/components/SessionSummary.tsx CHANGELOG.md HANDOFF.md TODO.md
git commit -m "feat(share): wire ShareScreen into SessionSummary, remove legacy modal [skip ci]"
```

---

## Self-Review

**1. Spec coverage:**
- `splits.ts` → Task 1 (pace por km / bloco 5km, esteira, fallback).
- `gradients.ts` → Task 2 (6 presets + swoosh `#FF006E`).
- `card-map.ts` → Task 3 (Web Mercator, tiles `dark_all`, traçado, sem Leaflet).
- ShareCard 4 variantes do mock → Task 4 (logo 60px uniforme, card1 grid 2×3 L/C/R + pacebox, card2 statcol, card3 statrow, card4 mapa 816×816 com shade).
- `saveToGallery` (MediaStore) + `shareToWhatsApp` (intent package) → Task 5; wrappers TS → Task 6.
- `ShareScreen` (abas Cartões/Adesivos, carrossel + dots, EditPanel inline, presets, foto via camera Base64, Story/WhatsApp/Mais/Salvar, PNG transparente + Copiar) → Task 7.
- Bloquear Salvar se <2 stats → Task 7 (`canSave`).
- Substituição do modal em `SessionSummary.tsx` + limpeza → Task 8.
- Pipeline completo (env.apk, build, test, lint, cap sync, gradlew) → Tasks 5/7/8.

**2. Placeholder scan:** sem TBD/TODO; todo código de passo incluído; comandos com saída esperada.

**3. Type consistency:**
- `CardVariant = 'pace' | 'left' | 'bottom' | 'map'` — usado em Task 4 (definição) e Tasks 7/8 (consumo) com os mesmos literais.
- `PaceBlock { label, paceSeconds }` — Task 1 define; Task 4 `PaceBox` consome `PaceBlock[]`.
- `choosePaceBlocks`, `formatPaceShort` — Task 1 exporta; Task 4 importa.
- `GradientPreset { id, label, css }` — Task 2 define; Tasks 4/7 consomem.
- `computeMapView/defaultView/tilesFor/tileUrl/routeShape/GeoPoint` — Task 3 define; Task 4 `CardMap` usa com os mesmos nomes.
- `saveCardToGallery(blob, filename?)` e `shareToWhatsApp(blob)` — Tasks 5/6 definem; Task 7 chama com assinatura idêntica.
- `StatValue { key, label, value }` e `gridCells/statFor` — Task 4; Task 7 usa `gridCells` e `STAT_CHIP_LABELS`.
- `ShareScreen({ session, onClose, showFeedback })` — Task 7 define; Task 8 monta com as mesmas props.
