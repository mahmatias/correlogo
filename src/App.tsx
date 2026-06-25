/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Play, LogOut, RefreshCw, CheckCircle, Circle, Trash2, BarChart2 } from 'lucide-react';
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
import { getAuth, getDb } from './lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection, query, getDocs, orderBy, deleteDoc } from 'firebase/firestore';

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

  const applyThemeClass = (light?: boolean) => {
    const isLight = light ?? !window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('light', isLight);
    setIsLightMode(isLight);
  };

  useEffect(() => {
    onAuthStateChanged(getAuth(), async (user) => {
      setUser(user);
      if (user) {
        // Local cache (localStorage) é aplicado primeiro para resposta instantânea
        // e como rede de segurança caso a leitura do Firestore falhe.
        const localPlansKey = `correlogo:plans:${user.uid}`;
        const localThemeKey = `correlogo:darkMode:${user.uid}`;

        const cachedPlans = localStorage.getItem(localPlansKey);
        if (cachedPlans) {
          try { setPlans(JSON.parse(cachedPlans)); } catch { /* ignore corrupt cache */ }
        }
        const cachedTheme = localStorage.getItem(localThemeKey);
        if (cachedTheme !== null) {
          applyThemeClass(cachedTheme === 'false');
        } else {
          applyThemeClass();
        }

        // Load plans & settings from Firestore (fonte de verdade, sobrescreve o cache local se disponível)
        try {
          const plansDoc = await getDoc(doc(getDb(), 'users', user.uid, 'data', 'plans'));
          if (plansDoc.exists()) {
            const remotePlans = plansDoc.data().plans ?? [];
            setPlans(remotePlans);
            localStorage.setItem(localPlansKey, JSON.stringify(remotePlans));
          }
          
          // Load sessions
          const q = query(collection(getDb(), 'users', user.uid, 'sessions'), orderBy('date', 'desc'));
          const qs = await getDocs(q);
          setSessions(qs.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingSession)));
        } catch (e) {
          console.error("Erro ao carregar dados do Firestore.", e);
        }

        try {
          const settingsDoc = await getDoc(doc(getDb(), 'users', user.uid, 'data', 'settings'));
          if (settingsDoc.exists() && typeof settingsDoc.data().isDarkMode === 'boolean') {
            const remoteDarkMode = settingsDoc.data().isDarkMode;
            applyThemeClass(!remoteDarkMode);
            localStorage.setItem(localThemeKey, String(remoteDarkMode));
          }
        } catch (e) {
          console.error("Erro ao carregar preferência de tema do Firestore. Usando cache local ou padrão do sistema.", e);
        }

        setInitialized(true);
      } else {
        setPlans([]);
        // Sem usuário logado: aplica preferência de tema do sistema diretamente.
        applyThemeClass();
        setInitialized(true);
      }
    });
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
                await deleteDoc(doc(getDb(), 'users', user.uid, 'sessions', session.id));
            }
            
            setSessions(sessionsToKeep);
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
                setSessions(s => s.filter(si => si.id !== sessionToDelete.id));
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
        
        try {
            console.log("Salvando sessão no Firestore:", { planId: id, ...sessionStats });
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
            
            const docRef = await addDoc(collection(getDb(), 'users', user.uid, 'sessions'), sessionData);
            const newSession: TrainingSession = { id: docRef.id, ...sessionData };
            setSessions(s => [newSession, ...s]);
            setSelectedSession(newSession);
        } catch (e) {
            console.error("Erro ao salvar sessão no Firestore:", e);
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
      <main className="w-full max-w-lg mx-auto p-4 pt-8">
        {!user ? (
          showSignup ? <Signup /> : <Login onSignupClick={() => setShowSignup(true)} />
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
                <button 
                  onClick={() => setShowHistory(true)}
                  className="p-2 rounded-full bg-bg-elevated text-accent-secondary"
                  aria-label="Histórico de treinos"
                >
                  <BarChart2 size={20} />
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2 rounded-full bg-bg-elevated text-accent"
                  aria-label="Sair"
                >
                  <LogOut size={20} />
                </button>
                <button 
                  onClick={toggleDarkMode}
                  className="p-2 rounded-full bg-bg-elevated text-accent-secondary"
                  aria-label={isLightMode ? 'Alternar para modo escuro' : 'Alternar para modo claro'}
                >
                  {isLightMode ? '🌙' : '☀️'}
                </button>
                </div>
              </div>
            )}
            
            {workoutToStart && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-label="Configurar treino">
                <div className="p-6 rounded-2xl shadow-xl w-full max-w-sm bg-bg-surface border border-border">
                    <h2 className="text-xl font-bold mb-6 text-text-primary">Configurar Treino</h2>
                    
                    <div className="space-y-4 mb-8">
                      <div>
                        <label className="block mb-2 text-sm font-semibold text-text-secondary">Modalidade</label>
                        <div className="flex gap-2">
                           <button className={`flex-1 p-3 rounded-lg ${workoutToStart.mode === 'outdoor' ? 'bg-accent text-white' : 'bg-bg-elevated text-text-primary'}`} onClick={() => setWorkoutToStart({...workoutToStart, mode: 'outdoor'})}>Ar Livre</button>
                           <button className={`flex-1 p-3 rounded-lg ${workoutToStart.mode === 'treadmill' ? 'bg-accent text-white' : 'bg-bg-elevated text-text-primary'}`} onClick={() => setWorkoutToStart({...workoutToStart, mode: 'treadmill'})}>Esteira</button>
                        </div>
                      </div>
                      
                      <div className="flex gap-4">
                          <button className="flex-1 p-3 rounded-lg bg-bg-elevated text-text-primary" onClick={() => setWorkoutToStart(null)}>Voltar</button>
                          <button 
                            className="flex-1 bg-accent text-white p-3 rounded-lg disabled:opacity-50" 
                            disabled={!workoutToStart.mode}
                            onClick={() => confirmWorkoutMode(workoutToStart.mode as 'treadmill' | 'outdoor')}
                          >
                            Iniciar
                          </button>
                      </div>
                    </div>
                </div>
              </div>
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
                <button 
                  className="w-full mt-4 p-2 bg-accent text-white rounded-lg hover:opacity-90 transition-colors"
                  onClick={() => setIsEditing(true)}
                >
                  Novo Treino Manual
                </button>
                <button 
                  className="w-full mt-4 p-2 bg-accent text-white rounded-lg hover:opacity-90 transition-colors"
                  onClick={() => setShowGenerator(true)}
                >
                  Gerador Automático
                </button>
                {plans.length > 0 && (
                  <button
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
                    className="w-full mt-2 p-2 border border-border text-text-muted rounded-lg text-sm"
                  >
                    Exportar plano atual (JSON)
                  </button>
                )}
                {plans.length > 0 && (
                    <button 
                        className="w-full mt-4 p-2 text-accent border border-accent rounded-lg hover:bg-accent hover:text-white transition-colors"
                        onClick={() => setPlanToDelete({ id: 'ALL', name: 'TODOS os planos' } as WorkoutPlan)}
                    >
                        Apagar Plano de Treino
                    </button>
                )}
                <button
                    className="w-full mt-4 p-3 bg-accent text-white rounded-lg font-semibold"
                    onClick={startFreeTraining}
                >
                    Treino Livre
                </button>
                <div className="space-y-4 pt-4">
                  {plans.length === 0 ? (
                    <p className="text-center text-text-muted">Nenhum plano carregado ainda.</p>
                  ) : (
                    plans.map((plan, index) => (
                      <div key={`${plan.id}-${index}`} className={`border border-border rounded-lg overflow-hidden ${plan.isCompleted ? 'opacity-50' : ''}`}>
                        <div
                          className="flex justify-between items-center p-4 cursor-pointer hover:bg-bg-elevated"
                          onClick={() => togglePlanExpansion(plan.id)}
                        >
                          <div className='flex gap-2 items-center'>
                            <button onClick={(e) => { e.stopPropagation(); toggleComplete(plan); }} aria-label={plan.isCompleted ? 'Marcar como não realizado' : 'Marcar como realizado'}>
                                {plan.isCompleted ? <CheckCircle className='text-accent-secondary' /> : <Circle className='text-text-muted' />}
                                <span className="sr-only">{plan.isCompleted ? 'Concluído' : 'Pendente'}</span>
                            </button>
                            <span className="font-medium text-text-primary">{plan.activityName || plan.name || 'Plano sem nome'}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center px-4 pb-4 bg-bg-surface">
                            <span className="text-xs text-text-muted">{formatTotalDuration(calculateTotalDuration(plan))}</span>
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
                        {expandedPlanId === plan.id && (
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
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            {planToUncomplete && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black bg-opacity-70" role="alertdialog" aria-modal="true" aria-label="Confirmar desmarcar atividade">
                <div className="p-8 rounded-3xl shadow-2xl w-full max-w-sm bg-bg-surface border border-border">
                    <h2 className="text-xl font-bold mb-4 text-center text-text-primary">Confirmar</h2>
                    <p className="mb-8 text-center text-text-secondary">
                        Tem certeza que deseja marcar a atividade como não realizada?<br />
                        Seu relatório de progresso dessa atividade será apagado.
                    </p>
                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={() => uncompletePlan(planToUncomplete)} 
                            className="w-full bg-accent hover:opacity-90 text-white p-4 rounded-xl font-bold transition-colors"
                        >
                            MARCAR COMO NÃO REALIZADA
                        </button>
                        <button 
                            onClick={() => setPlanToUncomplete(null)} 
                            className="w-full bg-bg-elevated text-text-primary p-4 rounded-xl font-bold"
                        >
                            CANCELAR
                        </button>
                    </div>
                </div>
              </div>
            )}
            {planToDelete && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black bg-opacity-70" role="alertdialog" aria-modal="true" aria-label="Confirmar exclusão">
                <div className="p-8 rounded-3xl shadow-2xl w-full max-w-sm bg-bg-surface border border-border">
                    <h2 className="text-xl font-bold mb-4 text-center text-text-primary">Confirmar Exclusão</h2>
                    <p className="mb-8 text-center text-text-secondary">
                        Deseja realmente apagar o plano "{planToDelete.name}"?
                    </p>
                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={() => deletePlan(planToDelete.id)} 
                            className="w-full bg-accent hover:opacity-90 text-white p-4 rounded-xl font-bold transition-colors"
                        >
                            SIM, APAGAR
                        </button>
                        <button 
                            onClick={() => setPlanToDelete(null)} 
                            className="w-full bg-bg-elevated text-text-primary p-4 rounded-xl font-bold"
                        >
                            CANCELAR
                        </button>
                    </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
