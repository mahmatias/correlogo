/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Play, LogOut, RefreshCw, CheckCircle, Circle, Trash2, BarChart2 } from 'lucide-react';
import { WorkoutPlan, formatDuration, formatTotalDuration, TrainingSession } from './types';
import WorkoutTracker from './components/WorkoutTracker';
import ImportPlan from './components/ImportPlan';
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
  const [activePlan, setActivePlan] = useState<{plan: WorkoutPlan, mode: 'treadmill' | 'outdoor', trainingType: 'time' | 'distance', sessionId: string} | null>(null);
  const [workoutToStart, setWorkoutToStart] = useState<{plan: WorkoutPlan, mode?: 'treadmill' | 'outdoor', type?: 'time' | 'distance'} | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [planToDelete, setPlanToDelete] = useState<WorkoutPlan | null>(null);
  const [showHistory, setShowHistory] = useState(false);

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
          setIsDarkMode(cachedTheme === 'true');
        } else {
          setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
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
            setIsDarkMode(remoteDarkMode);
            localStorage.setItem(localThemeKey, String(remoteDarkMode));
          }
        } catch (e) {
          console.error("Erro ao carregar preferência de tema do Firestore. Usando cache local ou padrão do sistema.", e);
        }

        setInitialized(true);
      } else {
        setPlans([]);
        // Sem usuário logado: aplica preferência de tema do sistema diretamente.
        setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
        setInitialized(true);
      }
    });
  }, []);

  const startWorkout = (plan: WorkoutPlan) => {
    setWorkoutToStart({ plan });
  };

  const confirmWorkoutMode = (mode: 'treadmill' | 'outdoor', trainingType: 'time' | 'distance') => {
    if (workoutToStart) {
      if (mode === 'outdoor') {
        navigator.geolocation.getCurrentPosition(() => {}, (err) => console.error(err));
      }
      setActivePlan({ plan: workoutToStart.plan, mode, trainingType, sessionId: `${workoutToStart.plan.id}-${Date.now()}` });
      setWorkoutToStart(null);
    }
  };

  const toggleDarkMode = async () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    if (user) {
        localStorage.setItem(`correlogo:darkMode:${user.uid}`, String(newDarkMode));
        try {
            await setDoc(doc(getDb(), 'users', user.uid, 'data', 'settings'), { isDarkMode: newDarkMode }, { merge: true });
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
        mode: 'treadmill' | 'outdoor',
        trainingType: 'time' | 'distance'
    }
) => {
    const plan = plans.find(p => p.id === id);
    const updatedPlans = plans.map(p => p.id === id ? {...p, isCompleted: true} : p);
    updatePlansState(updatedPlans);
    
    if (user && plan) {
        const totalDistance = sessionStats.distanceKm;
        const totalSeconds = sessionStats.timeSeconds;
        const avgSpeed = totalSeconds > 0 ? (totalDistance / (totalSeconds / 3600)) : 0;
        
        try {
            console.log("Salvando sessão no Firestore:", { planId: id, ...sessionStats });
            const sessionData: Omit<TrainingSession, 'id'> = {
                planId: id,
                planName: plan.name,
                date: new Date().toISOString(),
                mode: sessionStats.mode,
                trainingType: sessionStats.trainingType,
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
    return plan.steps.reduce((acc, step) => acc + step.durationSeconds, 0);
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-bg-deep' : 'bg-agate-cream'}`}>
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
                isDarkMode={isDarkMode} 
              />
            )}
            {selectedSession && (
              <SessionSummary session={selectedSession} onClose={() => setSelectedSession(null)} isDarkMode={isDarkMode} />
            )}
            {!activePlan && (
              <div className="flex justify-between items-center mb-8">
                <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-text-primary' : 'text-obsidian'}`}>Corre Logo 🏃</h1>
                <div className='flex gap-2'>
                <button 
                  onClick={() => setShowHistory(true)}
                  className={`p-2 rounded-full ${isDarkMode ? 'bg-bg-mantle text-citrine' : 'bg-agate-band text-obsidian'}`}
                >
                  <BarChart2 size={20} />
                </button>
                <button 
                  onClick={handleLogout}
                  className={`p-2 rounded-full ${isDarkMode ? 'bg-bg-mantle text-jasper-red' : 'bg-agate-band text-jasper-red'}`}
                >
                  <LogOut size={20} />
                </button>
                <button 
                  onClick={toggleDarkMode}
                  className={`p-2 rounded-full ${isDarkMode ? 'bg-bg-mantle text-citrine' : 'bg-agate-band text-obsidian'}`}
                >
                  {isDarkMode ? '☀️' : '🌙'}
                </button>
                </div>
              </div>
            )}
            
            {workoutToStart && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className={`p-6 rounded-2xl shadow-xl w-full max-w-sm ${isDarkMode ? 'bg-bg-bedrock border border-bg-shale' : 'bg-selenite'}`}>
                    <h2 className={`text-xl font-bold mb-6 ${isDarkMode ? 'text-text-primary' : 'text-obsidian'}`}>Configurar Treino</h2>
                    
                    <div className="space-y-4 mb-8">
                      <div>
                        <label className={`block mb-2 text-sm font-semibold ${isDarkMode ? 'text-text-secondary' : 'text-text-muted'}`}>Modalidade</label>
                        <div className="flex gap-2">
                           <button className={`flex-1 p-3 rounded-lg ${workoutToStart.mode === 'outdoor' ? (isDarkMode ? 'bg-labradorite text-agate-cream' : 'bg-tourmaline text-selenite') : (isDarkMode ? 'bg-bg-mantle' : 'bg-agate-band')}`} onClick={() => setWorkoutToStart({...workoutToStart, mode: 'outdoor'})}>Ar Livre</button>
                           <button className={`flex-1 p-3 rounded-lg ${workoutToStart.mode === 'treadmill' ? (isDarkMode ? 'bg-labradorite text-agate-cream' : 'bg-tourmaline text-selenite') : (isDarkMode ? 'bg-bg-mantle' : 'bg-agate-band')}`} onClick={() => setWorkoutToStart({...workoutToStart, mode: 'treadmill'})}>Esteira</button>
                        </div>
                      </div>
                      
                      <div>
                        <label className={`block mb-2 text-sm font-semibold ${isDarkMode ? 'text-text-secondary' : 'text-text-muted'}`}>Tipo de Treino</label>
                        <div className="flex gap-2">
                           <button className={`flex-1 p-3 rounded-lg ${workoutToStart.type === 'time' ? (isDarkMode ? 'bg-labradorite text-agate-cream' : 'bg-tourmaline text-selenite') : (isDarkMode ? 'bg-bg-mantle' : 'bg-agate-band')}`} onClick={() => setWorkoutToStart({...workoutToStart, type: 'time'})}>Tempo</button>
                           <button className={`flex-1 p-3 rounded-lg ${workoutToStart.type === 'distance' ? (isDarkMode ? 'bg-labradorite text-agate-cream' : 'bg-tourmaline text-selenite') : (isDarkMode ? 'bg-bg-mantle' : 'bg-agate-band')}`} onClick={() => setWorkoutToStart({...workoutToStart, type: 'distance'})}>Distância</button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                        <button className={`flex-1 p-3 rounded-lg ${isDarkMode ? 'bg-bg-shale text-text-primary' : 'bg-agate-band text-obsidian'}`} onClick={() => setWorkoutToStart(null)}>Voltar</button>
                        <button 
                          className="flex-1 bg-amethyst text-selenite p-3 rounded-lg disabled:opacity-50" 
                          disabled={!workoutToStart.mode || !workoutToStart.type}
                          onClick={() => confirmWorkoutMode(workoutToStart.mode!, workoutToStart.type!)}
                        >
                          Iniciar
                        </button>
                    </div>
                </div>
              </div>
            )}
            {activePlan ? (
                <WorkoutTracker 
                  key={activePlan.sessionId} 
                  plan={activePlan.plan} 
                  mode={activePlan.mode} 
                  onStop={() => setActivePlan(null)} 
                  isDarkMode={isDarkMode} 
                  markAsCompleted={markAsCompleted}
                  trainingType={activePlan.trainingType}
                  totalWorkoutTime={calculateTotalDuration(activePlan.plan)}
                />
            ) : (
              <div className={`${isDarkMode ? 'bg-bg-bedrock border-bg-shale' : 'bg-selenite border-agate-band'} p-8 rounded-2xl shadow-sm border`}>
                <ImportPlan onImport={handleImport} plans={plans} />
                {plans.length > 0 && (
                    <button 
                        className="w-full p-2 text-jasper-red border border-jasper-red rounded-lg hover:bg-jasper-red hover:text-selenite transition-colors"
                        onClick={() => setPlanToDelete({ id: 'ALL', name: 'TODOS os planos' } as WorkoutPlan)}
                    >
                        Apagar Plano de Treino
                    </button>
                )}
                <div className="space-y-4 pt-4">
                  {plans.length === 0 ? (
                    <p className={`text-center ${isDarkMode ? 'text-text-muted' : 'text-text-muted'}`}>Nenhum plano carregado ainda.</p>
                  ) : (
                    plans.map((plan, index) => (
                      <div key={`${plan.id}-${index}`} className={`${isDarkMode ? 'border-bg-shale' : 'border-agate-band'} border rounded-lg overflow-hidden ${plan.isCompleted ? 'opacity-50' : ''}`}>
                        <div
                          className={`flex justify-between items-center p-4 cursor-pointer ${isDarkMode ? 'hover:bg-bg-mantle' : 'hover:bg-agate-cream'}`}
                          onClick={() => togglePlanExpansion(plan.id)}
                        >
                          <div className='flex gap-2 items-center'>
                            <button onClick={(e) => { e.stopPropagation(); toggleComplete(plan); }}>
                                {plan.isCompleted ? <CheckCircle className='text-tourmaline' /> : <Circle className={isDarkMode ? 'text-text-muted' : 'text-agate-band'} />}
                            </button>
                            <span className={`font-medium ${isDarkMode ? 'text-agate-cream' : 'text-obsidian'}`}>{plan.activityName || plan.name || 'Plano sem nome'}</span>
                          </div>
                        </div>
                        <div className={`flex justify-between items-center px-4 pb-4 ${isDarkMode ? 'bg-bg-bedrock' : 'bg-selenite'}`}>
                            <span className={`text-xs ${isDarkMode ? 'text-text-muted' : 'text-agate-band'}`}>{formatTotalDuration(calculateTotalDuration(plan))}</span>
                            <div className='flex gap-2 items-center'>
                                <button 
                                    className={`p-2 text-tourmaline hover:bg-obsidian-light rounded-full ${!sessions.some(s => s.planId === plan.id) ? 'opacity-30 cursor-not-allowed' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); setSelectedSession(sessions.find(s => s.planId === plan.id) || null); }}
                                    disabled={!sessions.some(s => s.planId === plan.id)}
                                >
                                    <BarChart2 size={20} />
                                </button>
                                <button 
                                    className={`p-2 text-amethyst hover:bg-obsidian-light rounded-full ${plan.isCompleted ? 'cursor-not-allowed opacity-30' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); if (!plan.isCompleted) startWorkout(plan); }}
                                    disabled={plan.isCompleted}
                                >
                                    <Play size={20} />
                                </button>
                            </div>
                        </div>
                        {expandedPlanId === plan.id && (
                          <div className={`p-4 border-t ${isDarkMode ? 'border-bg-shale text-text-secondary' : 'border-agate-band text-text-muted'} text-sm`}>
                            <h4 className="font-semibold mb-2">Passos:</h4>
                            <ul className="space-y-1">
                              {plan.steps.map((step, idx) => {
                                const ptType = step.type === 'warmup' ? 'Aquecimento' : step.type === 'run' ? 'Corrida' : step.type === 'cooldown' ? 'Desaquecimento' : step.type === 'rest' ? 'Descanso' : step.type;
                                return (
                                  <li key={idx}>{ptType}: {formatDuration(step.durationSeconds)}min @ { (60/(step.targetPace||1)).toFixed(2) } KM/h (Ritmo {step.targetPace||0}")</li>
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
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black bg-opacity-70">
                <div className={`p-8 rounded-3xl shadow-2xl w-full max-w-sm ${isDarkMode ? 'bg-bg-bedrock border border-bg-shale' : 'bg-selenite'}`}>
                    <h2 className={`text-xl font-bold mb-4 text-center ${isDarkMode ? 'text-text-primary' : 'text-obsidian'}`}>Confirmar</h2>
                    <p className={`mb-8 text-center ${isDarkMode ? 'text-text-secondary' : 'text-text-muted'}`}>
                        Tem certeza que deseja marcar a atividade como não realizada?<br />
                        Seu relatório de progresso dessa atividade será apagado.
                    </p>
                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={() => uncompletePlan(planToUncomplete)} 
                            className="w-full bg-jasper-red hover:bg-malachite active:bg-jasper-red text-selenite p-4 rounded-xl font-bold transition-colors"
                        >
                            MARCAR COMO NÃO REALIZADA
                        </button>
                        <button 
                            onClick={() => setPlanToUncomplete(null)} 
                            className={`w-full ${isDarkMode ? 'bg-bg-shale' : 'bg-agate-band'} p-4 rounded-xl font-bold`}
                        >
                            CANCELAR
                        </button>
                    </div>
                </div>
              </div>
            )}
            {planToDelete && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black bg-opacity-70">
                <div className={`p-8 rounded-3xl shadow-2xl w-full max-w-sm ${isDarkMode ? 'bg-bg-bedrock border border-bg-shale' : 'bg-selenite'}`}>
                    <h2 className={`text-xl font-bold mb-4 text-center ${isDarkMode ? 'text-text-primary' : 'text-obsidian'}`}>Confirmar Exclusão</h2>
                    <p className={`mb-8 text-center ${isDarkMode ? 'text-text-secondary' : 'text-text-muted'}`}>
                        Deseja realmente apagar o plano "{planToDelete.name}"?
                    </p>
                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={() => deletePlan(planToDelete.id)} 
                            className="w-full bg-jasper-red hover:bg-malachite active:bg-jasper-red text-selenite p-4 rounded-xl font-bold transition-colors"
                        >
                            SIM, APAGAR
                        </button>
                        <button 
                            onClick={() => setPlanToDelete(null)} 
                            className={`w-full ${isDarkMode ? 'bg-bg-shale' : 'bg-agate-band'} p-4 rounded-xl font-bold`}
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
