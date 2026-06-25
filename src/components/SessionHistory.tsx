import { ArrowLeft, Calendar, BarChart2 } from 'lucide-react';
import { TrainingSession, formatDistance, formatDuration } from '../types';

interface Props {
  sessions: TrainingSession[];
  onClose: () => void;
  onSelectSession: (session: TrainingSession) => void;
}

export default function SessionHistory({ sessions, onClose, onSelectSession }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col p-6 overflow-y-auto">
        <button onClick={onClose} className="mb-6 flex items-center gap-2">
            <ArrowLeft /> Voltar
        </button>
        <h2 className="text-2xl font-bold mb-6 text-center">Histórico de Treinos</h2>
        
        {sessions.length === 0 ? (
            <p className="text-center text-text-muted">Nenhuma sessão encontrada.</p>
        ) : (
            <div className="space-y-4">
                {sessions.map(session => (
                    <div 
                        key={session.id} 
                        className="p-4 rounded-xl cursor-pointer bg-bg-surface"
                        onClick={() => onSelectSession(session)}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold">{session.planName}</span>
                            <span className="text-sm flex items-center gap-1 text-text-muted">
                                <Calendar size={14} /> {new Date(session.date).toLocaleDateString()}
                            </span>
                        </div>
                        <div className="flex gap-4 text-sm text-text-secondary">
                            <span>{formatDistance(session.totalDistanceKm)}</span>
                            <span>{formatDuration(session.totalDurationSeconds)}</span>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
}
