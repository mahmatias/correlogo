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
