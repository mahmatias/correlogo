# Agent Reference: Share Card, Bluetooth FTMS & Auto-Update

> **Propósito:** Documentar para um agente IA como cada feature foi implementada — arquivos envolvidos, arquitetura, fluxo de dados, decisões técnicas, e gotchas conhecidos.

---

## 1. Share Card (Compartilhar Atividade)

Gerar uma imagem 1080×1920 do treino e compartilhar via Android Share Sheet ou Instagram Stories.

### Arquivos

| Arquivo | Papel |
|---------|-------|
| `src/components/ShareCard.tsx` | 4 variantes de card (A Gradiente, B Vidro, C Mapa, D Foto) |
| `src/lib/shareCard.ts` | Captura (DOM→PNG) + lógica de compartilhamento |
| `src/components/SessionSummary.tsx` | Modal com seletor de variante, preview, botão compartilhar |

### Dependências

- `dom-to-image-more` ^3.10.2 — captura DOM element como PNG blob
- `@capacitor/share` ^7.0.4 — native share sheet
- `@capacitor/filesystem` ^7.0.0 — escrever blob em cache antes de share

### Arquitetura

```
SessionSummary modal
  │
  ├── User seleciona variante (a/b/c/d) + stats checkboxes + target (native/instagram-stories)
  │
  ├── Hidden <div ref={cardCaptureRef} style="fixed; left:-9999px">
  │     └── <ShareCard variant={X} ... />  ← renderizado off-screen para captura
  │
  ├── Preview <div style="transform: scale(200/1080)">
  │     └── <ShareCard variant={X} ... />  ← mesmo props, escalado
  │
  └── On "Compartilhar":
        captureCard(cardCaptureRef.current)
          → dom-to-image-more.toBlob() at 2160×3840 (scale=2)
          → Blob PNG (1080×1920 effective)
        shareImage(blob, filename, target)
          → native: Filesystem.writeFile → Capacitor.Share
          → instagram-stories: mesmo flow, dialogTitle="Compartilhar no Instagram Stories"
          → web: navigator.share() ou <a download>
```

### 4 Variantes

| ID | Nome | Background | Tamanho Texto |
|----|------|-----------|---------------|
| `a` | Gradiente | `linear-gradient(135deg, #1a0533, #2d1b69, #e8598b, #ffb347)` | `text-6xl` |
| `b` | Vidro | `radial-gradient` + glassmorphism (`backdrop-filter: blur(20px)`) | `text-5xl` |
| `c` | Mapa | Gradiente escuro + grid SVG + RouteSVG + gradient overlay | `text-4xl` |
| `d` | Foto | `transparent` + `bg-black/30` vignete (para sobrepor em foto real) | `text-7xl` |

### RouteSVG (Variante C)

- Converte `session.points` (lat/lon) para SVG `<path>` sem Leaflet
- Bounding box das coordenadas → flat 0-100%
- Marcador verde (start) e vermelho (end)
- **Z-index critical layer order:**
  1. Grid lines SVG (`opacity-[0.04]`)
  2. `RouteSVG` (`zIndex: 0`)
  3. Gradient overlay (`zIndex: 1`, cobre a rota) ← **bugfix: estava atrás**
  4. Stats container (`z-10`)

### Fluxo de Captura

```typescript
export async function captureCard(element: HTMLElement): Promise<Blob> {
  return domtoimage.toBlob(element, {
    width: 1080 * 2, height: 1920 * 2,
    style: { width: '1080px', height: '1920px', transform: 'scale(2)', transformOrigin: '0 0' },
    cacheBust: true, quality: 1.0,
  });
}
```

### Gotchas

- **400ms delay** antes de capturar (`await new Promise(r => setTimeout(r, 400))`) — garante que o DOM off-screen renderizou
- **Elemento de captura NÃO pode ser `display: none`** — `dom-to-image-more` precisa do elemento no DOM. Usa `position: fixed; left: -9999px`
- **Instagram Stories NÃO é deep-link direto** — usa `Share.share()` com `dialogTitle` customizado. Usuário precisa escolher Instagram manualmente no share sheet
- **Fonte Geologica** depende de carregamento global (Google Fonts). Se não carregou até a captura, renderiza em sans-serif fallback
- **Web Share API Level 2** (`navigator.share({ files })`) só em Chrome Android e Safari; fallback para `<a download>` no desktop

---

## 2. Bluetooth FTMS (Controle de Esteira)

Protocolo FTMS (Fitness Machine Service, UUID `0x1826`) para conectar, ler telemetria e controlar velocidade/inclinação de esteiras Bluetooth.

### Arquivos — Android (Kotlin)

| Arquivo | Papel |
|---------|-------|
| `android/.../TreadmillBlePlugin.kt` | Capacitor Plugin bridge — métodos JS → BLE |
| `android/.../TreadmillBleService.kt` | GATT state machine + scan + connect + command queue |
| `android/.../TreadmillFtmsManager.kt` | FTMS protocol encode/decode (byte manipulation puro) |
| `android/.../MainActivity.java` | `registerPlugin(TreadmillBlePlugin.class)` |

### Arquivos — Web (TypeScript)

| Arquivo | Papel |
|---------|-------|
| `src/lib/native-ble-transport.ts` | Bridge Capacitor → JS: `registerPlugin('TreadmillBle')` |
| `src/lib/ble-transport.ts` | Interface `BleTransport` + `MockTransport` para dev web |
| `src/lib/ftms-protocol.ts` | FTMS decode/encode mirror em TS |
| `src/lib/use-treadmill.ts` | React hook: gerencia transporte + estado |
| `src/lib/treadmill-machine.ts` | Formal state machine (9 states) — artefato de design anterior |
| `src/components/TreadmillPanel.tsx` | UI: scan, conectar, telemetria, controles ± |
| `src/components/WorkoutTracker.tsx` | Integração: auto-sync velocidade nos steps |
| `src/lib/__tests__/treadmill-machine.test.ts` | 9 testes unitários (vitest) |

### Arquitetura

```
useTreadmill() hook
  │
  ├── isNative() && !simulateBle → NativeBleTransport
  │     └── registerPlugin('TreadmillBle')
  │           └── TreadmillBlePlugin.kt (Capacitor)
  │                 └── TreadmillBleService.kt (GATT)
  │                       └── TreadmillFtmsManager.kt (FTMS bytes)
  │
  └── !isNative() || simulateBle → MockTransport
        └── Simula telemetria a 100ms interval
```

### GATT State Machine (5 estados reais)

`DISCONNECTED → CONNECTING → DISCOVERING → READY → CONTROLLED`

1. `connect(address)` → `device.connectGatt()`
2. `onConnectionStateChange(CONNECTED)` → `gatt.discoverServices()` (imediato, sem delay)
3. `onServicesDiscovered()` → get FTMS service → get characteristics → enable notifications
4. `enableNotifications()` → `setCharacteristicNotification()` + `writeDescriptor(CCCD, ENABLE_NOTIFICATION_VALUE)`
5. **Imediatamente envia `Request Control (0x00)`** para assumir controle
6. Resposta `0x80` (opcode + result) → estado `CONTROLLED`

### FTMS Protocol (TreadmillFtmsManager.kt / ftms-protocol.ts)

**UUIDs:**
- Service: `00001826-0000-1000-8000-00805f9b34fb`
- Measurement: `00002acd-0000-1000-8000-00805f9b34fb` (treadmill data)
- Control Point: `00002ad9-0000-1000-8000-00805f9b34fb`
- CCCD: `00002902-0000-1000-8000-00805f9b34fb`

**OpCodes:**
| OpCode | Comando | Bytes |
|--------|---------|-------|
| `0x00` | Request Control | `[0x00]` |
| `0x01` | Reset | `[0x01]` |
| `0x02` | Set Speed | `[0x02, speed UINT16 LE]` |
| `0x03` | Set Incline | `[0x03, incline SINT16 LE]` |
| `0x07` | Start | `[0x07]` |
| `0x08` | Stop | `[0x08]` |

**Telemetria (0x2ACD notify):**
- Flags UINT16 LE no byte 0
- Bit `0x0001` → Instantaneous Speed (UINT16 × 0.01 km/h)
- Bit `0x0002` → Total Distance (UINT32, meters)
- Bit `0x0004` → Instantaneous Incline (SINT16 ÷ 10, %)

### Keep-Alive

- `KEEP_ALIVE_INTERVAL_MS = 3000L`
- Coroutine re-envia último comando a cada 3s
- **Necessário** porque esteiras Matrix T600x têm safety timeout de 5-10s sem comando

### Permissões Bluetooth (AndroidManifest.xml)

```xml
<uses-feature android:name="android.hardware.bluetooth_le" android:required="false" />
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

### Bugfix Crítico (2026-07-30a)

**UUID `FTMS_MEASUREMENT_CHAR` estava `00002a63`** (Cycling Power Control Point) **→ corrigido para `00002acd`** (Treadmill Data). Esse era o root cause de "Required FTMS characteristics not found".

### MockTransport (Dev Web)

- `MockTransport` em `ble-transport.ts` simula dispositivo após 100ms scan
- Gera telemetria a 100ms com flags `0x47` (speed + distance + incline + time)
- Simula acúmulo de distância
- Processa opcodes 0x02 (speed), 0x03 (incline), 0x00 (request control)

### Integração WorkoutTracker

- `useEffect` watch `currentStepIndex` → `treadmill.setSpeed(60 / step.targetPace)` no step change
- `startAdjusting()` → incrementos de 0.1 (primeiros 2s) depois 0.5 km/h
- Modo esteira + nativo: timer JS **não é** source of truth — nativo é

---

## 3. Auto-Update (Atualização In-App)

Sistema de atualização customizado que substitui Firebase App Tester. Distribui APK via GitHub Releases.

### Arquivos

| Arquivo | Papel |
|---------|-------|
| `src/lib/update-checker.ts` | Core: fetch manifest, comparar versões, download + install |
| `src/lib/capacitor/apk-installer.ts` | Wrapper `registerPlugin('ApkInstaller')` |
| `android/.../ApkInstallerPlugin.kt` | Plugin nativo: FileProvider URI + Intent de instalação |
| `src/components/UpdatePrompt.tsx` | Modal "Atualização disponível" com Baixar / Agora não |
| `src/components/UserProfile.tsx` | Botão "Verificar atualizações" manual |
| `src/App.tsx` | Auto-check no mount do usuário (linhas 344-356) |
| `.github/workflows/firebase-deploy.yml` | CI que publica APK + `update-manifest.json` no Release |

### Fluxo

```
CI (push to main):
  build APK → cria/atualiza GitHub Release "latest"
  → publica:
     [1] app-release.apk
     [2] update-manifest.json
     
App (on auth):
  fetch(update-manifest.json) → parse → compara versionCode
  → se > currentVersionCode → mostra UpdatePrompt
  → "Baixar" → download blob → Filesystem.writeFile(cache)
  → ApkInstaller.installApk({ filePath: uri })
  → FileProvider → Intent.ACTION_VIEW → Package Installer
```

### update-manifest.json

Servido em: `https://github.com/mahmatias/correlogo/releases/download/latest/update-manifest.json`

```json
{
  "versionCode": 123,
  "versionName": "2.2",
  "downloadUrl": "https://github.com/mahmatias/correlogo/releases/download/latest/app-release.apk"
}
```

- `versionCode` = `GITHUB_RUN_NUMBER + 100` (monotônico)
- `versionName` = extraído do `build.gradle`
- Repositório público → URLs acessíveis sem auth

### CI Step (firebase-deploy.yml)

```yaml
- name: Upload APK to GitHub Release (in-app update)
  if: always()
  run: |
    git tag -f latest HEAD
    git push origin latest --force
    if gh release view latest > /dev/null 2>&1; then
      gh release upload latest --clobber app-release.apk update-manifest.json
    else
      gh release create latest ... app-release.apk update-manifest.json
    fi
```

- `if: always()` — roda mesmo se Firebase Distribution falhar
- **Critério de desempate:** `--clobber` em vez de `delete + create` (evita 404 se create falhar)

### Bugfix Crítico (2026-07-30e)

**Problema:** `gh release delete latest -y` deletava o release, depois `gh release create` falhava (timeout) → `update-manifest.json` em 404 → app nunca via atualização.

**Fix:** `gh release upload latest --clobber` sobrescreve assets sem deletar o release. `git tag -f latest HEAD` + force push mantém a tag atualizada.

### ApkInstallerPlugin.kt

```kotlin
@PluginMethod
fun installApk(call: PluginCall) {
  val apkUri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
  val intent = Intent(Intent.ACTION_VIEW).apply {
    setDataAndType(apkUri, "application/vnd.android.package-archive")
    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  }
  activity.startActivity(intent)
}
```

- Authority: `com.correlogo.app.fileprovider`
- FileProvider paths: `cache-path` + `external-path` configurados em `res/xml/file_paths.xml`

### Trigger Points

| Trigger | Local | Comportamento |
|---------|-------|---------------|
| **Auto (on auth)** | `App.tsx:344-356` | `useEffect` no `user` → `CapApp.getInfo()` → `checkForUpdate()` → se novo, seta `updateInfo` state → `UpdatePrompt` modal |
| **Manual** | `UserProfile.tsx:361-385` | Botão "Verificar atualizações" → mesmo check → se novo, baixa e instala direto (sem modal intermediário) |
| **CI** | `firebase-deploy.yml` | Push to main → build → publica APK + manifest |

---

## CHANGELOG / HANDOFF References

### Share Card
- `CHANGELOG.md`: Entradas `2026-07-30g` (v2) e `2026-07-30d` (original)
- `HANDOFF.md`: Sessão `2026-07-30f` (v2 overhaul) e `2026-07-30d`

### Bluetooth FTMS
- `CHANGELOG.md`: `2026-07-29i` (implementação), `2026-07-30a` (UUID fix), `2026-07-29j` (permissões)
- `HANDOFF.md`: Sessões `2026-07-30` (UUID fix) e `2026-07-29i` (arquitetura completa)
- `docs/FTMS-Bluetooth-Esteiras/`: Checklist de testes + diagnóstico nRF Connect

### Auto-Update
- `CHANGELOG.md`: `2026-07-30e` (CI fix), `2026-07-30c` (versionCode CI), `2026-07-30b` (workflow inicial)
- `HANDOFF.md`: Sessão "Release Keystore + Profile fixes + In-App Update" (linhas 112-144)
