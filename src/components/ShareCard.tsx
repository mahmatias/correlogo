import type { CSSProperties } from 'react';
import { TrainingSession, formatDistance, formatDuration } from '../types';

export type CardVariant = 'a' | 'b' | 'c';

export interface ShareCardData {
  distance: string;
  duration: string;
  pace: string;
  speed: string;
  date: string;
  mode: string;
  name: string;
}

export function extractCardData(session: TrainingSession): ShareCardData {
  const avgPaceSeconds = session.totalDurationSeconds / (session.totalDistanceKm || 1);
  return {
    distance: formatDistance(session.totalDistanceKm),
    duration: formatDuration(session.totalDurationSeconds),
    pace: formatDuration(Math.round(avgPaceSeconds)) + ' /km',
    speed: session.avgSpeedKmh.toFixed(1) + ' km/h',
    date: session.date
      ? new Date(session.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      : '',
    mode: session.mode === 'treadmill' ? 'Esteira' : 'Rua',
    name: session.planName || 'Corrida',
  };
}

interface ShareCardProps {
  data: ShareCardData;
  variant: CardVariant;
  showStats: Record<string, boolean>;
  className?: string;
  style?: CSSProperties;
  session: TrainingSession;
}

function RouteSVG({ session }: { session: TrainingSession }) {
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
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
      <path d={d} fill="none" stroke="white" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      {points.length > 1 && (
        <>
          <circle cx={points[0].x} cy={points[0].y} r="2" fill="#22C55E" />
          <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2" fill="#EF4444" />
        </>
      )}
    </svg>
  );
}

export default function ShareCard({ data, variant, showStats, className, style, session }: ShareCardProps) {
  const statLines: { key: string; value: string }[] = [];
  if (showStats.distance) statLines.push({ key: 'Distância', value: data.distance });
  if (showStats.duration) statLines.push({ key: 'Duração', value: data.duration });
  if (showStats.pace) statLines.push({ key: 'Pace', value: data.pace });
  if (showStats.speed) statLines.push({ key: 'Velocidade', value: data.speed });

  const showLogo = showStats.logo !== false;
  const showDate = showStats.date;
  const showMode = showStats.mode;
  const showName = showStats.name;

  if (variant === 'a') {
    return (
      <div
        className={`relative flex flex-col items-center justify-center text-white overflow-hidden ${className || ''}`}
        style={{
          width: '1080px',
          height: '1920px',
          background: 'linear-gradient(135deg, #1a0533 0%, #2d1b69 35%, #e8598b 70%, #ffb347 100%)',
          ...style,
        }}
      >
        <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] rounded-full bg-white/[0.04]" />
        <div className="absolute -bottom-[300px] -left-[100px] w-[500px] h-[500px] rounded-full bg-white/[0.04]" />

        {showLogo && (
          <div className="absolute top-16 left-16 text-lg font-bold tracking-[0.3em] opacity-60" style={{ fontFamily: 'Geologica, sans-serif' }}>
            CORRE LOGO
          </div>
        )}

        <div className="flex flex-col items-center gap-4 px-12 text-center" style={{ fontFamily: 'Geologica, sans-serif' }}>
          {statLines.map(s => (
            <div key={s.key}>
              <div className="text-5xl font-black tracking-tight leading-tight">{s.value}</div>
              <div className="text-sm font-light opacity-60 mt-1">{s.key}</div>
            </div>
          ))}

          {(showDate || showMode || showName) && (
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 mt-6 text-xs opacity-50">
              {showDate && <span>{data.date}</span>}
              {showMode && <span>{data.mode}</span>}
              {showName && <span>{data.name}</span>}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'b') {
    return (
      <div
        className={`relative flex flex-col items-center justify-center overflow-hidden ${className || ''}`}
        style={{
          width: '1080px',
          height: '1920px',
          background: 'radial-gradient(ellipse at 50% 30%, #1a1040, #0a0a14 70%)',
          ...style,
        }}
      >
        <div className="w-[720px] rounded-3xl px-12 py-16 text-white text-center" style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.10)',
          fontFamily: 'Geologica, sans-serif',
        }}>
          {showLogo && (
            <div className="text-[10px] tracking-[0.4em] opacity-30 mb-6">CORRE LOGO</div>
          )}
          {statLines.map(s => (
            <div key={s.key} className="mb-6 last:mb-0">
              <div className="text-sm opacity-50 mb-1">{s.key}</div>
              <div className="text-4xl font-bold tracking-tight">{s.value}</div>
            </div>
          ))}
          {(showDate || showMode || showName) && (
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 mt-8 text-[11px] opacity-40">
              {showDate && <span>{data.date}</span>}
              {showMode && <span>{data.mode}</span>}
              {showName && <span>{data.name}</span>}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'c') {
    return (
      <div
        className={`relative flex flex-col text-white overflow-hidden ${className || ''}`}
        style={{
          width: '1080px',
          height: '1920px',
          background: 'linear-gradient(180deg, #0a1628 0%, #0f2027 40%, #1a3a3a 70%, #0d2818 100%)',
          ...style,
        }}
      >
        {/* grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" viewBox="0 0 100 100" preserveAspectRatio="none">
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 5} y1="0" x2={i * 5} y2="100" stroke="white" strokeWidth="0.3" />
          ))}
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 5} x2="100" y2={i * 5} stroke="white" strokeWidth="0.3" />
          ))}
        </svg>

        <RouteSVG session={session} />

        <div className="absolute bottom-0 left-0 right-0 px-14 py-16" style={{
          background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)',
        }}>
          <div className="flex flex-col gap-5" style={{ fontFamily: 'Geologica, sans-serif' }}>
            {statLines.map(s => (
              <div key={s.key} className="flex items-baseline justify-between">
                <span className="text-xs opacity-50">{s.key}</span>
                <span className="text-3xl font-bold">{s.value}</span>
              </div>
            ))}
          </div>
          {(showDate || showMode || showName) && (
            <div className="flex gap-4 mt-6 text-[10px] opacity-40">
              {showDate && <span>{data.date}</span>}
              {showMode && <span>{data.mode}</span>}
              {showName && <span>{data.name}</span>}
            </div>
          )}
          {showLogo && (
            <div className="absolute top-6 left-14 text-[10px] tracking-[0.4em] opacity-30">CORRE LOGO</div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
