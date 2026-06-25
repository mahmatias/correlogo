import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Minus, Plus, Square } from 'lucide-react';
import { WorkoutPlan, formatDuration, formatDistance, getStepTypeLabel, ActivityPoint, getStepDurationSeconds } from '../types';
import MapComponent from './MapComponent';

interface Props {
  plan: WorkoutPlan;
  onStop: () => void;
  mode: 'treadmill' | 'outdoor';
  markAsCompleted: (id: string, sessionStats: { 
      points: ActivityPoint[], 
      distanceKm: number, 
      timeSeconds: number,
      mode: 'treadmill' | 'outdoor'
  }) => void;
  totalWorkoutTime: number;
  key?: string;
}

export default function WorkoutTracker({ plan, onStop, mode, markAsCompleted, totalWorkoutTime }: Props) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedRef = useRef(0);
  const [skippedTime, setSkippedTime] = useState(0);
  const [lapSeconds, setLapSeconds] = useState(0);
  const [lapDistance, setLapDistance] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isWorkoutCompleted, setIsWorkoutCompleted] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(10); // km/h
  const [countdown, setCountdown] = useState(5);
  const [finishProgress, setFinishProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // GPS state
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [path, setPath] = useState<{lat: number, lng: number, timestamp: number}[]>([]);
  const [dist, setDist] = useState(0); // km
  const [paceHistory, setPaceHistory] = useState<{timeSeconds: number, pace: number}[]>([]);
  
  const distRef = useRef(0);
  const speedRef = useRef(10);
  const lapDistRef = useRef(0);
  const pointsRef = useRef<ActivityPoint[]>([]);
  const coordsRef = useRef(coords);

  // Sync coords ref
  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  // Countdown logic
  useEffect(() => {
	  if (countdown > 0) {
		  const timer = setTimeout(() => {
			  setCountdown(c => c - 1);
		  }, 1000);
      
		  // Announce start once
		  if (countdown === 5) {
			  speak("Iniciando Treino");
		  }
		  
		  return () => clearTimeout(timer);
	  }
  }, [countdown]);

  // Sync refs to state
  useEffect(() => {
    const timer = setInterval(() => {
        setDist(distRef.current);
        setCurrentSpeed(speedRef.current);
        setLapDistance(lapDistRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // GPS tracking
  useEffect(() => {
    if (mode !== 'outdoor') return;

    let lastCoords: {lat: number, lng: number} | null = null;
    let lastTime: number = Date.now();

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const now = Date.now();
        setCoords(newCoords);
        setPath(p => [...p, { ...newCoords, timestamp: now }]);

        if (lastCoords) {
           const R = 6371; // km
           const dLat = (newCoords.lat - lastCoords.lat) * Math.PI / 180;
           const dLon = (newCoords.lng - lastCoords.lng) * Math.PI / 180;
           const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                     Math.cos(lastCoords.lat * Math.PI / 180) * Math.cos(newCoords.lat * Math.PI / 180) *
                     Math.sin(dLon/2) * Math.sin(dLon/2);
           const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
           const d = R * c; // km
           
           if (d > 0.001) { // Filter noise
             distRef.current += d;
             lapDistRef.current += d;
             const timeDiffHours = (now - lastTime) / 3600000;
             if (timeDiffHours > 0) {
               speedRef.current = d / timeDiffHours;
             }
           }
        }
        lastCoords = newCoords;
        lastTime = now;
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [mode]);

  useEffect(() => {
      return () => {
        if (finishTimerRef.current) clearInterval(finishTimerRef.current);
      }
  }, []);

  // Main timer
  useEffect(() => {
    if (!isPaused && countdown === 0) {
        intervalRef.current = setInterval(() => {
          setElapsedSeconds(s => s + 1);
          setLapSeconds(s => s + 1);
          
          if (mode === 'treadmill') {
            const dPerSec = (speedRef.current / 3600);
            distRef.current += dPerSec;
            lapDistRef.current += dPerSec;
          }

          elapsedRef.current += 1;
          
          // Accumulate point
          const newPoint: ActivityPoint = {
              timestampSeconds: elapsedRef.current,
              speedKmh: speedRef.current,
              distanceKm: distRef.current,
              stepIndex: currentStepIndex,
          };
          
          if (coordsRef.current) {
              newPoint.lat = coordsRef.current.lat;
              newPoint.lon = coordsRef.current.lng;
          }
          
          pointsRef.current.push(newPoint);

          // KM announcement
          const currentKm = Math.floor(distRef.current);
          if (currentKm > lastKmAnnouncedRef.current && currentKm > 0) {
            const timeSinceLastKm = elapsedRef.current - lastKmStartTimeRef.current;
            const paceMinPerKm = (timeSinceLastKm / 60); // min/km
            const paceMins = Math.floor(paceMinPerKm);
            const paceSecs = Math.round((paceMinPerKm - paceMins) * 60);
            
            speak(`Quilômetro ${currentKm} completado. Último quilômetro em ${paceMins} minutos e ${paceSecs} segundos`);
            lastKmAnnouncedRef.current = currentKm;
            lastKmStartTimeRef.current = elapsedRef.current;
          }

          const pace = speedRef.current > 0 ? (60 / speedRef.current) : 0;
          setPaceHistory(p => [...p, { timeSeconds: elapsedRef.current, pace }]);
        }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, countdown, mode]);

  // Initial speed based on targetPace (only for treadmill)
  const setStepSpeed = (index: number) => {
    if (mode !== 'treadmill') return;

    const step = plan.steps[index];
    if (step && step.targetPace && step.targetPace > 0) {
      const paceSpeed = 60 / step.targetPace;
      setCurrentSpeed(paceSpeed);
      speedRef.current = paceSpeed;
    }
  };

  useEffect(() => {
      setStepSpeed(0);
  }, []);

  // Calcula a distância-alvo (km) de uma etapa de Corrida a partir do plano
  // (que sempre traz duração + pace). Centralizado aqui para que a barra de
  // progresso, o marquee de objetivo e a lógica de conclusão da etapa usem
  // sempre o mesmo valor, sem repetir a fórmula em três lugares.
  const getStepTargetDistance = (step: { durationSeconds: number; targetPace?: number; targetDistance?: number }) => {
    if (step.targetDistance) return step.targetDistance;
    const speedKmh = 60 / (step.targetPace || 1);
    return (step.durationSeconds / 3600) * speedKmh;
  };

  const lastStepIndexRef = useRef<number>(-1);
  const lastKmAnnouncedRef = useRef<number>(0);
  const playStartAnnouncedRef = useRef<boolean>(false);
  const workoutCompletedAnnouncedRef = useRef<boolean>(false);
  const lastKmStartTimeRef = useRef<number>(0); // Timestamp of start of current km

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';

      // Try to find a female voice
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => v.lang === 'pt-BR' && v.name.toLowerCase().includes('female'));
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
      
      utterance.rate = 1.1; // Slightly faster for clarity
      window.speechSynthesis.speak(utterance);
    }
  };

  // Handle step progression & Lap announcement
  useEffect(() => {
    const currentStep = plan.steps[currentStepIndex];
    if (!currentStep) return;
    
    // Announce step change ONLY if step index changed
    if (currentStepIndex !== lastStepIndexRef.current) {
        const ptType = currentStep.type === 'warmup' ? 'Aquecimento' : currentStep.type === 'run' ? 'Corrida' : currentStep.type === 'cooldown' ? 'Desaquecimento' : currentStep.type === 'rest' ? 'Descanso' : currentStep.type;
        const targetDist = getStepTargetDistance(currentStep);
        const speedKmh = 60 / (currentStep.targetPace || 1);
        
        speak(`Volta atual ${formatDistance(targetDist)} de ${ptType} Pace ${currentStep.targetPace || 0}`);
        
        lastStepIndexRef.current = currentStepIndex;
    }

    let isCompleted = false;

    if (currentStep.basis === 'distance' && currentStep.type === 'run') {
        // Run steps by distance
        const targetDist = getStepTargetDistance(currentStep);
        if (lapDistance >= targetDist) isCompleted = true;
    } else {
        // Time based completion (warmup, cooldown, rest, or run if trainingType is time)
        if (lapSeconds >= getStepDurationSeconds(currentStep)) isCompleted = true;
    }

    if (!isCompleted) return;

    const isLastStep = currentStepIndex >= plan.steps.length - 1;

    if (isLastStep) {
      setIsWorkoutCompleted(true);
      setIsPaused(true);
    } else {
      const nextIndex = currentStepIndex + 1;
      setStepSpeed(nextIndex);
      setCurrentStepIndex(nextIndex);
      setLapSeconds(0);
      lapDistRef.current = 0; // Reset for next lap
      setLapDistance(0);
    }
  }, [lapSeconds, lapDistance, currentStepIndex, plan.steps]);

  const step = plan.steps[currentStepIndex] || { type: 'Finalizado', durationSeconds: 0, targetPace: 1, basis: 'time' };

  // É etapa de Corrida E o usuário escolheu o modo distância: nesse caso (e
  // somente nesse caso) o sistema passa a se basear na distância da etapa,
  // tanto para exibição (marquee, barra de progresso) quanto para a
  // conclusão da etapa (já tratado no efeito acima).
  const isDistanceStep = step.type === 'run' && (step as any).basis === 'distance';
  const stepTargetDistance = isDistanceStep ? getStepTargetDistance(step) : 0;

  useEffect(() => {
    if (isWorkoutCompleted && !workoutCompletedAnnouncedRef.current) {
        speak("Exercício Concluído. Parabéns!");
        workoutCompletedAnnouncedRef.current = true;
    }
  }, [isWorkoutCompleted]);

  
  const displayDistance = dist;
  
  // Need to track lap distance with GPS too. 
  // Let's simplify and just display total distance first to satisfy request.
  
  const avgSpeed = (speedRef.current); 

  const nextStep = () => {
    if (currentStepIndex < plan.steps.length - 1) {
      const currentStep = plan.steps[currentStepIndex];
      const remainingTime = Math.max(0, currentStep.durationSeconds - lapSeconds);
      setSkippedTime(prev => prev + remainingTime);
      
      const nextIndex = currentStepIndex + 1;
      setStepSpeed(nextIndex);
      setCurrentStepIndex(nextIndex);
      setLapSeconds(0);
      lapDistRef.current = 0;
      setLapDistance(0);
    } else {
      setIsPaused(true);
    }
  };

  // Speed selector logic
  const speedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pressStartRef = useRef<number>(0);

  const startAdjusting = (change: number) => {
    // 1 tap
    const newSpeed = Math.max(1, currentSpeed + (change > 0 ? 0.1 : -0.1));
    setCurrentSpeed(newSpeed);
    speedRef.current = newSpeed;

    // Hold logic
    speedTimeoutRef.current = setTimeout(() => {
      let speedChange = change > 0 ? 0.1 : -0.1;

      speedIntervalRef.current = setInterval(() => {
        // After 2s, accelerate variation
        if (Date.now() - pressStartRef.current > 2000) {
            speedChange = change > 0 ? 0.5 : -0.5;
        }
        setCurrentSpeed(s => {
          const ns = Math.max(1, s + speedChange);
          speedRef.current = ns;
          return ns;
        });
      }, Date.now() - pressStartRef.current > 2000 ? 500 : 300);
    }, 300);
  };

  const stopAdjusting = () => {
    if (speedTimeoutRef.current) clearTimeout(speedTimeoutRef.current);
    if (speedIntervalRef.current) clearInterval(speedIntervalRef.current);
    speedTimeoutRef.current = null;
    speedIntervalRef.current = null;
  };

  // Finish button logic
  const startFinish = () => {
    finishTimerRef.current = setInterval(() => {
        setFinishProgress(p => Math.min(p + 10, 100)); // Fill in 2s (10*10 intervals of 200ms = 2000ms)
    }, 200);
  };

  // Ao completar o hold (segurar 2s), aciona a mesma tela de decisão usada
  // quando o plano termina naturalmente, em vez de sair direto via onStop().
  // Assim o usuário sempre pode escolher "marcar como concluído" mesmo que
  // pare o treino antes do fim previsto do plano.
  useEffect(() => {
    if (finishProgress >= 100) {
      if (finishTimerRef.current) clearInterval(finishTimerRef.current);
      setIsPaused(true);
      setIsWorkoutCompleted(true);
      setFinishProgress(0);
    }
  }, [finishProgress]);
  
  const stopFinish = () => {
    if (finishTimerRef.current) clearInterval(finishTimerRef.current);
    setFinishProgress(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center p-4 min-h-screen relative bg-bg-deep text-text-primary">
      {countdown > 0 && (
        <div className="absolute inset-0 flex text-6xl justify-center items-center h-screen bg-bg-deep z-50">{countdown}</div>
      )}
      <div className="w-full max-w-md">
        <div className="text-center text-text-secondary text-sm uppercase tracking-wider mb-1">Atual</div>
        <div className="text-center text-3xl font-bold text-accent-secondary mb-6 uppercase">{getStepTypeLabel(step.type)}</div>
        
        <div className="grid grid-cols-3 gap-2 text-center mb-4">
          <div>
            <div className="text-text-secondary text-[10px] uppercase">Dist. Total</div>
            <div className="text-lg font-bold">{formatDistance(displayDistance)}</div>
          </div>
          <div>
            <div className="text-text-secondary text-[10px] uppercase">Tempo total</div>
            <div className="text-lg font-bold">{formatTime(elapsedSeconds)}</div>
          </div>
          <div>
            <div className="text-text-secondary text-[10px] uppercase">Vel. Média</div>
            <div className="text-lg font-bold">{(elapsedSeconds > 0 ? (displayDistance / (elapsedSeconds / 3600)) : 0).toFixed(1)} KM/h</div>
          </div>
        </div>
             {/* Step objective */}
        <div className="relative bg-bg-elevated rounded p-1 mb-2 overflow-hidden w-full h-5">
            <div key={currentStepIndex} className={`absolute top-1/2 -translate-y-1/2 ${!isPaused && countdown === 0 ? 'animate-marquee' : ''} text-[10px] text-text-primary whitespace-nowrap`}>
               {isDistanceStep ? formatDistance(stepTargetDistance) : formatDuration(step.durationSeconds)} {getStepTypeLabel(step.type)} @ { (60/(step.targetPace||1)).toFixed(1) } KM/h
            </div>
        </div>

        {/* Progress bars */}
        <div className="w-full bg-bg-elevated h-2 rounded-full mb-1">
            <div className="bg-accent-secondary h-full rounded-full" style={{width: `${isDistanceStep ? Math.min((lapDistance / (stepTargetDistance || 1)) * 100, 100) : Math.min((lapSeconds / (step.durationSeconds || 1)) * 100, 100)}%`}}></div>
        </div>
        
        <div className="w-full bg-bg-elevated h-2 rounded-full mb-8">
            <div className="bg-accent-secondary h-full rounded-full" style={{width: `${Math.min(((elapsedSeconds + skippedTime) / totalWorkoutTime) * 100, 100)}%`}}></div>
        </div>

        {mode === 'outdoor' && !isWorkoutCompleted && countdown === 0 && <div className="w-full mb-6 h-64"><MapComponent coords={coords} path={path} /></div>}

        {/* Step Distance and Time */}
        <div className="text-center mb-2 p-4 bg-bg-surface border border-border rounded-xl">
            <div className="text-4xl font-bold">{formatDistance(lapDistance)}</div>
            <div className="text-text-secondary uppercase tracking-widest text-xs">Dist. da Volta</div>
            <div className="text-2xl font-bold mt-2">{formatTime(lapSeconds)}</div>
            <div className="text-text-secondary uppercase tracking-widest text-xs">Tempo da Volta</div>
        </div>

        {mode === 'treadmill' && (
            <div className="flex items-center justify-between bg-bg-elevated rounded-xl p-2 mb-6">
                <button 
                    onMouseDown={() => { if (mode === 'treadmill') { pressStartRef.current = Date.now(); startAdjusting(-0.1); } }}
                    onMouseUp={stopAdjusting}
                    onMouseLeave={stopAdjusting}
                    onTouchStart={(e) => { e.preventDefault(); if (mode === 'treadmill') { pressStartRef.current = Date.now(); startAdjusting(-0.1); } }}
                    onTouchEnd={stopAdjusting}
                    className="p-4 rounded-lg bg-bg-elevated"
                    aria-label="Diminuir velocidade"
                >
                    <Minus />
                </button>
                <div className="flex flex-col items-center">
                    <div className="text-2xl font-bold text-accent-secondary">{currentSpeed.toFixed(1)} KM/h</div>
                    <div className="text-xs text-text-muted uppercase">Velocidade</div>
                </div>
                <button 
                    onMouseDown={() => { if (mode === 'treadmill') { pressStartRef.current = Date.now(); startAdjusting(0.1); } }}
                    onMouseUp={stopAdjusting}
                    onMouseLeave={stopAdjusting}
                    onTouchStart={(e) => { e.preventDefault(); if (mode === 'treadmill') { pressStartRef.current = Date.now(); startAdjusting(0.1); } }}
                    onTouchEnd={stopAdjusting}
                    className="p-4 rounded-lg bg-bg-elevated"
                    aria-label="Aumentar velocidade"
                >
                    <Plus />
                </button>
            </div>
        )}

        {isPaused ? (
            <button 
                onMouseDown={startFinish}
                onMouseUp={stopFinish}
                onMouseLeave={stopFinish}
                onTouchStart={startFinish}
                onTouchEnd={stopFinish}
                className="w-full flex items-center justify-center gap-2 bg-accent text-white py-4 rounded-full font-bold mb-4 uppercase relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-white opacity-20" style={{ width: `${finishProgress}%` }}></div>
                <Square aria-hidden="true" /> Finalizar treino
            </button>
        ) : (
            <button 
                onClick={nextStep} 
                disabled={currentStepIndex >= plan.steps.length - 1}
                className={`w-full flex items-center justify-center gap-2 bg-bg-elevated text-text-primary py-4 rounded-full font-bold mb-4 uppercase ${currentStepIndex >= plan.steps.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <SkipForward aria-hidden="true" /> Próxima volta
            </button>
        )}
        <button onClick={() => setIsPaused(!isPaused)} className="w-full flex items-center justify-center gap-2 bg-accent-secondary text-white py-4 rounded-full font-bold uppercase mb-4">
            {isPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />} {isPaused ? 'Continuar' : 'Pausar'}
        </button>

        {isWorkoutCompleted && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black bg-opacity-70" role="dialog" aria-modal="true" aria-label="Treino finalizado">
                <div className="p-8 rounded-3xl shadow-2xl w-full max-w-sm bg-bg-surface border border-border">
                    <h2 className="text-2xl font-bold mb-8 text-center text-text-primary">Treino Finalizado</h2>
                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={() => { markAsCompleted(plan.id, { points: pointsRef.current, distanceKm: dist, timeSeconds: elapsedSeconds, mode }); onStop(); }} 
                            className="w-full bg-accent-secondary hover:opacity-90 text-white p-4 rounded-xl font-bold transition-colors"
                        >
                            SALVAR RELATÓRIO
                        </button>
                        <button 
                            onClick={onStop} 
                            className="w-full bg-accent hover:opacity-90 text-white p-4 rounded-xl font-bold transition-colors"
                        >
                            DESCARTAR RELATÓRIO
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
