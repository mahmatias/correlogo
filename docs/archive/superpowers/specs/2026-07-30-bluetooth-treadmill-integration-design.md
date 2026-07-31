# Bluetooth FTMS Treadmill Integration — Design

## Objetivo
Permitir que o app **controle** esteiras Bluetooth com perfil FTMS (0x1826) — leitura de telemetria em tempo real e envio de comandos de velocidade/inclinação — com execução automática conforme o plano de treino.

## Arquitetura (em camadas)

```
┌──────────────────────────────────────────────────────┐
│  UI Layer                                            │
│  TreadmillPanel.tsx · WorkoutTracker.tsx · Modal     │
├──────────────────────────────────────────────────────┤
│  Hook                                                │
│  useTreadmill.ts                                     │
├──────────────────────────────────────────────────────┤
│  State Machine                                       │
│  treadmill-machine.ts                                │
├──────────────────────────────────────────────────────┤
│  Transport (interface + impls)                       │
│  ble-transport.ts                                    │
│  ├─ NativeBleTransport  (Android Capacitor)          │
│  ├─ WebBleTransport     (Web Bluetooth API)          │
│  └─ MockTransport       (desenvolvimento)            │
├──────────────────────────────────────────────────────┤
│  FTMS Protocol (puro, zero dependências)             │
│  ftms-protocol.ts                                    │
└──────────────────────────────────────────────────────┘
```

## Camada 1: `ftms-protocol.ts`

Funções puras para encode/decode dos bytes do perfil FTMS (GATT 0x1826/0x1827).

- **`parseTreadmillMetrics(buffer: DataView): TreadmillMetrics`** — Decodifica notificação da characteristic FTMS Measurement (0x2A63). Flags bitmask indicam quais campos estão presentes: velocidade instantânea (km/h × 100), velocidade média, distância total (m), inclinação (% × 10), elevação, ritmo, frequência cardíaca, gasto energético.
- **`encodeSetSpeed(speedKmh: number): ArrayBuffer`** — Opcode 0x02, speed em km/h × 100, little-endian uint16.
- **`encodeSetIncline(inclinePercent: number): ArrayBuffer`** — Opcode 0x03, inclinação em % × 10, little-endian int16.
- **`encodeRequestControl(): ArrayBuffer`** — Opcode 0x00, solicita controle da esteira.
- **`encodeReset(): ArrayBuffer`** — Opcode 0x01, devolve controle.
- **`parseControlPointResponse(buffer: DataView): ControlPointResponse`** — Decodifica resposta do Control Point (opcode da resposta, código de resultado, opcode solicitado).

Testáveis sem mock — `expect(encodeSetSpeed(10)).toEqual(new Uint8Array([0x02, 0xe8, 0x03]))`.

## Camada 2: `ble-transport.ts`

Interface genérica de transporte BLE:

```typescript
interface BleTransport {
  scan(onDevice: (device: BleDevice) => void): Promise<void>
  stopScan(): Promise<void>
  connect(address: string): Promise<void>
  disconnect(): Promise<void>
  onMetrics(cb: (data: DataView) => void): () => void
  onControlPointResponse(cb: (data: DataView) => void): () => void
  sendCommand(data: ArrayBuffer): Promise<void>
  onDisconnect(cb: () => void): () => void
}
```

Três implementações:

### NativeBleTransport
- Usa plugin Capacitor `TreadmillBlePlugin.kt` que implementa o discovery/notificação/escrita via Android BLE GATT API.
- Gerenciamento de estado GATT (SCAN → CONNECT → DISCOVER → ENABLE NOTIFY → ENABLE INDICATE → WRITE CONTROL → ...)
- Keep-alive: escrita periódica (3s) no Control Point para evitar timeout de segurança da esteira.

### WebBleTransport
- Usa `navigator.bluetooth.requestDevice()` com filtro FTMS.
- Write com resposta via `characteristic.writeValueWithResponse()`.
- Apenas para testes no Chrome.

### MockTransport
- Sem conectividade física.
- Escaneamento simulado: retorna um dispositivo mock após 1s.
- Conexão: emite transição de estados (CONNECTING → DISCOVERING → ENABLING → CONTROLLED) com intervalos simulados.
- Telemetria: emite `onMetrics` a cada 1s com valores simulados crescentes.
- Comandos: aceita `setSpeed`/`setIncline` e reflete nos próximos metrics.
- Útil para desenvolvimento web sem hardware.

## Camada 3: `treadmill-machine.ts`

Máquina de estados finita. Estados:

```
DISCONNECTED → [scan] → SCANNING
  → [device selected] → CONNECTING
  → [connected] → DISCOVERING_SERVICES
  → [services discovered] → ENABLING_NOTIFICATIONS
  → [notifications enabled] → ENABLING_INDICATIONS
  → [control point indications ON] → REQUESTING_CONTROL
  → [control acquired] → CONTROLLED
  → [disconnect/error/timeout] → DISCONNECTED
```

Eventos externos: `SCAN_RESULT`, `SCAN_TIMEOUT`, `SCAN_CANCELLED`, `DEVICE_SELECTED`, `CONNECTED`, `SERVICES_DISCOVERED`, `NOTIFICATIONS_ENABLED`, `INDICATIONS_ENABLED`, `CONTROL_ACQUIRED`, `CONTROL_FAILED`, `DISCONNECTED`, `DISCONNECTION_ALERT`.

Entrada: `(state, event) → { nextState, actions[] }`.

Saída de ações: efeitos colaterais que o hook executa (ex: `SEND_COMMAND`, `SHOW_ALERT`, `START_SCAN`, `STOP_SCAN`).

## Camada 4: `useTreadmill.ts`

Hook React que orquestra transport + state machine:

```typescript
function useTreadmill(): {
  state: BleState
  connected: boolean
  devices: BleDevice[]
  metrics: TreadmillMetrics | null
  speedKmh: number
  inclinePercent: number
  error: string | null
  scan: () => void
  connect: (address: string) => void
  disconnect: () => void
  setSpeed: (kmh: number) => void
  setIncline: (pct: number) => void
}
```

- `useEffect([])`: inicializa transport (mock/web/native conforme `isNative()`), conecta listeners da máquina.
- Cleanup: `transport.disconnect()` no unmount.
- `setSpeed`/`setIncline`: atualiza estado React + envia comando via transport.
- Desconexão inesperada: atualiza estado para `DISCONNECTED`, componente exibe toast.

## Camada 5: UI

### Modal "Configurar Treino" (antes do treino)
Linha atual com opção "Simular GPS". Adicionar abaixo:
- Botão "Conectar esteira Bluetooth" → ao clicar, abre scanner/dispositivos disponíveis.
- Após conectar: exibe "Esteira conectada: [nome]" + indicador verde.
- Se fechar o modal sem conectar: OK, treino segue sem BLE.

### `TreadmillPanel.tsx` (durante o treino)
Renderizado dentro do `WorkoutTracker` quando `mode === 'treadmill'`, entre o card de distância restante e os botões de velocidade manual.

Estado desconectado exibe:
- Botão "Conectar esteira" (ícone Bluetooth) → reabre scanner.

Estado conectado exibe:
- Indicador verde "Esteira conectada" + nome do dispositivo.
- Telemetria ao vivo: velocidade real, distância percorrida pela esteira.
- Se `speedKmh > 0` e target definido, exibe indicador de progresso (atual vs alvo).
- Ao desconectar durante o treino: toast "Esteira desconectada — ajuste manual" + estado volta a permitir reconexão.

### Integração no `WorkoutTracker.tsx`
- `useTreadmill()` chamado no corpo do componente (fora de condicionais).
- Na transição de etapa: `treadmill.setSpeed(60 / step.targetPace)` (já que o usuário escolheu mudança instantânea).
- Nos botões manuais `-` / `+` de velocidade: `treadmill.setSpeed(newSpeed)`.

## Fluxo de uso (workflow)

```
┌──────────────┐
│ Escolhe      │
│ "Esteira"    │
│ no modal     │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Modal "Configurar    │
│ Treino" (já existe)  │
│                      │
│ Opções:              │
│ ○ Ar Livre           │
│ ● Esteira            │
│                      │
│ [Conectar esteira    │
│  Bluetooth] — opcional│
│                      │
│ [Iniciar]            │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────┐
│ Se clicar "Conectar"     │
│ → Scanner BLE            │
│ → Lista dispositivos     │
│ → Seleciona → conecta    │
│ → "Conectado" + feedback │
│ → Fecha scanner          │
└──────┬───────────────────┘
       │
       ▼
┌───────────────────────────────┐
│ WorkoutTracker + TreadmillPanel│
│                               │
│ Botões - / + velocidade       │
│ (se conectado → BLE + local)  │
│ (se não → só local)           │
│                               │
│ Transição de etapa →          │
│   BLE setSpeed(se conectado)  │
│                               │
│ Se desconectar durante treino │
│   → toast alerta              │
│   → modo manual               │
└───────────────────────────────┘
```

## Considerações

- **Keep-alive**: muitas esteiras têm safety timeout de 5–10s sem comunicação. O NativeBleTransport envia um comando dummy ou repete última velocidade a cada 3s.
- **Reconexão**: se desconectar, não tenta reconexão automática — exibe alerta e deixa o usuário decidir se quer reconectar.
- **Web Bluetooth**: apenas para desenvolvimento/teste no Chrome. Não usamos em produção.
- **Tratamento de erros**: erros de scan/conexão/comando são expostos via `error` no hook e exibidos como toast na UI.
