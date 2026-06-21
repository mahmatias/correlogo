import { MapPin, Clock, ArrowLeft, BarChart2, Table, Download } from 'lucide-react';
import { formatDistance, formatDuration, TrainingSession } from '../types';
import MapComponent from './MapComponent';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useState } from 'react';
import { generateTCX, generateGPX } from '../lib/exportUtils';

interface Props {
  session: TrainingSession;
  onClose: () => void;
  isDarkMode: boolean;
}

export default function SessionSummary({ session, onClose, isDarkMode }: Props) {
  const [viewMode, setViewMode] = useState<'km' | 'lap'>('km');

  // Basic stats
  const avgPace = session.totalDurationSeconds / (session.totalDistanceKm || 1); // seconds per km
  
  // Pace data for graph
  const paceHistory = (session.points || []).map(p => ({
    timeSeconds: p.timestampSeconds,
    pace: p.speedKmh > 0 ? (60 / p.speedKmh) : 0
  }));

  const validPaces = (paceHistory || []).filter(h => h.pace > 0).map(h => h.pace);
  const bestPace = validPaces.length > 0 ? Math.min(...validPaces) * 60 : avgPace;

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
    <div className={`fixed inset-0 z-50 flex flex-col p-6 overflow-y-auto ${isDarkMode ? 'bg-bg-deep' : 'bg-agate-cream'} text-${isDarkMode ? 'text-text-primary' : 'obsidian'}`}>
        <button onClick={onClose} className="mb-4 flex items-center gap-2">
            <ArrowLeft /> Voltar
        </button>

        <h2 className="text-2xl font-bold mb-6 text-center">Resumo da Sessão</h2>

        <div className="flex gap-2 mb-6 justify-center">
            <button onClick={exportTCX} className="px-4 py-2 bg-tourmaline text-selenite rounded-lg text-sm font-bold">Exportar .TCX</button>
            {session.mode === 'outdoor' && (
                <button onClick={exportGPX} className="px-4 py-2 bg-tourmaline text-selenite rounded-lg text-sm font-bold">Exportar .GPX</button>
            )}
        </div>

        {path.length > 0 && (
            <div className="w-full mb-6 h-64">
                <MapComponent coords={null} path={path} isDarkMode={isDarkMode} />
            </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
            <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-bg-bedrock' : 'bg-selenite'}`}>
                <div className="text-sm text-text-muted">Total Distância</div>
                <div className="text-xl font-bold">{formatDistance(session.totalDistanceKm)}</div>
            </div>
            <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-bg-bedrock' : 'bg-selenite'}`}>
                <div className="text-sm text-text-muted">Total Tempo</div>
                <div className="text-xl font-bold">{formatDuration(session.totalDurationSeconds)}</div>
            </div>
            <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-bg-bedrock' : 'bg-selenite'}`}>
                <div className="text-sm text-text-muted">Pace Médio</div>
                <div className="text-xl font-bold">{formatDuration(Math.round(avgPace))} /km</div>
            </div>
            <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-bg-bedrock' : 'bg-selenite'}`}>
                <div className="text-sm text-text-muted">Melhor Pace</div>
                <div className="text-xl font-bold">{formatDuration(Math.round(bestPace))} /km</div>
            </div>
        </div>

        {paceHistory.length > 0 && (
            <div className={`p-4 rounded-xl mb-6 ${isDarkMode ? 'bg-bg-bedrock' : 'bg-selenite'}`}>
                <h3 className="font-bold mb-4">Variação de Pace</h3>
                <div className="relative h-48 min-h-[192px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={paceHistory}>
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
                            <Line type="monotone" dataKey="pace" stroke="#8884d8" dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}
        
    </div>
  );
}
