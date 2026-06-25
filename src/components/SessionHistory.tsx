import { ArrowLeft, Calendar, BarChart2, ClipboardList, Trash2 } from 'lucide-react';
import { TrainingSession, formatDistance, formatDuration } from '../types';
import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

interface Props {
  sessions: TrainingSession[];
  onClose: () => void;
  onSelectSession: (session: TrainingSession) => void;
  onDeleteSession: (sessionId: string) => void;
}

export default function SessionHistory({ sessions, onClose, onSelectSession, onDeleteSession }: Props) {
  const [sessionToDelete, setSessionToDelete] = useState<TrainingSession | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex flex-col p-6 overflow-y-auto bg-bg-deep text-text-primary" role="dialog" aria-modal="true" aria-label="Histórico de treinos">
        <button onClick={onClose} className="mb-6 flex items-center gap-2">
            <ArrowLeft /> Voltar
        </button>
        <h2 className="text-2xl font-bold mb-6 text-center">Histórico de Treinos</h2>
        
        {sessions.length === 0 ? (
            <div className="text-center text-text-muted py-16">
              <ClipboardList className="mx-auto mb-2" size={40} />
              <p>Nenhuma sessão encontrada.</p>
              <p className="text-sm mt-1">Complete um treino para vê-lo aqui.</p>
            </div>
        ) : (
            <div className="space-y-4">
                {sessions.map(session => (
                    <div key={session.id} className="p-4 rounded-xl bg-bg-surface">
                        <div className="flex justify-between items-center mb-2">
                            <span 
                                className="font-bold cursor-pointer hover:text-accent-secondary flex-1"
                                onClick={() => onSelectSession(session)}
                            >{session.planName}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-sm flex items-center gap-1 text-text-muted">
                                    <Calendar size={14} /> {new Date(session.date).toLocaleDateString()}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSessionToDelete(session); }}
                                    className="p-2 text-text-muted hover:text-danger hover:bg-bg-elevated rounded-full"
                                    aria-label="Apagar sessão"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        <div 
                            className="flex gap-4 text-sm text-text-secondary cursor-pointer"
                            onClick={() => onSelectSession(session)}
                        >
                            <span>{formatDistance(session.totalDistanceKm)}</span>
                            <span>{formatDuration(session.totalDurationSeconds)}</span>
                        </div>
                    </div>
                ))}
            </div>
        )}
        {sessionToDelete && (
            <Modal open={!!sessionToDelete} onClose={() => setSessionToDelete(null)} title="Confirmar Exclusão" role="alertdialog">
                <p className="mb-8 text-center text-text-secondary">
                    Deseja realmente apagar esta sessão do histórico?
                </p>
                <div className="flex flex-col gap-4">
                    <Button size="lg" onClick={() => { onDeleteSession(sessionToDelete.id); setSessionToDelete(null); }}>
                        SIM, APAGAR
                    </Button>
                    <Button variant="secondary" size="lg" onClick={() => setSessionToDelete(null)}>
                        CANCELAR
                    </Button>
                </div>
            </Modal>
        )}
    </div>
  );
}
