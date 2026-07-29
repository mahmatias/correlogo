# Tracking - TTS & Audio Focus

## Visão Geral

TTS (Text-to-Speech) anuncia:
- "Aquecimento", "Corrida", "Caminhada", "Desaquecimento"
- Metade da volta/treino
- Conclusão

---

## Arquitetura

```
Voice.ts (Queue) → Capacitor TTS Plugin → Native TTS
                        │
                        ▼
              AudioFocusPlugin (Kotlin)
              - Request AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
              - Abandon onUtteranceComplete
```

---

## Voice.ts - Queue System

```typescript
// src/lib/capacitor/voice.ts
interface QueueItem {
  text: string;
  priority: boolean;  // true = clear queue
  resolve: () => void;
}

const queue: QueueItem[] = [];
let isSpeaking = false;

export async function speak(text: string, priority = false) {
  return new Promise<void>(resolve => {
    queue.push({ text, priority, resolve });
    if (priority) queue.splice(0, queue.length - 1);
    processQueue();
  });
}

async function processQueue() {
  if (isSpeaking || queue.length === 0) return;
  isSpeaking = true;
  const { text, resolve } = queue.shift()!;
  
  try {
    await TextToSpeech.speak({ text, lang: 'pt-BR', rate: 1.0 });
    await requestAudioFocus(); // Kotlin
  } finally {
    await abandonAudioFocus(); // Kotlin
    isSpeaking = false;
    resolve();
    processQueue();
  }
}
```

---

## Anúncios Durante Treino

### 1. Início de Etapa

```typescript
// WorkoutTracker.tsx
const announceStep = (step: WorkoutStep, index: number) => {
  const type = stepTypeLabels[step.type]; // "Aquecimento", "Corrida", etc.
  speak(`${type}. ${formatDuration(step.durationSeconds)}.`, true);
};
```

### 2. Metade da Volta (Lap)

```typescript
// WorkoutTracker.tsx - a cada tick
if (lapProgress >= 0.5 && !halfLapAnnouncedRef.current) {
  speak("Chegamos na metade dessa volta!", true);
  halfLapAnnouncedRef.current = true;
}
```

### 3. Metade do Treino

```typescript
if (totalProgress >= 0.5 && !halfWorkoutAnnouncedRef.current) {
  speak("Chegamos na metade do treino!", true);
  halfWorkoutAnnouncedRef.current = true;
}
```

### 4. Fim de Etapa / Treino

```typescript
// Última etapa completa
speak("Exercício concluído, parabéns!", true);
setIsExtended(true); // Modo livre

// User pressiona "Finalizar"
speak("Agora é só olhar seu relatório", true);
showSaveModal();
```

---

## Audio Focus (Kotlin)

```kotlin
// AudioFocusPlugin.kt
class AudioFocusPlugin : Plugin() {
    private var audioManager: AudioManager? = null
    private var focusRequest: AudioFocusRequest? = null

    @PluginMethod
    fun requestAudioFocus(call: PluginCall) {
        audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
        
        focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setOnAudioFocusChangeListener { focusChange ->
                when (focusChange) {
                    AudioManager.AUDIOFOCUS_LOSS -> abandonFocus()
                    AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {}
                    AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {}
                    AudioManager.AUDIOFOCUS_GAIN -> {}
                }
            }
            .build()
        
        val result = audioManager!!.requestAudioFocus(focusRequest!!)
        call.resolve(JSObject().put("granted", result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED))
    }

    @PluginMethod
    fun abandonFocus(call: PluginCall) {
        audioManager?.abandonAudioFocusRequest(focusRequest)
        call.resolve()
    }
}
```

### Request Timing

```
speak(text)
    │
    ▼
requestAudioFocus()  →  AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
    │                     (música baixa ~80%)
    ▼
TTS.speak()  (Promise resolve no onDone)
    │
    ▼
onUtteranceComplete  →  abandonAudioFocus()
    │                     (música volta normal)
    ▼
resolve()
```

### Configuração Crítica

```kotlin
// CORRETO - Música baixa (duck), não pausa
AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
//    .setWillPauseWhenDucked(false)  // REMOVIDO - causava bug de volume não voltar

// ERRADO (causava bug)
AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
    .setWillPauseWhenDucked(true)  // Pausa música → às vezes não volta
```

---

## TTS Native vs Web Speech API

| Plataforma | Implementação |
|------------|---------------|
| **APK** | `@capacitor-community/text-to-speech` → Native TTS → AudioFocusPlugin |
| **Web** | `window.speechSynthesis` (Web Speech API) |

### Web Fallback

```typescript
// voice.ts
if (!isNative()) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 1.0;
  speechSynthesis.speak(utterance);
  return new Promise(r => utterance.onend = r);
}
```

---

## Troubleshooting

| Sintoma | Causa | Fix |
|---------|-------|-----|
| TTS repete "Parabéns" | `spokenCompletionRef` missing | Adicionar ref guard |
| Volume música não volta | `setWillPauseWhenDucked(true)` | Remover / usar `MAY_DUCK` |
| TTS não fala (APK) | Permissão `QUERY_ALL_PACKAGES` | Adicionar no Manifest |
| TTS corta no meio | `utterance.onend` não dispara | Usar `onDone` nativo / timeout fallback |
| Fila trava | `isSpeaking` não reseta | `finally { isSpeaking = false }` |

---

## Configuração Capacitor

```json
// capacitor.config.ts
{
  "plugins": {
    "TextToSpeech": {
      "ios": { "locale": "pt_BR" }
    }
  }
}
```

---

## Queue Priority Examples

```typescript
// Prioridade alta (corta fila)
await speak("Cuidado! Obstáculo à frente!", true);

// Prioridade normal (entra na fila)
await speak("Corrida", false);
await speak("Dois minutos", false);
await speak("Caminhada", false);
```

---

*Última revisão: 2026-07-29*