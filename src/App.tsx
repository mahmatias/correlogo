/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Play, LogOut, RefreshCw, CheckCircle, Circle, Trash2, BarChart2, Clipboard } from 'lucide-react';
import { WorkoutPlan, formatDuration, formatTotalDuration, TrainingSession, getStepDurationSeconds, ActivityPoint, TrainingProgram } from './types';
import WorkoutTracker from './components/WorkoutTracker';
import ImportPlan from './components/ImportPlan';
import WorkoutEditor from './components/WorkoutEditor';
import TrainingGenerator from './components/TrainingGenerator';
import ProgramReview from './components/ProgramReview';
import SessionSummary from './components/SessionSummary';
import SessionHistory from './components/SessionHistory';
import Signup from './components/Signup';
import Login from './components/Login';
import Modal from './components/Modal';
import Button from './components/Button';
import { getAuth, getDb } from './lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection, query, getDocs, orderBy, limit, deleteDoc } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [activePlan, setActivePlan] = useState<{plan: WorkoutPlan, mode: 'treadmill' | 'outdoor', sessionId: string} | null>(null);
  const [isFreeTraining, setIsFreeTraining] = useState(false);
  const [workoutToStart, setWorkoutToStart] = useState<{plan: WorkoutPlan, mode?: 'treadmill' | 'outdoor'} | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [programToReview, setProgramToReview] = useState<TrainingProgram | null>(null);
  const [planToDelete, setPlanToDelete] = useState<WorkoutPlan | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const applyThemeClass = (light?: boolean) => {
    const isLight = light ?? !window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('light', isLight);
    setIsLightMode(isLight);
  };

  useEffect(() => {
    const t0 = performance.now();
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      console.log(`[timing] onAuthStateChanged fired at ${(performance.now() - t0).toFixed(0)}ms, user=`, !!user);
      setUser(user);
      if (user) {
        const localPlansKey = `correlogo:plans:${user.uid}`;
        const localSessionsKey = `correlogo:sessions:${user.uid}`;
        const localThemeKey = `correlogo:darkMode:${user.uid}`;

        const cachedPlans = localStorage.getItem(localPlansKey);
        if (cachedPlans) {
          try { setPlans(JSON.parse(cachedPlans)); } catch { /* ignore corrupt cache */ }
        }
        const cachedSessions = localStorage.getItem(localSessionsKey);
        if (cachedSessions) {
          try { setSessions(JSON.parse(cachedSessions)); } catch { /* ignore corrupt cache */ }
        }
        const cachedTheme = localStorage.getItem(localThemeKey);
        if (cachedTheme !== null) {
          applyThemeClass(cachedTheme === 'false');
        } else {
          applyThemeClass();
        }

        const db = getDb();
        const t1 = performance.now();
        try {
          const firestorePromise = Promise.all([
            getDoc(doc(db, 'users', user.uid, 'data', 'plans')),
            getDocs(query(collection(db, 'users', user.uid, 'sessions'), orderBy('date', 'desc'), limit(50))),
            getDoc(doc(db, 'users', user.uid, 'data', 'settings')),
          ]);
          // Timeout de 5s — se o Firestore não responder, cai no catch e usa cache local
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout after 5s')), 5000)
          );
          const [plansDoc, qs, settingsDoc] = await Promise.race([firestorePromise, timeout]);
          console.log(`[timing] Firestore reads done at ${(performance.now() - t1).toFixed(0)}ms`);

          if (plansDoc.exists()) {
            const remotePlans = plansDoc.data().plans ?? [];
            // Merge: preserva planos criados localmente que ainda não estão no Firestore
            const cachedPlansRaw = localStorage.getItem(localPlansKey);
            if (cachedPlansRaw) {
              const localPlans: WorkoutPlan[] = JSON.parse(cachedPlansRaw);
              const merged = [...remotePlans];
              for (const lp of localPlans) {
                if (!merged.find(rp => rp.id === lp.id)) {
                  merged.push(lp);
                }
              }
              setPlans(merged);
              localStorage.setItem(localPlansKey, JSON.stringify(merged));
              // Salva de volta no Firestore se houve merge
              if (merged.length !== remotePlans.length) {
                setDoc(doc(db, 'users', user.uid, 'data', 'plans'), { plans: merged }).catch(() => {});
              }
            } else {
              setPlans(remotePlans);
              localStorage.setItem(localPlansKey, JSON.stringify(remotePlans));
            }
          }

          const remoteSessions = qs.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingSession));
          setSessions(remoteSessions);
          localStorage.setItem(localSessionsKey, JSON.stringify(remoteSessions));

          if (settingsDoc.exists() && typeof settingsDoc.data().isDarkMode === 'boolean') {
            const remoteDarkMode = settingsDoc.data().isDarkMode;
            applyThemeClass(!remoteDarkMode);
            localStorage.setItem(localThemeKey, String(remoteDarkMode));
          }

          // Sync: sobe para o Firestore dados que foram criados localmente enquanto offline
          const cachedSessionsRaw = localStorage.getItem(localSessionsKey);
          if (cachedSessionsRaw) {
            const allLocalSessions: TrainingSession[] = JSON.parse(cachedSessionsRaw);
            const localOnlySessions = allLocalSessions.filter(s => s.id.startsWith('local-') && !remoteSessions.find(rs => rs.id === s.id));
            for (const localSess of localOnlySessions) {
              try {
                const { id: _, ...data } = localSess;
                const docRef = await addDoc(collection(db, 'users', user.uid, 'sessions'), data);
                const updatedSessions = allLocalSessions.map(s => s.id === localSess.id ? { ...s, id: docRef.id } : s);
                localStorage.setItem(localSessionsKey, JSON.stringify(updatedSessions));
              } catch { /* se falhar na sync, tenta na próxima vez */ }
            }
          }
        } catch (e) {
          console.warn("Rodando no localStorage — Firestore indisponível.", e);
        } finally {
          setIsLoading(false);
          setInitialized(true);
          console.log(`[timing] Total load: ${(performance.now() - t0).toFixed(0)}ms`);
        }
      } else {
        setPlans([]);
        setSessions([]);
        applyThemeClass();
        setInitialized(true);
        setIsLoading(false);
      }
    });
    return () => { unsub(); };
  }, []);

  const startWorkout = (plan: WorkoutPlan) => {
    setWorkoutToStart({ plan });
  };

  const startFreeTraining = () => {
    const freePlan: WorkoutPlan = {
      id: 'freetrain-' + crypto.randomUUID(),
      name: 'Treino Livre',
      steps: [{ id: crypto.randomUUID(), type: 'run', durationSeconds: 86400, targetPace: 20 }],
    };
    setIsFreeTraining(true);
    startWorkout(freePlan);
  };

  const confirmWorkoutMode = (mode: 'treadmill' | 'outdoor') => {
    if (workoutToStart) {
      if (mode === 'outdoor') {
        navigator.geolocation.getCurrentPosition(() => {}, (err) => console.error(err));
      }
      setActivePlan({ plan: workoutToStart.plan, mode, sessionId: `${workoutToStart.plan.id}-${Date.now()}` });
      setWorkoutToStart(null);
    }
  };

  const toggleDarkMode = async () => {
    const isLight = !isLightMode;
    document.documentElement.classList.toggle('light', isLight);
    setIsLightMode(isLight);
    if (user) {
        localStorage.setItem(`correlogo:darkMode:${user.uid}`, String(!isLight));
        try {
            await setDoc(doc(getDb(), 'users', user.uid, 'data', 'settings'), { isDarkMode: !isLight }, { merge: true });
        } catch (e) {
            console.error("Erro ao salvar preferência de tema no Firestore (mantida apenas localmente):", e);
        }
    }
  };

  const togglePlanExpansion = (id: string) => {
    setExpandedPlanId(expandedPlanId === id ? null : id);
  };

  const handleImport = async (newPlans: WorkoutPlan[]) => {
    const updatedPlans = [...plans, ...newPlans];
    updatePlansState(updatedPlans);
  };

  const handleSaveManualPlan = (plan: WorkoutPlan) => {
    const updatedPlans = [...plans, plan];
    updatePlansState(updatedPlans);
    setIsEditing(false);
  };

  const deletePlan = async (id: string) => {
    let updatedPlans: WorkoutPlan[] = [];
    const plansToDelete: WorkoutPlan[] = [];

    if (id === 'ALL') {
        updatedPlans = [];
        plansToDelete.push(...plans);
    } else {
        updatedPlans = plans.filter(p => p.id !== id);
        const plan = plans.find(p => p.id === id);
        if (plan) plansToDelete.push(plan);
    }
    
    updatePlansState(updatedPlans);
    setPlanToDelete(null);

    // Delete associated sessions
    if (user && plansToDelete.length > 0) {
        try {
            const planIdsToDelete = plansToDelete.map(p => p.id);
            const sessionsToKeep = sessions.filter(s => !planIdsToDelete.includes(s.planId));
            const sessionsToDelete = sessions.filter(s => planIdsToDelete.includes(s.planId));
            
            for (const session of sessionsToDelete) {
                try {
                    await deleteDoc(doc(getDb(), 'users', user.uid, 'sessions', session.id));
                } catch { /* ignore individual delete failures */ }
            }
            
            setSessions(sessionsToKeep);
            localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(sessionsToKeep));
        } catch (e) {
            console.error("Erro ao deletar sessões do Firestore:", e);
        }
    }
  };

  const [planToUncomplete, setPlanToUncomplete] = useState<WorkoutPlan | null>(null);

  const toggleComplete = async (plan: WorkoutPlan) => {
    if (plan.isCompleted) {
        setPlanToUncomplete(plan);
    } else {
        const updatedPlans = plans.map(p => p.id === plan.id ? {...p, isCompleted: true} : p);
        updatePlansState(updatedPlans);
    }
  }

  const uncompletePlan = async (plan: WorkoutPlan) => {
    const updatedPlans = plans.map(p => p.id === plan.id ? {...p, isCompleted: false} : p);
    updatePlansState(updatedPlans);
    
    // Find and delete session
    if (user) {
        try {
            const sessionToDelete = sessions.find(s => s.planId === plan.id);
            if (sessionToDelete) {
                await deleteDoc(doc(getDb(), 'users', user.uid, 'sessions', sessionToDelete.id));
                setSessions(s => {
                  const updated = s.filter(si => si.id !== sessionToDelete.id);
                  localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
                  return updated;
                });
            }
        } catch (e) {
            console.error("Erro ao deletar sessão do Firestore:", e);
        }
    }
    setPlanToUncomplete(null);
  }

  const markAsCompleted = async (
    id: string, 
    sessionStats: { 
        points: ActivityPoint[], 
        distanceKm: number, 
        timeSeconds: number,
        mode: 'treadmill' | 'outdoor'
    }
) => {
    const plan = plans.find(p => p.id === id);
    if (plan) {
        updatePlansState(plans.map(p => p.id === id ? {...p, isCompleted: true} : p));
    }
    
    if (user) {
        const planName = plan?.name || 'Treino Livre';
        const totalDistance = sessionStats.distanceKm;
        const totalSeconds = sessionStats.timeSeconds;
        const avgSpeed = totalSeconds > 0 ? (totalDistance / (totalSeconds / 3600)) : 0;
        const sessionData: Omit<TrainingSession, 'id'> = {
            planId: id,
            planName,
            date: new Date().toISOString(),
            mode: sessionStats.mode,
            totalDurationSeconds: totalSeconds,
            totalDistanceKm: totalDistance,
            avgSpeedKmh: avgSpeed,
            completed: true,
            points: sessionStats.points
        };
        
        try {
            console.log("Salvando sessão no Firestore:", { planId: id, ...sessionStats });
            const docRef = await addDoc(collection(getDb(), 'users', user.uid, 'sessions'), sessionData);
            const newSession: TrainingSession = { id: docRef.id, ...sessionData };
            setSessions(s => {
              const updated = [newSession, ...s];
              localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
              return updated;
            });
            setSelectedSession(newSession);
        } catch (e) {
            console.error("Erro ao salvar sessão no Firestore (mantida apenas localmente):", e);
            const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const newSession: TrainingSession = { id: localId, ...sessionData };
            setSessions(s => {
              const updated = [newSession, ...s];
              localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
              return updated;
            });
            setSelectedSession(newSession);
        }
    }
  }

  const updatePlansState = async (updatedPlans: WorkoutPlan[]) => {
    setPlans(updatedPlans);
    if (user) {
        localStorage.setItem(`correlogo:plans:${user.uid}`, JSON.stringify(updatedPlans));
        try {
            await setDoc(doc(getDb(), 'users', user.uid, 'data', 'plans'), { plans: updatedPlans });
        } catch (e) {
            console.error("Erro ao salvar planos no Firestore:", e);
        }
    }
  }

  const handleLogout = () => {
    signOut(getAuth());
  };

  const calculateTotalDuration = (plan: WorkoutPlan) => {
    return plan.steps.reduce((acc, step) => acc + getStepDurationSeconds(step), 0);
  }

  return (
    <div className="min-h-screen">
      <main className="w-full max-w-xl mx-auto p-4 pt-8">
        {!user ? (
          showSignup ? <Signup /> : <Login onSignupClick={() => setShowSignup(true)} />
        ) : isLoading ? (
          <div className="flex flex-col gap-4 pt-8">
            <div className="h-8 w-48 bg-bg-elevated rounded animate-pulse" />
            <div className="h-40 bg-bg-elevated rounded animate-pulse" />
            <div className="h-40 bg-bg-elevated rounded animate-pulse" />
          </div>
        ) : (
          <>
            {showHistory && (
              <SessionHistory 
                sessions={sessions} 
                onClose={() => setShowHistory(false)} 
                onSelectSession={(s) => {setSelectedSession(s); setShowHistory(false);}} 
              />
            )}
            {selectedSession && (
              <SessionSummary 
                session={selectedSession} 
                plan={plans.find(p => p.id === selectedSession.planId)}
                onClose={() => setSelectedSession(null)} 
                onSuggestAdjustment={(adjustedPlan) => {
                  const updatedPlans = plans.map(p =>
                    p.id === selectedSession?.planId ? adjustedPlan : p
                  );
                  updatePlansState(updatedPlans);
                  setSelectedSession(null);
                }}
              />
            )}
            {!activePlan && (
              <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-text-primary">Corre Logo 🏃</h1>
                <div className='flex gap-2'>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory(true)}
                  aria-label="Histórico de treinos"
                >
                  <BarChart2 size={20} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  aria-label="Sair"
                >
                  <LogOut size={20} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleDarkMode}
                  aria-label={isLightMode ? 'Alternar para modo escuro' : 'Alternar para modo claro'}
                >
                  {isLightMode ? '🌙' : '☀️'}
                </Button>
                </div>
              </div>
            )}
            
            {workoutToStart && (
              <Modal open={!!workoutToStart} onClose={() => setWorkoutToStart(null)} title="Configurar Treino">
                    <div className="space-y-4 mb-8">
                      <div>
                        <label className="block mb-2 text-sm font-semibold text-text-secondary">Modalidade</label>
                        <div className="flex gap-2">
                           <button className={`flex-1 p-3 rounded-lg ${workoutToStart.mode === 'outdoor' ? 'bg-accent text-white' : 'bg-bg-elevated text-text-primary'}`} onClick={() => setWorkoutToStart({...workoutToStart, mode: 'outdoor'})}>Ar Livre</button>
                           <button className={`flex-1 p-3 rounded-lg ${workoutToStart.mode === 'treadmill' ? 'bg-accent text-white' : 'bg-bg-elevated text-text-primary'}`} onClick={() => setWorkoutToStart({...workoutToStart, mode: 'treadmill'})}>Esteira</button>
                        </div>
                      </div>
                      
                      <div className="flex gap-4">
                          <Button variant="secondary" className="flex-1" onClick={() => setWorkoutToStart(null)}>Voltar</Button>
                          <Button className="flex-1" disabled={!workoutToStart.mode} onClick={() => confirmWorkoutMode(workoutToStart.mode as 'treadmill' | 'outdoor')}>
                            Iniciar
                          </Button>
                      </div>
                    </div>
                </Modal>
            )}
            
            {activePlan ? (
                <WorkoutTracker 
                  key={activePlan.sessionId} 
                  plan={activePlan.plan} 
                  mode={activePlan.mode} 
                  onStop={() => { setActivePlan(null); setIsFreeTraining(false); }} 
                  markAsCompleted={markAsCompleted}
                  totalWorkoutTime={calculateTotalDuration(activePlan.plan)}
                  isFreeTraining={isFreeTraining}
                />
            ) : isEditing ? (
              <WorkoutEditor onSave={handleSaveManualPlan} onCancel={() => setIsEditing(false)} />
            ) : showGenerator ? (
              <TrainingGenerator onGenerate={(program) => {
                setProgramToReview(program);
                setShowGenerator(false);
              }} onCancel={() => setShowGenerator(false)} />
            ) : programToReview ? (
              <ProgramReview
                program={programToReview}
                onConfirm={(finalProgram) => {
                  const allPlans = finalProgram.weeks.flatMap(week => week.plans);
                  updatePlansState([...plans, ...allPlans]);
                  setProgramToReview(null);
                }}
                onCancel={() => setProgramToReview(null)}
              />
            ) : (
              <div className="bg-bg-surface border border-border p-8 rounded-2xl shadow-sm">
                <ImportPlan onImport={handleImport} plans={plans} />
                <Button className="w-full mt-4" onClick={() => setIsEditing(true)}>
                  Novo Treino Manual
                </Button>
                <Button className="w-full mt-4" onClick={() => setShowGenerator(true)}>
                  Gerador Automático
                </Button>
                {plans.length > 0 && (
                  <Button
                    variant="ghost"
                    className="w-full mt-2 border border-border"
                    onClick={() => {
                      const json = JSON.stringify(plans, null, 2);
                      const blob = new Blob([json], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `plano_${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Exportar plano atual (JSON)
                  </Button>
                )}
                {plans.length > 0 && (
                    <Button
                        variant="ghost"
                        className="w-full mt-4 border border-accent text-accent"
                        onClick={() => setPlanToDelete({ id: 'ALL', name: 'TODOS os planos' } as WorkoutPlan)}
                    >
                        Apagar Plano de Treino
                    </Button>
                )}
                <Button className="w-full mt-4" size="lg" onClick={startFreeTraining}>
                    Treino Livre
                </Button>
                <div className="space-y-4 pt-4">
                  {plans.length === 0 ? (
                    <div className="text-center text-text-muted py-8">
                      <Clipboard className="mx-auto mb-2" size={32} />
                      <p>Nenhum plano carregado ainda.</p>
                      <p className="text-sm mt-1">Use o gerador acima para criar seu primeiro plano!</p>
                    </div>
                  ) : (
                    plans.map((plan, index) => (
                       <div key={`${plan.id}-${index}`} className={`border border-border rounded-lg overflow-hidden ${plan.isCompleted ? 'opacity-70' : ''}`}>
                        <div
                          className="flex justify-between items-center p-4 cursor-pointer hover:bg-bg-elevated"
                          onClick={() => togglePlanExpansion(plan.id)}
                        >
                          <div className='flex gap-2 items-center'>
                            <button onClick={(e) => { e.stopPropagation(); toggleComplete(plan); }} className="p-2" aria-label={plan.isCompleted ? 'Marcar como não realizado' : 'Marcar como realizado'}>
                                {plan.isCompleted ? <CheckCircle className='text-accent-secondary' /> : <Circle className='text-text-muted' />}
                                <span className="sr-only">{plan.isCompleted ? 'Concluído' : 'Pendente'}</span>
                            </button>
                            <span className="font-medium text-text-primary truncate">{plan.activityName || plan.name || 'Plano sem nome'}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center px-4 pb-4 bg-bg-surface">
                            <span className="text-xs text-text-secondary">{formatTotalDuration(calculateTotalDuration(plan))}</span>
                            <div className='flex gap-2 items-center'>
                                {plan.manual && (
                                <button 
                                    className="p-2 text-text-muted hover:text-accent hover:bg-bg-elevated rounded-full"
                                    onClick={(e) => { e.stopPropagation(); setPlanToDelete(plan); }}
                                    aria-label="Apagar atividade"
                                >
                                    <Trash2 size={20} />
                                </button>
                                )}
                                <button 
                                    className={`p-2 text-accent-secondary hover:bg-bg-elevated rounded-full ${!sessions.some(s => s.planId === plan.id) ? 'opacity-30 cursor-not-allowed' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); setSelectedSession(sessions.find(s => s.planId === plan.id) || null); }}
                                    disabled={!sessions.some(s => s.planId === plan.id)}
                                    aria-label="Histórico desta atividade"
                                >
                                    <BarChart2 size={20} />
                                </button>
                                <button 
                                    className={`p-2 text-accent hover:bg-bg-elevated rounded-full ${plan.isCompleted ? 'cursor-not-allowed opacity-30' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); if (!plan.isCompleted) startWorkout(plan); }}
                                    disabled={plan.isCompleted}
                                    aria-label={plan.isCompleted ? 'Atividade já concluída' : 'Iniciar atividade'}
                                >
                                    <Play size={20} />
                                </button>
                            </div>
                        </div>
                        <div className={`overflow-hidden transition-all duration-300 ${expandedPlanId === plan.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                          <div className="p-4 border-t border-border text-text-secondary text-sm">
                            <h4 className="font-semibold mb-2">Passos:</h4>
                            <ul className="space-y-1">
                              {plan.steps.map((step, idx) => {
                                const ptType = step.type === 'warmup' ? 'Aquecimento' : step.type === 'run' ? 'Corrida' : step.type === 'cooldown' ? 'Desaquecimento' : step.type === 'rest' ? 'Descanso' : step.type;
                                return (
                                  <li key={idx}>{ptType}: {formatDuration(step.durationSeconds)}min{step.targetPace ? ` @ ${(60/step.targetPace).toFixed(1)} KM/h (Ritmo ${Math.floor(step.targetPace)}'${Math.round((step.targetPace % 1) * 60)}"/km)` : ''}</li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            {planToUncomplete && (
              <Modal open={!!planToUncomplete} onClose={() => setPlanToUncomplete(null)} title="Confirmar" role="alertdialog">
                    <p className="mb-8 text-center text-text-secondary">
                        Tem certeza que deseja marcar a atividade como não realizada?<br />
                        Seu relatório de progresso dessa atividade será apagado.
                    </p>
                    <div className="flex flex-col gap-4">
                        <Button size="lg" onClick={() => uncompletePlan(planToUncomplete)}>
                            MARCAR COMO NÃO REALIZADA
                        </Button>
                        <Button variant="secondary" size="lg" onClick={() => setPlanToUncomplete(null)}>
                            CANCELAR
                        </Button>
                    </div>
                </Modal>
            )}
            {planToDelete && (
              <Modal open={!!planToDelete} onClose={() => setPlanToDelete(null)} title="Confirmar Exclusão" role="alertdialog">
                    <p className="mb-8 text-center text-text-secondary">
                        Deseja realmente apagar o plano "{planToDelete.name}"?
                    </p>
                    <div className="flex flex-col gap-4">
                        <Button size="lg" onClick={() => deletePlan(planToDelete.id)}>
                            SIM, APAGAR
                        </Button>
                        <Button variant="secondary" size="lg" onClick={() => setPlanToDelete(null)}>
                            CANCELAR
                        </Button>
                    </div>
                </Modal>
            )}
          </>
        )}
      </main>
    </div>
  );
}
