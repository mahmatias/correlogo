import { MapPin, Clock, ArrowLeft, BarChart2, Table, Download, CheckCircle, XCircle } from 'lucide-react';
import { formatDistance, formatDuration, TrainingSession, WorkoutPlan } from '../types';
import MapComponent from './MapComponent';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useState } from 'react';
import { generateTCX, generateGPX } from '../lib/exportUtils';
import { evaluateSessionPerformance, suggestAdjustment } from '../lib/evaluatePerformance';

interface Props {
  session: TrainingSession;
  plan?: WorkoutPlan;
  onClose: () => void;
  onSuggestAdjustment?: (adjustedPlan: WorkoutPlan) => void;
}

export default function SessionSummary({ session, plan, onClose, onSuggestAdjustment }: Props) {
  const [viewMode, setViewMode] = useState<'km' | 'lap'>('km');

  // Basic stats
  const avgPace = session.totalDurationSeconds / (session.totalDistanceKm || 1); // seconds per km
  
  // Pace data for graph
  const pacePoints = (session.points || []).map(p => ({
    timeSeconds: p.timestampSeconds,
    pace: p.speedKmh > 0 ? (60 / p.speedKmh) : 0,
    stepIndex: p.stepIndex
  }));

  const COLORS = ['#8884d8', '#82ca9d', '#ff7300', '#ff0000', '#0088FE', '#00C49F'];

  const validPaces = (pacePoints || []).filter(h => h.pace > 0).map(h => h.pace);
  const bestPace = validPaces.length > 0 ? Math.min(...validPaces) * 60 : avgPace;
  
  const evaluation = plan ? evaluateSessionPerformance(plan, session) : null;

  const path = (session.points || []).filter(p => p.lat !== undefined && p.lon !== undefined).map(p => ({
      lat: p.lat!,
      lng: p.lon!,
      timestamp: p.timestampSeconds * 1000 + Date.now() // Dummy timestamp for map component
  }));

  const downloadFile = (content: string, filename: string, type: string) => {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const exportTCX = () => downloadFile(generateTCX(session), `session_${session.id}.tcx`, 'application/xml');
  const exportGPX = () => downloadFile(generateGPX(session), `session_${session.id}.gpx`, 'application/gpx+xml');

  return (
    <div className="fixed inset-0 z-50 flex flex-col p-6 overflow-y-auto bg-bg-deep text-text-primary" role="dialog" aria-modal="true" aria-label="Resumo da sessão">
        <button onClick={onClose} className="mb-4 flex items-center gap-2">
            <ArrowLeft /> Voltar
        </button>

        <h2 className="text-2xl font-bold mb-6 text-center">Resumo da Sessão</h2>

        <div className="flex gap-2 mb-6 justify-center">
            <button onClick={exportTCX} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-bold">Exportar .TCX</button>
            {session.mode === 'outdoor' && (
                <button onClick={exportGPX} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-bold">Exportar .GPX</button>
            )}
        </div>

        {path.length > 0 && (
            <div className="w-full mb-6 h-64">
                <MapComponent coords={null} path={path} />
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
        </div>
        
        {evaluation && (
          <div className="p-4 rounded-xl mb-6 bg-bg-surface">
            <h3 className="font-bold mb-4">Desempenho vs Plano</h3>
            <div className="text-sm mb-2">{evaluation.completionRate.toFixed(0)}% dos steps concluídos no pace alvo</div>
            <div className="space-y-2 mb-4">
              {evaluation.stepResults.map(res => (
                <div key={res.stepIndex} className="flex justify-between items-center text-sm">
                  <span>Step {res.stepIndex + 1}</span>
                  <div className="flex gap-4">
                    <span>Alvo: {res.targetPace.toFixed(2)}</span>
                    <span>Real: {res.actualAvgPace.toFixed(2)}</span>
                    {res.completed ? <CheckCircle className="text-success w-4 h-4" /> : <XCircle className="text-danger w-4 h-4" />}
                  </div>
                </div>
              ))}
            </div>
            {evaluation.needsAdjustment && (
              <div className="bg-warning/10 p-3 rounded-lg text-warning text-sm mb-3">
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
        
    </div>
  );
}
