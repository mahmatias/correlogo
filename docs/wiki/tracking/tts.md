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

## Voice.ts - Serial Queue (`queueChain`)

> **2026-08-28**: a fila foi reescrita como **promise serial** (`queueChain`). O bug anterior: múltiplos `speak()` no mesmo tick rodavam em paralelo → segundo cortava o primeiro, e o `AudioFocus` request/abandon sobrepostos quebrava o duck (volume nunca voltava). Agora cada utterance roda **após** a anterior terminar, e o `requestFocus`/`abandonFocus` de uma só entram após a outra ter liberado.

```typescript
// src/lib/capacitor/voice.ts
let queueChain: Promise<void> = Promise.resolve();

export async function speak(text: string, lang = 'pt-BR') {
  if (!isNative()) { speakWeb(text, lang); return; }
  const run = queueChain.then(async () => {
    try {
      await TextToSpeech.stop();              // zera a fila do TTS nativo
      await AudioFocus.requestFocus();        // duck (música -80%)
      await TextToSpeech.speak({ text, lang, rate: 1.0 }); // resolve no onDone
      await AudioFocus.abandonFocus().catch(() => {});     // volta o volume
    } catch (e) {
      console.warn('[voice] native TTS error:', e);
      AudioFocus.abandonFocus().catch(() => {});
    }
  });
  queueChain = run.catch(() => {});   // erro de um não trava os seguintes
  return run;
}

export function stopSpeaking() {
  TextToSpeech.stop().catch(() => {});
  AudioFocus.abandonFocus().catch(() => {});
  queueChain = Promise.resolve();     // descarta a fila pendente
}
```

`stopSpeaking()` zera a fila — um utterance cancelado não deixa a chain segurando foco nem bloqueando o próximo lote.

---

## Anúncios Durante Treino

### 1. Início de Etapa

```typescript
// WorkoutTracker.tsx
const announceStep = (step: WorkoutStep, index: number) => {
  const type = stepTypeLabels[step.type]; // "Aquecimento", "Corrida", etc.
  speak(`${type}. ${formatDuration(step.durationSeconds)}.`);
};
```

### 2. Metade da Volta (Lap)

```typescript
// WorkoutTracker.tsx - a cada tick
if (lapProgress >= 0.5 && !halfLapAnnouncedRef.current) {
  speak("Chegamos na metade dessa volta!");
  halfLapAnnouncedRef.current = true;
}
```

### 3. Metade do Treino

```typescript
if (totalProgress >= 0.5 && !halfWorkoutAnnouncedRef.current) {
  speak("Chegamos na metade do treino!");
  halfWorkoutAnnouncedRef.current = true;
}
```

### 4. Fim de Etapa / Treino

```typescript
// Última etapa completa
speak("Exercício concluído, parabéns!");
setIsExtended(true); // Modo livre

// User pressiona "Finalizar"
speak("Agora é só olhar seu relatório");
showSaveModal();
```

---

## Audio Focus (Kotlin)

> **2026-08-28**: o plugin agora mantém um **contador de referência** (`focusRefCount`) com `synchronized`. Só o primeiro `requestFocus` (0→1) pede foco ao sistema e só o último `abandonFocus` (1→0) libera — chamadas sobrepostas nunca desbalanceiam o duck (que era a causa do volume da música nunca voltar).

```kotlin
// AudioFocusPlugin.kt
class AudioFocusPlugin : Plugin() {
    private var audioFocusRequest: AudioFocusRequest? = null;
    private var focusRefCount: Int = 0;    // request 0->1 pede foco; abandon 1->0 libera
    private val focusLock = Any();

    @PluginMethod
    fun requestFocus(call: PluginCall) {
        synchronized(focusLock) {
            if (focusRefCount == 0) {
                val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(AudioAttributes.Builder()
                        .setUsage(USAGE_ASSISTANCE_SONIFICATION)
                        .setContentType(CONTENT_TYPE_SPEECH).build())
                    .build();
                audioFocusRequest = request;
                audioManager.requestAudioFocus(request);
            }
            focusRefCount++;
        }
        call.resolve();
    }

    @PluginMethod
    fun abandonFocus(call: PluginCall) {
        synchronized(focusLock) {
            if (focusRefCount > 0) focusRefCount--;
            if (focusRefCount == 0) {
                audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it); audioFocusRequest = null; }
            }
        }
        call.resolve();
    }
}
```

### Request Timing (serial)

```
speak(text)
    │  (encadeado em queueChain — só roda após o anterior terminar)
    ▼
TextToSpeech.stop()       → zera fila do TTS nativo
    ▼
AudioFocus.requestFocus() → focusRefCount 0->1 → duck (música -80%)
    ▼
TTS.speak()  (Promise resolve no onDone de UMA utterance)
    ▼
AudioFocus.abandonFocus() → focusRefCount 1->0 → música volta normal
```

Como a fila é **serial**, nunca há dois `speak` com foco no ar — um utterance termina e libera o foco antes do próximo pedir. Assim, o duck sempre é desfeito e a música restaura o volume.

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
| Volume música não volta | request/abandon de foco sobrepostos (chamadas concorrentes) | Fila serial `queueChain` + `focusRefCount` no plugin (2026-08-28) |
| TTS duplo (segundo corta primeiro) | `speak()` concorrentes no mesmo tick | Fila serial `queueChain` (`speak` enfileirado, não paralelo) |
| TTS não fala (APK) | Permissão `QUERY_ALL_PACKAGES` | Adicionar no Manifest |
| Fila trava | erro de um utterance quebra a chain | `queueChain = run.catch(() => {})` por utterance |

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

## Ordem de Anúncios (serial — fila FIFO)

A fila é **FIFO**: anúncios disparados no mesmo tick entram na ordem e são falados um após o outro (não se cortam).

```typescript
speak("Corrida");
speak("Dois minutos");
speak("Caminhada");
// Fala "Corrida" → "Dois minutos" → "Caminhada", em sequência
```

Para cancelar/pular o restante, use `stopSpeaking()` (zera a fila e libera o foco).

---

*Última revisão: 2026-08-28 (fila serial `queueChain` + `AudioFocusPlugin` com `focusRefCount`)*