# Tracking - Timers

## Dual Timer Architecture

O app usa **dois timers paralelos** por design:

| Timer | Fonte | Precisão | Uso |
|-------|-------|----------|-----|
| **Nativo (Kotlin)** | `CountDownTimer` / `Handler` | 1s exato | Source of Truth — elapsed, distance, HC export |
| **JS (React)** | `setInterval(1000)` | ~1s (drift) | UI updates, TTS triggers, step display |

---

## Native Timer (Source of Truth)

### Implementation (Kotlin)

```kotlin
// android/.../TrackingPlugin.kt
private var nativeTimer: CountDownTimer? = null
private var elapsedSeconds = 0L

@PluginMethod
fun startNativeTimer(call: PluginCall) {
    elapsedSeconds = 0
    nativeTimer = object : CountDownTimer(Long.MAX_VALUE, 1000) {
        override fun onTick(millisUntilFinished: Long) {
            elapsedSeconds++
            notifyListeners("timerTick", JSObject().put("elapsedSeconds", elapsedSeconds))
        }
        override fun onFinish() {}
    }.start()
}

@PluginMethod
fun pauseNativeTimer(call: PluginCall) {
    nativeTimer?.cancel()
}

@PluginMethod
fun resumeNativeTimer(call: PluginCall) {
    startNativeTimer(call) // reusa mesma lógica
}

@PluginMethod
fun stopNativeTimer(call: PluginCall) {
    nativeTimer?.cancel()
    nativeTimer = null
    elapsedSeconds = 0
}
```

### Evento para JS

```typescript
// src/lib/capacitor/tracking.ts
Tracking.addListener('timerTick', ({ elapsedSeconds }) => {
  if (!isPausedRef.current) {
    // Nativo é source of truth
    setElapsedSeconds(elapsedSeconds);
    // Atualiza refs para cálculos
    elapsedRef.current = elapsedSeconds * 1000;
  }
});
```

---

## JS Timer (UI Updates)

```typescript
// WorkoutTracker.tsx
useEffect(() => {
  const timer = setInterval(() => {
    // Só UI — não acumula tempo/distância
    setDist(distRef.current);
    setCurrentSpeed(speedRef.current);
    setLapDistance(lapDistRef.current);
  }, 1000);
  return () => clearInterval(timer);
}, []);
```

### Por que dois?

| Problema | Solução |
|----------|---------|
| JS `setInterval` drift | Nativo é preciso (Android `CountDownTimer`) |
| Native timer não atualiza React | JS timer força re-render |
| Background/foreground | Native timer continua rodando em foreground service |

---

## Countdown (Pré-Treino)

```typescript
const [countdown, setCountdown] = useState(5);

useEffect(() => {
  if (countdown > 0) {
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    if (countdown === 5) speak("Iniciando Treino", true);
    return () => clearTimeout(timer);
  }
}, [countdown]);
```

---

## Pause/Resume Logic

```typescript
const [isPaused, setIsPaused] = useState(false);
const isPausedRef = useRef(false);

const togglePause = () => {
  const next = !isPaused;
  setIsPaused(next);
  isPausedRef.current = next;
  
  if (next) {
    Tracking.pauseNativeTimer();
    Tracking.stopTracking(); // Para GPS, mantém serviço
    voice.stop();
  } else {
    Tracking.resumeNativeTimer();
    Tracking.startTracking(); // Reinicia GPS
  }
};
```

### GPS durante Pausa

```typescript
// tracking.ts listener
Tracking.addListener('locationUpdate', (loc) => {
  // Coords/map SEMPRE atualizam (visual)
  setCoords({ latitude: loc.latitude, longitude: loc.longitude });
  setPath(p => [...p, { lat: loc.latitude, lng: loc.longitude }]);
  
  // Distância SÓ se não pausado
  if (!isPausedRef.current) {
    distRef.current += haversine(lastCoord, loc);
  }
});
```

---

## Countdown vs Timer

| Fase | Timer Ativo | Countdown | UI |
|------|-------------|-----------|-----|
| Pré-treino | ❌ | 5→0 | Overlay "5, 4, 3..." |
| Treino ativo | ✅ Nativo + JS | ❌ | Tempo decorrido |
| Pausado | ⏸️ Pausado | ❌ | "Pausado" + botão Retomar |
| Treino livre | ✅ | ❌ | Cronômetro crescente |

---

## Free Training Mode

```typescript
const isFreeTraining = useRef(false);

// Sem plano → sem steps → timer infinito
// UI esconde "Tempo restante" (sempre 0:00)
// TTS de "metade do treino" desabilitado
```

---

## Sync Issues & Fixes

| Bug | Causa | Fix |
|-----|-------|-----|
| Timer conta durante countdown | JS + Nativo rodando junto | JS timer early return se `countdown > 0` |
| Distância pula na troca de step | `distRef = elapsed × speed` recalcula do zero | Acúmulo incremental via `prevElapsedRef` |
| TTS metade não dispara | Closure captura `lapSeconds` stale | Usar `lapElapsed` local ou ref-based |
| Volume música não volta | `setWillPauseWhenDucked(true)` | Remover / usar `false` |

---

*Última revisão: 2026-07-29*