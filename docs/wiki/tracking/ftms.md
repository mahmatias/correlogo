# Tracking — Bluetooth FTMS (Esteira)

## Visão Geral

Controle bidirecional de esteiras Bluetooth via protocolo FTMS (Fitness Machine Service, UUID `0x1826`). Leitura de telemetria (velocidade, distância, inclinação) e envio de comandos (set speed, set incline, request control).

---

## Arquitetura

```
useTreadmill() hook
  ├── isNative() && !simulateBle → NativeBleTransport
  │     └── registerPlugin('TreadmillBle') → TreadmillBlePlugin.kt
  │           └── TreadmillBleService.kt (GATT)
  │                 └── TreadmillFtmsManager.kt (FTMS bytes)
  └── !isNative() || simulateBle → MockTransport
        └── Simula telemetria (dev web)
```

## Arquivos

| Arquivo | Papel |
|---------|-------|
| `android/.../TreadmillBlePlugin.kt` | Capacitor plugin — métodos JS → BLE |
| `android/.../TreadmillBleService.kt` | GATT state machine, scan, connect, command queue |
| `android/.../TreadmillFtmsManager.kt` | FTMS encode/decode |
| `src/lib/native-ble-transport.ts` | Bridge Capacitor → JS |
| `src/lib/ble-transport.ts` | Interface + MockTransport |
| `src/lib/ftms-protocol.ts` | FTMS decode/encode (TS) |
| `src/lib/use-treadmill.ts` | React hook |
| `src/components/TreadmillPanel.tsx` | UI scan/conectar/controles |
| `src/lib/__tests__/treadmill-machine.test.ts` | Testes unitários |

## FTMS Protocol

### UUIDs

- Service: `00001826-0000-1000-8000-00805f9b34fb`
- Measurement: `00002acd-0000-1000-8000-00805f9b34fb`
- Control Point: `00002ad9-0000-1000-8000-00805f9b34fb`
- CCCD: `00002902-0000-1000-8000-00805f9b34fb`

### OpCodes

| OpCode | Comando |
|--------|---------|
| `0x00` | Request Control |
| `0x01` | Reset |
| `0x02` | Set Speed (UINT16 LE × 0.01 km/h) |
| `0x03` | Set Incline (SINT16 LE ÷ 10 %) |
| `0x07` | Start |
| `0x08` | Stop |

### Telemetria (notify 0x2ACD)

Flags UINT16 LE no byte 0:
- `0x0001` → Instantaneous Speed (UINT16 × 0.01 km/h)
- `0x0002` → Total Distance (UINT32, meters)
- `0x0004` → Instantaneous Incline (SINT16 ÷ 10, %)

## GATT State Machine

`DISCONNECTED → CONNECTING → DISCOVERING → READY → CONTROLLED`

Após `onServicesDiscovered`, ativa notifications + indications e envia `Request Control (0x00)` imediatamente.

## Keep-Alive

Intervalo de 3s (coroutine) re-envia último comando. Necessário porque esteiras Matrix têm safety timeout de 5-10s.

## MockTransport (Dev Web)

Simula dispositivo FTMS após 100ms de scan. Gera telemetria a cada 100ms. Processa opcodes de speed/incline/request control.

## Permissões

```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

## Bugfix Conhecido

- `FTMS_MEASUREMENT_CHAR` foi corrigido de `00002a63` (Cycling Power) para `00002acd` (Treadmill Data) em 2026-07-30a
- Características devem ser acessadas apenas dentro de `onServicesDiscovered()`

## Referências

- `docs/FTMS-Bluetooth-Esteiras/CHECKLIST-TESTES-FTMS-COMPLETO.md` — checklist de testes
- `docs/FTMS-Bluetooth-Esteiras/DIAGNOSTICO-FTMS-NRF.md` — diagnóstico nRF Connect
- `docs/agent-reference-SHARE-FTMS-UPDATE.md` — referência detalhada para agentes
