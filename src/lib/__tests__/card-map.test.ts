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
    expect(url).toMatch(/^https:\/\/[abcd]\.basemaps\.cartocdn\.com\/dark_all\/16\/24272\/37185\.png(\?key=.*)?$/);
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
