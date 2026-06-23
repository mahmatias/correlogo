import { useState } from 'react';
import { WorkoutPlan, WorkoutStep, getStepTypeLabel } from '../types';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export default function WorkoutEditor({ onSave, onCancel, initialPlan }: { onSave: (plan: WorkoutPlan) => void, onCancel: () => void, initialPlan?: WorkoutPlan }) {
    const [name, setName] = useState(initialPlan?.name || '');
    const [steps, setSteps] = useState<WorkoutStep[]>(initialPlan?.steps || []);

    const addStep = (type: WorkoutStep['type']) => {
        const pace = 5; // pace in min/km
        const dist = 1; // distance in km
        const duration = (dist / (60 / pace)) * 3600;

        setSteps([...steps, { 
            id: crypto.randomUUID(), 
            type, 
            durationSeconds: type !== 'run' ? 300 : duration,
            targetDistance: type === 'run' ? dist : undefined,
            targetPace: type === 'run' ? pace : undefined
        }]);
    };

    const updateStep = (id: string, updates: Partial<WorkoutStep>) => {
        setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const removeStep = (id: string) => {
        setSteps(steps.filter(s => s.id !== id));
    };

    const moveStep = (index: number, direction: 'up' | 'down') => {
        const newSteps = [...steps];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newSteps.length) return;
        [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
        setSteps(newSteps);
    };

    const handleSave = () => {
        if (!name.trim() || steps.length === 0) return;
        onSave({ id: initialPlan?.id || crypto.randomUUID(), name, steps });
    };

    const paceToMmss = (pace: number | undefined) => {
        if (!pace) return '';
        const mins = Math.floor(pace);
        const secs = Math.round((pace - mins) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    const mmssToPace = (mmss: string) => {
        const [mins, secs] = mmss.split(':').map(Number);
        return (mins || 0) + (secs || 0) / 60;
    }

    return (
        <div className="p-6 bg-selenite rounded-xl">
            <h2 className="text-2xl font-bold mb-4">{initialPlan ? 'Editar Sessão' : 'Novo Plano de Treino'}</h2>
            <input 
                type="text" 
                placeholder="Nome do treino" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full p-2 mb-4 border rounded"
            />
            
            {steps.map((step, index) => (
                <div key={step.id} className="flex flex-col gap-2 mb-4 p-3 bg-white rounded shadow-sm">
                    <div className="flex gap-2 items-center">
                        <span className="flex-1 font-semibold">{getStepTypeLabel(step.type)}</span>
                        <button onClick={() => moveStep(index, 'up')}><ArrowUp size={16} /></button>
                        <button onClick={() => moveStep(index, 'down')}><ArrowDown size={16} /></button>
                        <button onClick={() => removeStep(step.id)} className="text-red-500"><Trash2 size={16} /></button>
                    </div>
                    {step.type === 'run' ? (
                        <div className="flex flex-col gap-2 text-sm">
                            <div className="flex gap-2">
                                <label className="flex items-center gap-1">Dist (km): <input type="number" step="0.1" value={step.targetDistance ?? 1} onChange={e => {
                                    const dist = parseFloat(e.target.value);
                                    const speedKmh = 60 / (step.targetPace || 1);
                                    updateStep(step.id, { targetDistance: dist, durationSeconds: Math.round((dist / speedKmh) * 3600) });
                                }} className="w-16 p-1 border rounded" /></label>
                                <label className="flex items-center gap-1">ou Segs: <input type="number" value={step.durationSeconds ?? ''} onChange={e => {
                                    const secs = parseInt(e.target.value);
                                    const speedKmh = 60 / (step.targetPace || 1);
                                    updateStep(step.id, { durationSeconds: secs, targetDistance: (secs / 3600) * speedKmh });
                                }} className="w-16 p-1 border rounded" /></label>
                                <label className="flex items-center gap-1">Ritmo: <input type="text" placeholder="m:ss" value={paceToMmss(step.targetPace)} onChange={e => {
                                    const pace = mmssToPace(e.target.value);
                                    const speedKmh = 60 / pace;
                                    updateStep(step.id, { targetPace: pace, durationSeconds: Math.round(((step.targetDistance || 1) / speedKmh) * 3600) });
                                }} className="w-16 p-1 border rounded" /></label>
                            </div>
                            <label className="flex items-center gap-2">
                                Progressão por:
                                <select
                                    value={step.basis ?? 'time'}
                                    onChange={e => updateStep(step.id, { basis: e.target.value as 'time' | 'distance' })}
                                    className="p-1 border rounded text-sm"
                                >
                                    <option value="time">Tempo</option>
                                    <option value="distance">Distância</option>
                                </select>
                            </label>
                        </div>
                    ) : (
                        <label className="text-sm flex items-center gap-1">Duração (segs): <input type="number" value={step.durationSeconds ?? 300} onChange={e => updateStep(step.id, { durationSeconds: parseInt(e.target.value) })} className="w-20 p-1 border rounded" /></label>
                    )}
                </div>
            ))}

            <div className="flex gap-2 mb-4">
                {(['warmup', 'run', 'rest', 'cooldown'] as WorkoutStep['type'][]).map(type => (
                    <button key={type} onClick={() => addStep(type)} className="p-2 bg-tourmaline text-white rounded text-sm">
                        <Plus size={16} className="inline mr-1" /> {getStepTypeLabel(type)}
                    </button>
                ))}
            </div>

            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="p-2 bg-gray-300 rounded">Cancelar</button>
                <button onClick={handleSave} className="p-2 bg-amethyst text-white rounded">Salvar Treino</button>
            </div>
        </div>
    );
}
