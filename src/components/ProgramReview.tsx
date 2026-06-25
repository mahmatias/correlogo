import { useState } from 'react';
import { TrainingProgram, WorkoutPlan } from '../types';
import WorkoutEditor from './WorkoutEditor';

interface ProgramReviewProps {
  program: TrainingProgram;
  onConfirm: (program: TrainingProgram) => void;
  onCancel: () => void;
}

export default function ProgramReview({ program, onConfirm, onCancel }: ProgramReviewProps) {
  const [localProgram, setLocalProgram] = useState<TrainingProgram>(program);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [editingSession, setEditingSession] = useState<{ weekIndex: number; sessionIndex: number; plan: WorkoutPlan } | null>(null);

  if (editingSession) {
    return (
      <div className="p-6">
        <WorkoutEditor 
          initialPlan={editingSession.plan}
          onSave={(updatedPlan) => {
            const newWeeks = [...localProgram.weeks];
            newWeeks[editingSession.weekIndex].plans[editingSession.sessionIndex] = updatedPlan;
            setLocalProgram({ ...localProgram, weeks: newWeeks });
            setEditingSession(null);
          }}
          onCancel={() => setEditingSession(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 bg-bg-surface rounded-xl border border-border">
      <h2 className="text-2xl font-bold mb-4">Revisar Plano: {localProgram.name}</h2>
      
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-yellow-800 text-sm mb-6">
        ⚠️ Este plano é uma sugestão baseada em metodologia de treinamento esportivo e não substitui a orientação de um profissional de educação física ou médico — especialmente se você tem lesões recentes ou condições de saúde pré-existentes.
      </div>

      <div className="space-y-4">
        {localProgram.weeks.map((week, weekIndex) => (
          <div key={week.weekNumber} className="border border-border rounded-lg p-4 bg-bg-elevated">
            <button 
              className="w-full text-left font-semibold"
              onClick={() => setExpandedWeek(expandedWeek === weekIndex ? null : weekIndex)}
            >
              Semana {week.weekNumber} — {week.phase.toUpperCase()} {week.isRecoveryWeek ? '(Recuperação)' : ''}
            </button>
            
            {expandedWeek === weekIndex && (
              <div className="mt-4 space-y-2">
                {week.plans.map((plan, sessionIndex) => (
                  <div key={plan.id} className="flex justify-between items-center p-2 bg-bg-elevated rounded">
                    <span>{plan.name}</span>
                    <div className="flex gap-2">
                      <button 
                        className="text-accent-secondary text-sm"
                        onClick={() => setEditingSession({ weekIndex, sessionIndex, plan })}
                      >
                        Editar
                      </button>
                      <button 
                        className="text-red-500 text-sm"
                        onClick={() => {
                          if (confirm('Remover esta sessão?')) {
                            const newWeeks = [...localProgram.weeks];
                            newWeeks[weekIndex].plans.splice(sessionIndex, 1);
                            setLocalProgram({ ...localProgram, weeks: newWeeks });
                          }
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="flex justify-between gap-4 mt-6">
        <button onClick={onCancel} className="p-2 bg-bg-elevated text-text-primary rounded">Cancelar</button>
        <button onClick={() => onConfirm(localProgram)} className="p-2 bg-accent text-white rounded">Confirmar e salvar plano</button>
      </div>
    </div>
  );
}
