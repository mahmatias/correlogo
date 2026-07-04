import { useState } from 'react';
import { TrainingProgram, ProgramWeek, WorkoutPlan, WorkoutStep } from '../types';
import { X } from 'lucide-react';

const solveVelocity = (vo2target: number) => {
  const a = 0.000104, b = 0.182258, c = -4.60 - vo2target;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
};

const calcVO2 = (vMperMin: number) =>
  -4.60 + 0.182258 * vMperMin + 0.000104 * vMperMin * vMperMin;

const vToPace = (vMperMin: number) => 1000 / vMperMin;

const formatDateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const assignScheduledDates = (program: TrainingProgram, startDate: string, daysOfWeek: number[]): TrainingProgram => {
    if (!startDate || daysOfWeek.length === 0) return program;
    const sortedDays = [...new Set(daysOfWeek)].sort((a, b) => a - b);
    const start = new Date(startDate + 'T12:00:00');
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weeks = program.weeks.map((week, w) => {
        const plans = week.plans.map((plan, s) => {
            const targetDay = sortedDays[s % sortedDays.length];
            const planDate = new Date(weekStart);
            planDate.setDate(weekStart.getDate() + w * 7 + targetDay);
            if (planDate < start) planDate.setDate(planDate.getDate() + 7);
            return { ...plan, scheduledDate: formatDateKey(planDate) };
        });
        return { ...week, plans };
    });
    return { ...program, weeks };
};

const calculateTotalWeeks = (data: any) => 
    data.raceDate && data.startDate
        ? Math.min(24, Math.max(4, Math.round((new Date(data.raceDate).getTime() - new Date(data.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000))))
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
    id: crypto.randomUUID(),
    type,
    durationSeconds: Math.round(durationSeconds),
    targetPace: parseFloat(targetPace.toFixed(2)),
    ...(basis ? { basis } : {}),
});

// Mapeia um índice da tabela runna (0-15) para o índice linear interpolado
// em N semanas, garantindo que a semana 0 mapeia para 0 e a última para 15.
const mapTableIndex = (weekIdx: number, totalWeeks: number): number => {
    if (totalWeeks <= 1) return 0;
    const raw = (weekIdx / (totalWeeks - 1)) * 15;
    return Math.min(15, Math.max(0, Math.round(raw)));
};

// Converte os steps crus da tabela runna em WorkoutStep[] formatados
const buildBeginnerSteps = (steps: { t: string; min?: number; km?: number }[], runPace: number, walkPace: number): WorkoutStep[] => {
    const planSteps: WorkoutStep[] = [];
    planSteps.push(createStep('warmup', 300, walkPace));
    for (const s of steps) {
        if (s.t === 'run' && s.min != null) {
            planSteps.push(createStep('run', Math.round(s.min * 60), runPace));
        } else if (s.t === 'run' && s.km != null) {
            const secs = Math.round((s.km / (60 / runPace)) * 3600);
            planSteps.push({ ...createStep('run', secs, runPace, 'distance'), targetDistance: s.km });
        } else if (s.t === 'walk') {
            planSteps.push(createStep('rest', Math.round((s.min ?? 1) * 60), walkPace));
        }
    }
    planSteps.push(createStep('cooldown', 300, walkPace));
    return planSteps;
};

const generateBeginnerProgram = (data: any, totalWeeks: number): TrainingProgram => {
    const comfortPace = Math.max(6, (data.referenceRace.timeSeconds / 60) / data.referenceRace.distanceKm);
    const runPace = data.goal.targetPace ?? comfortPace;
    const walkPace = Math.max(comfortPace, 12);

    // Duração mínima viável para um C25K é 6 semanas; máxima 52
    const clampedWeeks = Math.max(6, Math.min(52, totalWeeks));

    const runnaTable: { t: string; min?: number; km?: number }[][][] = [
        [ // W1
            [{t:'run',min:3},{t:'walk',min:2},{t:'run',min:3},{t:'walk',min:2},{t:'run',min:3},{t:'walk',min:2}],
            [{t:'run',min:2.5},{t:'walk',min:1.5},{t:'run',min:3},{t:'walk',min:2},{t:'run',min:2.5},{t:'walk',min:1.5},{t:'run',min:3},{t:'walk',min:2},{t:'run',min:1}],
        ],
        [ // W2
            [{t:'run',min:2},{t:'walk',min:1},{t:'run',min:2},{t:'walk',min:1},{t:'run',min:2},{t:'walk',min:1},{t:'run',min:2},{t:'walk',min:1},{t:'run',min:2},{t:'walk',min:1},{t:'run',min:2},{t:'walk',min:1}],
            [{t:'run',min:4},{t:'walk',min:1.5},{t:'run',min:4},{t:'walk',min:1.5},{t:'run',min:4},{t:'walk',min:1.5}],
        ],
        [ // W3
            [{t:'run',min:1},{t:'walk',min:0.5},{t:'run',min:3},{t:'walk',min:1},{t:'run',min:1},{t:'walk',min:0.5},{t:'run',min:3},{t:'walk',min:1},{t:'run',min:1},{t:'walk',min:0.5},{t:'run',min:3},{t:'walk',min:1},{t:'run',min:1}],
            [{t:'run',min:1.5},{t:'walk',min:1},{t:'run',min:5},{t:'walk',min:1.5},{t:'run',min:1.5},{t:'walk',min:1},{t:'run',min:5},{t:'walk',min:1.5}],
        ],
        [ // W4
            [{t:'run',min:2.5},{t:'walk',min:1},{t:'run',min:3},{t:'walk',min:1},{t:'run',min:2.5},{t:'walk',min:1},{t:'run',min:3},{t:'walk',min:1}],
            [{t:'run',min:1},{t:'walk',min:0.5},{t:'run',min:5},{t:'walk',min:1.5},{t:'run',min:1},{t:'walk',min:0.5},{t:'run',min:5},{t:'walk',min:1.5}],
        ],
        [ // W5
            [{t:'run',min:6},{t:'walk',min:1.5},{t:'run',min:1},{t:'walk',min:0.5},{t:'run',min:6}],
            [{t:'run',min:1},{t:'walk',min:0.5},{t:'run',min:3},{t:'walk',min:1},{t:'run',min:1},{t:'walk',min:0.5},{t:'run',min:3},{t:'walk',min:1},{t:'run',min:1},{t:'walk',min:0.5},{t:'run',min:3},{t:'walk',min:1},{t:'run',min:1}],
        ],
        [ // W6
            [{t:'run',min:3},{t:'walk',min:1},{t:'run',min:4},{t:'walk',min:1},{t:'run',min:3},{t:'walk',min:1},{t:'run',min:4},{t:'walk',min:1}],
            [{t:'run',min:7},{t:'walk',min:1.5},{t:'run',min:1},{t:'walk',min:0.5},{t:'run',min:7}],
        ],
        [ // W7
            [{t:'run',min:8},{t:'walk',min:1.5},{t:'run',min:8},{t:'walk',min:1.5}],
            [{t:'run',min:3},{t:'walk',min:1},{t:'run',min:5},{t:'walk',min:1},{t:'run',min:3},{t:'walk',min:1},{t:'run',min:5},{t:'walk',min:1}],
        ],
        [ // W8
            [{t:'run',km:0.75},{t:'walk',min:1},{t:'run',km:0.25},{t:'walk',min:0.5},{t:'run',km:0.75}],
            [{t:'run',km:0.75},{t:'walk',min:1},{t:'run',km:0.75},{t:'walk',min:1}],
        ],
        [ // W9
            [{t:'run',km:1.75}],
            [{t:'run',km:1.25},{t:'walk',min:1},{t:'run',km:1.25},{t:'walk',min:1}],
        ],
        [ // W10
            [{t:'run',km:2.25}],
            [{t:'run',km:1.5},{t:'walk',min:1},{t:'run',km:1.5},{t:'walk',min:1}],
        ],
        [ // W11
            [{t:'run',km:2.75}],
            [{t:'run',km:1.75},{t:'walk',min:1},{t:'run',km:1.75},{t:'walk',min:1}],
        ],
        [ // W12
            [{t:'run',km:0.75},{t:'walk',min:0.5},{t:'run',km:1.5},{t:'walk',min:1},{t:'run',km:0.75}],
            [{t:'run',km:2.5}],
        ],
        [ // W13
            [{t:'run',km:3.5}],
            [{t:'run',km:2},{t:'walk',min:1},{t:'run',km:0.25},{t:'walk',min:0.5},{t:'run',km:2}],
        ],
        [ // W14
            [{t:'run',km:4}],
            [{t:'run',km:3.75}],
        ],
        [ // W15
            [{t:'run',km:2.5},{t:'walk',min:1},{t:'run',km:2.5},{t:'walk',min:1}],
            [{t:'run',km:4.25}],
        ],
        [ // W16
            [{t:'run',km:1.25},{t:'walk',min:0.5},{t:'run',km:2.5},{t:'walk',min:1},{t:'run',km:1.25}],
            [{t:'run',km:5}],
        ],
    ];

    const weeks: ProgramWeek[] = [];
    for (let i = 0; i < clampedWeeks; i++) {
        const tableIdx = mapTableIndex(i, clampedWeeks);
        const sessions = runnaTable[tableIdx];
        const plans: WorkoutPlan[] = sessions.map((steps, si) => {
            const planSteps = buildBeginnerSteps(steps, runPace, walkPace);
            const hasDistance = steps.some(s => s.km != null);
            if (hasDistance) {
                const totalKm = steps.filter(s => s.t === 'run').reduce((a, s) => a + (s.km ?? 0), 0);
                return { id: crypto.randomUUID(), name: `Semana ${i + 1} — Treino ${si + 1} (${totalKm.toFixed(2).replace('.',',')} km)`, steps: planSteps, programName: 'Plano Iniciante' };
            }
            const totalMin = steps.filter(s => s.t === 'run').reduce((a, s) => a + (s.min ?? 0), 0);
            return { id: crypto.randomUUID(), name: `Semana ${i + 1} — Treino ${si + 1} (${Math.round(totalMin)}min de corrida)`, steps: planSteps, programName: 'Plano Iniciante' };
        });

        // Load management: generate regenerative sessions interleaved with main sessions
        const extraDayCount = Math.max(0, (data.daysOfWeek?.length || 0) - sessions.length);
        if (extraDayCount > 0) {
            const allRunSteps = plans.flatMap(p => p.steps.filter(s => s.type === 'run'));
            const lightestRunSecs = allRunSteps.length > 0
                ? Math.min(...allRunSteps.map(s => s.durationSeconds))
                : 180;
            const jogSecs = Math.round(lightestRunSecs / 2);

            const regenSessions: WorkoutPlan[] = [];
            for (let e = 0; e < extraDayCount; e++) {
                const lmSteps: WorkoutStep[] = [
                    createStep('warmup', 900, walkPace),
                ];
                if (jogSecs >= 60) {
                    lmSteps.push(createStep('run', jogSecs, runPace));
                }
                lmSteps.push(createStep('cooldown', 300, walkPace));
                regenSessions.push({
                    id: crypto.randomUUID(),
                    name: `Semana ${i + 1} — Regenerativo`,
                    steps: lmSteps,
                    programName: 'Plano Iniciante',
                });
            }

            // Interleave: M1, R1, M2, R2, R3...
            const interleaved: WorkoutPlan[] = [];
            for (let j = 0; j < Math.max(plans.length, regenSessions.length); j++) {
                if (j < plans.length) interleaved.push(plans[j]);
                if (j < regenSessions.length) interleaved.push(regenSessions[j]);
            }
            plans.length = 0;
            plans.push(...interleaved);
        }

        weeks.push({ weekNumber: i + 1, phase: 'base', isRecoveryWeek: false, plans });
    }

    return {
        id: crypto.randomUUID(), name: 'Plano Iniciante', goal: data.goal,
        experienceLevel: data.experienceLevel, referenceRace: data.referenceRace,
        daysOfWeek: data.daysOfWeek, mode: data.mode, raceDate: data.raceDate,
        weeks, createdAt: Date.now(),
    };
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
        const refPaceMinKm = (data.referenceRace.timeSeconds / 60) / data.referenceRace.distanceKm;
        const paceE = Math.min(vToPace(solveVelocity(vdotWeek * 0.65)), refPaceMinKm + 2), paceT = vToPace(solveVelocity(vdotWeek * 0.88)), paceI = vToPace(solveVelocity(vdotWeek * 0.975));

        let phase: 'base' | 'build' | 'peak' | 'taper' = i < baseWeeks ? 'base' : i < baseWeeks + buildWeeks ? 'build' : i < baseWeeks + buildWeeks + peakWeeks ? 'peak' : 'taper';
        const isRecoveryWeek = (i + 1) % 4 === 0 && (phase === 'build' || phase === 'peak');

        if (i > 0) {
            if (isRecoveryWeek) cumulativeVolume *= 0.75;
            else if (phase === 'taper') cumulativeVolume *= 0.8;
            else cumulativeVolume = Math.min(cumulativeVolume * 1.1, 36000);
        }

        const weekDays = data.daysOfWeek.length;
        const [intervalIndices, limarIndices] = (() => {
            const interval = new Set<number>();
            const limiar = new Set<number>();
            if (!isRecoveryWeek && phase !== 'base' && phase !== 'taper') {
                if (weekDays <= 2) {
                    if (i % 2 === 0) interval.add(0);
                    else limiar.add(0);
                } else {
                    const maxI = phase === 'peak' ? 2 : 1;
                    let count = 0;
                    for (let idx = 0; idx < weekDays - 1 && count < maxI; idx++) {
                        const nextIsConsecutive = idx + 1 < weekDays && data.daysOfWeek[idx + 1] === data.daysOfWeek[idx] + 1;
                        if (nextIsConsecutive && count > 0) continue;
                        interval.add(idx);
                        count++;
                    }
                    for (let idx = 0; idx < weekDays - 1; idx++) {
                        if (!interval.has(idx)) { limiar.add(idx); break; }
                    }
                }
            }
            return [interval, limiar];
        })();
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
            return { id: crypto.randomUUID(), name: `Semana ${i + 1} — ${phaseLabel[phase]} — ${sessionLabel[sessionType]}`, programName: `Plano pace ${data.goal.targetPace} min/km`, steps };
        });
        weeks.push({ weekNumber: i + 1, phase, isRecoveryWeek, plans });
    }
    return { id: crypto.randomUUID(), name: `Plano pace ${data.goal.targetPace} min/km`, goal: data.goal, experienceLevel: data.experienceLevel, referenceRace: data.referenceRace, daysOfWeek: data.daysOfWeek, mode: data.mode, raceDate: data.raceDate, weeks, createdAt: Date.now() };
};

const generateStandardProgram = (data: any, totalWeeks: number): TrainingProgram => {
    const T = data.referenceRace.timeSeconds / 60;
    const v = (data.referenceRace.distanceKm * 1000) / T;
    const VO2 = calcVO2(v);
    const percentVO2max = 0.8 + 0.1894393 * Math.exp(-0.012778 * T) + 0.2989558 * Math.exp(-0.1932605 * T);
    const vdot = VO2 / percentVO2max;
    const refPaceMinKm = (data.referenceRace.timeSeconds / 60) / data.referenceRace.distanceKm;
    const paceE = Math.min(vToPace(solveVelocity(vdot * 0.65)), refPaceMinKm + 2), paceT = vToPace(solveVelocity(vdot * 0.88)), paceI = vToPace(solveVelocity(vdot * 0.975));
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
        const [intervalIndices, limiarIndices] = (() => {
            const interval = new Set<number>();
            const limiar = new Set<number>();
            if (phase !== 'base' && !isRecoveryWeek) {
                if (weekDays <= 2) {
                    if (i % 2 === 0) interval.add(0);
                    else limiar.add(0);
                } else {
                    const maxI = phase === 'peak' ? 2 : 1;
                    let count = 0;
                    for (let idx = 0; idx < weekDays - 1 && count < maxI; idx++) {
                        const nextIsConsecutive = idx + 1 < weekDays && data.daysOfWeek[idx + 1] === data.daysOfWeek[idx] + 1;
                        if (nextIsConsecutive && count > 0) continue;
                        interval.add(idx);
                        count++;
                    }
                    for (let idx = 0; idx < weekDays - 1; idx++) {
                        if (!interval.has(idx)) { limiar.add(idx); break; }
                    }
                }
            }
            return [interval, limiar];
        })();
        const plans: WorkoutPlan[] = data.daysOfWeek.map((day: number, index: number) => {
            const sessionType = (phase === 'base' || isRecoveryWeek) ? 'easy' : (index === weekDays - 1) ? 'long' : intervalIndices.has(index) ? 'intervalo' : limiarIndices.has(index) ? 'limiar' : 'easy';
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
            return { id: crypto.randomUUID(), name: `Semana ${i + 1} — ${phaseLabel[phase]} — ${sessionLabel[sessionType]}`, programName: `Plano ${goal}`, steps };
        });
        weeks.push({ weekNumber: i + 1, phase, isRecoveryWeek, plans });
    }
    return { id: crypto.randomUUID(), name: `Plano ${goal}`, goal: data.goal, experienceLevel: data.experienceLevel, referenceRace: data.referenceRace, daysOfWeek: data.daysOfWeek, mode: data.mode, raceDate: data.raceDate, weeks, createdAt: Date.now() };
};

const generateProgram = (data: any): TrainingProgram => {
    const totalWeeks = calculateTotalWeeks(data);
    
    let program: TrainingProgram;
    if (data.experienceLevel === 'beginner') {
        program = generateBeginnerProgram(data, totalWeeks);
    } else {
        const refPaceMinkm = (data.referenceRace.timeSeconds / 60) / data.referenceRace.distanceKm;
        if (data.goal.targetPace != null && refPaceMinkm - data.goal.targetPace > 0.15) {
            program = generateImprovePaceProgram(data, totalWeeks);
        } else {
            program = generateStandardProgram(data, totalWeeks);
        }
    }
    
    program = assignScheduledDates(program, data.startDate, data.daysOfWeek);

    // Adiciona marcador visual da prova após a distribuição de datas
    if (data.raceDate) {
        const lastWeek = program.weeks[program.weeks.length - 1];
        if (lastWeek) {
            lastWeek.plans.push({
                id: crypto.randomUUID(),
                name: '🏁 Prova',
                steps: [{ id: crypto.randomUUID(), type: 'run', durationSeconds: 1, targetPace: data.goal?.targetPace ?? 6 }],
                programName: program.name,
                isRaceMarker: true,
                scheduledDate: data.raceDate,
            });
            // Reordena plans da última semana para que a prova fique no scheduledDate correto
            lastWeek.plans.sort((a, b) => {
                if (a.isRaceMarker) return 1;
                if (b.isRaceMarker) return -1;
                return (a.scheduledDate || '').localeCompare(b.scheduledDate || '');
            });
        }
    }

    return program;
};

export default function TrainingGenerator({ onGenerate, onCancel }: { onGenerate: (program: TrainingProgram) => void, onCancel: () => void }) {
    const [page, setPage] = useState(0);
    const [useEstimation, setUseEstimation] = useState(false);
    const [estimationPaceMin, setEstimationPaceMin] = useState(9);
    const [estimationPaceSec, setEstimationPaceSec] = useState(0);
    const [comfortPaceMin, setComfortPaceMin] = useState(12);
    const [comfortPaceSec, setComfortPaceSec] = useState(0);
    const [beginnerTargetPaceMin, setBeginnerTargetPaceMin] = useState(8);
    const [beginnerTargetPaceSec, setBeginnerTargetPaceSec] = useState(0);
    const [targetPaceMin, setTargetPaceMin] = useState(7);
    const [targetPaceSec, setTargetPaceSec] = useState(0);
    const [refHours, setRefHours] = useState(0);
    const [refMinutes, setRefMinutes] = useState(30);
    const [refSeconds, setRefSeconds] = useState(0);
    const todayStr = () => new Date().toISOString().slice(0, 10);
    const [data, setData] = useState<Partial<TrainingProgram> & { raceDate?: string; startDate?: string; daysOfWeek: number[]; mode: 'outdoor' | 'treadmill' | 'both'; }>({
        goal: { raceDistance: 'none' },
        experienceLevel: 'beginner',
        referenceRace: { distanceKm: 5, timeSeconds: 1800 },
        daysOfWeek: [],
        mode: 'both'
    });
    
    const isDeadlineRisky = () => {
        if (!data.raceDate || !data.startDate || data.goal?.raceDistance === 'none') return false;
        const weeks = (new Date(data.raceDate).getTime() - new Date(data.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000);
        const threshold = data.goal?.raceDistance === '42k' ? 6 : (data.goal?.raceDistance === '21k' ? 4 : 0);
        return weeks < threshold;
    };
    
    const pages = [
        <div key="page1">
            <h2 className="text-xl font-bold mb-4">Qual seu objetivo?</h2>
            <select className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary" value={data.goal?.raceDistance} onChange={e => setData({...data, goal: {...data.goal, raceDistance: e.target.value as any}})}>
                <option value="none">Condicionamento</option>
                <option value="5k">5K</option>
                <option value="10k">10K</option>
                <option value="21k">21K</option>
                <option value="42k">42K</option>
            </select>
            {data.goal?.raceDistance !== 'none' && (
                <>
                    <div className="mt-4">
                        <label>Data de início:</label>
                        <input type="date" value={data.startDate || ''} className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary" onChange={e => setData({...data, startDate: e.target.value})} />
                    </div>
                    <div className="mt-4">
                        <label>Data da prova:</label>
                        <input type="date" className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary" onChange={e => setData({...data, raceDate: e.target.value})} min={data.startDate || todayStr()} />
                    </div>
                    {data.goal.raceDistance !== 'none' && (
                        <div className="mt-4">
                            <label className="text-sm text-text-secondary block mb-2">
                                Qual seu pace alvo para esse programa (min/km)?
                            </label>
                            <div className="flex gap-2 items-center">
                                <label className="flex flex-col items-center text-xs text-text-muted flex-1">
                                    <select
                                        value={targetPaceMin ?? 7}
                                        onChange={e => {
                                            const m = Math.max(3, Math.min(12, parseInt(e.target.value) || 7));
                                            setTargetPaceMin(m);
                                            setData({...data, goal: {...data.goal, targetPace: m + (targetPaceSec ?? 0) / 60}});
                                        }}
                                        className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary text-center"
                                    >
                                        {Array.from({length: 10}, (_, i) => i + 3).map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                    minutos
                                </label>
                                <span className="text-text-muted">:</span>
                                <label className="flex flex-col items-center text-xs text-text-muted flex-1">
                                    <select
                                        value={targetPaceSec ?? 0}
                                        onChange={e => {
                                            const s = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                            setTargetPaceSec(s);
                                            setData({...data, goal: {...data.goal, targetPace: (targetPaceMin ?? 7) + s / 60}});
                                        }}
                                        className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary text-center"
                                    >
                                        {Array.from({length: 60}, (_, i) => i).map(s => (
                                            <option key={s} value={s}>{String(s).padStart(2, '0')}</option>
                                        ))}
                                    </select>
                                    segundos / km
                                </label>
                            </div>
                            {isPaceGoalUnrealistic(data, calculateTotalWeeks(data)) && <p className="text-accent-secondary text-sm mt-2">⚠️ Essa melhora de pace é muito agressiva para o prazo. Considere um objetivo mais gradual ou mais semanas de treino.</p>}
                        </div>
                    )}
                </>
            )}
            {isDeadlineRisky() && <p className="text-danger text-sm mt-2">O prazo é arriscado para esse objetivo! Considere ajustar a meta ou a data.</p>}
        </div>,
        <div key="page2">
            <h2 className="text-xl font-bold mb-4">Referência de condicionamento</h2>
            <label className="flex items-center gap-2 mb-4">
                <input type="checkbox" checked={useEstimation} onChange={e => {
                    const checked = e.target.checked;
                    setUseEstimation(checked);
                    if (checked) {
                        // Sincronizar referenceRace com estimationPace atual ao marcar o checkbox
                        const p = (estimationPaceMin ?? 9) + (estimationPaceSec ?? 0) / 60;
                        setData({...data, referenceRace: { distanceKm: 5, timeSeconds: p * 5 * 60 }});
                    }
                }} />
                Não tenho corrida recente (usar estimativa)
            </label>
            {!useEstimation ? (
                <>
                    <input type="number" placeholder="Distância (km)" className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary mb-2" onChange={e => setData({...data, referenceRace: {...data.referenceRace!, distanceKm: Math.max(0, parseFloat(e.target.value) || 0)}})} />
                    <div className="flex gap-2 items-center mb-2">
                      <label className="text-sm text-text-secondary w-full">Tempo da corrida:</label>
                    </div>
                    <div className="flex gap-2">
                      <label className="flex flex-col items-center text-xs text-text-muted flex-1">
                        <input
                          type="number" min="0" max="23"
                          value={refHours}
                          onChange={e => {
                            const h = Math.max(0, parseInt(e.target.value) || 0);
                            setRefHours(h);
                            setData({...data, referenceRace: {...data.referenceRace!, timeSeconds: h * 3600 + refMinutes * 60 + refSeconds}});
                          }}
                          className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary text-center"
                        />
                        horas
                      </label>
                      <label className="flex flex-col items-center text-xs text-text-muted flex-1">
                        <input
                          type="number" min="0" max="59"
                          value={refMinutes}
                          onChange={e => {
                            const m = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                            setRefMinutes(m);
                            setData({...data, referenceRace: {...data.referenceRace!, timeSeconds: refHours * 3600 + m * 60 + refSeconds}});
                          }}
                          className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary text-center"
                        />
                        minutos
                      </label>
                      <label className="flex flex-col items-center text-xs text-text-muted flex-1">
                        <input
                          type="number" min="0" max="59"
                          value={refSeconds}
                          onChange={e => {
                            const s = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                            setRefSeconds(s);
                            setData({...data, referenceRace: {...data.referenceRace!, timeSeconds: refHours * 3600 + refMinutes * 60 + s}});
                          }}
                          className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary text-center"
                        />
                        segundos
                      </label>
                    </div>
                </>
            ) : data.experienceLevel === 'beginner' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-text-secondary block mb-2">
                    Em qual pace você consegue caminhar ou correr confortavelmente agora (min/km)?
                  </label>
                  <div className="flex gap-2 items-center">
                    <label className="flex flex-col items-center text-xs text-text-muted flex-1">
                      <select
                        value={comfortPaceMin ?? 12}
                        onChange={e => {
                          const m = Math.max(6, Math.min(15, parseInt(e.target.value) || 12));
                          setComfortPaceMin(m);
                          setData({...data, referenceRace: { distanceKm: 5, timeSeconds: (m + (comfortPaceSec ?? 0) / 60) * 5 * 60 }});
                        }}
                        className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary text-center"
                      >
                        {Array.from({length: 10}, (_, i) => i + 6).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      minutos
                    </label>
                    <span className="text-text-muted">:</span>
                    <label className="flex flex-col items-center text-xs text-text-muted flex-1">
                      <select
                        value={comfortPaceSec ?? 0}
                        onChange={e => {
                          const s = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                          setComfortPaceSec(s);
                          setData({...data, referenceRace: { distanceKm: 5, timeSeconds: ((comfortPaceMin ?? 12) + s / 60) * 5 * 60 }});
                        }}
                        className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary text-center"
                      >
                        {Array.from({length: 60}, (_, i) => i).map(s => (
                          <option key={s} value={s}>{String(s).padStart(2, '0')}</option>
                        ))}
                      </select>
                      segundos / km
                    </label>
                  </div>
                  <p className="text-xs text-text-muted mt-1">* Você pode caminhar rápido ou correr muito lentamente nesse pace</p>
                </div>
            
                <div>
                  <label className="text-sm text-text-secondary block mb-2">
                    Em qual pace você quer aprender a correr (min/km)?
                  </label>
                  <div className="flex gap-2 items-center">
                    <label className="flex flex-col items-center text-xs text-text-muted flex-1">
                      <select
                        value={beginnerTargetPaceMin ?? 8}
                        onChange={e => {
                          const m = Math.max(3, Math.min(11, parseInt(e.target.value) || 8));
                          setBeginnerTargetPaceMin(m);
                          const targetPace = m + (beginnerTargetPaceSec ?? 0) / 60;
                          setData({...data, goal: {...data.goal, targetPace}});
                        }}
                        className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary text-center"
                      >
                        {Array.from({length: 9}, (_, i) => i + 3).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      minutos
                    </label>
                    <span className="text-text-muted">:</span>
                    <label className="flex flex-col items-center text-xs text-text-muted flex-1">
                      <select
                        value={beginnerTargetPaceSec ?? 0}
                        onChange={e => {
                          const s = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                          setBeginnerTargetPaceSec(s);
                          const targetPace = (beginnerTargetPaceMin ?? 8) + s / 60;
                          setData({...data, goal: {...data.goal, targetPace}});
                        }}
                        className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary text-center"
                      >
                        {Array.from({length: 60}, (_, i) => i).map(s => (
                          <option key={s} value={s}>{String(s).padStart(2, '0')}</option>
                        ))}
                      </select>
                      segundos / km
                    </label>
                  </div>
                  <p className="text-xs text-text-muted mt-1">* Deve ser mais rápido que seu pace de conforto</p>
                </div>
              </div>
            ) : (
                <>
                    <label className="text-sm text-text-secondary block mb-2">
                        Em qual pace você consegue completar essa distância atualmente (min/km)?
                    </label>
                    <div className="flex gap-2 items-center">
                        <label className="flex flex-col items-center text-xs text-text-muted flex-1">
                            <select
                                value={estimationPaceMin ?? 9}
                                onChange={e => {
                                    const m = Math.max(6, Math.min(15, parseInt(e.target.value) || 9));
                                    setEstimationPaceMin(m);
                                    const p = m + (estimationPaceSec ?? 0) / 60;
                                    setData({...data, referenceRace: { distanceKm: 5, timeSeconds: p * 5 * 60 }});
                                }}
                                className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary text-center"
                            >
                                {Array.from({length: 10}, (_, i) => i + 6).map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            minutos
                        </label>
                        <span className="text-text-muted">:</span>
                        <label className="flex flex-col items-center text-xs text-text-muted flex-1">
                            <select
                                value={estimationPaceSec ?? 0}
                                onChange={e => {
                                    const s = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                    setEstimationPaceSec(s);
                                    const p = (estimationPaceMin ?? 9) + s / 60;
                                    setData({...data, referenceRace: { distanceKm: 5, timeSeconds: p * 5 * 60 }});
                                }}
                                className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary text-center"
                            >
                                {Array.from({length: 60}, (_, i) => i).map(s => (
                                    <option key={s} value={s}>{String(s).padStart(2, '0')}</option>
                                ))}
                            </select>
                            segundos / km
                        </label>
                    </div>
                </>
            )}
            <p className="text-xs text-text-muted mt-2">* Estimativa menos precisa que uma corrida real.</p>
        </div>,
        <div key="page3">
            <h2 className="text-xl font-bold mb-4">Em quais dias costuma treinar?</h2>
            {[0,1,2,3,4,5,6].map(day => (
                <label key={day} className="flex items-center gap-2">
                    <input type="checkbox" checked={data.daysOfWeek.includes(day)} onChange={e => {
                        const newDays = e.target.checked ? [...data.daysOfWeek, day] : data.daysOfWeek.filter(d => d !== day);
                        setData({...data, daysOfWeek: newDays});
                    }} />
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][day]}
                </label>
            ))}
            <h2 className="text-xl font-bold mt-4 mb-2">Modo de treino</h2>
            <select className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary" value={data.mode} onChange={e => setData({...data, mode: e.target.value as any})}>
                <option value="outdoor">Rua</option>
                <option value="treadmill">Esteira</option>
                <option value="both">Ambos</option>
            </select>
        </div>,
        <div key="page4">
            <h2 className="text-xl font-bold mb-4">Nível de experiência</h2>
            <select className="w-full p-2 border border-border rounded bg-bg-elevated text-text-primary" value={data.experienceLevel} onChange={e => setData({...data, experienceLevel: e.target.value as any})}>
                <option value="beginner">Iniciante</option>
                <option value="intermediate">Intermediário</option>
                <option value="advanced">Avançado</option>
            </select>
        </div>
    ];

    return (
        <div className="p-6 bg-bg-surface rounded-xl border border-border relative">
            <button onClick={onCancel} className="absolute top-2 right-2 text-text-muted" aria-label="Fechar"><X size={20} /></button>
            {pages[page]}
            <div className="flex justify-between mt-6">
                <button disabled={page === 0} onClick={() => setPage(page - 1)} className="p-2 bg-bg-elevated text-text-primary rounded">Voltar</button>
                {page < pages.length - 1 ? 
                    <button disabled={page === 0 && isDeadlineRisky()} onClick={() => setPage(page + 1)} className="p-2 bg-accent text-white rounded">Próximo</button> :
                    <button onClick={() => onGenerate(generateProgram(data))} className="p-2 bg-accent text-white rounded">Gerar</button>
                }
            </div>
        </div>
    );
}
