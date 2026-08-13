import { MapPin, Clock, ArrowLeft, BarChart2, Table, Download, CheckCircle, XCircle, Share2, X, Trophy, Medal, Flame, Heart } from 'lucide-react';
import { formatDistance, formatDuration, TrainingSession, WorkoutPlan, getStepTypeLabel, ProfileData } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';

const MapComponent = lazy(() => import('./MapComponent'));
import { generateTCX, generateGPX } from '../lib/exportUtils';
import { evaluateSessionPerformance, suggestAdjustment } from '../lib/evaluatePerformance';
import { isNative } from '../lib/capacitor/platform';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import ShareScreen from './ShareScreen';
import { calculateKcal, formatKcal } from '../lib/calories';
import { estimateHrMax } from '../lib/hr-zones';
import { zoneColor, zoneLabel } from '../lib/hr-zones';
import { computeHrSummary } from '../lib/hr-summary';

interface Props {
  session: TrainingSession;
  plan?: WorkoutPlan;
  profile?: ProfileData | null;
  onClose: () => void;
  onSuggestAdjustment?: (adjustedPlan: WorkoutPlan) => void;
  showFeedback?: (type: 'success' | 'error', message: string) => void;
}

function ScrollHint({ visible }: { visible: boolean }) {
  const [show, setShow] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!visible) { setShow(false); return; }
    const fadeTimer = setTimeout(() => setFading(true), 2500);
    const hideTimer = setTimeout(() => setShow(false), 3000);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, [visible]);

  if (!show) return null;

  return (
    <div className={`text-center text-xs text-text-muted mb-2 animate-pulse flex items-center justify-center gap-2${fading ? ' opacity-0 transition-opacity duration-500' : ''}`}>
      <span>◀</span>
      <span>deslize para ver mais steps →</span>
    </div>
  );
}

export default function SessionSummary({ session, plan, profile, onClose, onSuggestAdjustment, showFeedback }: Props) {
  const [viewMode, setViewMode] = useState<'km' | 'lap'>('km');
  const [showShareModal, setShowShareModal] = useState(false);

  // Basic stats
  const avgPace = session.totalDurationSeconds / (session.totalDistanceKm || 1); // seconds per km
  const weightKg = profile?.weightInKg ?? 70;
  const estimatedKcal = calculateKcal(session, weightKg);

  const hrMax = estimateHrMax(profile?.dob ?? null);
  const hrSummary = hrMax ? computeHrSummary(session.points || [], hrMax) : null;
  const hrPoints = (session.points || [])
    .filter(p => p.heartRate)
    .map(p => ({ timeSeconds: p.timestampSeconds, heartRate: p.heartRate! }));

  // Pace data for graph
  const pacePoints = (session.points || []).map(p => ({
    timeSeconds: p.timestampSeconds,
    pace: p.speedKmh > 0 ? (60 / p.speedKmh) : 0,
    stepIndex: p.stepIndex
  }));

  const COLORS = ['#8884d8', '#82ca9d', '#ff7300', '#ff0000', '#0088FE', '#00C49F'];

  const validPaces = (pacePoints || []).filter(h => h.pace > 0).map(h => h.pace);
  const bestPace = validPaces.length > 0 ? Math.min(...validPaces) * 60 : avgPace;
  
  const evalPlan: WorkoutPlan | null = session.planSteps
    ? { id: session.planId, name: session.planName, steps: session.planSteps }
    : plan;
  const evaluation = evalPlan ? evaluateSessionPerformance(evalPlan, session) : null;

  const path = (session.points || []).filter(p => p.lat !== undefined && p.lon !== undefined).map(p => ({
      lat: p.lat!,
      lng: p.lon!,
      timestamp: p.timestampSeconds * 1000 + Date.now() // Dummy timestamp for map component
  }));

  const saveFile = async (content: string, filename: string, mime: string) => {
    if (isNative()) {
      try {
        await Filesystem.mkdir({
          path: 'Download/CorreLogo',
          directory: Directory.ExternalStorage,
          recursive: true,
        }).catch(() => {});
        await Filesystem.writeFile({
          path: `Download/CorreLogo/${filename}`,
          data: content,
          directory: Directory.ExternalStorage,
          encoding: Encoding.UTF8,
        });
        showFeedback('success', 'Arquivo salvo');
      } catch (err) {
        showFeedback('error', 'Erro ao salvar arquivo');
      }
    } else {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const exportTCX = () => saveFile(generateTCX(session), `session_${session.id}.tcx`, 'application/xml');
  const exportGPX = () => saveFile(generateGPX(session), `session_${session.id}.gpx`, 'application/gpx+xml');

  return (
    <div className="fixed inset-0 z-50 flex flex-col p-6 overflow-y-auto bg-bg-deep text-text-primary" role="dialog" aria-modal="true" aria-label="Resumo da sessão">
        <button onClick={onClose} className="mb-4 flex items-center gap-2">
            <ArrowLeft /> Voltar
        </button>

        <h2 className="text-2xl font-bold mb-1 text-center">Resumo da Sessão</h2>
        <p className="text-xs text-text-muted text-center">ID: {session.id}</p>
        {session.date && (
          <p className="text-xs text-text-muted text-center mb-6">
            Realizada em: {new Date(session.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às {new Date(session.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        )}

        <div className="flex gap-2 mb-6 justify-center flex-wrap">
            <button onClick={exportTCX} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-bold">Exportar .TCX</button>
            {session.mode === 'outdoor' && (
                <button onClick={exportGPX} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-bold">Exportar .GPX</button>
            )}
            <button onClick={() => setShowShareModal(true)} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-bold flex items-center gap-2">
                <Share2 className="w-4 h-4" /> Compartilhar
            </button>
        </div>

        {path.length > 0 && (
            <div className="w-full mb-6" style={{ minHeight: '300px', height: '300px' }}>
                <Suspense fallback={<div className="w-full bg-bg-elevated rounded animate-pulse flex items-center justify-center text-text-muted" style={{ height: '300px' }}>Carregando mapa…</div>}>
                    <MapComponent coords={null} path={path} />
                </Suspense>
            </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-bg-surface">
                <div className="text-sm text-text-secondary">Total Distância</div>
                <div className="text-xl font-bold">{formatDistance(session.totalDistanceKm)}</div>
            </div>
            <div className="p-4 rounded-xl bg-bg-surface">
                <div className="text-sm text-text-secondary">Total Tempo</div>
                <div className="text-xl font-bold">{formatDuration(session.totalDurationSeconds)}</div>
            </div>
            <div className="p-4 rounded-xl bg-bg-surface">
                <div className="text-sm text-text-secondary">Pace Médio</div>
                <div className="text-xl font-bold">{formatDuration(Math.round(avgPace))} /km</div>
            </div>
            <div className="p-4 rounded-xl bg-bg-surface">
                <div className="text-sm text-text-secondary">Melhor Pace</div>
                <div className="text-xl font-bold">{formatDuration(Math.round(bestPace))} /km</div>
            </div>
            <div className="p-4 rounded-xl bg-bg-surface flex items-center gap-2">
                <Flame className="text-amber-400" size={24} />
                <div>
                    <div className="text-sm text-text-secondary">Gasto estimado</div>
                    <div className="text-xl font-bold text-amber-400">{formatKcal(estimatedKcal)}</div>
                </div>
            </div>
        </div>

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
        
        {evaluation && (
          <div className="p-4 rounded-xl mb-6 bg-bg-surface">
            <h3 className="font-bold mb-4">Desempenho vs Plano</h3>
            <div className="text-sm mb-3">{evaluation.completionRate.toFixed(0)}% dos steps concluídos no pace alvo</div>

            {/* scroll hint */}
            <ScrollHint visible={evaluation.stepResults.length > 1} />

            {/* carousel track */}
            <div
              className="flex gap-3 overflow-x-auto pb-3"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {evaluation.stepResults.map((res) => {
                const stepName = getStepTypeLabel(res.type);

                const barColor = res.completed
                  ? 'bg-success'
                  : res.actualAvgPace > 0 && res.actualAvgPace <= (res.targetPace || 0) * 1.25
                    ? 'bg-warning'
                    : 'bg-text-muted';

                return (
                  <div
                    key={res.stepIndex}
                    className="flex-shrink-0 w-[220px] rounded-xl bg-bg-elevated p-4 border border-border"
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    <div className="text-xs text-text-muted uppercase mb-1">Step {res.stepIndex + 1}</div>
                    <div className="text-base font-bold text-text-primary mb-3">{stepName}</div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div>
                        <div className="text-[10px] text-text-muted">Distância</div>
                        <div className="font-semibold text-text-primary">{formatDistance(res.distanceCovered)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-muted">Veloc. Média</div>
                        <div className="font-semibold text-text-primary">
                          {res.avgSpeedKmh > 0 ? `${res.avgSpeedKmh.toFixed(1)} km/h` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-muted">Ritmo Médio</div>
                        <div className="font-semibold text-text-primary">
                          {res.actualAvgPace > 0 ? `${formatDuration(Math.round(res.actualAvgPace * 60))} /km` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-muted">Duração</div>
                        <div className="font-semibold text-text-primary">
                          {res.durationInStep > 0 ? formatDuration(Math.round(res.durationInStep)) : '—'}
                        </div>
                      </div>
                    </div>

                    {/* progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-text-muted mb-1">
                        <span>Progresso</span>
                        <span>{Math.round(res.progressPct)}%</span>
                      </div>
                      <div className="h-1.5 bg-bg-deep rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor} transition-all duration-300`}
                          style={{ width: `${res.progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* status icon */}
                    <div className="mt-2 flex justify-end">
                      {res.completed
                        ? <CheckCircle className="text-success w-4 h-4" />
                        : <XCircle className="text-danger w-4 h-4" />
                      }
                    </div>
                  </div>
                );
              })}
            </div>

            {evaluation.needsAdjustment && (
              <div className="bg-warning/10 p-3 rounded-lg text-warning text-sm mt-3">
                A progressão atual parece acelerada para você. Deseja que os próximos treinos sejam ajustados?
                <button onClick={() => plan && onSuggestAdjustment?.(suggestAdjustment(plan))} className="block mt-2 font-bold underline">
                  Sugerir ajuste nos próximos treinos
                </button>
              </div>
            )}
          </div>
        )}

        {pacePoints.length > 0 && (
            <div className="p-4 rounded-xl mb-6 bg-bg-surface">
                <h3 className="font-bold mb-4">Variação de Pace</h3>
                <div className="relative h-48 min-h-[192px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={pacePoints}>
                            <XAxis dataKey="timeSeconds" tickFormatter={(timeSeconds) => {
                                const minutes = Math.floor(timeSeconds / 60);
                                const seconds = Math.floor(timeSeconds % 60);
                                return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
                            }} />
                            <YAxis domain={['auto', 'auto']} tickFormatter={(pace) => {
                                const minutes = Math.floor(pace);
                                const seconds = Math.round((pace - minutes) * 60);
                                return `${minutes < 10 ? '0' : ''}${minutes}'${seconds < 10 ? '0' : ''}${seconds}"`;
                            }} reversed />
                            <Tooltip labelFormatter={() => ''} formatter={(value: number) => {
                                const minutes = Math.floor(value);
                                const seconds = Math.round((value - minutes) * 60);
                                return [`${minutes < 10 ? '0' : ''}${minutes}'${seconds < 10 ? '0' : ''}${seconds}"`, 'Pace'];
                            }} />
                            <Line 
                                type="monotone" 
                                dataKey="pace" 
                                stroke="#8884d8" 
                                strokeWidth={2}
                                dot={(props: any) => {
                                    const { cx, cy, payload } = props;
                                    if (payload.pace === 0) return null;
                                    const color = COLORS[payload.stepIndex % COLORS.length];
                                    return <circle cx={cx} cy={cy} r={3} fill={color} stroke={color} />;
                                }} 
                                connectNulls={true}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

        {hrSummary && (
            <div className="p-4 rounded-xl mb-6 bg-bg-surface">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Heart className="text-danger" size={18} /> Frequência Cardíaca
                </h3>
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-bg-elevated text-center">
                        <div className="text-[10px] text-text-muted uppercase">Média</div>
                        <div className="text-lg font-bold">{Math.round(hrSummary.avgHr)}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-bg-elevated text-center">
                        <div className="text-[10px] text-text-muted uppercase">Máx</div>
                        <div className="text-lg font-bold text-danger">{hrSummary.maxHr}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-bg-elevated text-center">
                        <div className="text-[10px] text-text-muted uppercase">Mín</div>
                        <div className="text-lg font-bold">{hrSummary.minHr}</div>
                    </div>
                </div>
                {hrPoints.length > 1 && (
                    <div className="relative h-40 min-h-[160px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={hrPoints}>
                                <XAxis dataKey="timeSeconds" tickFormatter={(t) => {
                                    const minutes = Math.floor(t / 60);
                                    const seconds = Math.floor(t % 60);
                                    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
                                }} />
                                <YAxis domain={['auto', 'auto']} tickFormatter={(v) => String(v)} />
                                <Tooltip labelFormatter={() => ''} formatter={(value: number) => [`${value} bpm`, 'FC']} />
                                <Line type="monotone" dataKey="heartRate" stroke="#ef4444" strokeWidth={2} dot={false} connectNulls />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                    {([1, 2, 3, 4, 5] as const).map(z => {
                        const secs = hrSummary.timeByZone[z];
                        if (secs <= 0) return null;
                        return (
                            <span key={z} className="px-2 py-1 rounded-full text-xs font-medium bg-bg-elevated" style={{ color: zoneColor(z) }}>
                                {zoneLabel(z)} · {formatDuration(Math.round(secs))}
                            </span>
                        );
                    })}
                </div>
            </div>
        )}

        {session.mode === 'outdoor' && (session.points || []).filter(p => p.altitude !== undefined).length > 1 && (
            <div className="p-4 rounded-xl mb-6 bg-bg-surface">
                <h3 className="font-bold mb-4">Perfil de Elevação</h3>
                <div className="relative h-48 min-h-[192px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={(session.points || []).filter(p => p.altitude !== undefined)}>
                            <XAxis dataKey="distanceKm" tickFormatter={(km) => `${km.toFixed(1)}km`} domain={['auto', 'auto']} />
                            <YAxis domain={['auto', 'auto']} tickFormatter={(m) => `${m.toFixed(0)}m`} />
                            <Tooltip labelFormatter={(km: number) => `${km.toFixed(2)} km`} formatter={(value: number) => [`${value.toFixed(1)} m`, 'Altitude']} />
                            <Line type="monotone" dataKey="altitude" stroke="#ff7300" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}

{showShareModal && (
  <ShareScreen
    session={session}
    profile={profile}
    onClose={() => setShowShareModal(false)}
    showFeedback={showFeedback}
  />
)}
    </div>
  );
}
