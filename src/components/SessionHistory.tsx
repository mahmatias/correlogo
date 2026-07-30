import { ArrowLeft, Calendar, ClipboardList, Trash2, CheckCircle2, Mail, Play, AlertTriangle } from 'lucide-react';
import { TrainingSession, SyncStatus, formatDistance, formatDuration } from '../types';
import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

interface Props {
  sessions: TrainingSession[];
  onClose: () => void;
  onSelectSession: (session: TrainingSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onExportSession?: (session: TrainingSession, target?: 'gmail' | 'hc') => void;
}

function SyncBadge({ status, label, icon }: { status: SyncStatus | undefined; label: string; icon: React.ReactNode }) {
  if (status === 'synced') {
    return <span className="text-green-500 text-xs flex items-center gap-0.5"><CheckCircle2 size={11} />{label}</span>;
  }
  return null;
}

function PendingBadge({ status, label, icon, onClick, retrying }: { status: SyncStatus | undefined; label: string; icon: React.ReactNode; onClick: () => void; retrying?: boolean }) {
  if (status === 'synced') return null;
  if (retrying) return <span className="text-text-muted text-xs flex items-center gap-0.5 animate-pulse">{icon}{label}…</span>;
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={"text-xs flex items-center gap-0.5 underline " + (status === 'failed' ? 'text-red-500' : 'text-amber-500')}>
      {icon}{label}
    </button>
  );
}

export default function SessionHistory({ sessions, onClose, onSelectSession, onDeleteSession, onExportSession }: Props) {
  const [sessionToDelete, setSessionToDelete] = useState<TrainingSession | null>(null);
  const [syncingTarget, setSyncingTarget] = useState<{ id: string; target: 'gmail' | 'hc' } | null>(null);

  const handleSync = async (session: TrainingSession, target: 'gmail' | 'hc') => {
    if (!onExportSession) return;
    setSyncingTarget({ id: session.id, target });
    try {
      await onExportSession(session, target);
    } finally {
      setSyncingTarget(null);
    }
  };

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
                {sessions.map(session => {
                  const hcOk = session.hcSyncStatus === 'synced';
                  const gmailOk = session.gmailSyncStatus === 'synced';
                  const anyPending = !hcOk || !gmailOk;
                  return (
                    <div key={session.id} className="p-4 rounded-xl bg-bg-surface">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold cursor-pointer hover:text-accent-secondary"
                          onClick={() => onSelectSession(session)}>{session.planName}</span>
                        <span className="text-sm text-text-muted">{new Date(session.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between items-center mb-2 cursor-pointer"
                        onClick={() => onSelectSession(session)}>
                        <span className="text-sm text-text-secondary">{formatDistance(session.totalDistanceKm)}</span>
                        <span className="text-sm text-text-secondary">{formatDuration(session.totalDurationSeconds)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {gmailOk && hcOk ? (
                            <span className="text-green-500 text-xs flex items-center gap-1">
                              <CheckCircle2 size={13} /> Sincronizado ✅✅
                            </span>
                          ) : (
                            <>
                              <SyncBadge status={session.gmailSyncStatus} label="Gmail" icon={<Mail size={11} />} />
                              <PendingBadge status={session.gmailSyncStatus} label="Gmail" icon={<Mail size={11} />}
                                onClick={() => handleSync(session, 'gmail')}
                                retrying={syncingTarget?.id === session.id && syncingTarget?.target === 'gmail'} />
                              <SyncBadge status={session.hcSyncStatus} label="HC" icon={<Play size={11} />} />
                              <PendingBadge status={session.hcSyncStatus} label="HC" icon={<Play size={11} />}
                                onClick={() => handleSync(session, 'hc')}
                                retrying={syncingTarget?.id === session.id && syncingTarget?.target === 'hc'} />
                            </>
                          )}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setSessionToDelete(session); }}
                          className="p-2 text-text-muted hover:text-danger hover:bg-bg-elevated rounded-full" aria-label="Apagar sessão">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
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
