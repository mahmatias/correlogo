# Voz com tela apagada — CoachingService nativo (motor de coaching em Kotlin)

- **Data**: 2026-08-20
- **Status**: Aprovado (design), aguardando plano de implementação
- **Autor**: sessão 2026-08-20 (advisor)
- **Modo alvo**: Android (Capacitor 7.6.7, core 7.6.7)

## Problema

Durante treino (testado em esteira), quando a tela desliga (timeout de
inatividade do Android ou botão power), as chamadas de voz (TTS/coaching)
param. O timer e a distância continuam corretos ao desbloquear, mas a voz
não é emitida.

**Causa raiz [Certain]**: quando a tela desliga, o Android suspende a
Activity e, com ela, o **WebView/JS**. O timer nativo (`TrackingService`) e a
esteira BLE (`TreadmillBleService`) continuam vivos (porque são
services/tarefas nativas com wakelock), mas o **JS que decide QUANDO falar**
é pausado. O TTS em si não falha — o gatilho JS morre junto com a tela.

## Objetivo

Manter a voz do coaching em **esteira E outdoor** mesmo com a tela
totalmente desligada (botão power), sem depender do WebView vivo.

## Decisões sancionadas (critério de desempate)

Critério central: **resolver a causa raiz** (dependência do WebView) em vez
de contornos (permissões READ, keep-awake), que já se mostraram insuficientes.

1. **Motor 100% nativo**: a decisão de QUANDO falar roda no Android
   (`CoachingService`), lendo tempo/velocidade/GPS/FC **direto no nativo**,
   sem depender do WebView. O JS só envia o plano 1x e comandos de controle.
2. **Service domina toda a voz em Android**: com a tela acesa OU apagada, a
   voz em Android vem do `CoachingService`. O JS para de chamar TTS no
   Android (web mantém). Evita duplicação e handoff.
3. **JS dirige a UI, service só fala**: o `WorkoutTracker` mantém a lógica de
   UI (métricas, mapa, pause) como é hoje. O service é delegado exclusivo de
   fala. Aceita-se risco de divergência UI↔voz (mitigado por evento de
   re-sync após retorno de tela).
4. **Escopo: esteira + outdoor** na mesma entrega.
5. **Trade-off aceito**: motor de coaching duplicado (JS p/ UI + Kotlin p/
   voz). Documentado como dívida; mitigação futura (fora do escopo) é mover
   toda a lógica para nativo e o JS só renderizar.

## Arquitetura

```
[WorkoutTracker.tsx]  ──(plano 1x + comandos)──►  CoachingPlugin  ──►  CoachingService
        │  dirige a UI                                                        │
        │                                                                     │
        │   tempo/velocidade/GPS/FC lidos no próprio nativo ◄─────────────────┘
        │   (SystemClock, TreadmillBleService, HrBleService, TrackingService)
        │
        └──(evento service→JS: coachingState)── para re-sync da UI após tela
```

### Camadas novas no nativo

1. **`CoachingPlugin.kt`** (Capacitor plugin) — ponte JS↔service.
2. **`CoachingService.kt`** (Android `Service`, foreground) — dono do motor e
   do TTS; segura `PARTIAL_WAKE_LOCK`.
3. **`CoachingEngine.kt`** (classe Kotlin pura, testável) — lógica de decisão
   de voz.

## Contrato `CoachingPlugin` (JS ↔ nativo)

**JS → nativo:**
- `start({ plan: {steps[], name}, mode: 'treadmill'|'outdoor', hrMax, isFreeTraining })`
- `pause()` / `resume()`
- `stop()`

**Nativo → JS:**
- `coachingState` (`{ elapsed, stepIndex, distanceKm, isPaused, currentStep }`)
  — emitido ao retomar o WebView (após tela apagada) para a UI re-sincronizar.

## Motor de coaching portado (`CoachingEngine.kt`)

Entrada 1x: `steps[]` (`{type, durationSeconds, targetPace, targetDistance,
basis}`), `mode`, `hrMax`, `isFreeTraining`.

Entrada contínua (nativa): tempo (`SystemClock.elapsedRealtime()`), velocidade
(`TreadmillBleService`), GPS/posição (`TrackingService`), bpm (`HrBleService`).

Estados internos: `currentStepIndex`, `lapSeconds`, `lapDistance`,
`skippedTime`, `isPaused`, `isAutoPaused`, `isExtended`; flags speak-once
(`spokenCompletion`, `almostThereAnnounced`, `halfLapAnnounced`,
`halfWorkoutAnnounced`, `lastAnnouncedZone`).

Eventos/falas (espelham `WorkoutTracker.tsx:286-640`):
1. KM completado (`Quilômetro N completado...`)
2. Metade da volta (run por distância)
3. Metade do treino
4. Troca de etapa (`Volta atual X de Y`)
5. Quase lá (antes de fechar step)
6. Próxima etapa
7. Zona de FC trocada (`Você está na {zona}`)
8. Conclusão (`Exercício concluído, parabéns!`)
9. Autopause/autoresume (outdoor)
10. Início/pausa manual/continuação

## Refatoração JS

**`WorkoutTracker.tsx`:**
- `speak()` (linha ~500): em `isNative()`, não fala (delega ao service); web
  mantém `voiceSpeak`.
- `useEffect` de zona de FC e demais `useEffect` de coaching: continuam
  rodando (UI), mas a parte `speak()` fica inerte no Android.
- Gatilhos de estado (`pause/resume/skip/stop`) continuam no JS e são
  comunicados ao service via `CoachingPlugin`.

**`App.tsx`:**
- Início do treino: `Coaching.start({...})`.
- Stop/onStop: `Coaching.stop()`.

**`voice.ts`:** caminho nativo de `speak()` removido/ocioso; `speak()` web
mantém.

## Android / TTS / Manifest

- **Manifest**: `<service android:name=".CoachingService"
  android:foregroundServiceType="specialUse">` (com `<property>`
  `android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE`) **ou**
  `connectedDevice` (dependência BLE). Permissões: `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_SPECIAL_USE` (ou `CONNECTED_DEVICE`), `WAKE_LOCK`.
- **TTS**: `android.speech.tts.TextToSpeech` no `onCreate` do service;
  `AudioFocusManager` para duck; fila com
  `setOnUtteranceProgressListener` (mesma intenção do `AudioFocusPlugin`).
- **Integração**: `CoachingService` é dono do tempo (não depende do timer do
  `TrackingService`); recebe refs de `TreadmillBleService`/`HrBleService`
  para velocidade/bpm. Não remove `TrackingService` existente (GPS +
  `startNativeTimer` permanecem como estão para não quebrar).
- **keepAwake**: o `CoachingService` com `PARTIAL_WAKE_LOCK` + foreground
  mantém a CPU viva com tela apagada. O `keepAwake` de tela fica como está
  (evita apagar por inatividade).

## Testes

- `CoachingEngine.kt`: testes unitários Kotlin para cada gatilho de voz
  (km, troca de etapa, quase-lá, meio volta, meio treino, zona FC,
  conclusão, autopause).
- Verificação manual no device: esteira e outdoor, tela acesa e apagada,
  voz continuando; UI re-sincronizando após desbloquear.

## Validação de build

Obrigatório (AGENTS.md):
`Copy-Item .env.apk .env` → `npm run build` → `npx cap sync android` →
`gradlew assembleDebug` (JAVA_HOME Temurin 21).

## Fora do escopo (entrega futura)

- Mover toda a lógica de coaching para nativo e o JS só renderizar.
- PiP durante treino (cenário "usar outro app").
