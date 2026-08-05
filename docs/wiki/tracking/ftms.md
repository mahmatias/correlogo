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

Flags UINT16 LE no byte 0 — bit0 é **More Data** (0 = Instantaneous Speed presente, 1 = ausente):

| Bit | Campo | Tamanho |
|-----|-------|---------|
| 0 | More Data (0 = speed presente) | — |
| 1 | Average Speed (× 0.01 km/h) | UINT16 |
| 2 | Total Distance (metros, 24-bit) | 24-bit |
| 3 | Inclination (÷ 10, %) + Ramp Angle (÷ 10, °) | SINT16 + SINT16 |
| 4 | Elevation Gain (+ e −) | SINT16 + SINT16 |
| 5 | Instantaneous Pace | UINT8 |
| 6 | Average Pace | UINT8 |
| 7 | Expended Energy (total, por hora, por minuto) | UINT16 + UINT16 + UINT8 |
| 8 | Heart Rate | UINT8 |
| 9 | Metabolic Equivalent (÷ 10) | UINT8 |
| 10 | Elapsed Time (s) | UINT16 |
| 11 | Remaining Time (s) | UINT16 |
| 12 | Force on Belt + Power Output | SINT16 + SINT16 |
| 13 | Power Output | SINT16 + SINT16 |

> ⚠️ Atenção: parse anterior (pré-2026-08-05) tratava bit0 como "speed presente" (invertido), bit2 como inclinação e bit1 como distância — isso fazia a velocidade ser lida como inclinação ×10 (5.0 km/h → 50%).

## GATT State Machine

`DISCONNECTED → CONNECTING → DISCOVERING → READY → CONTROLLED`

Após `onServicesDiscovered`, ativa notifications/indications e envia `Request Control (0x00)` imediatamente. O CCCD do control point usa **NOTIFY (0x0001)** se a char não tiver `PROPERTY_INDICATE` (fallback para esteiras BH iConcept), senão INDICATE (0x0002).

## Keep-Alive (Request Control)

Renovação **por idle**, não por timer fixo — evita spam de writes (causa do GATT error 133 em Samsung/API 33+):

- Coroutine checa a cada `KEEP_ALIVE_CHECK_INTERVAL_MS = 5s`.
- Só envia `Request Control (0x00, keep-alive)` se `now - lastSuccessfulWriteMs >= KEEP_ALIVE_RENEW_AFTER_IDLE_MS = 25s` (esteiras Matrix têm safety timeout de 5-10s, mas o refresh com 25s de folga cobre).
- `lastSuccessfulWriteMs` atualizado em `onCharacteristicWrite` com `GATT_SUCCESS`.
- 2 falhas consecutivas de write de keep-alive → `stopKeepAlive()` **silencioso** (sem toast) para não envenenar o link GATT.

## Fila de Writes (serializada)

Um write por vez, todos agendados no main handler (`handler.post`), para eliminar corrida entre keep-alive (IO) e comandos do usuário:

- `writeCharacteristic` que retorna ≠ `SUCCESS` → retry em 200ms (`pendingRetry`), drop só após `MAX_GATT_WRITE_ATTEMPTS = 10`.
- API 33+: `g.writeCharacteristic(char, value, writeType)` (checa `BluetoothStatusCodes`); nunca mutar `char.value` compartilhado.
- `writeType` = `WRITE_TYPE_DEFAULT` se a char tem `PROPERTY_WRITE`, senão `WRITE_TYPE_NO_RESPONSE`.

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
- **GATT error 133 (`0x85`) no controle (2026-08-05)** — escrevias falhavam após tempo conectado em Samsung/API 33+. Causas: keep-alive de 2s sem thread-safety + `writeCharacteristic(char)` mutando `char.value` + CCCD hardcoded INDICATE. Corrigido com fila serializada, API 33+ `writeCharacteristic(char, value, writeType)`, retry 200ms e keep-alive por idle (25s). Ver `TreadmillBleService.kt` e commit `6ed3498`.
- **Telemetria com flag map inventado (2026-08-05)** — speed aparecia como inclinação ×10 e speed sempre 0.0. Root cause: parse de `0x2ACD` com bit0 invertido (More Data) e bit2/bit1 com tamanhos errados. Corrigido em `ftms-protocol.ts` (TS, caminho real) + `TreadmillFtmsManager.kt` (dead code). Confirmado contra diagnóstico nRF (flags `0x078C`) e parser do duhow/ftms-bridge. Commits `8f8xxxx`/ver `git log`.
- **Control Point response com result/opcode trocados (2026-08-05)** — spec é `[0x80][requested opcode][result]`; o código lia `[1]` como result e `[2]` como opcode. Fazia Request Control rejeitado ser tratado como sucesso (CONTROLLED falso) e respostas de Set Speed/Incline aparecerem como falha. Corrigido no service e no manager.

## Referências

- `docs/archive/FTMS-Bluetooth-Esteiras/CHECKLIST-TESTES-FTMS-COMPLETO.md` — checklist de testes
- `docs/archive/FTMS-Bluetooth-Esteiras/DIAGNOSTICO-FTMS-NRF.md` — diagnóstico nRF Connect
- `docs/archive/agent-reference-SHARE-FTMS-UPDATE.md` — referência detalhada para agentes
