# Capacitor Android — App Nativo Corre Logo

**Data:** 2026-07-04
**Status:** Design aprovado, aguardando implementação

## Objetivo

Empacotar o Corre Logo (SPA React + Vite + Firebase) como app Android usando Capacitor, com acesso a recursos nativos: GPS em background, TTS, WakeLock, step counter, áudio ducking e notificações. Uso próprio (sem publicação na Play Store).

## Escopo

### Essenciais
- GPS em background (ForegroundService)
- TTS nativo (`@capacitor/text-to-speech`)
- WakeLock (`@capacitor/keep-awake`)
- Sensor de passos (`TYPE_STEP_COUNTER` via plugin custom)
- Áudio ducking (`AudioManager.requestAudioFocus` via plugin custom)

### Nice-to-have
- Notificações locais (`@capacitor/local-notifications`)

### Fora de escopo
- iOS (apenas Android)
- Publicação na Play Store
- Push notifications (Firebase Cloud Messaging)
- Sensor de frequência cardíaca

## Abordagem

**Híbrida:** Capacitor como shell + plugins oficiais + plugins custom em Kotlin para o que não tem cobertura da comunidade (tracking, step counter, áudio ducking).

## Dependências

### package.json

```json
"dependencies": {
  "@capacitor/core": "^7.0.0",
  "@capacitor/android": "^7.0.0",
    "@capacitor/text-to-speech": "^7.0.0",
  "@capacitor/keep-awake": "^7.0.0",
  "@capacitor/local-notifications": "^7.0.0"
},
"devDependencies": {
  "@capacitor/cli": "^7.0.0"
}
```

## Estrutura de Diretórios

```
corre-logo/
├── android/                       ← gerado por `npx cap add android`
│   └── app/src/main/java/com/correlogo/app/
│       ├── TrackingPlugin.kt      ← Plugin Capacitor (GPS + steps)
│       ├── TrackingService.kt     ← ForegroundService
│       ├── AudioFocusPlugin.kt    ← Plugin Capacitor (ducking)
│       └── MainActivity.kt       ← gerado, pode precisar de tweaks
├── capacitor.config.ts
├── src/
│   ├── lib/
│   │   └── capacitor/
│   │       ├── platform.ts        ← isNativePlatform()
│   │       ├── tracking.ts        ← wrapper GPS + steps
│   │       ├── voice.ts           ← wrapper TTS
│   │       ├── wakeLock.ts        ← wrapper KeepAwake
│   │       └── notifications.ts   ← wrapper LocalNotifications
```

## Capacitor Config

```ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.correlogo.app',
  appName: 'Corre Logo',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config',
      iconColor: '#F97316',
    },
  },
  android: {
    allowMixedContent: true,
  },
};
```

## AndroidManifest — Permissões e Service

```xml
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />

<service
  android:name=".TrackingService"
  android:foregroundServiceType="location"
  android:exported="false" />
```

## Build Workflow

| Comando | Ação |
|---------|------|
| `npm run build` | Build Vite (gera `dist/`) |
| `npx cap sync` | Sincroniza plugins + copia `dist/` |
| `npx cap run android` | Build + instala no device |
| `npx cap open android` | Abre Android Studio para debug |

O build web (`npm run dev`, `npm run build`) continua funcionando independente. Capacitor é apenas a camada Android.

## Arquitetura dos Plugins Custom

### TrackingPlugin.kt (GPS + StepCounter)
- **Métodos:** `startTracking()`, `stopTracking()`, `getStepCount()`
- **Eventos:** `locationUpdate` (lat, lng, steps, timestamp)
- **Interno:** inicia `TrackingService` que usa `FusedLocationProviderClient` para GPS e `SensorManager.TYPE_STEP_COUNTER` para passos
- **Notificação:** notificação persistente na status bar "Corre Logo — Gravando treino"

### AudioFocusPlugin.kt (Ducking)
- **Métodos:** `requestFocus()`, `abandonFocus()`
- **Interno:** `AudioManager.requestAudioFocus(AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)`
- **Uso:** chamado antes e depois de cada `voice.speak()`

## Camada de Abstração React

Cada wrapper em `src/lib/capacitor/`:
- Tenta usar o plugin Capacitor via `isNativePlatform()`
- Fallback para API Web (navigator.geolocation, speechSynthesis, etc.) quando no browser

### tracking.ts
```ts
if (isNativePlatform()) {
  // TrackingPlugin.startTracking() + listener 'locationUpdate'
} else {
  // navigator.geolocation.watchPosition() (código existente)
}
```

### voice.ts
```ts
if (isNativePlatform()) {
  await AudioFocusPlugin.requestFocus();
  await TextToSpeech.speak({ text, lang: 'pt-BR' });
  await AudioFocusPlugin.abandonFocus();
} else {
  // speechSynthesis.speak() (código existente)
}
```

## Mudanças no Código Existente

| Arquivo | Substituir | Por |
|---------|-----------|-----|
| `App.tsx:297` | `navigator.geolocation.getCurrentPosition()` | `tracking.startTracking()` |
| `WorkoutTracker.tsx` | `watchPosition` callbacks | `TrackingPlugin.addListener('locationUpdate')` |
| Onde chama `speechSynthesis` | chamada direta | `voice.speak()` |
| Início do treino | — | `wakeLock.keepAwake()` |
| Fim do treino | — | `wakeLock.releaseWakeLock()` |
| Ao sair do workout | — | `TrackingPlugin.stopTracking()` |

## O que NÃO Muda

- Firebase Auth (email + Google) — funciona no WebView
- Firestore com `enableIndexedDbPersistence` — offline continua funcionando
- Calendário, planos, sessões, editor de treinos — 0 alterações
- CSS/Tailwind — renderizado normalmente no WebView
- Server Express — não usado no app Android (build standalone)
- `npm run build` — continua gerando `dist/` normalmente

## Validação

1. `npm run build` sem erros
2. `npx cap sync` sem erros
3. `npx cap run android` abre no device
4. Treino outdoor: GPS trackeia mesmo com tela desligada e volta acesa
5. TTS: anúncios de voz funcionam com Spotify tocando (ducking)
6. Step counter: número de passos aparece no summary
7. WakeLock: tela não apaga durante treino
8. Notificações: lembrete aparece no horário agendado
