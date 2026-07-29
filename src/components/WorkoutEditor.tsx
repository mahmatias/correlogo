import { useState } from 'react';
import { WorkoutPlan, WorkoutStep, getStepTypeLabel } from '../types';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { sanitizeText } from '../lib/sanitize';

interface StepBlock {
    id: string;
    repeat: number;
    steps: WorkoutStep[];
}

export default function WorkoutEditor({ onSave, onCancel, initialPlan }: { onSave: (plan: WorkoutPlan) => void, onCancel: () => void, initialPlan?: WorkoutPlan }) {
    const [name, setName] = useState(initialPlan?.name || '');
    const [blocks, setBlocks] = useState<StepBlock[]>(() => {
        if (initialPlan?.steps && initialPlan.steps.length > 0) {
            return [{ id: crypto.randomUUID(), repeat: 1, steps: initialPlan.steps }];
        }
        return [{ id: crypto.randomUUID(), repeat: 1, steps: [] }];
    });

    const pace = 5;
    const walkPace = 12;
    const dist = 1;
    const duration = (dist / (60 / pace)) * 3600;

    const addStep = (blockId: string, type: WorkoutStep['type']) => {
        setBlocks(blocks.map(b =>
            b.id === blockId
                ? { ...b, steps: [...b.steps, {
                    id: crypto.randomUUID(),
                    type,
                    durationSeconds: type !== 'run' ? 300 : duration,
                    targetDistance: type === 'run' ? dist : undefined,
                    targetPace: type === 'run' ? pace : walkPace,
                }] }
                : b
        ));
    };

    const updateStep = (blockId: string, stepId: string, updates: Partial<WorkoutStep>) => {
        setBlocks(blocks.map(b =>
            b.id === blockId
                ? { ...b, steps: b.steps.map(s => s.id === stepId ? { ...s, ...updates } : s) }
                : b
        ));
    };

    const removeStep = (blockId: string, stepId: string) => {
        setBlocks(blocks.map(b =>
            b.id === blockId ? { ...b, steps: b.steps.filter(s => s.id !== stepId) } : b
        ));
    };

    const moveStep = (blockId: string, index: number, direction: 'up' | 'down') => {
        setBlocks(blocks.map(b => {
            if (b.id !== blockId) return b;
            const newSteps = [...b.steps];
            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= newSteps.length) return b;
            [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
            return { ...b, steps: newSteps };
        }));
    };

    const addBlock = () => {
        setBlocks([...blocks, { id: crypto.randomUUID(), repeat: 1, steps: [] }]);
    };

    const removeBlock = (blockId: string) => {
        if (blocks.length <= 1) return;
        setBlocks(blocks.filter(b => b.id !== blockId));
    };

    const moveBlock = (index: number, direction: 'up' | 'down') => {
        const newBlocks = [...blocks];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
        [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
        setBlocks(newBlocks);
    };

    const changeBlockRepeat = (blockId: string, repeat: number) => {
        setBlocks(blocks.map(b =>
            b.id === blockId ? { ...b, repeat: Math.max(1, isNaN(repeat) ? 1 : Math.min(99, repeat)) } : b
        ));
    };

    const expandBlocks = (): WorkoutStep[] => {
        return blocks.flatMap(block => {
            if (block.repeat <= 1) return block.steps;
            const result: WorkoutStep[] = [];
            for (let i = 0; i < block.repeat; i++) {
                for (const step of block.steps) {
                    result.push({ ...step, id: crypto.randomUUID() });
                }
            }
            return result;
        });
    };

    const handleSave = () => {
        const safeName = sanitizeText(name, 100);
        const flatSteps = expandBlocks();
        if (!safeName || flatSteps.length === 0) return;
        onSave({ id: initialPlan?.id || crypto.randomUUID(), name: safeName, steps: flatSteps, blocks, manual: true });
    };

    const paceToMmss = (pace: number | undefined) => {
        if (!pace) return '';
        const mins = Math.floor(pace);
        const secs = Math.round((pace - mins) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const mmssToPace = (mmss: string) => {
        const [mins, secs] = mmss.split(':').map(Number);
        return (mins || 0) + (secs || 0) / 60;
    };

    return (
        <div className="p-6 bg-bg-surface rounded-xl border border-border">
            <h2 className="text-2xl font-bold mb-4">{initialPlan ? 'Editar Sessão' : 'Novo Plano de Treino'}</h2>
            <label htmlFor="workout-name" className="sr-only">Nome do treino</label>
            <input
                id="workout-name"
                type="text"
                placeholder="Nome do treino"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-2 mb-4 border border-border rounded bg-bg-elevated text-text-primary"
            />

            {blocks.map((block, blockIndex) => (
                <div key={block.id} className="mb-4 p-3 bg-bg-elevated rounded border border-border">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm text-text-muted">Bloco {blockIndex + 1}</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => moveBlock(blockIndex, 'up')} disabled={blockIndex === 0} aria-label="Mover bloco para cima" className={blockIndex === 0 ? 'opacity-30' : ''}><ArrowUp size={16} /></button>
                            <button onClick={() => moveBlock(blockIndex, 'down')} disabled={blockIndex === blocks.length - 1} aria-label="Mover bloco para baixo" className={blockIndex === blocks.length - 1 ? 'opacity-30' : ''}><ArrowDown size={16} /></button>
                            {blocks.length > 1 && (
                                <button onClick={() => removeBlock(block.id)} className="text-red-500" aria-label="Remover bloco"><Trash2 size={16} /></button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                        <label className="text-sm text-text-muted flex items-center gap-1">
                            Repetir bloco:
                            <input
                                type="number"
                                min="1"
                                max="99"
                                value={block.repeat}
                                onChange={e => changeBlockRepeat(block.id, parseInt(e.target.value) || 1)}
                                onFocus={e => e.target.select()}
                                className="w-12 p-1 border border-border rounded bg-bg-surface text-text-primary text-sm text-center"
                            />
                            <span className="text-xs opacity-70">x</span>
                        </label>
                        {block.repeat > 1 && block.steps.length > 0 && (
                            <span className="text-xs text-accent-secondary">
                                → {block.steps.length * block.repeat} etapas no total
                            </span>
                        )}
                    </div>

                    {block.steps.map((step, stepIndex) => (
                        <div key={step.id} className="flex flex-col gap-2 mb-2 p-3 bg-bg-surface rounded">
                            <div className="flex gap-2 items-center">
                                <span className="flex-1 font-semibold">{getStepTypeLabel(step.type)}</span>
                                <button onClick={() => moveStep(block.id, stepIndex, 'up')} disabled={stepIndex === 0} aria-label="Mover passo para cima" className={stepIndex === 0 ? 'opacity-30' : ''}><ArrowUp size={16} /></button>
                                <button onClick={() => moveStep(block.id, stepIndex, 'down')} disabled={stepIndex === block.steps.length - 1} aria-label="Mover passo para baixo" className={stepIndex === block.steps.length - 1 ? 'opacity-30' : ''}><ArrowDown size={16} /></button>
                                <button onClick={() => removeStep(block.id, step.id)} className="text-red-500" aria-label="Remover passo"><Trash2 size={16} /></button>
                            </div>
                            {step.type === 'run' ? (
                                <div className="flex flex-col gap-2 text-sm">
                                    <div className="grid grid-cols-3 gap-2">
                                        <label className="flex flex-col gap-1">
                                            <span className="text-xs text-text-muted">Dist (km)</span>
                                            <input type="number" step="0.1" value={step.targetDistance ?? 1} onChange={e => {
                                                const dist = parseFloat(e.target.value);
                                                const speedKmh = 60 / (step.targetPace || 1);
                                                updateStep(block.id, step.id, { targetDistance: dist, durationSeconds: Math.round((dist / speedKmh) * 3600) });
                                            }} className="w-full p-1 border border-border rounded bg-bg-elevated text-text-primary" />
                                        </label>
                                        <label className="flex flex-col gap-1">
                                            <span className="text-xs text-text-muted">ou Segs</span>
                                            <input type="number" value={step.durationSeconds ?? ''} onChange={e => {
                                                const secs = parseInt(e.target.value);
                                                const speedKmh = 60 / (step.targetPace || 1);
                                                updateStep(block.id, step.id, { durationSeconds: secs, targetDistance: (secs / 3600) * speedKmh });
                                            }} className="w-full p-1 border border-border rounded bg-bg-elevated text-text-primary" />
                                        </label>
                                        <label className="flex flex-col gap-1">
                                            <span className="text-xs text-text-muted">Ritmo (m:ss)</span>
                                            <input type="text" placeholder="5:00" value={paceToMmss(step.targetPace)} onChange={e => {
                                                const pace = mmssToPace(e.target.value);
                                                const speedKmh = 60 / pace;
                                                updateStep(block.id, step.id, { targetPace: pace, durationSeconds: Math.round(((step.targetDistance || 1) / speedKmh) * 3600) });
                                            }} className="w-full p-1 border border-border rounded bg-bg-elevated text-text-primary" />
                                        </label>
                                    </div>
                                    <label className="flex items-center gap-2">
                                        Progressão por:
                                        <select
                                            value={step.basis ?? 'time'}
                                            onChange={e => updateStep(block.id, step.id, { basis: e.target.value as 'time' | 'distance' })}
                                            className="p-1 border border-border rounded text-sm bg-bg-elevated text-text-primary"
                                        >
                                            <option value="time">Tempo</option>
                                            <option value="distance">Distância</option>
                                        </select>
                                    </label>
                                </div>
                            ) : (
                                <label className="text-sm flex items-center gap-1">Duração (segs): <input type="number" value={step.durationSeconds ?? 300} onChange={e => updateStep(block.id, step.id, { durationSeconds: parseInt(e.target.value) })} className="w-20 p-1 border border-border rounded bg-bg-elevated text-text-primary" /></label>
                            )}
                        </div>
                    ))}

                    <div className="grid grid-cols-2 gap-2 mt-2">
                        {(['warmup', 'run', 'rest', 'cooldown'] as WorkoutStep['type'][]).map(type => (
                            <button key={type} onClick={() => addStep(block.id, type)} className="flex items-center justify-center gap-1 p-2 bg-accent-secondary/80 text-white rounded text-sm hover:bg-accent-secondary transition-colors">
                                <Plus size={16} /> {getStepTypeLabel(type)}
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            <button onClick={addBlock} className="w-full p-2 mb-4 border-2 border-dashed border-border rounded text-text-muted hover:bg-bg-elevated transition-colors">
                <Plus size={16} className="inline mr-1" /> Novo Bloco
            </button>

            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="p-2 bg-bg-elevated text-text-primary rounded">Cancelar</button>
                <button onClick={handleSave} className="p-2 bg-accent text-white rounded">Salvar Treino</button>
            </div>
        </div>
    );
}
