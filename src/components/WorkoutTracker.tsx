import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Minus, Plus, Square } from 'lucide-react';
import { WorkoutPlan, formatDuration, formatDistance, getStepTypeLabel, ActivityPoint, getStepDurationSeconds } from '../types';
import MapComponent from './MapComponent';
import { startTracking, TrackCallback, Tracking, startKeepAlive, stopKeepAlive, startNativeTimer, pauseNativeTimer, resumeNativeTimer, stopNativeTimer, onTimerTick } from '../lib/capacitor/tracking';
import { isNative } from '../lib/capacitor/platform';
import { speak as voiceSpeak } from '../lib/capacitor/voice';

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
  isFreeTraining?: boolean;
  simulateGps?: boolean;
  key?: string;
}

export default function WorkoutTracker({ plan, onStop, mode, markAsCompleted, totalWorkoutTime, isFreeTraining, simulateGps }: Props) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedRef = useRef(0);
  const [skippedTime, setSkippedTime] = useState(0);
  const [lapSeconds, setLapSeconds] = useState(0);
  const [lapDistance, setLapDistance] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isWorkoutCompleted, setIsWorkoutCompleted] = useState(false);
  const [isExtended, setIsExtended] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(10); // km/h
  const [countdown, setCountdown] = useState(5);
  const [finishProgress, setFinishProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // GPS state
  const [coords, setCoords] = useState<{lat: number, lng: number, altitude?: number} | null>(null);
  const [path, setPath] = useState<{lat: number, lng: number, altitude?: number, timestamp: number}[]>([]);
  const [dist, setDist] = useState(0); // km
  const [paceHistory, setPaceHistory] = useState<{timeSeconds: number, pace: number}[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const distRef = useRef(0);
  const speedRef = useRef(10);
  const lapDistRef = useRef(0);
  const pointsRef = useRef<ActivityPoint[]>([]);
  const coordsRef = useRef<{lat: number, lng: number, altitude?: number} | null>(null);
  const isPausedRef = useRef(false);
  const prevElapsedRef = useRef<number>(0); // previous native timer elapsed for incremental distance
  const spokenCompletionRef = useRef(false);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

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
			  speak("Iniciando Treino", true);
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

  // GPS tracking + keep-alive + native timer
  useEffect(() => {
    if (countdown > 0) return; // aguarda regressiva terminar

    if (mode !== 'outdoor') {
      console.log('[WorkerTracker] mode != outdoor, starting keep-alive + native timer');
      startKeepAlive();
      // Start native timer (immune to WebView background throttling)
      if (isNative()) {
        startNativeTimer(0);
      }
      return () => {
        stopNativeTimer();
        stopKeepAlive();
      };
    }

    console.log('[WorkerTracker] GPS useEffect iniciado, mode=', mode, 'simulateGps=', simulateGps);

    let lastCoords: {lat: number, lng: number} | null = null;
    let lastTime: number = Date.now();
    let cleanup: (() => void) | null = null;

    const handlePosition: TrackCallback = (pos) => {
      const now = pos.timestamp;
      setCoords({ lat: pos.lat, lng: pos.lng });
      setPath(p => [...p, { ...pos, timestamp: now, altitude: undefined }]);

      if (lastCoords) {
         const R = 6371;
         const dLat = (pos.lat - lastCoords.lat) * Math.PI / 180;
         const dLon = (pos.lng - lastCoords.lng) * Math.PI / 180;
         const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                   Math.cos(lastCoords.lat * Math.PI / 180) * Math.cos(pos.lat * Math.PI / 180) *
                   Math.sin(dLon/2) * Math.sin(dLon/2);
         const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
         const d = R * c;

         if (d > 0.001 && !isPausedRef.current) {
           distRef.current += d;
           lapDistRef.current += d;
           lastMovementTimeRef.current = now;
           const timeDiffHours = (now - lastTime) / 3600000;
           if (timeDiffHours > 0) {
             speedRef.current = d / timeDiffHours;
           }
         }

         // Auto-pause: speed < 1 km/h for 5s while moving
         const speedKmh = d / ((now - lastTime) / 3600000 || 1);
         if (!isPausedRef.current && !isAutoPausedRef.current && speedKmh < 1.0 && (now - lastMovementTimeRef.current) > 5000) {
           isAutoPausedRef.current = true;
           setIsPaused(true);
           speak("Pausando o Treino", true);
         }

         // Auto-resume: speed > 2 km/h (only if auto-paused, not manual)
         if (isPausedRef.current && isAutoPausedRef.current && speedKmh > 3.0) {
           isAutoPausedRef.current = false;
           setIsPaused(false);
           speak("Continuando o Treino", true);
         }
      }
      lastCoords = { lat: pos.lat, lng: pos.lng };
      lastTime = now;
    };

    if (simulateGps) {
      console.log('[WorkerTracker] starting GPS simulator');
      import('../lib/gpsSimulator').then(({ startGpsSimulation }) => {
        cleanup = startGpsSimulation({
          originLat: -15.7975,
          originLng: -47.8919,
          onPosition: (pos: GeolocationPosition) => handlePosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: pos.timestamp,
          }),
          onError: (err) => console.error(err),
        });
      });
    } else {
      console.log('[WorkerTracker] calling startTracking (native plugin)');
      startTracking(handlePosition).then((tracker) => {
        console.log('[WorkerTracker] startTracking OK, tracker ready');
        setPermissionError(null);
        cleanup = () => tracker.stop();
      }).catch((err) => {
        console.error('[WorkerTracker] GPS tracking error:', err);
        setPermissionError(err?.message || String(err));
      });
    }

    return () => { if (cleanup) cleanup(); };
  }, [mode, simulateGps, retryKey, countdown]);

  // Native timer tick listener (treadmill mode — immune to background throttling)
  useEffect(() => {
    if (mode !== 'treadmill' || !isNative()) return;

    const handle = onTimerTick((elapsed) => {
      setElapsedSeconds(elapsed);
      elapsedRef.current = elapsed;

      // Incremental distance (doesn't recalculate from scratch — avoid jump on speed change)
      const dPerSec = speedRef.current / 3600;
      if (prevElapsedRef.current >= 0) {
        const delta = elapsed - prevElapsedRef.current;
        if (delta > 0) {
          distRef.current += delta * dPerSec;
        }
      }
      prevElapsedRef.current = elapsed;

      // Lap tracking via lapStartElapsedRef
      const lapElapsed = elapsed - lapStartElapsedRef.current;
      const lapDist = lapElapsed * dPerSec;
      lapDistRef.current = lapDist;
      setLapDistance(lapDist);
      setLapSeconds(lapElapsed);

      // Accumulate point
      const newPoint: ActivityPoint = {
        timestampSeconds: elapsed,
        speedKmh: speedRef.current,
        distanceKm: distRef.current,
        stepIndex: stepIndexRef.current,
      };
      if (coordsRef.current) {
        newPoint.lat = coordsRef.current.lat;
        newPoint.lon = coordsRef.current.lng;
        if (coordsRef.current.altitude !== undefined) {
          newPoint.altitude = coordsRef.current.altitude;
        }
      }
      pointsRef.current.push(newPoint);

      // KM announcement
      const currentKm = Math.floor(distRef.current);
      if (currentKm > lastKmAnnouncedRef.current && currentKm > 0) {
        const timeSinceLastKm = elapsed - lastKmStartTimeRef.current;
        const paceMinPerKm = timeSinceLastKm / 60;
        const paceMins = Math.floor(paceMinPerKm);
        const paceSecs = Math.round((paceMinPerKm - paceMins) * 60);
        speak(`Quilômetro ${currentKm} completado. Último quilômetro em ${paceMins} minutos e ${paceSecs} segundos`, true);
        lastKmAnnouncedRef.current = currentKm;
        lastKmStartTimeRef.current = elapsed;
      }

      // Half-lap TTS
      if (!halfLapAnnouncedRef.current) {
        const currentStepObj = plan.steps[stepIndexRef.current];
        if (currentStepObj?.type === 'run') {
          if (currentStepObj.basis === 'distance') {
            const tDist = getStepTargetDistance(currentStepObj);
            if (tDist > 0 && lapDistRef.current >= tDist / 2) {
              halfLapAnnouncedRef.current = true;
              speak("Chegamos na metade dessa volta!", true);
            }
          } else {
            const dur = getStepDurationSeconds(currentStepObj);
            if (dur > 180 && lapElapsed >= dur / 2) {
              halfLapAnnouncedRef.current = true;
              speak("Chegamos na metade dessa volta!", true);
            }
          }
        }
      }

      // Half-workout TTS
      if (!halfWorkoutAnnouncedRef.current && !isFreeTraining) {
        if (elapsed >= totalWorkoutTime / 2) {
          halfWorkoutAnnouncedRef.current = true;
          speak("Chegamos na metade do treino!", true);
        }
      }
    });

    return () => { if (handle) handle.then(h => h.remove()); };
  }, [mode, countdown, isPaused]);

  useEffect(() => {
      return () => {
        if (finishTimerRef.current) clearInterval(finishTimerRef.current);
      }
  }, []);

  // Main timer
  const stepIndexRef = useRef(0);
  const lapStartElapsedRef = useRef(0); // total elapsed when current step started (for native timer lap calc)

  useEffect(() => {
    if (!isPaused && countdown === 0) {
        intervalRef.current = setInterval(() => {
          // Native timer is source of truth for treadmill+native — skip time/distance
          if (mode === 'treadmill' && isNative()) {
            // Only accumulate points + pace history (time/distance handled by native timer)
            const newPoint: ActivityPoint = {
                timestampSeconds: elapsedRef.current,
                speedKmh: speedRef.current,
                distanceKm: distRef.current,
                stepIndex: stepIndexRef.current,
            };
            if (coordsRef.current) {
                newPoint.lat = coordsRef.current.lat;
                newPoint.lon = coordsRef.current.lng;
                if (coordsRef.current.altitude !== undefined) {
                    newPoint.altitude = coordsRef.current.altitude;
                }
            }
            pointsRef.current.push(newPoint);

            const pace = speedRef.current > 0 ? (60 / speedRef.current) : 0;
            setPaceHistory(p => [...p, { timeSeconds: elapsedRef.current, pace }]);

            // KM announcement (native timer doesn't have this)
            const currentKm = Math.floor(distRef.current);
            if (currentKm > lastKmAnnouncedRef.current && currentKm > 0) {
              const timeSinceLastKm = elapsedRef.current - lastKmStartTimeRef.current;
              const paceMinPerKm = timeSinceLastKm / 60;
              const paceMins = Math.floor(paceMinPerKm);
              const paceSecs = Math.round((paceMinPerKm - paceMins) * 60);
              speak(`Quilômetro ${currentKm} completado. Último quilômetro em ${paceMins} minutos e ${paceSecs} segundos`, true);
              lastKmAnnouncedRef.current = currentKm;
              lastKmStartTimeRef.current = elapsedRef.current;
            }
            return;
          }

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
              stepIndex: stepIndexRef.current,
          };
          
          if (coordsRef.current) {
              newPoint.lat = coordsRef.current.lat;
              newPoint.lon = coordsRef.current.lng;
              if (coordsRef.current.altitude !== undefined) {
                  newPoint.altitude = coordsRef.current.altitude;
              }
          }
          
          pointsRef.current.push(newPoint);

          // KM announcement
          const currentKm = Math.floor(distRef.current);
          if (currentKm > lastKmAnnouncedRef.current && currentKm > 0) {
            const timeSinceLastKm = elapsedRef.current - lastKmStartTimeRef.current;
            const paceMinPerKm = (timeSinceLastKm / 60); // min/km
            const paceMins = Math.floor(paceMinPerKm);
            const paceSecs = Math.round((paceMinPerKm - paceMins) * 60);
            
            speak(`Quilômetro ${currentKm} completado. Último quilômetro em ${paceMins} minutos e ${paceSecs} segundos`, true);
            lastKmAnnouncedRef.current = currentKm;
            lastKmStartTimeRef.current = elapsedRef.current;
          }

          // Half-lap TTS: announce at 50% of step duration (run steps only)
          if (!halfLapAnnouncedRef.current) {
            const currentStepObj = plan.steps[stepIndexRef.current];
            if (currentStepObj?.type === 'run') {
              if (currentStepObj.basis === 'distance') {
                const tDist = getStepTargetDistance(currentStepObj);
                if (tDist > 0 && lapDistRef.current >= tDist / 2) {
                  halfLapAnnouncedRef.current = true;
                  speak("Chegamos na metade dessa volta!", true);
                }
              } else {
                const dur = getStepDurationSeconds(currentStepObj);
                const lapTimeSeconds = elapsedRef.current - lapStartElapsedRef.current;
                if (dur > 180 && lapTimeSeconds >= dur / 2) {
                  halfLapAnnouncedRef.current = true;
                  speak("Chegamos na metade dessa volta!", true);
                }
              }
            }
          }

          // Half-workout TTS: announce once at 50% of total workout time
          if (!halfWorkoutAnnouncedRef.current && !isFreeTraining) {
            if ((elapsedRef.current + 0) >= totalWorkoutTime / 2) {
              halfWorkoutAnnouncedRef.current = true;
              speak("Chegamos na metade do treino!", true);
            }
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
  const almostThereAnnouncedRef = useRef<boolean>(false);
  const halfLapAnnouncedRef = useRef<boolean>(false);
  const halfWorkoutAnnouncedRef = useRef<boolean>(false);
  const speedTouchRef = useRef(false); // blocks synthesized mouse events on mobile
  const isAutoPausedRef = useRef(false); // true when auto-pause triggered (not manual)
  const lastMovementTimeRef = useRef(Date.now()); // last time GPS detected movement

  const speak = (text: string, force = false) => {
    if (!force && (isFreeTraining || isExtended)) return;
    voiceSpeak(text, 'pt-BR');
  };

  const formatDurationSpeech = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} segundos`;
    if (secs === 0) return `${mins} minutos`;
    return `${mins} minutos e ${secs} segundos`;
  };

  const formatDistanceTts = (distKm: number) => {
    if (distKm < 1) return `${Math.round(distKm * 1000)}m`;
    return `${distKm.toFixed(2).replace('.', ',')}km`;
  };

    // Handle step progression & Lap announcement
    useEffect(() => {
        const currentStep = plan.steps[currentStepIndex];
        if (!currentStep) return;
        
        // Announce step change ONLY if step index changed
        if (currentStepIndex !== lastStepIndexRef.current) {
            if (countdown > 0) return; // wait for countdown to finish
            lastStepIndexRef.current = currentStepIndex;
            almostThereAnnouncedRef.current = false;
            halfLapAnnouncedRef.current = false;
            const ptType = currentStep.type === 'warmup' ? 'Aquecimento' : currentStep.type === 'run' ? 'Corrida' : currentStep.type === 'cooldown' ? 'Desaquecimento' : currentStep.type === 'rest' ? 'Caminhada' : currentStep.type;
            const stepDuration = getStepDurationSeconds(currentStep);
            const targetDist = getStepTargetDistance(currentStep);
            const isDistBasis = currentStep.basis === 'distance';
            const paceTtText = currentStep.targetPace
                ? (mode === 'treadmill'
                    ? (() => {
                        const speed = 60 / currentStep.targetPace;
                        const speedText = parseFloat(speed.toFixed(1)).toString().replace('.', ',');
                        return ` a ${speedText} quilômetros por hora`;
                      })()
                    : ` Pace ${currentStep.targetPace}`)
                : '';
            
            speak(`Volta atual ${isDistBasis ? formatDistanceTts(targetDist) : formatDurationSpeech(stepDuration)} de ${ptType}${paceTtText}`);
        }

        // Almost-there announcement before step completes
        const stepDur = getStepDurationSeconds(currentStep);
        const isDist = currentStep.basis === 'distance' && currentStep.type === 'run';
        let threshold = 0, prefix = '';
        if (currentStep.type === 'run') { threshold = 15; prefix = 'Você está quase lá. '; }
        else if (currentStep.type === 'warmup' || currentStep.type === 'rest' || currentStep.type === 'cooldown') { threshold = 10; }

        if (threshold > 0 && currentStepIndex < plan.steps.length - 1 && !almostThereAnnouncedRef.current) {
            let isClose = false;
            if (isDist) {
                const targetDist = getStepTargetDistance(currentStep);
                isClose = targetDist - lapDistance <= 0.1 && targetDist - lapDistance > 0;
            } else {
                isClose = stepDur - lapSeconds <= threshold && stepDur - lapSeconds > 0 && stepDur > threshold + 5;
            }
            if (isClose) {
                almostThereAnnouncedRef.current = true;
                const next = plan.steps[currentStepIndex + 1];
                const nextLabel = next.type === 'warmup' ? 'Aquecimento' : next.type === 'run' ? 'Corrida' : next.type === 'cooldown' ? 'Desaquecimento' : next.type === 'rest' ? 'Caminhada' : next.type;
                const nextIsDist = next.basis === 'distance';
                const nextSpeed = next.targetPace ? (60 / next.targetPace).toFixed(1).replace('.', ',') : '';
                const nextPaceText = next.targetPace
                    ? (mode === 'treadmill'
                        ? ` a ${nextSpeed} quilômetros por hora`
                        : ` Pace ${next.targetPace}`)
                    : '';
                const nextObj = nextIsDist ? formatDistanceTts(getStepTargetDistance(next)) : formatDurationSpeech(getStepDurationSeconds(next));
                speak(`${prefix}Próxima volta: ${nextObj} de ${nextLabel}${nextPaceText}`);
            }
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
      if (!spokenCompletionRef.current) {
        spokenCompletionRef.current = true;
        speak("Exercício concluído, parabéns!", true);
      }
      setIsExtended(true);
    } else {
      const nextIndex = currentStepIndex + 1;
      setStepSpeed(nextIndex);
      setCurrentStepIndex(nextIndex);
      stepIndexRef.current = nextIndex;
      setLapSeconds(0);
      lapStartElapsedRef.current = elapsedRef.current;
      lapDistRef.current = 0; // Reset for next lap
      setLapDistance(0);
    }
    }, [lapSeconds, lapDistance, currentStepIndex, plan.steps, countdown]);

  const step = plan.steps[currentStepIndex] || { type: 'Finalizado', durationSeconds: 0, targetPace: 1, basis: 'time' };

  // É etapa de Corrida E o usuário escolheu o modo distância: nesse caso (e
  // somente nesse caso) o sistema passa a se basear na distância da etapa,
  // tanto para exibição (marquee, barra de progresso) quanto para a
  // conclusão da etapa (já tratado no efeito acima).
  const isDistanceStep = step.type === 'run' && (step as any).basis === 'distance';
  const stepTargetDistance = isDistanceStep ? getStepTargetDistance(step) : 0;

  useEffect(() => {
    if (isWorkoutCompleted && !workoutCompletedAnnouncedRef.current) {
        speak("Agora é só olhar seu relatório", true);
        workoutCompletedAnnouncedRef.current = true;
        stopNativeTimer();
    }
  }, [isWorkoutCompleted]);

  // Native timer pause/resume (treadmill)
  useEffect(() => {
    if (mode !== 'treadmill' || !isNative()) return;
    if (isPaused) {
      pauseNativeTimer();
    } else if (countdown === 0) {
      resumeNativeTimer();
    }
  }, [isPaused, mode, countdown]);

  
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
      stepIndexRef.current = nextIndex;
      setLapSeconds(0);
      lapStartElapsedRef.current = elapsedRef.current;
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
    <div className="h-full flex flex-col bg-bg-deep text-text-primary overflow-hidden">
      {permissionError && mode === 'outdoor' && (
        <div className="flex-shrink-0 w-full px-4 pt-3 pb-1 bg-danger/10 border-b border-danger/30 text-danger">
          <p className="font-semibold text-sm mb-1">Permissão de localização necessária</p>
          <p className="text-xs mb-2 text-text-secondary">{permissionError}</p>
          <div className="flex gap-2">
            <button
              onClick={() => { setPermissionError(null); setRetryKey(k => k + 1); }}
              className="flex-1 py-2 rounded bg-bg-elevated text-text-primary text-xs font-medium"
            >
              Tentar novamente
            </button>
            <button
              onClick={async () => { try { await Tracking.openAppSettings(); } catch {} }}
              className="flex-1 py-2 rounded bg-accent/80 text-white text-xs font-medium"
            >
              Abrir Configurações
            </button>
          </div>
        </div>
      )}
      {countdown > 0 && (
        <div className="fixed inset-0 flex text-6xl justify-center items-center bg-bg-deep z-50">{countdown}</div>
      )}
      <div className="flex-1 flex flex-col px-6 py-3 pb-[calc(48px+env(safe-area-inset-bottom,0px))] w-full overflow-hidden">
        <div className="flex-shrink-0 text-center text-text-secondary text-[11px] uppercase tracking-wider">Atual</div>
        <div className="flex-shrink-0 text-center text-3xl font-bold text-accent-secondary uppercase">{isExtended ? 'Corrida Livre' : getStepTypeLabel(step.type)}</div>

        <div className="flex-shrink-0 grid grid-cols-3 gap-2 text-center mt-1">
          <div>
            <div className="text-text-secondary text-[12px] uppercase">Dist. Total</div>
            <div className="text-lg font-bold">{formatDistance(displayDistance)}</div>
          </div>
          <div>
            <div className="text-text-secondary text-[12px] uppercase">Tempo total</div>
            <div className="text-lg font-bold">{formatTime(elapsedSeconds)}</div>
          </div>
          <div>
            <div className="text-text-secondary text-[12px] uppercase">Vel. Média</div>
            <div className="text-lg font-bold">{(elapsedSeconds > 0 ? (displayDistance / (elapsedSeconds / 3600)) : 0).toFixed(1)} KM/h</div>
          </div>
        </div>

        {/* Marquee — unified height/font for both modes */}
        <div className="flex-shrink-0 relative bg-bg-elevated rounded p-1 mt-1 overflow-hidden w-full h-9">
            <div key={currentStepIndex} className={`absolute top-1/2 -translate-y-1/2 ${!isPaused && countdown === 0 ? 'animate-marquee' : ''} text-base text-text-primary whitespace-nowrap`}>
                {isFreeTraining ? 'Corrida Livre' : `${isDistanceStep ? formatDistance(stepTargetDistance) : formatDuration(step.durationSeconds)} ${getStepTypeLabel(step.type)}${step.targetPace ? ` @ ${(60/step.targetPace).toFixed(1)} km/h` : ''}`}
            </div>
        </div>

        {/* Step progress bar — unified, with percentage */}
        <div className="text-[9px] uppercase tracking-wider text-text-secondary mt-1 mb-0.5">Progresso da Volta</div>
        <div className="flex-shrink-0 relative w-full h-[18px] bg-bg-elevated rounded-full mt-0.5">
            <div className="bg-accent-secondary h-full rounded-full" style={{width: `${isDistanceStep ? Math.min((lapDistance / (stepTargetDistance || 1)) * 100, 100) : Math.min((lapSeconds / (step.durationSeconds || 1)) * 100, 100)}%`}}></div>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white drop-shadow-sm pointer-events-none">{isDistanceStep ? Math.min(Math.round((lapDistance / (stepTargetDistance || 1)) * 100), 100) : Math.min(Math.round((lapSeconds / (step.durationSeconds || 1)) * 100), 100)}%</span>
        </div>

        {/* Total progress bar — unified, with percentage */}
        <div className="text-[9px] uppercase tracking-wider text-text-secondary mt-1 mb-0.5">Progresso do Treino</div>
        <div className="flex-shrink-0 relative w-full h-[18px] bg-bg-elevated rounded-full mt-0.5">
            <div className="bg-accent-secondary h-full rounded-full" style={{width: `${Math.min(((elapsedSeconds + skippedTime) / totalWorkoutTime) * 100, 100)}%`}}></div>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white drop-shadow-sm pointer-events-none">{Math.min(Math.round(((elapsedSeconds + skippedTime) / totalWorkoutTime) * 100), 100)}%</span>
        </div>

        {mode === 'outdoor' && !isWorkoutCompleted && countdown === 0 && (
          <div className="w-full rounded-lg overflow-hidden mt-2" style={{ flex: '0.85', minHeight: 120 }}>
            <MapComponent coords={coords} path={path} />
          </div>
        )}

        {/* Distance box — unified: primary = what's left to complete goal */}
        <div className={(mode === 'treadmill' ? 'flex-1 min-h-0' : 'flex-shrink-0') + ' mt-2'}>
          <div className="w-full h-full px-3 py-2 bg-bg-surface border border-border rounded-xl flex flex-col items-center justify-center">
            {isDistanceStep ? (
                <>
                    <div className="text-[42px] font-bold leading-tight">{formatDistance(Math.max(0, stepTargetDistance - lapDistance))}</div>
                    <div className="text-text-secondary uppercase tracking-widest text-[10px]">Distância Restante</div>
                    <div className="text-xl font-bold mt-2">{formatTime(lapSeconds)}</div>
                    <div className="text-text-secondary uppercase tracking-widest text-[10px]">Tempo da Volta</div>
                </>
            ) : (
                <>
                    <div className="text-[42px] font-bold leading-tight">{formatTime(Math.max(0, step.durationSeconds - lapSeconds))}</div>
                    <div className="text-text-secondary uppercase tracking-widest text-[10px]">Tempo Restante</div>
                    {!isFreeTraining && (
                      <>
                        <div className="text-xl font-bold mt-2">{formatDistance(lapDistance)}</div>
                        <div className="text-text-secondary uppercase tracking-widest text-[10px]">Distância Percorrida</div>
                      </>
                    )}
                </>
            )}
          </div>
        </div>

        {mode === 'treadmill' && (
            <div className="flex-shrink-0 flex items-center justify-between bg-bg-elevated rounded-xl p-2 mt-2">
                <button 
                    onMouseDown={() => { if (speedTouchRef.current) return; if (mode === 'treadmill') { pressStartRef.current = Date.now(); startAdjusting(-0.1); } }}
                    onMouseUp={() => { stopAdjusting(); }}
                    onMouseLeave={() => { stopAdjusting(); }}
                    onTouchStart={(e) => { speedTouchRef.current = true; e.preventDefault(); if (mode === 'treadmill') { pressStartRef.current = Date.now(); startAdjusting(-0.1); } }}
                    onTouchEnd={() => { stopAdjusting(); setTimeout(() => { speedTouchRef.current = false; }, 100); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startAdjusting(-0.1); } }}
                    onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') stopAdjusting(); }}
                    className="p-2 rounded-lg bg-bg-elevated"
                    style={{ touchAction: 'manipulation' }}
                    aria-label="Diminuir velocidade"
                >
                    <Minus size={22} />
                </button>
                <div className="flex flex-col items-center">
                    <div className="text-2xl font-bold text-accent-secondary">{currentSpeed.toFixed(1)} KM/h</div>
                    <div className="text-[10px] text-text-muted uppercase">Velocidade</div>
                </div>
                <button 
                    onMouseDown={() => { if (speedTouchRef.current) return; if (mode === 'treadmill') { pressStartRef.current = Date.now(); startAdjusting(0.1); } }}
                    onMouseUp={() => { stopAdjusting(); }}
                    onMouseLeave={() => { stopAdjusting(); }}
                    onTouchStart={(e) => { speedTouchRef.current = true; e.preventDefault(); if (mode === 'treadmill') { pressStartRef.current = Date.now(); startAdjusting(0.1); } }}
                    onTouchEnd={() => { stopAdjusting(); setTimeout(() => { speedTouchRef.current = false; }, 100); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startAdjusting(0.1); } }}
                    onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') stopAdjusting(); }}
                    className="p-2 rounded-lg bg-bg-elevated"
                    style={{ touchAction: 'manipulation' }}
                    aria-label="Aumentar velocidade"
                >
                    <Plus size={22} />
                </button>
            </div>
        )}

        {/* Buttons — stacked, full width (both modes) */}
        <div className={`flex-shrink-0 flex flex-col gap-2 ${mode === 'outdoor' ? 'mt-auto pb-1' : 'mt-2'}`}>
          {isPaused || isExtended ? (
              <button 
                  onMouseDown={startFinish}
                  onMouseUp={stopFinish}
                  onMouseLeave={stopFinish}
                  onTouchStart={startFinish}
                  onTouchEnd={stopFinish}
                  className="w-full flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-xl font-bold uppercase relative overflow-hidden"
              >
                  <div className="absolute inset-0 bg-accent-secondary/45" style={{ width: `${finishProgress}%` }}></div>
                  <Square size={18} aria-hidden="true" /> Finalizar
              </button>
          ) : (
              <button 
                  onClick={nextStep} 
                  disabled={currentStepIndex >= plan.steps.length - 1}
                  className={`w-full flex items-center justify-center gap-2 bg-bg-elevated text-text-primary py-3 rounded-xl font-bold uppercase ${currentStepIndex >= plan.steps.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                  <SkipForward size={18} aria-hidden="true" /> Próxima volta
              </button>
          )}
          <button onClick={() => { if (!isPaused) { isAutoPausedRef.current = false; lastMovementTimeRef.current = Date.now(); } setIsPaused(!isPaused); }} className="w-full flex items-center justify-center gap-2 bg-accent-secondary text-white py-3 rounded-xl font-bold uppercase">
              {isPaused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />} {isPaused ? 'Continuar' : 'Pausar'}
          </button>
        </div>
      </div>

      {isWorkoutCompleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70" role="dialog" aria-modal="true" aria-label="Treino finalizado">
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
                        className="w-full bg-bg-elevated hover:opacity-80 text-text-secondary p-4 rounded-xl font-bold transition-colors border border-border"
                    >
                        DESCARTAR RELATÓRIO
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
