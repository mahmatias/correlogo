import { useState } from 'react';
import { Watch, Check, Square, CheckSquare, Footprints, Timer, MapPin } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import type { WatchWorkout } from '../types';
import { formatDuration, formatDistance } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  workouts: WatchWorkout[];
  onImport: (selected: WatchWorkout[]) => void;
  importing: boolean;
}

export default function WatchImportModal({ open, onClose, workouts, onImport, importing }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(workouts.map(w => w.id)));

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = selected.size === workouts.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(workouts.map(w => w.id)));
  };

  return (
    <Modal open={open} onClose={onClose} title="Importar do relógio">
      <p className="text-sm text-text-secondary mb-4 text-center">
        {workouts.length} treino{workouts.length !== 1 ? 's' : ''} encontrado{workouts.length !== 1 ? 's' : ''} no Health Connect
      </p>

      <button
        onClick={toggleAll}
        className="w-full flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-bg-elevated text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        {allSelected ? <CheckSquare size={16} className="text-accent" /> : <Square size={16} />}
        {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
      </button>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {workouts.map(w => {
          const checked = selected.has(w.id);
          const date = new Date(w.startTimeMs);
          return (
            <button
              key={w.id}
              onClick={() => toggle(w.id)}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-colors text-left ${
                checked
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-bg-surface hover:bg-bg-elevated'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {checked
                  ? <CheckSquare size={18} className="text-accent" />
                  : <Square size={18} className="text-text-muted" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-text-primary">
                    {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                  <span className="text-xs text-text-muted">
                    {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {w.exerciseType === 'treadmill' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-elevated text-accent-secondary font-medium">
                      Esteira
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <MapPin size={11} /> {formatDistance(w.distanceKm)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Timer size={11} /> {formatDuration(w.durationSeconds)}
                  </span>
                  {w.durationSeconds > 0 && w.distanceKm > 0 && (
                    <span className="flex items-center gap-1">
                      <Footprints size={11} /> {(w.distanceKm / (w.durationSeconds / 3600)).toFixed(1)} km/h
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 mt-5">
        <Button
          variant="secondary"
          size="lg"
          onClick={onClose}
          disabled={importing}
        >
          Cancelar
        </Button>
        <Button
          size="lg"
          onClick={() => {
            const chosen = workouts.filter(w => selected.has(w.id));
            if (chosen.length > 0) onImport(chosen);
          }}
          disabled={importing || selected.size === 0}
        >
          {importing ? 'Importando…' : `Importar ${selected.size > 0 ? `(${selected.size})` : ''}`}
        </Button>
      </div>
    </Modal>
  );
}
