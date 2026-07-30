/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { Play, RefreshCw, CheckCircle, Circle, Trash2, BarChart2, Clipboard, ChevronUp, ChevronDown, Rocket, Calendar as CalendarIcon, Calendar, Bluetooth, BluetoothSearching, BluetoothConnected, X, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { WorkoutPlan, formatDuration, formatTotalDuration, TrainingSession, getStepDurationSeconds, ActivityPoint, TrainingProgram, ProfileData, SettingsData } from './types';
import WorkoutTracker from './components/WorkoutTracker';
import ImportPlan from './components/ImportPlan';
import WorkoutEditor from './components/WorkoutEditor';
import TrainingGenerator from './components/TrainingGenerator';
import ProgramReview from './components/ProgramReview';
import SessionHistory from './components/SessionHistory';
import Signup from './components/Signup';
import Login from './components/Login';
import Modal from './components/Modal';
import Button from './components/Button';
import UserProfile from './components/UserProfile';
import WeekCalendar from './components/WeekCalendar';
import MonthCalendar from './components/MonthCalendar';
import BottomSheet from './components/BottomSheet';
import GoogleCalendarModal from './components/GoogleCalendarModal';
import { useTreadmill, type TreadmillConnection } from './lib/use-treadmill';
import { getAuth, getDb } from './lib/firebase';
import { downloadIcal } from './lib/ical';
import { keepAwake, allowSleep } from './lib/capacitor/wakeLock';
import { requestAllPermissions } from './lib/capacitor/permissions';
import { Tracking } from './lib/capacitor/tracking';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { exportWorkoutToHealthConnect } from './lib/capacitor/health-connect';
import type { WorkoutExport, SyncStatus } from './lib/capacitor/health-connect';
import { sendWorkoutToStravaViaEmail, handleGmailWebCallback } from './lib/gmailApi';
import { checkForUpdate, downloadApkAndInstall } from './lib/update-checker';
import type { UpdateInfo } from './lib/update-checker';
import UpdatePrompt from './components/UpdatePrompt';
import { onAuthStateChanged, User, signOut, getRedirectResult } from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection, query, getDocs, orderBy, limit, deleteDoc, writeBatch } from 'firebase/firestore';

function stripUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined) as unknown as T;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) clean[k] = stripUndefined(v);
  }
  return clean as T;
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDateBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const SessionSummary = lazy(() => import('./components/SessionSummary'));

console.log('[CorreLogo-JS] App.tsx carregado - módulo avaliado');

export default function App() {
  console.log('[CorreLogo-JS] App componente renderizado');
  const [user, setUser] = useState<User | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const latestSessionIdRef = useRef<string | null>(null);
  const pendingHcSyncRef = useRef<SyncStatus | null>(null);
  const pendingGmailSyncRef = useRef<SyncStatus | null>(null);
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [activePlan, setActivePlan] = useState<{plan: WorkoutPlan, mode: 'treadmill' | 'outdoor', sessionId: string, simulateGps?: boolean} | null>(null);
  const [isFreeTraining, setIsFreeTraining] = useState(false);
  const [workoutToStart, setWorkoutToStart] = useState<{plan: WorkoutPlan, mode?: 'treadmill' | 'outdoor', simulateGps?: boolean, simulateBle?: boolean} | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const treadmill = useTreadmill();
  const [isEditing, setIsEditing] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [programToReview, setProgramToReview] = useState<TrainingProgram | null>(null);
  const [planToDelete, setPlanToDelete] = useState<WorkoutPlan | null>(null);
  const [reschedulePlanId, setReschedulePlanId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showMonthCalendar, setShowMonthCalendar] = useState(false);
  const [showGoogleCalendarModal, setShowGoogleCalendarModal] = useState(false);
  const [pendingOAuthToken, setPendingOAuthToken] = useState<string | null>(null);
  const [showBackgroundPrompt, setShowBackgroundPrompt] = useState(false);
  const [appCameFromSettings, setAppCameFromSettings] = useState(false);
const [backActionStack, setBackActionStack] = useState<(() => void)[]>([]);
  const [planToUncomplete, setPlanToUncomplete] = useState<WorkoutPlan | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updating, setUpdating] = useState(false);
  const getWeekStart = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d);
    mon.setDate(diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  };
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()));

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setSaveFeedback({ type, message });
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  // Define a ação do botão back baseada no estado atual
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || activePlan) {
      setBackActionStack([]);
      return;
    }

    const actions: Array<() => void> = [];

    // Ordem de prioridade (último = topo da pilha = executa primeiro)
    if (showGoogleCalendarModal) actions.push(() => setShowGoogleCalendarModal(false));
    if (reschedulePlanId) actions.push(() => setReschedulePlanId(null));
    if (planToDelete) actions.push(() => setPlanToDelete(null));
    if (planToUncomplete) actions.push(() => setPlanToUncomplete(null));
    if (workoutToStart) actions.push(() => setWorkoutToStart(null));
    if (programToReview) actions.push(() => setProgramToReview(null));
    if (showGenerator) actions.push(() => setShowGenerator(false));
    if (showHistory) actions.push(() => setShowHistory(false));
    if (showUserProfile) actions.push(() => setShowUserProfile(false));
    if (showSignup) actions.push(() => setShowSignup(false));
    if (showBackgroundPrompt) actions.push(() => setShowBackgroundPrompt(false));

    setBackActionStack(actions);
  }, [showSignup, showUserProfile, showHistory, showGenerator, programToReview, workoutToStart, planToDelete, reschedulePlanId, planToUncomplete, showGoogleCalendarModal, showBackgroundPrompt, activePlan]);

  const applyThemeClass = (light?: boolean) => {
    const isLight = light ?? !window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('light', isLight);
    setIsLightMode(isLight);
  };

  useEffect(() => {
    const t0 = performance.now();
    const auth = getAuth();
    let redirectDone = false;
    let authStateFired = false;
    let foundUser = false;

    const finalizeAuth = () => {
      if (redirectDone && authStateFired) {
        if (!foundUser) {
          setPlans([]);
          setSessions([]);
          applyThemeClass();
          setInitialized(true);
          setIsLoading(false);
        }
        setCheckingAuth(false);
      }
    };

    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        console.log('[auth] redirect sign-in successful for', result.user.email);
        foundUser = true;
      }
    }).catch((err) => {
      console.warn('[auth] redirect result error:', err?.code || err?.message);
    }).finally(() => {
      redirectDone = true;
      finalizeAuth();
    });

    const unsub = onAuthStateChanged(auth, async (user) => {
      console.log(`[timing] onAuthStateChanged fired at ${(performance.now() - t0).toFixed(0)}ms, user=`, !!user);
      setUser(user);
      authStateFired = true;
      if (user) {
        foundUser = true;
        finalizeAuth();
        const localPlansKey = `correlogo:plans:${user.uid}`;
        const localSessionsKey = `correlogo:sessions:${user.uid}`;
        const localThemeKey = `correlogo:darkMode:${user.uid}`;

        const cachedPlans = localStorage.getItem(localPlansKey);
        if (cachedPlans) {
          try {
            const raw: WorkoutPlan[] = JSON.parse(cachedPlans);
            const migrated = raw.map(p => ({ ...p, scheduledDate: p.scheduledDate || formatDateKey(new Date()) }));
            setPlans(migrated);
          } catch { /* ignore corrupt cache */ }
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
        let localSessionsToSync: TrainingSession[] = [];
        try {
          const firestorePromise = Promise.all([
            getDoc(doc(db, 'users', user.uid, 'data', 'plans')),
            getDocs(query(collection(db, 'users', user.uid, 'sessions'), orderBy('date', 'desc'), limit(50))),
            getDoc(doc(db, 'users', user.uid, 'data', 'settings')),
            getDoc(doc(db, 'users', user.uid, 'data', 'profile')),
          ]);
          // Timeout de 5s — se o Firestore não responder, cai no catch e usa cache local
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout after 5s')), 5000)
          );
          const [plansDoc, qs, settingsDoc, profileDoc] = await Promise.race([firestorePromise, timeout]);
          console.log(`[timing] Firestore reads done at ${(performance.now() - t1).toFixed(0)}ms`);

          if (plansDoc.exists()) {
            const remotePlans = plansDoc.data().plans ?? [];
            const migratedRemote = remotePlans.map((p: WorkoutPlan) => ({ ...p, scheduledDate: p.scheduledDate || formatDateKey(new Date()) }));
            // Merge: preserva planos criados localmente que ainda não estão no Firestore
            const cachedPlansRaw = localStorage.getItem(localPlansKey);
            if (cachedPlansRaw) {
              const localPlans: WorkoutPlan[] = JSON.parse(cachedPlansRaw).map((p: WorkoutPlan) => ({ ...p, scheduledDate: p.scheduledDate || formatDateKey(new Date()) }));
              const merged = [...migratedRemote];
              for (const lp of localPlans) {
                if (!merged.find(rp => rp.id === lp.id)) {
                  merged.push(lp);
                }
              }
              setPlans(merged);
              localStorage.setItem(localPlansKey, JSON.stringify(merged));
              // Salva de volta no Firestore se houve merge
              if (merged.length !== remotePlans.length) {
                setDoc(doc(db, 'users', user.uid, 'data', 'plans'), { plans: stripUndefined(merged) }, { merge: true }).catch(() => {});
              }
            } else {
              setPlans(migratedRemote);
              localStorage.setItem(localPlansKey, JSON.stringify(migratedRemote));
            }
          }

          const remoteSessions = qs.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingSession));
          // Captura sessões locais ANTES de sobrescrever o localStorage
          const beforeRaw = localStorage.getItem(localSessionsKey);
          const before: TrainingSession[] = beforeRaw ? JSON.parse(beforeRaw) : [];
          localSessionsToSync = before.filter(s => s.id.startsWith('local-'));
          setSessions(remoteSessions);
          localStorage.setItem(localSessionsKey, JSON.stringify(remoteSessions));

          if (settingsDoc.exists() && typeof settingsDoc.data().isDarkMode === 'boolean') {
            const remoteDarkMode = settingsDoc.data().isDarkMode;
            applyThemeClass(!remoteDarkMode);
            localStorage.setItem(localThemeKey, String(remoteDarkMode));
          }

          if (settingsDoc.exists()) {
            setSettings({
              isDarkMode: settingsDoc.data().isDarkMode ?? false,
              distanceUnit: (settingsDoc.data() as any).distanceUnit || 'km',
              paceUnit: (settingsDoc.data() as any).paceUnit || 'per_km',
              weightUnit: (settingsDoc.data() as any).weightUnit || 'kg',
            });
          }

          if (profileDoc.exists()) {
            setProfile(profileDoc.data() as ProfileData);
            localStorage.setItem(`correlogo:profile:${user.uid}`, JSON.stringify(profileDoc.data()));
          }

          // Sync Google profile photo to Firestore if available and not yet stored
          if (user.photoURL && (!profileDoc.exists() || !(profileDoc.data() as any).photoURL)) {
            setDoc(doc(db, 'users', user.uid, 'data', 'profile'), { photoURL: user.photoURL, updatedAt: Date.now() }, { merge: true }).catch(() => {});
          }
        } catch (e) {
          console.warn("Rodando no localStorage — Firestore indisponível.", e);
          const cachedProfile = localStorage.getItem(`correlogo:profile:${user.uid}`);
          if (cachedProfile) {
            try { setProfile(JSON.parse(cachedProfile)); } catch { /* corrupt cache */ }
          }
          const cachedSettings = localStorage.getItem(`correlogo:settings:${user.uid}`);
          if (cachedSettings) {
            try { setSettings(JSON.parse(cachedSettings)); } catch { /* corrupt cache */ }
          }
        } finally {
          // Sync local sessions even if fetch failed (localSessionsToSync stays empty on failure,
          // but localStorage was NOT overwritten — read directly from it)
          const toSync = localSessionsToSync.length > 0
            ? localSessionsToSync
            : JSON.parse(localStorage.getItem(localSessionsKey) || '[]')
                .filter((s: TrainingSession) => s.id.startsWith('local-'));
          for (const sess of toSync) {
            try {
              const { id: _, ...data } = sess;
              const docRef = await addDoc(collection(getDb(), 'users', user.uid, 'sessions'), stripUndefined(data));
              // Re-read current list (may have been overwritten with remote-only data)
              const current: TrainingSession[] = JSON.parse(localStorage.getItem(localSessionsKey) || '[]');
              const updated = current.filter(s => s.id !== sess.id);
              if (!updated.find(s => s.id === docRef.id)) {
                updated.unshift({ ...sess, id: docRef.id });
              }
              localStorage.setItem(localSessionsKey, JSON.stringify(updated));
              setSessions(updated);
            } catch { /* tenta na próxima inicialização */ }
          }
          setIsLoading(false);
          setInitialized(true);
          console.log(`[timing] Total load: ${(performance.now() - t0).toFixed(0)}ms`);
        }
      } else if (redirectDone) {
        setPlans([]);
        setSessions([]);
        applyThemeClass();
        setInitialized(true);
        setIsLoading(false);
        setShowUserProfile(false);
        finalizeAuth();
      }
    });
    return () => { unsub(); };
  }, []);

  // Native auth state listener — with skipNativeAuth:true o native plugin não
  // gerencia auth state diretamente; auth fica por conta do onAuthStateChanged
  // do Firebase JS SDK (que recebe o credential do native sign-in).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const capUnsub = FirebaseAuthentication.addListener('authStateChange', (event) => {
      console.log('[App.tsx] native authStateChange (skipNativeAuth=true):', event.user ? 'evento ignorado (JS SDK gerencia auth)' : 'logout');
    });
    return () => { capUnsub.remove(); };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const info = await CapApp.getInfo();
        const versionCode = parseInt(info.build, 10);
        const update = await checkForUpdate(versionCode);
        if (!cancelled && update) setUpdateInfo(update);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let sub: { remove: () => void } | null = null;
    CapApp.addListener('appUrlOpen', (event: { url: string }) => {
      console.log('[deeplink] appUrlOpen:', event.url);
      try {
        const url = new URL(event.url);
        if (url.protocol === 'com.correlogo.app:' && url.hostname === 'oauth') {
          const token = url.searchParams.get('token');
          const refreshToken = url.searchParams.get('refresh_token');
          const error = url.searchParams.get('error');
          const state = url.searchParams.get('state');
          if (state && (state.startsWith('gm_web_') || state.startsWith('gm_'))) {
            const expectedState = sessionStorage.getItem('gmail_oauth_state');
            if (expectedState && state === expectedState) {
              sessionStorage.removeItem('gmail_oauth_state');
            }
            if (token) {
              localStorage.setItem('gmail_strava_token', JSON.stringify({ access_token: token, refresh_token: refreshToken || undefined }));
              showFeedback('success', 'Gmail conectado!');
            } else if (error) {
              showFeedback('error', 'Falha ao conectar Gmail.');
            }
          } else {
            const expectedState = sessionStorage.getItem('gcal_oauth_state');
            if (state && expectedState && state === expectedState) {
              sessionStorage.removeItem('gcal_oauth_state');
            }
            if (token) {
              localStorage.setItem('google_calendar_token', token);
              setPendingOAuthToken(token);
              setShowGoogleCalendarModal(true);
            } else if (error) {
              setPendingOAuthToken(null);
              setShowGoogleCalendarModal(true);
            }
          }
        }
      } catch (e) {
        console.warn('[deeplink] parse error', e);
      }
    }).then((s) => { sub = s; });

    return () => { sub?.remove(); };
  }, []);

  // Web OAuth callback handler for Gmail (gm_ state prefix)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('gcal_token');
    const errorParam = params.get('gcal_error');
    const state = params.get('state');

    if (errorParam) {
      console.warn('[Gmail web callback] error:', errorParam);
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    if (token && state && state.startsWith('gm_web_')) {
      const savedState = sessionStorage.getItem('gmail_oauth_state');
      if (savedState === state) {
        sessionStorage.removeItem('gmail_oauth_state');
        const refreshToken = params.get('refresh_token');
        localStorage.setItem('gmail_strava_token', JSON.stringify({ access_token: token, refresh_token: refreshToken || undefined }));
        showFeedback('success', 'Gmail conectado!');
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  // Back button: double-press to exit (only on main screen, not during workout)
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || activePlan) return;

    let lastBack = 0;
    let handler: { remove: () => void };

CapApp.addListener('backButton', () => {
      if (backActionStack.length > 0) {
        const action = backActionStack[backActionStack.length - 1];
        action();
        setBackActionStack(prev => prev.slice(0, -1));
        return;
      }
      const now = Date.now();
      if (now - lastBack < 2000) {
        CapApp.exitApp();
      } else {
        lastBack = now;
        showFeedback('success', 'Pressione VOLTAR novamente para fechar o app');
      }
    }).then((h) => { handler = h; });

    return () => { handler?.remove(); };
  }, [activePlan, backActionStack, showFeedback]);

  const doGpsWarmup = async () => {
    try {
      console.log('[App.tsx] iniciando warmup GPS silencioso');
      await Tracking.startTracking();
      await new Promise(resolve => setTimeout(resolve, 3000));
      await Tracking.stopTracking();
      console.log('[App.tsx] warmup GPS concluído');
    } catch (warmupErr: any) {
      console.warn('[App.tsx] warmup GPS falhou:', warmupErr?.message);
    }
  };

  const checkRunWarmup = async () => {
    try {
      const result: any = await Tracking.checkLocationPermissions();
      if (result.location === 'granted') {
        setPermissionsNeeded(false);
        if (result.background === 'granted') {
          await doGpsWarmup();
        } else {
          setShowBackgroundPrompt(true);
        }
      }
    } catch (e: any) {
      console.warn('[App.tsx] checkRunWarmup falhou:', e?.message);
    }
  };

  const handleRequestPermissionsClick = async () => {
    console.log('[App.tsx] Botão "Conceder Permissões" clicado');
    try {
      await requestAllPermissions();
      showFeedback('success', 'Permissões solicitadas!');
      // Check permission state: if fine/coarse granted → check background
      await checkRunWarmup();
    } catch (e: any) {
      console.error('[App.tsx] erro ao pedir permissões', e);
      showFeedback('error', 'Erro: ' + (e?.message || e));
    }
  };

  // Listen for app resume to re-check permissions after user visits settings
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let sub: { remove: () => void } | null = null;
    CapApp.addListener('appStateChange', (state) => {
      if (state.isActive && showBackgroundPrompt) {
        console.log('[App.tsx] app voltou ao foco — re-checkando permissão background');
        checkRunWarmup();
      }
    }).then((s) => { sub = s; });
    return () => { sub?.remove(); };
  }, [showBackgroundPrompt]);

  // Painel de permissões pendentes — disparado assim que detecta o estado
  const [permissionsNeeded, setPermissionsNeeded] = useState(false);

  useEffect(() => {
    if (!user) return;
    console.log('[App.tsx] checkLocationPermissions disparou (user mudou)');
    (async () => {
      try {
        const result: any = await Tracking.checkLocationPermissions();
        console.log('[App.tsx] checkLocationPermissions ->', result);
        if (result.location !== 'granted') setPermissionsNeeded(true);
      } catch (e: any) {
        console.warn('[App.tsx] checkLocationPermissions falhou:', e?.message);
      }
    })();
  }, [user]);

  // Aciona permissões quando o app termina de inicializar (incl. login restaurado de cache)
  useEffect(() => {
    if (!initialized) return;
    if (!user) return;
    console.log('[App.tsx] permissões useEffect disparou (initialized=true, user set)');
    (async () => {
      try {
        await requestAllPermissions();
        await checkRunWarmup();
      } catch (e: any) {
        console.warn('[App.tsx] requestAllPermissions falhou:', e?.message);
      }
    })();
  }, [initialized, user]);

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
    console.log('[App.tsx] confirmWorkoutMode called, mode=', mode, 'simulateGps=', workoutToStart?.simulateGps);
    if (workoutToStart) {
      if (mode === 'outdoor') {
        console.log('[App.tsx] outdoors, ligou keepAwake');
        keepAwake();
      }
      console.log('[App.tsx] setActivePlan disparado, mode=', mode);
      setActivePlan({ plan: workoutToStart.plan, mode, sessionId: `${workoutToStart.plan.id}-${Date.now()}`, simulateGps: workoutToStart.simulateGps });
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

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
  };

  const handleWeekChange = (direction: -1 | 1) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + direction * 7);
    setWeekStart(next);
  };

  const handleImport = async (newPlans: WorkoutPlan[]) => {
    const datedPlans = newPlans.map(p => ({ ...p, scheduledDate: p.scheduledDate || formatDateKey(new Date()) }));
    const updatedPlans = [...plans, ...datedPlans];
    updatePlansState(updatedPlans, 'Planos importados com sucesso!');
  };

  const handleSaveManualPlan = (plan: WorkoutPlan) => {
    const datedPlan = { ...plan, scheduledDate: plan.scheduledDate || formatDateKey(new Date()) };
    const updatedPlans = [...plans, datedPlan];
    updatePlansState(updatedPlans, 'Plano manual salvo!');
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
    showFeedback('success', 'Plano removido com sucesso!');

    // Delete associated sessions
    if (user && plansToDelete.length > 0) {
        try {
            const db = getDb();
            const planIdsToDelete = plansToDelete.map(p => p.id);
            const sessionsToKeep = sessions.filter(s => !planIdsToDelete.includes(s.planId));
            const sessionsToDelete = sessions.filter(s => planIdsToDelete.includes(s.planId));
            
            const batch = writeBatch(db);
            for (const session of sessionsToDelete) {
                batch.delete(doc(db, 'users', user.uid, 'sessions', session.id));
            }
            await batch.commit();
            
            setSessions(sessionsToKeep);
            localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(sessionsToKeep));
        } catch (e) {
            console.error("Erro ao deletar sessões do Firestore:", e);
        }
    }
  };

  const toggleComplete = async (plan: WorkoutPlan) => {
    if (plan.isCompleted) {
        setPlanToUncomplete(plan);
    } else {
        const updatedPlans = plans.map(p => p.id === plan.id ? {...p, isCompleted: true} : p);
        updatePlansState(updatedPlans, 'Atividade concluída!');
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
            planSteps: plan?.steps ? plan.steps.map(s => ({ ...s })) : [],
            date: new Date().toISOString(),
            mode: sessionStats.mode,
            totalDurationSeconds: totalSeconds,
            totalDistanceKm: totalDistance,
            avgSpeedKmh: avgSpeed,
            completed: true,
            points: sessionStats.points,
            hcSyncStatus: undefined,
            gmailSyncStatus: undefined,
        };
        
        try {
            console.log("Salvando sessão no Firestore:", { planId: id, ...sessionStats });
            const docRef = await addDoc(collection(getDb(), 'users', user.uid, 'sessions'), stripUndefined(sessionData));
            showFeedback('success', 'Treino salvo com sucesso!');
            const newSession: TrainingSession = { id: docRef.id, ...sessionData };
            setSessions(s => {
              const updated = [newSession, ...s];
              localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
              return updated;
            });
            setSelectedSession(newSession);
            latestSessionIdRef.current = newSession.id;
        } catch (e) {
            console.error("Erro ao salvar sessão no Firestore (mantida apenas localmente):", e);
            showFeedback('error', 'Falha ao salvar treino no servidor. Dados mantidos localmente.');
            const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const newSession: TrainingSession = { id: localId, ...sessionData };
            setSessions(s => {
              const updated = [newSession, ...s];
              localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
              return updated;
            });
            setSelectedSession(newSession);
            latestSessionIdRef.current = newSession.id;
        }

        const sid = latestSessionIdRef.current;
        const hcPending = pendingHcSyncRef.current;
        const gmailPending = pendingGmailSyncRef.current;
        if (sid && (hcPending || gmailPending)) {
            setSessions(prev => {
                let updated = [...prev];
                if (hcPending) updated = updated.map(s => s.id === sid ? { ...s, hcSyncStatus: hcPending } : s);
                if (gmailPending) updated = updated.map(s => s.id === sid ? { ...s, gmailSyncStatus: gmailPending } : s);
                localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
                return updated;
            });
            if (!sid.startsWith('local-')) {
                const payload: Record<string, unknown> = {};
                if (hcPending) payload.hcSyncStatus = hcPending;
                if (gmailPending) payload.gmailSyncStatus = gmailPending;
                setDoc(doc(getDb(), 'users', user.uid, 'sessions', sid), payload, { merge: true }).catch(() => {});
            }
            pendingHcSyncRef.current = null;
            pendingGmailSyncRef.current = null;
        }
    }
  }

  const updatePlansState = async (updatedPlans: WorkoutPlan[], successMsg?: string) => {
    setPlans(updatedPlans);
    if (user) {
        localStorage.setItem(`correlogo:plans:${user.uid}`, JSON.stringify(updatedPlans));
        try {
            await setDoc(doc(getDb(), 'users', user.uid, 'data', 'plans'), { plans: stripUndefined(updatedPlans) }, { merge: true });
            if (successMsg) showFeedback('success', successMsg);
        } catch (e) {
            console.error("Erro ao salvar planos no Firestore:", e);
            showFeedback('error', 'Falha ao salvar no servidor. Dados mantidos localmente.');
        }
    }
  }

  const openAppSettings = () => {
    if (Capacitor.isNativePlatform()) {
      // Caminho feliz: pedir ACCESS_BACKGROUND_LOCATION. A partir do Android 11
      // (API 30), o sistema exibe um diálogo nativo que, após o usuário aceitar,
      // já leva direto para a tela do app com as opções de localização
      // ("Permitir o tempo todo", "Durante o uso", etc) — exatamente o que o
      // usuário precisa para escolher background location.
      Tracking.requestBackgroundLocationPermission()
        .then(() => {
          console.log('[openAppSettings] requestBackgroundLocationPermission OK');
        })
        .catch((err) => {
          console.warn('[openAppSettings] background permission flow failed, abrindo settings:', err);
          Tracking.openAppSettings().catch((settingsErr) => {
            console.error('[openAppSettings] plugin error:', settingsErr);
            showFeedback('error', 'Não foi possível abrir as configurações');
          });
        });
    }
  };

  const handleLogout = () => {
    signOut(getAuth());
  };

  const handleProfileSaved = (newProfile: ProfileData, newSettings: SettingsData) => {
    setProfile(newProfile);
    setSettings(newSettings);
  };

  const parseDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysBetween = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
  const addDays = (date: string, days: number) => {
    const d = parseDate(date);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const formatDateKeyLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const snapToSameDayOfWeek = (candidateDate: string, originalDayOfWeek: number) => {
    const d = parseDate(candidateDate);
    const diff = (originalDayOfWeek - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    return formatDateKeyLocal(d);
  };

  const handleDateChange = (planId: string, newDate: string, mode: 'single' | 'cascade' = 'single') => {
    if (!newDate) return;
    const targetPlan = plans.find(p => p.id === planId);
    if (!targetPlan || !targetPlan.scheduledDate) {
      const updated = plans.map(p => p.id === planId ? { ...p, scheduledDate: newDate } : p);
      updatePlansState(updated);
      return;
    }
    if (mode === 'single') {
      const updated = plans.map(p => p.id === planId ? { ...p, scheduledDate: newDate } : p);
      updatePlansState(updated);
      return;
    }
    const programId = targetPlan.generatedFromProgramId;
    const programName = targetPlan.programName;
    const programPlans = plans
      .filter(p => p.scheduledDate && (
        programId ? p.generatedFromProgramId === programId : !!(programName && p.programName === programName)
      ))
      .sort((a, b) => a.scheduledDate!.localeCompare(b.scheduledDate!));
    const trainingDays = [...new Set(programPlans.map(p => parseDate(p.scheduledDate!).getDay()))].sort((a, b) => a - b);
    const targetIdx = programPlans.findIndex(p => p.id === planId);
    const afterPlans = programPlans.slice(targetIdx + 1);
    const rescheduled: { id: string; date: string }[] = [];
    let cursor = newDate;
    for (const p of afterPlans) {
      const cursorDow = parseDate(cursor).getDay();
      let nextDay = trainingDays.find(d => d > cursorDow);
      let nextDate: string;
      if (nextDay !== undefined) {
        const d = parseDate(cursor);
        d.setDate(d.getDate() + ((nextDay - cursorDow + 7) % 7));
        nextDate = formatDateKeyLocal(d);
      } else {
        nextDay = trainingDays[0];
        const d = parseDate(cursor);
        d.setDate(d.getDate() + ((nextDay - cursorDow + 7) % 7 || 7));
        nextDate = formatDateKeyLocal(d);
      }
      rescheduled.push({ id: p.id, date: nextDate });
      cursor = nextDate;
    }
    const rescheduleMap = new Map(rescheduled.map(r => [r.id, r.date]));
    const updated = plans.map(p => {
      if (p.id === planId) return { ...p, scheduledDate: newDate };
      if (rescheduleMap.has(p.id)) return { ...p, scheduledDate: rescheduleMap.get(p.id)! };
      return p;
    });
    updatePlansState(updated);
  };

  const calculateTotalDuration = (plan: WorkoutPlan) => {
    return plan.steps.reduce((acc, step) => acc + getStepDurationSeconds(step), 0);
  }

  const plansForSelectedDate = useMemo(() => {
    const key = formatDateKey(selectedDate);
    return plans.filter(p => p.scheduledDate === key);
  }, [plans, selectedDate]);

  const { plannedDates, completedDates, raceDates } = useMemo(() => {
    const planned = new Set<string>();
    const completed = new Set<string>();
    const race = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = formatDateKey(d);
      const dayPlans = plans.filter(p => p.scheduledDate === key);
      if (dayPlans.length > 0) planned.add(key);
      if (dayPlans.some(p => p.isCompleted)) completed.add(key);
      if (sessions.some(s => s.date?.startsWith(key))) completed.add(key);
      if (dayPlans.some(p => p.isRaceMarker)) race.add(key);
    }
    return { plannedDates: planned, completedDates: completed, raceDates: race };
  }, [plans, sessions, weekStart]);

  const allPlannedDates = useMemo(() => {
    const planned = new Set<string>();
    const completed = new Set<string>();
    const race = new Set<string>();
    for (const p of plans) {
      if (p.scheduledDate) {
        planned.add(p.scheduledDate);
        if (p.isCompleted) completed.add(p.scheduledDate);
        if (p.isRaceMarker) race.add(p.scheduledDate);
      }
    }
    for (const s of sessions) {
      if (s.date) completed.add(s.date);
    }
    return { planned, completed, race };
  }, [plans, sessions]);

  const dayPlansCount = plansForSelectedDate.length;
  const remainingCount = plans.filter(p => !p.isCompleted).length;
  const isTodaySelected = selectedDate.toDateString() === new Date().toDateString();
  const greetingName = profile?.displayName || user?.displayName || 'Corredor';

  return (
      <div className="min-h-screen h-screen flex flex-col bg-bg-deep overflow-hidden">
      {saveFeedback && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] max-w-[90%] px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium text-center transition-all duration-300 ${saveFeedback.type === 'success' ? 'bg-green-600' : 'bg-danger'}`} role="alert">
          {saveFeedback.message}
        </div>
      )}
      {permissionsNeeded && (
        <div className="fixed top-0 left-0 right-0 z-[9998] p-4 bg-danger text-white shadow-lg">
          <div className="max-w-xl mx-auto flex flex-col gap-2">
            <p className="font-semibold">⚠️ Permissão de Localização necessária para treinos ao ar livre</p>
            <p className="text-sm">O app precisa de acesso à localização para registrar trajeto, passos e mapa.</p>
            <div className="flex gap-2">
              <button
                onClick={handleRequestPermissionsClick}
                className="px-4 py-2 rounded bg-white text-danger font-semibold text-sm"
              >
                Conceder Permissão
              </button>
              <button
                onClick={() => setPermissionsNeeded(false)}
                className="px-4 py-2 rounded bg-danger/20 text-white text-sm"
              >
                Lembrar depois
              </button>
            </div>
          </div>
        </div>
      )}
      <main className={`flex-1 w-full max-w-xl mx-auto ${activePlan ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {checkingAuth || !user ? (
          checkingAuth ? (
            <div className="flex flex-col items-center justify-center min-h-screen bg-bg-deep p-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-16 h-16 mb-6" aria-hidden="true">
                <path d="M20 65 C30 65, 45 55, 55 45 C40 48, 30 45, 25 38 C40 38, 55 30, 85 20 C75 38, 60 62, 50 75 C52 65, 48 58, 42 56 C35 64, 25 65, 20 65 Z" fill="var(--color-accent)" />
                <path d="M15 50 C25 50, 35 43, 42 37 C35 39, 28 37, 25 33 C33 33, 45 27, 55 22 C48 32, 42 42, 38 48 C39 42, 36 38, 32 37 C28 44, 20 50, 15 50 Z" fill="var(--color-accent)" opacity="0.6" />
              </svg>
              <h1 className="text-2xl font-bold text-text-primary mb-6">Corre Logo</h1>
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : showSignup ? <Signup onLoginClick={() => setShowSignup(false)} /> : <Login onSignupClick={() => setShowSignup(true)} />
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-screen bg-bg-deep p-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-16 h-16 mb-6" aria-hidden="true">
              <path d="M20 65 C30 65, 45 55, 55 45 C40 48, 30 45, 25 38 C40 38, 55 30, 85 20 C75 38, 60 62, 50 75 C52 65, 48 58, 42 56 C35 64, 25 65, 20 65 Z" fill="var(--color-accent)" />
              <path d="M15 50 C25 50, 35 43, 42 37 C35 39, 28 37, 25 33 C33 33, 45 27, 55 22 C48 32, 42 42, 38 48 C39 42, 36 38, 32 37 C28 44, 20 50, 15 50 Z" fill="var(--color-accent)" opacity="0.6" />
            </svg>
            <h1 className="text-2xl font-bold text-text-primary mb-6">Corre Logo</h1>
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {showHistory && (
              <SessionHistory 
                sessions={sessions} 
                onClose={() => setShowHistory(false)} 
                onSelectSession={(s) => {setSelectedSession(s); setShowHistory(false);}} 
                onDeleteSession={(sessionId) => {
                  setSessions(s => {
                    const updated = s.filter(si => si.id !== sessionId);
                    if (user) localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
                    return updated;
                  });
                  if (user && !sessionId.startsWith('local-')) {
                    deleteDoc(doc(getDb(), 'users', user.uid, 'sessions', sessionId)).catch(() => {});
                  }
                  showFeedback('success', 'Sessão removida do histórico.');
                }}
                onExportSession={async (session, target) => {
                    const retryHc = !target || target === 'hc';
                    const retryGmail = !target || target === 'gmail';
                    const hcNeeded = retryHc && (!session.hcSyncStatus || session.hcSyncStatus !== 'synced');
                    const gmailNeeded = retryGmail && (!session.gmailSyncStatus || session.gmailSyncStatus !== 'synced');
                    let hcResult: { success: boolean; status: SyncStatus; error?: string } | null = null;
                    let gmailResult: { success: boolean; error?: string } | null = null;
                    if (hcNeeded) {
                        const exportData: WorkoutExport = {
                            startTime: new Date(session.date).getTime(),
                            endTime: new Date(session.date).getTime() + session.totalDurationSeconds * 1000,
                            durationSeconds: session.totalDurationSeconds,
                            distanceKm: session.totalDistanceKm,
                            exerciseType: session.mode === 'treadmill' ? 'treadmill' : 'running',
                            avgSpeedKmh: session.avgSpeedKmh,
                            route: session.mode === 'outdoor' ? session.points
                                .filter(p => p.lat && p.lon)
                                .map(p => ({
                                    lat: p.lat!,
                                    lng: p.lon!,
                                    altitude: p.altitude,
                                    timestamp: new Date(session.date).getTime() + (p.timestampSeconds || 0) * 1000,
                                }))
                                : undefined,
                        };
                        hcResult = await exportWorkoutToHealthConnect(exportData);
                    }
                    if (gmailNeeded) {
                        gmailResult = await sendWorkoutToStravaViaEmail(session);
                    }
                    if (user) {
                        setSessions(prev => {
                            let updated = [...prev];
                            if (hcResult) updated = updated.map(s => s.id === session.id ? { ...s, hcSyncStatus: hcResult!.status } : s);
                            if (gmailResult) updated = updated.map(s => s.id === session.id ? { ...s, gmailSyncStatus: gmailResult!.success ? 'synced' as const : 'failed' as const } : s);
                            localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
                            return updated;
                        });
                        if (!session.id.startsWith('local-')) {
                            const payload: Record<string, unknown> = {};
                            if (hcResult) payload.hcSyncStatus = hcResult.status;
                            if (gmailResult) payload.gmailSyncStatus = gmailResult.success ? 'synced' : 'failed';
                            setDoc(doc(getDb(), 'users', user.uid, 'sessions', session.id), payload, { merge: true }).catch(() => {});
                        }
                    }
                    if (hcResult) {
                        showFeedback(hcResult.success ? 'success' : 'error', hcResult.success ? 'Health Connect sincronizado!' : `HC: ${hcResult.error || 'erro'}`);
                    }
                    if (gmailResult && gmailResult.success) {
                        showFeedback('success', 'Atividade enviada ao Strava!');
                    } else if (gmailResult && gmailResult.error && gmailResult.error !== 'Apenas dispositivo nativo') {
                        showFeedback('error', `Strava: ${gmailResult.error}`);
                    }
                }}
              />
            )}
            {selectedSession && (
              <Suspense fallback={<div className="flex justify-center items-center h-64"><div className="h-8 w-8 bg-bg-elevated rounded animate-pulse" /></div>}>
              <SessionSummary 
                session={selectedSession} 
                plan={plans.find(p => p.id === selectedSession.planId)}
                showFeedback={showFeedback}
                onClose={() => setSelectedSession(null)} 
                onSuggestAdjustment={(adjustedPlan) => {
                  const updatedPlans = plans.map(p =>
                    p.id === selectedSession?.planId ? adjustedPlan : p
                  );
                  updatePlansState(updatedPlans, 'Plano ajustado com sucesso!');
                  setSelectedSession(null);
                }}
              />
              </Suspense>
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

                      {workoutToStart.mode === 'outdoor' && (
                        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer mb-4">
                          <input type="checkbox" checked={!!workoutToStart.simulateGps} onChange={(e) => setWorkoutToStart({...workoutToStart, simulateGps: e.target.checked})} className="accent-accent" />
                          Simular GPS (dados fictícios para teste)
                        </label>
                      )}
                      {workoutToStart.mode === 'treadmill' && (
                        <div className="bg-bg-elevated rounded-lg space-y-2">
                          {!treadmill.connected ? (
                            <>
                              <button
                                onClick={() => treadmill.scan()}
                                disabled={treadmill.state === 'SCANNING'}
                                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-bg-surface hover:bg-bg-elevated text-text-primary transition-colors disabled:opacity-50"
                              >
                                {treadmill.state === 'SCANNING' ? (
                                  <BluetoothSearching size={18} className="animate-pulse" />
                                ) : (
                                  <Bluetooth size={18} />
                                )}
                                <span className="text-sm font-medium">
                                  {treadmill.state === 'SCANNING' ? 'Escaneando...' : 'Conectar esteira Bluetooth'}
                                </span>
                              </button>
                              {treadmill.devices.length > 0 && (
                                <div className="border border-border rounded-lg max-h-32 overflow-y-auto space-y-1">
                                  {treadmill.devices.map(d => (
                                    <button
                                      key={d.address}
                                      onClick={() => treadmill.connect(d.address)}
                                      disabled={treadmill.state === 'CONNECTING'}
                                      className="w-full text-left p-2 rounded bg-bg-surface text-xs hover:bg-bg-elevated transition-colors disabled:opacity-50"
                                    >
                                      {d.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {treadmill.state === 'CONNECTING' && (
                                <p className="text-xs text-yellow-400 flex items-center gap-1 px-1">
                                  <BluetoothSearching size={14} className="animate-pulse" />
                                  Conectando...
                                </p>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center justify-between p-3 rounded-lg bg-green-900/20 border border-green-700/30">
                              <p className="text-sm text-green-400 flex items-center gap-2">
                                <BluetoothConnected size={16} />
                                <span className="font-medium">
                                  {treadmill.connectedDeviceName ? `Conectado: ${treadmill.connectedDeviceName}` : 'Conectado'}
                                </span>
                              </p>
                              <button
                                onClick={() => treadmill.disconnect()}
                                className="text-text-secondary hover:text-red-400 transition-colors p-1"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          )}
                          {treadmill.error && (
                            <p className="text-danger text-xs px-1">{treadmill.error}</p>
                          )}
                          <p className="text-[10px] text-text-muted px-1">
                            Se conectado, a velocidade do treino será ajustada automaticamente
                          </p>
                        </div>
                      )}

                      <div className="flex gap-4">
                          <Button variant="secondary" className="flex-1" onClick={() => setWorkoutToStart(null)}>Voltar</Button>
                          <Button className="flex-1" disabled={!workoutToStart.mode} onClick={() => {
                            console.log('[App.tsx] Iniciar click, mode=', workoutToStart.mode, 'simulateGps=', workoutToStart.simulateGps);
                            confirmWorkoutMode(workoutToStart.mode as 'treadmill' | 'outdoor');
                          }}>
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
                  simulateGps={activePlan.simulateGps}
                  treadmill={treadmill}
                  showFeedback={showFeedback}
                  onStop={() => { allowSleep(); setActivePlan(null); setIsFreeTraining(false); }} 
                  markAsCompleted={markAsCompleted}
                  totalWorkoutTime={calculateTotalDuration(activePlan.plan)}
                  isFreeTraining={isFreeTraining}
                  onSyncResult={(status) => {
                      if (!user) return;
                      const sessionId = latestSessionIdRef.current;
                      if (!sessionId) {
                          pendingHcSyncRef.current = status;
                          return;
                      }
                      setSessions(prev => {
                          const updated = prev.map(s => s.id === sessionId ? { ...s, hcSyncStatus: status } : s);
                          localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
                          return updated;
                      });
                      if (!sessionId.startsWith('local-')) {
                          setDoc(doc(getDb(), 'users', user.uid, 'sessions', sessionId), { hcSyncStatus: status }, { merge: true }).catch(() => {});
                      }
                  }}
                  onGmailSyncResult={(status) => {
                      if (!user) return;
                      const sessionId = latestSessionIdRef.current;
                      if (!sessionId) {
                          pendingGmailSyncRef.current = status;
                          return;
                      }
                      setSessions(prev => {
                          const updated = prev.map(s => s.id === sessionId ? { ...s, gmailSyncStatus: status } : s);
                          localStorage.setItem(`correlogo:sessions:${user.uid}`, JSON.stringify(updated));
                          return updated;
                      });
                      if (!sessionId.startsWith('local-')) {
                          setDoc(doc(getDb(), 'users', user.uid, 'sessions', sessionId), { gmailSyncStatus: status }, { merge: true }).catch(() => {});
                      }
                  }}
                />
            ) : isEditing ? (
              <div className="p-4">
              <WorkoutEditor onSave={handleSaveManualPlan} onCancel={() => setIsEditing(false)} />
              </div>
            ) : showGenerator ? (
              <div className="p-4">
              <TrainingGenerator onGenerate={(program) => {
                setProgramToReview(program);
                setShowGenerator(false);
              }} onCancel={() => setShowGenerator(false)} />
              </div>
            ) : programToReview ? (
              <div className="p-4">
              <ProgramReview
                program={programToReview}
                onConfirm={(finalProgram) => {
                  const allPlans = finalProgram.weeks.flatMap(w => w.plans.map(p => ({ ...p, generatedFromProgramId: finalProgram.id })));
                  updatePlansState([...plans, ...allPlans], 'Programa gerado com sucesso!');
                  setProgramToReview(null);
                }}
                onCancel={() => setProgramToReview(null)}
              />
              </div>
            ) : (
              <>
              <div className="sticky top-0 z-10 bg-bg-deep px-4 pb-2 pt-4">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                    Corre Logo
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-7 h-7" aria-hidden="true">
                      <path d="M20 65 C30 65, 45 55, 55 45 C40 48, 30 45, 25 38 C40 38, 55 30, 85 20 C75 38, 60 62, 50 75 C52 65, 48 58, 42 56 C35 64, 25 65, 20 65 Z" fill="var(--color-accent)" />
                      <path d="M15 50 C25 50, 35 43, 42 37 C35 39, 28 37, 25 33 C33 33, 45 27, 55 22 C48 32, 42 42, 38 48 C39 42, 36 38, 32 37 C28 44, 20 50, 15 50 Z" fill="var(--color-accent)" opacity="0.6" />
                    </svg>
                  </h1>
                  <div className='flex gap-2'>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleDarkMode}
                    aria-label={isLightMode ? 'Alternar para modo escuro' : 'Alternar para modo claro'}
                  >
                    {isLightMode ? '🌙' : '☀️'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHistory(true)}
                    aria-label="Histórico de treinos"
                  >
                    <BarChart2 size={20} />
                  </Button>
                  <button
                    onClick={() => setShowUserProfile(true)}
                    className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center hover:opacity-90 transition-opacity overflow-hidden"
                    aria-label="Perfil do usuário"
                  >
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold">
                        {(profile?.displayName || user.email || '?')[0].toUpperCase()}
                      </span>
                    )}
                  </button>
                  </div>
                </div>

                <p className="text-text-secondary mt-1">Olá, <strong>{greetingName}</strong></p>
              </div>

              <div className="px-4 pb-4">
              <div className="mt-4 bg-bg-surface border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowMonthCalendar(!showMonthCalendar)}
                  className="w-full p-3 flex items-center justify-between hover:bg-bg-elevated transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <CalendarIcon size={16} className="text-accent" />
                    Calendário
                  </span>
                  {showMonthCalendar ? <ChevronUp size={18} className="text-text-muted" /> : <ChevronDown size={18} className="text-text-muted" />}
                </button>

                {showMonthCalendar ? (
                  <div className="px-3 pb-3 pt-3">
                    <MonthCalendar
                      selectedDate={selectedDate}
                      onSelectDate={(d) => { handleSelectDate(d); }}
                      plannedDates={allPlannedDates.planned}
                      completedDates={allPlannedDates.completed}
                      raceDates={allPlannedDates.race}
                    />
                  </div>
                ) : (
                  <div className="px-3 pb-3 pt-1">
                    <WeekCalendar
                      selectedDate={selectedDate}
                      weekStart={weekStart}
                      onSelectDate={handleSelectDate}
                      onWeekChange={handleWeekChange}
                      plannedDates={plannedDates}
                      completedDates={completedDates}
                      raceDates={raceDates}
                    />
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowPlanSheet(true)}
                className="w-full mt-4 p-4 bg-bg-surface border border-border rounded-xl flex items-center justify-between"
              >
                <span className="font-semibold text-text-primary">Planos</span>
                <span className="flex items-center gap-2">
                  <span className="bg-accent text-white text-xs px-2 py-0.5 rounded-full">{isTodaySelected ? `${remainingCount} restantes` : dayPlansCount}</span>
                  <ChevronUp size={20} className="text-text-muted" />
                </span>
              </button>

              <BottomSheet open={showPlanSheet} onClose={() => setShowPlanSheet(false)}>
                <div className="space-y-3">
                  <Button className="w-full" onClick={() => { setShowPlanSheet(false); setIsEditing(true); }}>
                    Novo Treino Manual
                  </Button>
                  <Button className="w-full" size="lg" onClick={() => { setShowPlanSheet(false); startFreeTraining(); }}>
                    Treino Livre
                  </Button>
                  <Button className="w-full" onClick={() => { setShowPlanSheet(false); setShowGenerator(true); }}>
                    Gerador Automático
                  </Button>
                  <ImportPlan onImport={(newPlans) => { setShowPlanSheet(false); handleImport(newPlans); }} plans={plans} />
                  {plans.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => { setShowPlanSheet(false); downloadIcal(plans, 'corre-logo-treinos.ics'); }}
                        style={{
                          display: 'flex',
                          width: '100%',
                          whiteSpace: 'nowrap',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.5rem 1rem',
                          borderRadius: '0.5rem',
                          backgroundColor: 'rgb(var(--color-bg-elevated))',
                          color: 'rgb(var(--color-text-primary))',
                          transition: 'all 0.15s',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        <CalendarIcon size={16} style={{ marginRight: '0.5rem', flexShrink: 0 }} />
                        Exportar para Calendário (.ics)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowPlanSheet(false); setShowGoogleCalendarModal(true); }}
                        style={{
                          display: 'flex',
                          width: '100%',
                          whiteSpace: 'nowrap',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.5rem 1rem',
                          borderRadius: '0.5rem',
                          color: 'rgb(var(--color-text-muted))',
                          transition: 'all 0.15s',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(var(--color-text-primary))'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(var(--color-text-muted))'}
                      >
                        <Calendar size={16} style={{ marginRight: '0.5rem', flexShrink: 0 }} />
                        Sincronizar Google Calendar
                      </button>
                      <Button
                        variant="ghost"
                        className="w-full border border-accent text-accent"
                        onClick={() => { setShowPlanSheet(false); setPlanToDelete({ id: 'ALL', name: 'TODOS os planos' } as WorkoutPlan); }}
                      >
                        Apagar Plano de Treino
                      </Button>
                    </>
                  )}
                </div>
              </BottomSheet>

              <div className="space-y-4 mt-4">
                {plans.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <Rocket size={48} className="text-accent mb-4" />
                    <h2 className="text-xl font-bold text-text-primary mb-2">Bem-vindo ao Corre Logo!</h2>
                    <p className="text-text-secondary mb-6 max-w-xs">
                      Seu assistente pessoal de treinos de corrida. Crie planos, acompanhe seu progresso e atinja suas metas.
                    </p>
                    <div className="flex flex-col gap-3 w-full max-w-xs">
                      <Button size="lg" onClick={() => { setShowPlanSheet(true); }}>
                        Criar Primeiro Treino
                      </Button>
                      <Button variant="secondary" size="lg" onClick={() => { setShowGenerator(true); }}>
                        Gerar Programa Automático
                      </Button>
                    </div>
                  </div>
                ) : plansForSelectedDate.length === 0 ? (
                  <p className="text-center text-text-muted py-8">Nenhum treino programado para este dia</p>
                ) : (
                  plansForSelectedDate.map((plan, index) => (
                     <div key={`${plan.id}-${index}`} className={`border border-border rounded-lg overflow-hidden ${plan.isCompleted ? 'opacity-70' : ''}`}>
                      <div
                        className="flex justify-between items-center p-4 cursor-pointer hover:bg-bg-elevated"
                        onClick={() => togglePlanExpansion(plan.id)}
                      >
                        <div className='flex gap-2 items-center'>
                          {plan.isRaceMarker ? (
                            <span className="text-lg">🏁</span>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); toggleComplete(plan); }} className="p-2" aria-label={plan.isCompleted ? 'Marcar como não realizado' : 'Marcar como realizado'}>
                              {plan.isCompleted ? <CheckCircle className='text-accent-secondary' /> : <Circle className='text-text-muted' />}
                              <span className="sr-only">{plan.isCompleted ? 'Concluído' : 'Pendente'}</span>
                            </button>
                          )}
                          <span className="font-medium text-text-primary truncate">{plan.activityName || plan.name || 'Plano sem nome'}</span>
                        </div>
                      </div>
                      {!plan.isRaceMarker && (
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
                      )}
                      <div className={`overflow-y-auto transition-all duration-300 ${expandedPlanId === plan.id ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="p-4 border-t border-border text-text-secondary text-sm">
                          <div className="flex justify-end mb-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); setReschedulePlanId(plan.id); }}
                              className="text-xs text-accent border border-accent rounded px-3 py-1.5 hover:bg-accent hover:text-white transition-colors"
                            >
                              Reagendar
                            </button>
                          </div>
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
              </>
            )}
            {planToUncomplete && (
              <Modal open={!!planToUncomplete} onClose={() => setPlanToUncomplete(null)} title="Confirmar" role="alertdialog">
                    <p className="mb-8 text-center text-text-secondary">
                        Tem certeza que deseja marcar a atividade como não realizada?<br />
                        Seu relatório de progresso dessa atividade será <strong className="text-danger">apagado permanentemente</strong>.
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
            {reschedulePlanId && (
              <Modal open={!!reschedulePlanId} onClose={() => setReschedulePlanId(null)} title="Reagendar Treino">
                <div className="flex flex-col items-center gap-6">
                  <p className="text-text-secondary text-sm text-center">
                    Selecione a nova data para este treino.
                  </p>
                  <input
                    type="date"
                    defaultValue={plans.find(p => p.id === reschedulePlanId)?.scheduledDate || ''}
                    autoFocus
                    onChange={() => {}}
                    style={{ colorScheme: 'dark' }}
                    id="reschedule-date-input"
                    className="w-full p-3 border border-border rounded-lg bg-bg-elevated text-text-primary text-base focus:outline-none focus:border-accent cursor-pointer"
                  />
                  <div className="flex flex-col gap-2 w-full">
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => {
                        const input = document.getElementById('reschedule-date-input') as HTMLInputElement;
                        if (input?.value) { handleDateChange(reschedulePlanId, input.value, 'single'); setReschedulePlanId(null); }
                      }}
                    >
                      Reagendar apenas este
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        const input = document.getElementById('reschedule-date-input') as HTMLInputElement;
                        if (input?.value) { handleDateChange(reschedulePlanId, input.value, 'cascade'); setReschedulePlanId(null); }
                      }}
                    >
                      Reagendar este e seguintes
                    </Button>
                  </div>
                  <Button variant="ghost" className="w-full" onClick={() => setReschedulePlanId(null)}>
                    Cancelar
                  </Button>
                </div>
              </Modal>
            )}
          </>
        )}
        {showUserProfile && (
          <UserProfile
            open={showUserProfile}
            onClose={() => setShowUserProfile(false)}
            user={user!}
            initialProfile={profile}
            initialSettings={settings}
            showFeedback={showFeedback}
            onSaved={handleProfileSaved}
          />
        )}
        <GoogleCalendarModal
          open={showGoogleCalendarModal}
          onClose={() => setShowGoogleCalendarModal(false)}
          plans={plans}
          pendingOAuthToken={pendingOAuthToken}
          onOAuthTokenConsumed={() => setPendingOAuthToken(null)}
        />
        {showBackgroundPrompt && (
          <Modal open={true} onClose={() => setShowBackgroundPrompt(false)} title="Permissão de Localização">
            <div className="flex flex-col items-center gap-4">
              <p className="text-text-secondary text-sm text-center">
                Para que o GPS funcione corretamente durante todo o treino, mesmo com a tela desligada,
                é necessário permitir o acesso à localização <strong>"Permitir o tempo todo"</strong>.
              </p>
              <p className="text-text-muted text-xs text-center">
                Toque em "Permitir tempo todo" e o sistema abrirá a tela de permissões
                com as opções de localização do Corre Logo.
              </p>
              <p className="text-text-muted text-[10px] text-center">
                Após escolher, volte ao app e toque em "Já ativei".
              </p>
              <div className="flex flex-col gap-3 w-full mt-2">
                <Button size="lg" onClick={openAppSettings}>
                  Permitir tempo todo
                </Button>
                <Button variant="secondary" size="lg" onClick={() => { setShowBackgroundPrompt(false); setPermissionsNeeded(false); }}>
                  Já ativei
                </Button>
              </div>
            </div>
          </Modal>
        )}
        <UpdatePrompt
          open={updateInfo !== null}
          update={updateInfo}
          downloading={updating}
          onUpdate={async () => {
            if (!updateInfo) return;
            setUpdating(true);
            try {
              await downloadApkAndInstall(updateInfo);
              setUpdateInfo(null);
            } catch (e) {
              showFeedback('error', `Erro ao atualizar: ${e instanceof Error ? e.message : String(e)}`);
            }
            setUpdating(false);
          }}
          onDismiss={() => setUpdateInfo(null)}
        />
      </main>
    </div>
  );
}
