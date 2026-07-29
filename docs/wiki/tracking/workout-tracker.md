# Tracking - WorkoutTracker Overview

## Visão Geral

`WorkoutTracker.tsx` é o componente principal de execução de treino. Gerencia:
- Timer (JS + Nativo)
- GPS (Outdoor) / Esteira
- TTS (Text-to-Speech)
- Passos (Step Counter)
- WakeLock (Manter tela acesa)
- Auto-save + Sync (HC + Strava)

---

## Props

```typescript
interface Props {
  plan: WorkoutPlan;
  onStop: () => void;
  mode: 'treadmill' | 'outdoor';
  markAsCompleted: (id: string, stats: SessionStats) => void;
  totalWorkoutTime: number;
  isFreeTraining?: boolean;
  simulateGps?: boolean;
  key?: string;                    // Força re-mount ao trocar treino
  onSyncResult?: (status: SyncStatus) => void;
}
```

---

## State & Refs

```typescript
// Refs (não causam re-render)
const elapsedRef = useRef(0);           // Tempo total (ms)
const distRef = useRef(0);              // Distância acumulada (km)
const speedRef = useRef(0);             // Velocidade atual (km/h)
const lapDistRef = useRef(0);           // Distância da volta atual
const pointsRef = useRef<ActivityPoint[]>([]);  // Série temporal
const sessionStartTimeRef = useRef(0);  // Date.now() início

// State (causam re-render)
const [elapsedSeconds, setElapsedSeconds] = useState(0);
const [isPaused, setIsPaused] = useState(false);
const [currentStepIndex, setCurrentStepIndex] = useState(0);
const [lapSeconds, setLapSeconds] = useState(0);
const [syncStatus, setSyncStatus] = useState<'idle'|'syncing'|'synced'|'failed'>('idle');
```

---

## Lifecycle

```
Mount
  → requestAllPermissions() (GPS se outdoor)
  → startKeepAlive() (WakeLock)
  → startTracking() (GPS + Step Counter nativo)
  → startNativeTimer() (1s interval nativo)
  → setInterval JS (UI updates 1s)
  → Countdown 5s → start

Pause
  → stopNativeTimer()
  → stopTracking() (mantém GPS ativo para mapa)
  → abandonAudioFocus()

Resume
  → startNativeTimer()
  → requestAudioFocus()

Complete
  → stopNativeTimer()
  → stopTracking()
  → stopKeepAlive()
  → handleSaveAndSync()
  → onStop()
```

---

## Timer Dual (JS + Nativo)

### Nativo (Source of Truth)
```kotlin
// TrackingPlugin.kt
@PluginMethod
fun startNativeTimer(call: PluginCall) {
  timer = object : CountDownTimer(Long.MAX_VALUE, 1000) {
    override fun onTick(millisUntilFinished: Long) {
      notifyListeners("timerTick", JSObject("elapsedSeconds").put("value", elapsedSeconds++))
    }
    override fun onFinish() {}
  }.start()
}
```

```typescript
// src/lib/capacitor/tracking.ts
Tracking.addListener('timerTick', ({ elapsedSeconds }) => {
  if (!isPausedRef.current) {
    setElapsedSeconds(elapsedSeconds);
  }
});
```

### JS (UI Updates)
```typescript
// Atualiza UI a cada 1s (não é source of truth)
useEffect(() => {
  const timer = setInterval(() => {
    setDist(distRef.current);
    setCurrentSpeed(speedRef.current);
  }, 1000);
  return () => clearInterval(timer);
}, []);
```

> **Regra**: Em modo esteira + nativo, JS timer **não** acumula distância — nativo é source of truth.

---

## GPS & Distance (Outdoor)

```typescript
Tracking.addListener('locationUpdate', ({ latitude, longitude, speed }) => {
  if (isPausedRef.current) return; // Não acumula distância pausado
  
  const newPoint: ActivityPoint = {
    timestampSeconds: elapsedRef.current,
    speedKmh: speed * 3.6,           // m/s → km/h
    distanceKm: distRef.current,
    stepIndex: currentStepIndex,
    lat: latitude,
    lon: longitude,
    altitude: altitude,
  };
  pointsRef.current.push(newPoint);
  
  // Haversine distance
  if (lastCoordRef.current) {
    const d = haversine(lastCoordRef.current, { latitude, longitude });
    distRef.current += d;
  }
  lastCoordRef.current = { latitude, longitude };
});
```

---

## Step Counter

```typescript
Tracking.addListener('stepUpdate', ({ steps }) => {
  setStepCount(steps);
});
```

---

## TTS (Text-to-Speech)

```typescript
// src/lib/capacitor/voice.ts
export const speak = async (text: string, priority: boolean = false) => {
  await TextToSpeech.speak({
    text,
    lang: 'pt-BR',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    category: 'ambient',  // Ducking
  });
};

// Anúncios automáticos
- "Iniciando Treino" (countdown 5s)
- "Aquecimento" / "Corrida" / "Caminhada" / "Desaquecimento" (mudança de passo)
- "Chegamos na metade dessa volta!" (50% step > 3min)
- "Chegamos na metade do treino!" (50% total time)
- "Exercício concluído, parabéns!" (último step)
- "Agora é só olhar seu relatório" (finalizar)
```

---

## WakeLock & Foreground Service

```typescript
// Nativo - TrackingPlugin.kt
@PluginMethod
fun startKeepAlive(call: PluginCall) {
  // Inicia Foreground Service + PARTIAL_WAKE_LOCK
  val intent = Intent(context, TrackingService::class.java)
  intent.action = "KEEP_ALIVE"
  ContextCompat.startForegroundService(context, intent)
}

@PluginMethod
fun stopKeepAlive(call: PluginCall) {
  val intent = Intent(context, TrackingService::class.java)
  intent.action = "STOP_KEEP_ALIVE"
  context.startService(intent)
}
```

---

## Handle Save & Sync

```typescript
const handleSaveAndSync = async () => {
  const exportData: WorkoutExport = {
    startTime: sessionStartTimeRef.current,
    endTime: Date.now(),
    durationSeconds: elapsedRef.current,
    distanceKm: distRef.current,
    exerciseType: mode === 'treadmill' ? 'treadmill' : 'running',
    avgSpeedKmh: speedRef.current,
    route: mode === 'outdoor' ? pointsRef.current.filter(p => p.lat && p.lon).map(...) : undefined,
  };
  
  markAsCompleted(plan.id, { points: pointsRef.current, distanceKm: dist, timeSeconds: elapsed, mode });
  
  const hcResult = await exportWorkoutToHealthConnect(exportData);
  setSyncStatus(hcResult.success ? 'synced' : 'failed');
  if (onSyncResult) onSyncResult(hcResult.status);
  
  // Strava via Gmail (fire-and-forget)
  const stravaSession: TrainingSession = { ... };
  sendWorkoutToStravaViaEmail(stravaSession).catch(console.warn);
  
  onStop();
};
```

---

## Key Refs

| Ref | Descrição |
|-----|-----------|
| `elapsedRef` | Tempo total ms (nativo) |
| `distRef` | Distância acumulada km |
| `speedRef` | Velocidade atual km/h |
| `lapDistRef` | Distância volta atual |
| `pointsRef` | ActivityPoint[] série temporal |
| `sessionStartTimeRef` | Date.now() início |
| `isPausedRef` | Sync com `isPaused` state |
| `lastCoordRef` | Último GPS para Haversine |

---

## Error Handling

| Erro | Fallback |
|------|----------|
| GPS permission denied | Modal "Permissão necessária" + botão "Abrir Configurações" |
| Health Connect permission denied | Toast "Verifique permissões" + retry button no histórico |
| TTS fails | Silencioso (não bloqueia) |
| Native timer fails | JS timer assume (menos preciso) |

---

*Última revisão: 2026-07-29*