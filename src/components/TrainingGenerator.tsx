import { useState } from 'react';
import { TrainingProgram, ProgramWeek, WorkoutPlan, WorkoutStep } from '../types';
import { X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const solveVelocity = (vo2target: number) => {
  const a = 0.000104, b = 0.182258, c = -4.60 - vo2target;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
};

const calcVO2 = (vMperMin: number) =>
  -4.60 + 0.182258 * vMperMin + 0.000104 * vMperMin * vMperMin;

const vToPace = (vMperMin: number) => 1000 / vMperMin;

const calculateTotalWeeks = (data: any) => 
    data.raceDate
        ? Math.min(24, Math.max(4, Math.round((new Date(data.raceDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))))
        : 8;

const isPaceGoalUnrealistic = (data: any, totalWeeks: number) => {
  if (!data.goal.targetPace || !data.referenceRace.timeSeconds) return false;
  const currentPace = (data.referenceRace.timeSeconds / 60) / data.referenceRace.distanceKm;
  const improvement = currentPace - data.goal.targetPace;
  const weeks = totalWeeks || 16;
  const maxImprovement = (weeks / 8) * 0.75;
  return improvement > maxImprovement;
};

const createStep = (
  type: WorkoutStep['type'],
  durationSeconds: number,
  targetPace: number,
  basis?: 'time' | 'distance'
): WorkoutStep => ({
    id: uuidv4(),
    type,
    durationSeconds: Math.round(durationSeconds),
    targetPace: parseFloat(targetPace.toFixed(2)),
    ...(basis ? { basis } : {}),
});

const generateBeginnerProgram = (data: any, totalWeeks: number): TrainingProgram => {
    const weeks: ProgramWeek[] = [];
    const runPace = (data.referenceRace.timeSeconds / 60) / data.referenceRace.distanceKm;
    const walkPace = runPace + 2.0;

    for (let i = 0; i < totalWeeks; i++) {
        const weekNum = i + 1;
        const isCorridaContinua = weekNum > totalWeeks - 4;
        const isRecoveryWeek = weekNum % 4 === 0 && !isCorridaContinua;
        const recoveryFactor = isRecoveryWeek ? 0.75 : 1.0;
        let steps: WorkoutStep[] = [];
        
        steps.push(createStep('warmup', 300, walkPace));
        
        if (isCorridaContinua) {
            const raceDistMap: Record<string, number> = {
                '5k': 5, '10k': 10, '21k': 21, '42k': 42, 'none': data.referenceRace.distanceKm
            };
            const goalDist = raceDistMap[data.goal.raceDistance] ?? data.referenceRace.distanceKm;
            const continuousFactors = [0.30, 0.55, 0.80, 1.0];
            const continuousIndex = Math.min(3, weekNum - (totalWeeks - 3));
            const dist = goalDist * continuousFactors[continuousIndex];
            steps.push(createStep('run', Math.round(dist * runPace * 60 * recoveryFactor), runPace, 'distance'));
        } else {
            const table = [
                { run: 120, rest: 120, reps: 4 }, { run: 180, rest: 120, reps: 4 },
                { run: 240, rest: 90, reps: 4 }, { run: 180, rest: 60, reps: 4 },
                { run: 300, rest: 90, reps: 3 }, { run: 360, rest: 90, reps: 3 },
                { run: 420, rest: 60, reps: 3 }, { run: 480, rest: 60, reps: 2 },
                { run: 600, rest: 60, reps: 2 }, { run: 720, rest: 60, reps: 2 },
                { run: 600, rest: 60, reps: 2 }, { run: 900, rest: 60, reps: 1 }
            ][weekNum - 1] || { run: 900, rest: 60, reps: 1 };
            
            for (let r = 0; r < table.reps; r++) {
                steps.push(createStep('run', Math.round(table.run * recoveryFactor), runPace, 'time'));
                if (r < table.reps - 1) steps.push(createStep('rest', Math.round(table.rest * recoveryFactor), walkPace, 'time'));
            }
        }
        steps.push(createStep('cooldown', 300, walkPace));

        const plans: WorkoutPlan[] = data.daysOfWeek.map((day: number, idx: number) => {
            const volumeFactor = idx === 0 ? 1.0 : 0.85;
            const adjustedSteps = steps.map(s => 
                (s.type === 'run' || s.type === 'rest') ? {...s, durationSeconds: Math.max(30, Math.round(s.durationSeconds * volumeFactor))} : s
            );
            return { id: uuidv4(), name: `Semana ${weekNum} — ${isCorridaContinua ? 'Corrida contínua' : 'Corrida/Caminhada'}${idx > 0 ? ' (2)' : ''}`, steps: adjustedSteps, programName: 'Plano Iniciante' };
        });

        weeks.push({ weekNumber: weekNum, phase: 'base', isRecoveryWeek, plans });
    }
    return { id: uuidv4(), name: 'Plano Iniciante', goal: data.goal, experienceLevel: data.experienceLevel, referenceRace: data.referenceRace, daysOfWeek: data.daysOfWeek, mode: data.mode, raceDate: data.raceDate, weeks, createdAt: Date.now() };
};

const generateImprovePaceProgram = (data: any, totalWeeks: number): TrainingProgram => {
    const T = data.referenceRace.timeSeconds / 60;
    const v = (data.referenceRace.distanceKm * 1000) / T;
    const VO2current = calcVO2(v);
    const percentVO2max = 0.8 + 0.1894393 * Math.exp(-0.012778 * T) + 0.2989558 * Math.exp(-0.1932605 * T);
    const vdotCurrent = VO2current / percentVO2max;
    const vTarget = 1000 / data.goal.targetPace;
    const vo2Target = calcVO2(vTarget);
    const vdotTarget = vo2Target / 0.975;
    
    const goal = data.goal.raceDistance;
    let baseW = 0, buildW = 0, peakW = 0, taperW = 0;
    if (goal === 'none') { baseW = 0.4; buildW = 0.6; }
    else if (goal === '5k' || goal === '10k') { baseW = 0.2; buildW = 0.4; peakW = 0.3; taperW = 0.1; }
    else if (goal === '21k') { baseW = 0.25; buildW = 0.4; peakW = 0.2; taperW = 0.15; }
    else { baseW = 0.3; buildW = 0.35; peakW = 0.2; taperW = 0.15; }

    let baseWeeks = Math.round(totalWeeks * baseW), buildWeeks = Math.round(totalWeeks * buildW), peakWeeks = Math.round(totalWeeks * peakW), taperWeeks = Math.round(totalWeeks * taperW);
    const sum = baseWeeks + buildWeeks + peakWeeks + taperWeeks;
    if (sum !== totalWeeks) baseWeeks += (totalWeeks - sum);
    
    const phaseLabel: Record<string, string> = { base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper' };
    const sessionLabel: Record<string, string> = { easy: 'Fácil', long: 'Long Run', limiar: 'Limiar', intervalo: 'Intervalo' };

    const weeks: ProgramWeek[] = [];
    let cumulativeVolume = data.daysOfWeek.length * 30 * 60;

    for (let i = 0; i < totalWeeks; i++) {
        const progress = totalWeeks > 1 ? i / (totalWeeks - 1) : 1;
        const vdotWeek = vdotCurrent + (vdotTarget - vdotCurrent) * progress;
        const paceE = vToPace(solveVelocity(vdotWeek * 0.65)), paceT = vToPace(solveVelocity(vdotWeek * 0.88)), paceI = vToPace(solveVelocity(vdotWeek * 0.975));

        let phase: 'base' | 'build' | 'peak' | 'taper' = i < baseWeeks ? 'base' : i < baseWeeks + buildWeeks ? 'build' : i < baseWeeks + buildWeeks + peakWeeks ? 'peak' : 'taper';
        const isRecoveryWeek = (i + 1) % 4 === 0 && (phase === 'build' || phase === 'peak');

        if (i > 0) {
            if (isRecoveryWeek) cumulativeVolume *= 0.75;
            else if (phase === 'taper') cumulativeVolume *= 0.8;
            else cumulativeVolume = Math.min(cumulativeVolume * 1.1, 36000);
        }

        const weekDays = data.daysOfWeek.length;
        const intervalIndices = new Set<number>();
        const limarIndices = new Set<number>();

        if (!isRecoveryWeek && phase !== 'base' && phase !== 'taper') {
            const maxI = phase === 'peak' ? 2 : 1;
            let countI = 0;
            for (let idx = 0; idx < weekDays - 1 && countI < maxI; idx++) {
                if (intervalIndices.has(idx - 1)) continue;
                const nextDayIsConsecutive = idx + 1 < weekDays &&
                    data.daysOfWeek[idx + 1] === data.daysOfWeek[idx] + 1;
                if (nextDayIsConsecutive && countI > 0) continue;
                intervalIndices.add(idx);
                countI++;
            }
        }
        
        if (!isRecoveryWeek && phase !== 'base' && phase !== 'taper') {
            if (weekDays <= 2) {
                const useInterval = i % 2 === 0;
                if (useInterval) {
                    intervalIndices.clear();
                    intervalIndices.add(0);
                } else {
                    intervalIndices.clear();
                    limarIndices.add(0);
                }
            } else {
                for (let idx = 0; idx < weekDays - 1; idx++) {
                    if (!intervalIndices.has(idx)) { limarIndices.add(idx); break; }
                }
            }
        }
        const plans: WorkoutPlan[] = data.daysOfWeek.map((day: number, index: number) => {
            const isLastDay = index === weekDays - 1;
            const sessionType = isRecoveryWeek ? 'easy' : isLastDay ? 'long' : intervalIndices.has(index) ? 'intervalo' : limarIndices.has(index) ? 'limiar' : 'easy';
            let runSeconds = cumulativeVolume / weekDays;
            if (sessionType === 'long') runSeconds *= 1.4;
            else if (sessionType === 'intervalo') runSeconds *= 0.8;
            else if (sessionType === 'limiar') runSeconds *= 0.9;
            const steps: WorkoutStep[] = [];
            steps.push(createStep('warmup', 300, paceE));
            if (sessionType === 'intervalo') {
                const intervalSeconds = Math.round(runSeconds / 4);
                for (let r = 0; r < 4; r++) { steps.push(createStep('run', intervalSeconds, paceI, 'time')); steps.push(createStep('rest', Math.round(intervalSeconds * 0.5), paceE, 'time')); }
            } else {
                const dur = (phase === 'taper' && sessionType === 'limiar') ? Math.round(runSeconds * 0.5) : Math.round(runSeconds);
                steps.push(createStep('run', dur, sessionType === 'limiar' ? paceT : paceE, 'time'));
            }
            steps.push(createStep('cooldown', 300, paceE));
            return { id: uuidv4(), name: `Semana ${i + 1} — ${phaseLabel[phase]} — ${sessionLabel[sessionType]}`, programName: `Plano pace ${data.goal.targetPace} min/km`, steps };
        });
        weeks.push({ weekNumber: i + 1, phase, isRecoveryWeek, plans });
    }
    return { id: uuidv4(), name: `Plano pace ${data.goal.targetPace} min/km`, goal: data.goal, experienceLevel: data.experienceLevel, referenceRace: data.referenceRace, daysOfWeek: data.daysOfWeek, mode: data.mode, raceDate: data.raceDate, weeks, createdAt: Date.now() };
};

const generateStandardProgram = (data: any, totalWeeks: number): TrainingProgram => {
    const T = data.referenceRace.timeSeconds / 60;
    const v = (data.referenceRace.distanceKm * 1000) / T;
    const VO2 = calcVO2(v);
    const percentVO2max = 0.8 + 0.1894393 * Math.exp(-0.012778 * T) + 0.2989558 * Math.exp(-0.1932605 * T);
    const vdot = VO2 / percentVO2max;
    const paceE = vToPace(solveVelocity(vdot * 0.65)), paceT = vToPace(solveVelocity(vdot * 0.88)), paceI = vToPace(solveVelocity(vdot * 0.975));
    const goal = data.goal.raceDistance;
    const isBeginner = data.experienceLevel === 'beginner';

    let baseW = 0, buildW = 0, peakW = 0, taperW = 0;
    if (goal === 'none') { baseW = 0.5; buildW = 0.5; }
    else if (goal === '5k' || goal === '10k') { baseW = 0.25; buildW = 0.4; peakW = 0.25; taperW = 0.1; }
    else if (goal === '21k') { baseW = 0.3; buildW = 0.35; peakW = 0.2; taperW = 0.15; }
    else { baseW = 0.35; buildW = 0.3; peakW = 0.2; taperW = 0.15; }

    let baseWeeks = Math.round(totalWeeks * baseW), buildWeeks = Math.round(totalWeeks * buildW), peakWeeks = Math.round(totalWeeks * peakW), taperWeeks = Math.round(totalWeeks * taperW);
    if (isBeginner) { baseWeeks++; buildWeeks = Math.max(1, buildWeeks - 1); }
    const sum = baseWeeks + buildWeeks + peakWeeks + taperWeeks;
    if (sum !== totalWeeks) baseWeeks += (totalWeeks - sum);

    const phaseLabel: Record<string, string> = { base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper' };
    const sessionLabel: Record<string, string> = { easy: 'Fácil', long: 'Long Run', limiar: 'Limiar', intervalo: 'Intervalo' };

    const weeks: ProgramWeek[] = [];
    let cumulativeVolume = data.daysOfWeek.length * 30 * 60;

    for (let i = 0; i < totalWeeks; i++) {
        let phase: 'base' | 'build' | 'peak' | 'taper' = i < baseWeeks ? 'base' : i < baseWeeks + buildWeeks ? 'build' : i < baseWeeks + buildWeeks + peakWeeks ? 'peak' : 'taper';
        const isRecoveryWeek = (i + 1) % 4 === 0 && (phase === 'build' || phase === 'peak');

        if (i > 0) {
            if (isRecoveryWeek) cumulativeVolume *= 0.75;
            else if (phase === 'taper') cumulativeVolume *= 0.8;
            else cumulativeVolume = Math.min(cumulativeVolume * 1.1, 36000);
        }

        const weekDays = data.daysOfWeek.length;
        const intervalIndices = new Set<number>();
        if (phase !== 'base' && !isRecoveryWeek) {
            const maxInterval = phase === 'peak' ? 2 : 1;
            let count = 0;
            for (let idx = 0; idx < weekDays - 1 && count < maxInterval; idx++) {
                if (intervalIndices.has(idx - 1)) continue;
                const nextDayIsConsecutive = idx + 1 < weekDays &&
                    data.daysOfWeek[idx + 1] === data.daysOfWeek[idx] + 1;
                if (nextDayIsConsecutive && count > 0) continue;
                intervalIndices.add(idx);
                count++;
            }
        }
        const plans: WorkoutPlan[] = data.daysOfWeek.map((day: number, index: number) => {
            const sessionType = (phase === 'base' || isRecoveryWeek) ? 'easy' : (index === weekDays - 1) ? 'long' : intervalIndices.has(index) ? 'intervalo' : (index === 1 && phase !== 'base' && !isRecoveryWeek) ? 'limiar' : 'easy';
            let runSeconds = cumulativeVolume / weekDays;
            if (sessionType === 'long') runSeconds *= 1.4;
            else if (sessionType === 'intervalo') runSeconds *= 0.8;
            const steps: WorkoutStep[] = [];
            steps.push(createStep('warmup', 300, paceE));
            if (sessionType === 'intervalo') {
                const intervalSeconds = Math.round(runSeconds / 4);
                for (let r = 0; r < 4; r++) { steps.push(createStep('run', intervalSeconds, paceI, 'time')); steps.push(createStep('rest', Math.round(intervalSeconds * 0.5), paceE, 'time')); }
            } else {
                steps.push(createStep('run', Math.round(runSeconds), sessionType === 'limiar' ? paceT : paceE, 'time'));
            }
            steps.push(createStep('cooldown', 300, paceE));
            return { id: uuidv4(), name: `Semana ${i + 1} — ${phaseLabel[phase]} — ${sessionLabel[sessionType]}`, programName: `Plano ${goal}`, steps };
        });
        weeks.push({ weekNumber: i + 1, phase, isRecoveryWeek, plans });
    }
    return { id: uuidv4(), name: `Plano ${goal}`, goal: data.goal, experienceLevel: data.experienceLevel, referenceRace: data.referenceRace, daysOfWeek: data.daysOfWeek, mode: data.mode, raceDate: data.raceDate, weeks, createdAt: Date.now() };
};

const generateProgram = (data: any): TrainingProgram => {
    const totalWeeks = calculateTotalWeeks(data);
    const refPaceMinkm = (data.referenceRace.timeSeconds / 60) / data.referenceRace.distanceKm;

    if (data.experienceLevel === 'beginner' && refPaceMinkm > 8.5) {
        return generateBeginnerProgram(data, totalWeeks);
    }
    
    if (data.goal.targetPace != null) {
        return generateImprovePaceProgram(data, totalWeeks);
    }
    
    return generateStandardProgram(data, totalWeeks);
};

export default function TrainingGenerator({ onGenerate, onCancel }: { onGenerate: (program: TrainingProgram) => void, onCancel: () => void }) {
    const [page, setPage] = useState(0);
    const [useEstimation, setUseEstimation] = useState(false);
    const [estimationPace, setEstimationPace] = useState(5);
    const [refHours, setRefHours] = useState(0);
    const [refMinutes, setRefMinutes] = useState(30);
    const [refSeconds, setRefSeconds] = useState(0);
    const [data, setData] = useState<Partial<TrainingProgram> & { raceDate?: string; daysOfWeek: number[]; mode: 'outdoor' | 'treadmill' | 'both'; }>({
        goal: { raceDistance: 'none' },
        experienceLevel: 'beginner',
        referenceRace: { distanceKm: 5, timeSeconds: 1800 },
        daysOfWeek: [],
        mode: 'both'
    });
    
    const isDeadlineRisky = () => {
        if (!data.raceDate || data.goal?.raceDistance === 'none') return false;
        const weeks = (new Date(data.raceDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000);
        const threshold = data.goal?.raceDistance === '42k' ? 6 : (data.goal?.raceDistance === '21k' ? 4 : 0);
        return weeks < threshold;
    };
    
    const pages = [
        <div key="page1">
            <h2 className="text-xl font-bold mb-4">Qual seu objetivo?</h2>
            <select className="w-full p-2 border rounded" value={data.goal?.raceDistance} onChange={e => setData({...data, goal: {...data.goal, raceDistance: e.target.value as any}})}>
                <option value="none">Condicionamento</option>
                <option value="5k">5K</option>
                <option value="10k">10K</option>
                <option value="21k">21K</option>
                <option value="42k">42K</option>
            </select>
            {data.goal?.raceDistance !== 'none' && (
                <>
                    <div className="mt-4">
                        <label>Data da prova:</label>
                        <input type="date" className="w-full p-2 border rounded" onChange={e => setData({...data, raceDate: e.target.value})} />
                    </div>
                    {data.goal.raceDistance === (data.referenceRace?.distanceKm + 'k') && (
                        <div className="mt-4">
                            <label className="text-sm text-gray-600 block mb-1">Qual seu pace alvo (min/km)?</label>
                            <input type="number" step="0.1" min="3" max="12" className="w-full p-2 border rounded" value={data.goal.targetPace ?? ''} onChange={e => setData({...data, goal: {...data.goal, targetPace: parseFloat(e.target.value) || undefined}})} />
                            <label className="text-sm text-gray-600 block mt-2 mb-1">Em qual distância? (km)</label>
                            <input type="number" step="0.1" min="1" className="w-full p-2 border rounded" value={data.goal.targetDistance ?? data.referenceRace.distanceKm} onChange={e => setData({...data, goal: {...data.goal, targetDistance: parseFloat(e.target.value) || undefined}})} />
                            {isPaceGoalUnrealistic(data, calculateTotalWeeks(data)) && <p className="text-yellow-600 text-sm mt-2">⚠️ Essa melhora de pace é muito agressiva para o prazo. Considere um objetivo mais gradual ou mais semanas de treino.</p>}
                        </div>
                    )}
                </>
            )}
            {isDeadlineRisky() && <p className="text-red-500 text-sm mt-2">O prazo é arriscado para esse objetivo! Considere ajustar a meta ou a data.</p>}
        </div>,
        <div key="page2">
            <h2 className="text-xl font-bold mb-4">Referência de condicionamento</h2>
            <label className="flex items-center gap-2 mb-4">
                <input type="checkbox" checked={useEstimation} onChange={e => {
                    const checked = e.target.checked;
                    setUseEstimation(checked);
                    if (checked) {
                        // Sincronizar referenceRace com estimationPace atual ao marcar o checkbox
                        setData({...data, referenceRace: { distanceKm: 5, timeSeconds: estimationPace * 5 * 60 }});
                    }
                }} />
                Não tenho corrida recente (usar estimativa)
            </label>
            {!useEstimation ? (
                <>
                    <input type="number" placeholder="Distância (km)" className="w-full p-2 border rounded mb-2" onChange={e => setData({...data, referenceRace: {...data.referenceRace!, distanceKm: Math.max(0, parseFloat(e.target.value) || 0)}})} />
                    <div className="flex gap-2 items-center mb-2">
                      <label className="text-sm text-gray-600 w-full">Tempo da corrida:</label>
                    </div>
                    <div className="flex gap-2">
                      <label className="flex flex-col items-center text-xs text-gray-500 flex-1">
                        <input
                          type="number" min="0" max="23"
                          value={refHours}
                          onChange={e => {
                            const h = Math.max(0, parseInt(e.target.value) || 0);
                            setRefHours(h);
                            setData({...data, referenceRace: {...data.referenceRace!, timeSeconds: h * 3600 + refMinutes * 60 + refSeconds}});
                          }}
                          className="w-full p-2 border rounded text-center"
                        />
                        horas
                      </label>
                      <label className="flex flex-col items-center text-xs text-gray-500 flex-1">
                        <input
                          type="number" min="0" max="59"
                          value={refMinutes}
                          onChange={e => {
                            const m = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                            setRefMinutes(m);
                            setData({...data, referenceRace: {...data.referenceRace!, timeSeconds: refHours * 3600 + m * 60 + refSeconds}});
                          }}
                          className="w-full p-2 border rounded text-center"
                        />
                        minutos
                      </label>
                      <label className="flex flex-col items-center text-xs text-gray-500 flex-1">
                        <input
                          type="number" min="0" max="59"
                          value={refSeconds}
                          onChange={e => {
                            const s = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                            setRefSeconds(s);
                            setData({...data, referenceRace: {...data.referenceRace!, timeSeconds: refHours * 3600 + refMinutes * 60 + s}});
                          }}
                          className="w-full p-2 border rounded text-center"
                        />
                        segundos
                      </label>
                    </div>
                </>
            ) : (
                <>
                    <label className="text-sm text-gray-600 block mb-1">Seu ritmo confortável (min/km):</label>
                    <input type="number" className="w-full p-2 border rounded" value={estimationPace} onChange={(e) => {
                        const p = Math.max(1, parseFloat(e.target.value) || 0);
                        setEstimationPace(p);
                        setData({...data, referenceRace: { distanceKm: 5, timeSeconds: p * 5 * 60 }});
                    }} />
                </>
            )}
            <p className="text-xs text-gray-500 mt-2">* Estimativa menos precisa que uma corrida real.</p>
        </div>,
        <div key="page3">
            <h2 className="text-xl font-bold mb-4">Em quais dias costuma treinar?</h2>
            {[0,1,2,3,4,5,6].map(day => (
                <label key={day} className="flex items-center gap-2">
                    <input type="checkbox" onChange={e => {
                        const newDays = e.target.checked ? [...data.daysOfWeek, day] : data.daysOfWeek.filter(d => d !== day);
                        setData({...data, daysOfWeek: newDays});
                    }} />
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][day]}
                </label>
            ))}
            <h2 className="text-xl font-bold mt-4 mb-2">Modo de treino</h2>
            <select className="w-full p-2 border rounded" value={data.mode} onChange={e => setData({...data, mode: e.target.value as any})}>
                <option value="outdoor">Rua</option>
                <option value="treadmill">Esteira</option>
                <option value="both">Ambos</option>
            </select>
        </div>,
        <div key="page4">
            <h2 className="text-xl font-bold mb-4">Nível de experiência</h2>
            <select className="w-full p-2 border rounded" value={data.experienceLevel} onChange={e => setData({...data, experienceLevel: e.target.value as any})}>
                <option value="beginner">Iniciante</option>
                <option value="intermediate">Intermediário</option>
                <option value="advanced">Avançado</option>
            </select>
        </div>
    ];

    return (
        <div className="p-6 bg-selenite rounded-xl relative">
            <button onClick={onCancel} className="absolute top-2 right-2 text-gray-500"><X size={20} /></button>
            {pages[page]}
            <div className="flex justify-between mt-6">
                <button disabled={page === 0} onClick={() => setPage(page - 1)} className="p-2 bg-gray-300 rounded">Voltar</button>
                {page < pages.length - 1 ? 
                    <button disabled={page === 0 && isDeadlineRisky()} onClick={() => setPage(page + 1)} className="p-2 bg-amethyst text-white rounded">Próximo</button> :
                    <button onClick={() => onGenerate(generateProgram(data))} className="p-2 bg-amethyst text-white rounded">Gerar</button>
                }
            </div>
        </div>
    );
}
