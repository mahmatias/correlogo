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
const CARTO_KEY = (import.meta.env.VITE_CARTO_API_KEY as string | undefined) ?? '';

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
  return `https://${sub}.basemaps.cartocdn.com/dark_all/${t.z}/${t.x}/${t.y}.png${CARTO_KEY ? `?key=${CARTO_KEY}` : ''}`;
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
