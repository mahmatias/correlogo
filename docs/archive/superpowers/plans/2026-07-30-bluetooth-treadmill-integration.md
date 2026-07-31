# Bluetooth FTMS Treadmill Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the app to connect to any Bluetooth FTMS treadmill — read telemetry, send speed/incline commands, and auto-adjust speed per workout step.

**Architecture:** Layered — protocol (pure), transport (BLE abstraction), state machine, React hook, UI. Each layer testable independently.

**Tech Stack:** TypeScript (protocol, transport, machine, hook, UI), Kotlin (Android BLE plugin), Capacitor (bridge), Web Bluetooth API (browser dev).

## Global Constraints

- All FTMS protocol functions must be pure (no side effects, no IO)
- Transport interface must be implementable for web (Web Bluetooth) and native (Android BLE plugin)
- On web, `isNative()` returns false → use `WebBleTransport` or `MockTransport`
- On Android, `isNative()` returns true → use `NativeBleTransport`
- Keep-alive: resend last speed command every 3s while connected to prevent safety timeout
- Auto-speed on step transition is instantaneous (no ramp)
- Speed/incline display: show real (from treadmill) not target while connected; fallback to target when disconnected

---

### Task 1: FTMS Protocol (`ftms-protocol.ts`)

**Files:**
- Create: `src/lib/ftms-protocol.ts`
- Test: `src/lib/__tests__/ftms-protocol.test.ts`

**Interfaces:**
- Produces: `parseTreadmillMetrics(data: DataView): TreadmillMetrics`, `encodeSetSpeed(speedKmh: number): ArrayBuffer`, `encodeSetIncline(inclinePercent: number): ArrayBuffer`, `encodeRequestControl(): ArrayBuffer`, `encodeReset(): ArrayBuffer`, `parseControlPointResponse(data: DataView): ControlPointResponse`

- [ ] **Step 1: Define types in ftms-protocol.ts**

```typescript
export interface TreadmillMetrics {
  instantSpeedKmh: number          // km/h, required per spec
  averageSpeedKmh?: number
  totalDistanceMeters?: number
  instantaneousInclinePercent?: number
  elevationGainMeters?: number
  stepRate?: number                // cadence
  heartRate?: number
  elapsedTimeSeconds?: number
}

export interface ControlPointResponse {
  resultCode: number    // 0x01 = success, others = error codes
  requestedOpcode: number
}

export enum FtmsOpcode {
  REQUEST_CONTROL = 0x00,
  RESET = 0x01,
  SET_SPEED = 0x02,
  SET_INCLINE = 0x03,
  START = 0x07,
  STOP = 0x08,
}
```

- [ ] **Step 2: Write failing test for parseTreadmillMetrics**

```typescript
// src/lib/__tests__/ftms-protocol.test.ts
import { parseTreadmillMetrics, encodeSetSpeed, encodeSetIncline } from '../ftms-protocol';

describe('parseTreadmillMetrics', () => {
  it('parses instant speed from FTMS measurement', () => {
    // Flag byte: 0x01 = instant speed present
    // Speed: 10.0 km/h = 1000 -> 0xE8 0x03 (little-endian uint16)
    const buf = new Uint8Array([0x01, 0xE8, 0x03]).buffer;
    const result = parseTreadmillMetrics(new DataView(buf));
    expect(result.instantSpeedKmh).toBe(10.0);
    expect(result.totalDistanceMeters).toBeUndefined();
  });

  it('parses speed + distance when flags indicate both', () => {
    // Flags: 0x01 (speed) | 0x02 (distance) = 0x03
    // Speed: 12.5 km/h = 1250 -> 0xE2 0x04
    // Distance: 1500m = 1500 -> 0xDC 0x05
    const buf = new Uint8Array([0x03, 0xE2, 0x04, 0xDC, 0x05]).buffer;
    const result = parseTreadmillMetrics(new DataView(buf));
    expect(result.instantSpeedKmh).toBe(12.5);
    expect(result.totalDistanceMeters).toBe(1500);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

`npx vitest run src/lib/__tests__/ftms-protocol.test.ts -t "parseTreadmillMetrics"`

- [ ] **Step 4: Implement parseTreadmillMetrics**

```typescript
// src/lib/ftms-protocol.ts
import type { TreadmillMetrics, ControlPointResponse, FtmsOpcode } from './ftms-protocol';

export function parseTreadmillMetrics(data: DataView): TreadmillMetrics {
  const flags = data.getUint16(0, true);
  let offset = 2;
  const result: TreadmillMetrics = { instantSpeedKmh: 0 };

  if (flags & 0x0001) { // Instantaneous Speed (km/h * 100)
    result.instantSpeedKmh = data.getUint16(offset, true) / 100;
    offset += 2;
  }
  if (flags & 0x0002) { // Total Distance
    result.totalDistanceMeters = data.getUint32(offset, true);
    offset += 4;
  }
  if (flags & 0x0004) { // Instantaneous Incline
    result.instantaneousInclinePercent = data.getInt16(offset, true) / 10;
    offset += 2;
  }
  if (flags & 0x0008) { // Elevation Gain
    result.elevationGainMeters = data.getInt16(offset, true);
    offset += 2;
  }
  if (flags & 0x0010) { // Step Rate
    result.stepRate = data.getUint16(offset, true);
    offset += 2;
  }
  if (flags & 0x0020) { // Heart Rate
    result.heartRate = data.getUint8(offset);
    offset += 1;
  }
  if (flags & 0x0040) { // Elapsed Time
    result.elapsedTimeSeconds = data.getUint16(offset, true);
    offset += 2;
  }
  if (flags & 0x0080) { // Remaining Time
    offset += 2;
  }
  if (flags & 0x0100) { // Force on Belt
    offset += 2;
  }
  if (flags & 0x0200) { // Power Output
    offset += 2;
  }

  return result;
}
```

- [ ] **Step 5: Write failing test for encodeSetSpeed**

```typescript
it('encodes set speed command', () => {
  const result = encodeSetSpeed(10.0);
  const view = new Uint8Array(result);
  // Opcode 0x02 + speed 1000 (10.0 * 100) as uint16 LE = 0xE8 0x03
  expect(view).toEqual(new Uint8Array([0x02, 0xE8, 0x03]));
});
```

- [ ] **Step 6: Implement encodeSetSpeed + encodeSetIncline**

```typescript
export function encodeSetSpeed(speedKmh: number): ArrayBuffer {
  const speedRaw = Math.round(speedKmh * 100);
  const buf = new ArrayBuffer(3);
  const view = new DataView(buf);
  view.setUint8(0, 0x02);            // opcode
  view.setUint16(1, speedRaw, true);  // speed in 0.01 km/h resolution
  return buf;
}

export function encodeSetIncline(inclinePercent: number): ArrayBuffer {
  const inclineRaw = Math.round(inclinePercent * 10);
  const buf = new ArrayBuffer(3);
  const view = new DataView(buf);
  view.setUint8(0, 0x03);              // opcode
  view.setInt16(1, inclineRaw, true);  // incline in 0.1% resolution
  return buf;
}
```

- [ ] **Step 7: Run tests to verify they pass**

`npx vitest run src/lib/__tests__/ftms-protocol.test.ts`

- [ ] **Step 8: Write failing tests + implement remaining functions**

```typescript
it('encodes request control command', () => {
  const result = encodeRequestControl();
  expect(new Uint8Array(result)).toEqual(new Uint8Array([0x00]));
});

it('parses control point response', () => {
  // Success response: opcode 0x80 (response bit) + result 0x01 + requested opcode 0x00
  const buf = new Uint8Array([0x80, 0x01, 0x00]).buffer;
  const result = parseControlPointResponse(new DataView(buf));
  expect(result.resultCode).toBe(0x01);
  expect(result.requestedOpcode).toBe(0x00);
});
```

Implement:

```typescript
export function encodeRequestControl(): ArrayBuffer {
  return new Uint8Array([0x00]).buffer;
}

export function encodeReset(): ArrayBuffer {
  return new Uint8Array([0x01]).buffer;
}

export function parseControlPointResponse(data: DataView): ControlPointResponse {
  return {
    resultCode: data.getUint8(1),
    requestedOpcode: data.getUint8(2),
  };
}
```

- [ ] **Step 9: Run all tests**

`npx vitest run src/lib/__tests__/ftms-protocol.test.ts`

- [ ] **Step 10: Commit**

```bash
git add src/lib/ftms-protocol.ts src/lib/__tests__/ftms-protocol.test.ts
git commit -m "feat(ble): add FTMS protocol encode/decode"
```

---

### Task 2: Transport Interface + WebBluetoothTransport + MockTransport

**Files:**
- Create: `src/lib/ble-transport.ts`
- Test: `src/lib/__tests__/ble-transport.test.ts` (mock only, web needs browser)

**Interfaces:**
- Consumes: `parseTreadmillMetrics`, `encodeSetSpeed`, `encodeSetIncline`, `encodeRequestControl`, `encodeReset`, `parseControlPointResponse` from ftms-protocol
- Produces: `BleDevice`, `BleTransport` interface, `MockTransport` class, `WebBleTransport` class

- [ ] **Step 1: Define types + interface in ble-transport.ts**

```typescript
export interface BleDevice {
  name: string
  address: string
}

export interface BleTransport {
  scan(onDevice: (device: BleDevice) => void): Promise<void>
  stopScan(): Promise<void>
  connect(address: string): Promise<void>
  disconnect(): Promise<void>
  sendCommand(data: ArrayBuffer): Promise<void>
  onMetrics(cb: (data: DataView) => void): () => void
  onControlPointResponse(cb: (data: DataView) => void): () => void
  onDisconnect(cb: () => void): () => void
  onError(cb: (error: string) => void): () => void
}
```

- [ ] **Step 2: Write failing test for MockTransport**

```typescript
// src/lib/__tests__/ble-transport.test.ts
import { MockTransport } from '../ble-transport';

describe('MockTransport', () => {
  it('emits scan result after start', (done) => {
    const transport = new MockTransport();
    transport.scan((device) => {
      expect(device.name).toContain('Esteira Simulada');
      done();
    });
  });

  it('transitions to connected state after connect', async () => {
    const transport = new MockTransport();
    transport.scan(() => {});
    const device = await new Promise<any>(resolve => {
      transport.scan(d => resolve(d));
    });
    // ... wait for scan to complete
  });
});
```

- [ ] **Step 3: Implement MockTransport with full state simulation**

```typescript
export class MockTransport implements BleTransport {
  private metricsListeners: Array<(data: DataView) => void> = [];
  private controlPointListeners: Array<(data: DataView) => void> = [];
  private disconnectListeners: Array<() => void> = [];
  private errorListeners: Array<(err: string) => void> = [];
  private metricsInterval: ReturnType<typeof setInterval> | null = null;
  private _connected = false;
  private _speedKmh = 0;
  private _inclinePct = 0;
  private _distanceM = 0;
  private _time = 0;

  async scan(onDevice: (device: BleDevice) => void): Promise<void> {
    setTimeout(() => {
      onDevice({ name: 'Esteira Simulada (FTMS)', address: '00:11:22:33:44:55' });
    }, 1000);
  }

  async stopScan(): Promise<void> {}

  async connect(address: string): Promise<void> {
    this._connected = true;
    // Start emitting metrics
    this.metricsInterval = setInterval(() => {
      this._time++;
      if (this._speedKmh > 0) {
        this._distanceM += (this._speedKmh * 1000 / 3600);
      }
      const buf = new ArrayBuffer(13);
      const view = new DataView(buf);
      view.setUint16(0, 0x41, true); // flags: speed + distance + incline + time
      view.setUint16(2, Math.round(this._speedKmh * 100), true);
      view.setUint32(4, Math.round(this._distanceM), true);
      view.setInt16(8, Math.round(this._inclinePct * 10), true);
      view.setUint16(10, this._time, true);
      this.metricsListeners.forEach(cb => cb(new DataView(buf)));
    }, 1000);
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    this.disconnectListeners.forEach(cb => cb());
  }

  async sendCommand(data: ArrayBuffer): Promise<void> {
    const view = new DataView(data);
    const opcode = view.getUint8(0);
    if (opcode === 0x02) { // set speed
      this._speedKmh = view.getUint16(1, true) / 100;
      this.controlPointListeners.forEach(cb => {
        const resp = new Uint8Array([0x80, 0x01, 0x02]).buffer;
        cb(new DataView(resp));
      });
    } else if (opcode === 0x03) { // set incline
      this._inclinePct = view.getInt16(1, true) / 10;
      this.controlPointListeners.forEach(cb => {
        const resp = new Uint8Array([0x80, 0x01, 0x03]).buffer;
        cb(new DataView(resp));
      });
    } else if (opcode === 0x00) { // request control
      this.controlPointListeners.forEach(cb => {
        const resp = new Uint8Array([0x80, 0x01, 0x00]).buffer;
        cb(new DataView(resp));
      });
    }
  }

  onMetrics(cb: (data: DataView) => void): () => void {
    this.metricsListeners.push(cb);
    return () => { this.metricsListeners = this.metricsListeners.filter(l => l !== cb); };
  }

  onControlPointResponse(cb: (data: DataView) => void): () => void {
    this.controlPointListeners.push(cb);
    return () => { this.controlPointListeners = this.controlPointListeners.filter(l => l !== cb); };
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.push(cb);
    return () => { this.disconnectListeners = this.disconnectListeners.filter(l => l !== cb); };
  }

  onError(cb: (err: string) => void): () => void {
    this.errorListeners.push(cb);
    return () => { this.errorListeners = this.errorListeners.filter(l => l !== cb); };
  }
}
```

- [ ] **Step 4: Implement WebBleTransport**

```typescript
export class WebBleTransport implements BleTransport {
  private server: BluetoothRemoteGATTServer | null = null;
  private ftmsMeasurement: BluetoothRemoteGATTCharacteristic | null = null;
  private ftmsControlPoint: BluetoothRemoteGATTCharacteristic | null = null;
  private metricsListeners: Array<(data: DataView) => void> = [];
  private controlPointListeners: Array<(data: DataView) => void> = [];
  private disconnectListeners: Array<() => void> = [];
  private errorListeners: Array<(err: string) => void> = [];

  async scan(onDevice: (device: BleDevice) => void): Promise<void> {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [0x1826] }],
        optionalServices: [0x1826],
      });
      const info: BleDevice = {
        name: device.name || 'Unknown',
        address: device.id,
      };
      onDevice(info);
    } catch (err: any) {
      this.errorListeners.forEach(cb => cb(err.message));
    }
  }

  async stopScan(): Promise<void> {}

  async connect(address: string): Promise<void> {
    // Web Bluetooth doesn't support connecting by address directly
    // Connection happens during requestDevice
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [0x1826] }],
    });
    device.addEventListener('gattserverdisconnected', () => {
      this.disconnectListeners.forEach(cb => cb());
    });
    this.server = device.gatt;
    if (!this.server) throw new Error('No GATT server');
    await this.server.connect();
    const service = await this.server.getPrimaryService(0x1826);
    this.ftmsMeasurement = await service.getCharacteristic(0x2A63);
    this.ftmsControlPoint = await service.getCharacteristic(0x2AD9);
    await this.ftmsMeasurement.startNotifications();
    this.ftmsMeasurement.addEventListener('characteristicvaluechanged', (e: any) => {
      this.metricsListeners.forEach(cb => cb(e.target.value));
    });
    await this.ftmsControlPoint.startNotifications();
    this.ftmsControlPoint.addEventListener('characteristicvaluechanged', (e: any) => {
      this.controlPointListeners.forEach(cb => cb(e.target.value));
    });
  }

  async disconnect(): Promise<void> {
    await this.server?.disconnect();
    this.server = null;
  }

  async sendCommand(data: ArrayBuffer): Promise<void> {
    if (!this.ftmsControlPoint) throw new Error('Not connected');
    await this.ftmsControlPoint.writeValueWithResponse(data);
  }

  onMetrics(cb: (data: DataView) => void): () => void {
    this.metricsListeners.push(cb);
    return () => { this.metricsListeners = this.metricsListeners.filter(l => l !== cb); };
  }

  onControlPointResponse(cb: (data: DataView) => void): () => void {
    this.controlPointListeners.push(cb);
    return () => { this.controlPointListeners = this.controlPointListeners.filter(l => l !== cb); };
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.push(cb);
    return () => { this.disconnectListeners = this.disconnectListeners.filter(l => l !== cb); };
  }

  onError(cb: (err: string) => void): () => void {
    this.errorListeners.push(cb);
    return () => { this.errorListeners = this.errorListeners.filter(l => l !== cb); };
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/ble-transport.ts src/lib/__tests__/ble-transport.test.ts
git commit -m "feat(ble): add transport interface + WebBleTransport + MockTransport"
```

---

### Task 3: State Machine (`treadmill-machine.ts`)

**Files:**
- Create: `src/lib/treadmill-machine.ts`
- Test: `src/lib/__tests__/treadmill-machine.test.ts`

**Interfaces:**
- Consumes: nothing (pure state machine)
- Produces: `TreadmillState` union type, `MachineEvent` union type, `createMachine()` → `{ send(event): MachineState }`

- [ ] **Step 1: Define states + events + machine**

Types and state machine transitions. Pure function: `(currentState, event) → { state, actions }`.

- [ ] **Step 2: Write failing test**

```typescript
it('transitions DISCONNECTED -> SCANNING on SCAN event', () => {
  const machine = createMachine();
  const result = machine.send('SCAN');
  expect(result.state).toBe('SCANNING');
});

it('transitions SCANNING -> CONNECTING on DEVICE_SELECTED', () => {
  const machine = createMachine();
  machine.send('SCAN');
  const result = machine.send({ type: 'DEVICE_SELECTED', address: '00:11:22:33' });
  expect(result.state).toBe('CONNECTING');
});

it('does nothing on unexpected CONNECT event in SCANNING', () => {
  const machine = createMachine();
  const result = machine.send({ type: 'CONNECTED' }); // no device selected yet
  expect(result.state).toBe('DISCONNECTED');
});
```

- [ ] **Step 3: Implement state machine**

```typescript
export type BleState =
  | 'DISCONNECTED'
  | 'SCANNING'
  | 'CONNECTING'
  | 'DISCOVERING_SERVICES'
  | 'ENABLING_NOTIFICATIONS'
  | 'ENABLING_INDICATIONS'
  | 'REQUESTING_CONTROL'
  | 'CONTROLLED';

export type MachineEvent =
  | { type: 'SCAN' }
  | { type: 'SCAN_CANCELLED' }
  | { type: 'DEVICE_SELECTED'; address: string }
  | { type: 'CONNECTED' }
  | { type: 'SERVICES_DISCOVERED' }
  | { type: 'NOTIFICATIONS_ENABLED' }
  | { type: 'INDICATIONS_ENABLED' }
  | { type: 'CONTROL_ACQUIRED' }
  | { type: 'CONTROL_FAILED' }
  | { type: 'DISCONNECTED' }
  | { type: 'DISCONNECTION_ALERT' }
  | { type: 'ERROR'; message: string };

export interface MachineState {
  state: BleState;
  selectedAddress?: string;
  error?: string;
  actions: MachineAction[];
}

export type MachineAction =
  | { type: 'START_SCAN' }
  | { type: 'STOP_SCAN' }
  | { type: 'CONNECT_TO_DEVICE'; address: string }
  | { type: 'DISCONNECT' }
  | { type: 'SEND_COMMAND'; data: ArrayBuffer }
  | { type: 'SHOW_ALERT'; message: string };

const transitions: Record<BleState, Partial<Record<string, (s: MachineState, e: MachineEvent) => MachineState>>> = {
  DISCONNECTED: {
    SCAN: (s) => ({ state: 'SCANNING', actions: [{ type: 'START_SCAN' }] }),
  },
  SCANNING: {
    SCAN_CANCELLED: (s) => ({ state: 'DISCONNECTED', actions: [{ type: 'STOP_SCAN' }] }),
    DEVICE_SELECTED: (s, e) => ({
      state: 'CONNECTING',
      selectedAddress: (e as any).address,
      actions: [{ type: 'STOP_SCAN' }, { type: 'CONNECT_TO_DEVICE', address: (e as any).address }],
    }),
  },
  CONNECTING: {
    CONNECTED: (s) => ({ ...s, state: 'DISCOVERING_SERVICES' }),
    DISCONNECTED: (s) => ({ state: 'DISCONNECTED', actions: [{ type: 'SHOW_ALERT', message: 'Falha ao conectar' }] }),
  },
  DISCOVERING_SERVICES: {
    SERVICES_DISCOVERED: (s) => ({ ...s, state: 'ENABLING_NOTIFICATIONS' }),
    DISCONNECTED: (s) => ({ state: 'DISCONNECTED' }),
  },
  ENABLING_NOTIFICATIONS: {
    NOTIFICATIONS_ENABLED: (s) => ({ ...s, state: 'ENABLING_INDICATIONS' }),
    DISCONNECTED: (s) => ({ state: 'DISCONNECTED' }),
  },
  ENABLING_INDICATIONS: {
    INDICATIONS_ENABLED: (s) => ({
      ...s,
      state: 'REQUESTING_CONTROL',
      actions: [{ type: 'SEND_COMMAND', data: new Uint8Array([0x00]).buffer }],
    }),
    DISCONNECTED: (s) => ({ state: 'DISCONNECTED' }),
  },
  REQUESTING_CONTROL: {
    CONTROL_ACQUIRED: (s) => ({ ...s, state: 'CONTROLLED' }),
    CONTROL_FAILED: (s) => ({ ...s, state: 'DISCONNECTED', actions: [{ type: 'SHOW_ALERT', message: 'Falha ao obter controle da esteira' }] }),
    DISCONNECTED: (s) => ({ state: 'DISCONNECTED' }),
  },
  CONTROLLED: {
    DISCONNECTED: (s) => ({ state: 'DISCONNECTED', actions: [{ type: 'SHOW_ALERT', message: 'Esteira desconectada' }] }),
    DISCONNECTION_ALERT: (s) => ({ state: 'DISCONNECTED', actions: [{ type: 'SHOW_ALERT', message: 'Esteira desconectada — ajuste manual' }] }),
  },
};

export function createMachine(): { send(event: MachineEvent): MachineState; getState(): BleState } {
  let current: MachineState = { state: 'DISCONNECTED', actions: [] };
  return {
    send(event: MachineEvent): MachineState {
      const handler = transitions[current.state]?.[event.type];
      if (handler) {
        current = handler(current, event);
      }
      return current;
    },
    getState(): BleState {
      return current.state;
    },
  };
}
```

- [ ] **Step 4: Run tests to pass**

`npx vitest run src/lib/__tests__/treadmill-machine.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/treadmill-machine.ts src/lib/__tests__/treadmill-machine.test.ts
git commit -m "feat(ble): add treadmill state machine"
```

---

### Task 4: Android BLE Plugin (Kotlin)

**Files:**
- Create: `android/app/src/main/java/com/correlogo/app/TreadmillFtmsManager.kt`
- Create: `android/app/src/main/java/com/correlogo/app/TreadmillBleService.kt`
- Create: `android/app/src/main/java/com/correlogo/app/TreadmillBlePlugin.kt`
- Modify: `android/app/src/main/java/com/correlogo/app/MainActivity.java`
- Modify: `android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Consumes: Android BLE APIs
- Produces: Capacitor plugin with methods `initBle()`, `startBleScan()`, `stopBleScan()`, `connectTreadmill(address)`, `disconnectTreadmill()`, `setTreadmillSpeed(speed)`, `setTreadmillIncline(incline)`

- [ ] **Step 1: Create TreadmillFtmsManager.kt**

Pure encode-decode matching the JS `ftms-protocol.ts` but in Kotlin:

```kotlin
package com.correlogo.app

class TreadmillFtmsManager {
    fun parseMetrics(data: ByteArray): Map<String, Any> { ... }
    fun encodeSetSpeed(speedKmh: Double): ByteArray { ... }
    fun encodeSetIncline(inclinePercent: Double): ByteArray { ... }
    fun encodeRequestControl(): ByteArray { ... }
    fun encodeReset(): ByteArray { ... }
}
```

- [ ] **Step 2: Create TreadmillBleService.kt**

GATT state machine: callbacks for connection, service discovery, notification enabling, characteristic writes. Keep-alive coroutine (3s timer). Pure state management with `disconnected`, `connecting`, `discovering`, `ready`, `controlled` states.

- [ ] **Step 3: Create TreadmillBlePlugin.kt**

Capacitor plugin exposing:
- `initBle()` → check BT adapter, request enable if needed
- `startBleScan()` → scan for FTMS devices, emit `treadmillScanResult` events per device
- `stopBleScan()` → stop scan
- `connectTreadmill(address)` → connect via TreadmillBleService
- `disconnectTreadmill()` → disconnect
- `setTreadmillSpeed(speed)` → encode + write to control point
- `setTreadmillIncline(incline)` → encode + write to control point
- Emits `treadmillState`, `treadmillMetrics`, `treadmillControlPointResponse`, `treadmillError`, `treadmillScanResult` events

- [ ] **Step 4: Register plugin in MainActivity.java**

Add `registerPlugin(TreadmillBlePlugin.class);` in `load()` method.

- [ ] **Step 5: Add BLE permissions in AndroidManifest.xml**

```xml
<uses-feature android:name="android.hardware.bluetooth_le" android:required="false" />
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

- [ ] **Step 6: Build + verify compilation**

```bash
Copy-Item -Path ".env.apk" -Destination ".env" -Force
npm run build
npx cap sync android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotfix"
cd android && gradlew assembleDebug
```

- [ ] **Step 7: Commit**

```bash
git add android/app/src/main/java/com/correlogo/app/TreadmillFtmsManager.kt
git add android/app/src/main/java/com/correlogo/app/TreadmillBleService.kt
git add android/app/src/main/java/com/correlogo/app/TreadmillBlePlugin.kt
git add android/app/src/main/java/com/correlogo/app/MainActivity.java
git add android/app/src/main/AndroidManifest.xml
git commit -m "feat(ble): add Android BLE FTMS plugin"
```

---

### Task 5: React Hook (`use-treadmill.ts`)

**Files:**
- Create: `src/lib/use-treadmill.ts`

**Interfaces:**
- Consumes: `BleTransport`, `BleDevice`, `MockTransport`, `WebBleTransport` from `ble-transport.ts`; `isNative` from `platform.ts`; `TreadmillMetrics` from `ftms-protocol.ts`
- Produces: `useTreadmill() → { state, connected, devices, metrics, speedKmh, inclinePercent, error, scan, connect, disconnect, setSpeed, setIncline }`

- [ ] **Step 1: Create use-treadmill.ts**

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { isNative } from './capacitor/platform';
import type { BleTransport, BleDevice } from './ble-transport';
import { MockTransport } from './ble-transport';
import type { TreadmillMetrics } from './ftms-protocol';

export interface TreadmillConnection {
  state: string;
  connected: boolean;
  devices: BleDevice[];
  metrics: TreadmillMetrics | null;
  speedKmh: number;
  inclinePercent: number;
  error: string | null;
  scan: () => Promise<void>;
  connect: (address: string) => Promise<void>;
  disconnect: () => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  setIncline: (incline: number) => Promise<void>;
}

function createTransport(): BleTransport {
  if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
    // Web Bluetooth (Chrome)
    return new WebBleTransport();
  }
  // Fallback: mock for development
  return new MockTransport();
}

export function useTreadmill(): TreadmillConnection {
  const [state, setState] = useState<string>('DISCONNECTED');
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [metrics, setMetrics] = useState<TreadmillMetrics | null>(null);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [inclinePercent, setInclinePercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const transportRef = useRef<BleTransport | null>(null);
  const cleanupsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    const transport = createTransport();
    transportRef.current = transport;

    const c1 = transport.onMetrics((data) => {
      try {
        const { parseTreadmillMetrics } = require('./ftms-protocol');
        const m = parseTreadmillMetrics(data);
        setMetrics(m);
        setSpeedKmh(m.instantSpeedKmh);
        if (m.instantaneousInclinePercent !== undefined) {
          setInclinePercent(m.instantaneousInclinePercent);
        }
      } catch {}
    });

    const c2 = transport.onDisconnect(() => {
      setState('DISCONNECTED');
      setMetrics(null);
      setSpeedKmh(0);
    });

    const c3 = transport.onError((msg) => {
      setError(msg);
    });

    cleanupsRef.current = [c1, c2, c3];

    return () => {
      transport.disconnect();
      cleanupsRef.current.forEach(fn => fn());
    };
  }, []);

  const scan = useCallback(async () => {
    setDevices([]);
    setError(null);
    setState('SCANNING');
    try {
      const transport = transportRef.current!;
      await transport.scan((device) => {
        setDevices(prev => {
          if (prev.find(d => d.address === device.address)) return prev;
          return [...prev, device];
        });
      });
    } catch (err: any) {
      setError(err.message);
      setState('DISCONNECTED');
    }
  }, []);

  const connect = useCallback(async (address: string) => {
    setError(null);
    setState('CONNECTING');
    try {
      await transportRef.current!.connect(address);
      setState('CONTROLLED');
    } catch (err: any) {
      setError(err.message);
      setState('DISCONNECTED');
    }
  }, []);

  const disconnect = useCallback(async () => {
    await transportRef.current?.disconnect();
    setState('DISCONNECTED');
    setDevices([]);
    setMetrics(null);
    setSpeedKmh(0);
    setInclinePercent(0);
  }, []);

  const setSpeed = useCallback(async (speed: number) => {
    setSpeedKmh(speed);
    try {
      const { encodeSetSpeed } = await import('./ftms-protocol');
      await transportRef.current?.sendCommand(encodeSetSpeed(speed));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const setIncline = useCallback(async (incline: number) => {
    setInclinePercent(incline);
    try {
      const { encodeSetIncline } = await import('./ftms-protocol');
      await transportRef.current?.sendCommand(encodeSetIncline(incline));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  return {
    state,
    connected: state === 'CONTROLLED',
    devices,
    metrics,
    speedKmh,
    inclinePercent,
    error,
    scan,
    connect,
    disconnect,
    setSpeed,
    setIncline,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/use-treadmill.ts
git commit -m "feat(ble): add useTreadmill hook"
```

---

### Task 6: TreadmillPanel UI

**Files:**
- Create: `src/components/TreadmillPanel.tsx`

**Interfaces:**
- Consumes: `TreadmillConnection` from `use-treadmill.ts`
- Produces: React component with connect button, telemetry display, speed/incline controls

- [ ] **Step 1: Create TreadmillPanel.tsx**

```tsx
import { useState } from 'react';
import { Bluetooth, BluetoothSearching, BluetoothConnected, Plus, Minus, X } from 'lucide-react';
import Button from './Button';
import type { TreadmillConnection } from '../lib/use-treadmill';

interface Props {
  treadmill: TreadmillConnection;
  targetSpeedKmh?: number;
  onSpeedChange?: (speed: number) => void;
  onInclineChange?: (incline: number) => void;
}

export default function TreadmillPanel({ treadmill, targetSpeedKmh, onSpeedChange, onInclineChange }: Props) {
  const [showScan, setShowScan] = useState(false);
  const { state, connected, devices, metrics, speedKmh, error, scan, connect, disconnect, setSpeed, setIncline } = treadmill;
  const isConnecting = state === 'CONNECTING';

  const handleToggleConnect = () => {
    if (connected || isConnecting) {
      disconnect();
      setShowScan(false);
    } else {
      setShowScan(!showScan);
      if (!showScan) scan();
    }
  };

  const handleSpeedDown = () => {
    const newSpeed = Math.max(1, speedKmh - 0.5);
    setSpeed(newSpeed);
    onSpeedChange?.(newSpeed);
  };

  const handleSpeedUp = () => {
    const newSpeed = Math.min(25, speedKmh + 0.5);
    setSpeed(newSpeed);
    onSpeedChange?.(newSpeed);
  };

  const handleInclineDown = () => {
    const newIncline = Math.max(-2, inclinePercent - 0.5);
    setIncline(newIncline);
    onInclineChange?.(newIncline);
  };

  const handleInclineUp = () => {
    const newIncline = Math.min(15, inclinePercent + 0.5);
    setIncline(newIncline);
    onInclineChange?.(newIncline);
  };

  return (
    <div className="bg-bg-elevated rounded-xl p-3 space-y-3">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleToggleConnect}
          className={`flex items-center gap-2 text-sm font-medium ${connected ? 'text-green-400' : isConnecting ? 'text-yellow-400' : 'text-text-secondary'} hover:text-text-primary transition-colors`}
        >
          {connected ? <BluetoothConnected className="w-4 h-4" /> : isConnecting ? <BluetoothSearching className="w-4 h-4 animate-pulse" /> : <Bluetooth className="w-4 h-4" />}
          <span>{connected ? 'Esteira conectada' : isConnecting ? 'Conectando...' : 'Conectar esteira'}</span>
        </button>
        {(connected || isConnecting) && (
          <button onClick={disconnect} className="text-text-secondary hover:text-red-400 transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-danger text-xs">{error}</p>}

      {/* Scan results */}
      {showScan && !connected && (
        <div className="border border-border rounded-lg p-2 max-h-28 overflow-y-auto space-y-1">
          {devices.length === 0 && state === 'SCANNING' && (
            <p className="text-xs text-text-muted animate-pulse">Escaneando...</p>
          )}
          {devices.length === 0 && state === 'DISCONNECTED' && (
            <p className="text-xs text-text-muted">Nenhuma esteira encontrada</p>
          )}
          {devices.map(d => (
            <button
              key={d.address}
              onClick={() => { connect(d.address); setShowScan(false); }}
              className="w-full text-left p-2 rounded bg-bg-surface text-xs hover:bg-bg-elevated transition-colors"
            >
              {d.name} ({d.address})
            </button>
          ))}
        </div>
      )}

      {/* Telemetry */}
      {connected && metrics && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-accent-secondary">{speedKmh.toFixed(1)}</div>
            <div className="text-[9px] text-text-muted uppercase">KM/h</div>
            {targetSpeedKmh !== undefined && (
              <div className="text-[8px] text-text-muted">Alvo: {targetSpeedKmh.toFixed(1)}</div>
            )}
          </div>
          <div>
            <div className="text-lg font-bold">{metrics.totalDistanceMeters ? (metrics.totalDistanceMeters / 1000).toFixed(2) : '0.00'}</div>
            <div className="text-[9px] text-text-muted uppercase">KM</div>
          </div>
          <div>
            <div className="text-lg font-bold">{inclinePercent.toFixed(1)}%</div>
            <div className="text-[9px] text-text-muted uppercase">Inclinação</div>
          </div>
        </div>
      )}

      {/* Speed controls */}
      {connected && (
        <div className="flex items-center justify-between gap-4">
          <button onClick={handleSpeedDown} className="p-2 rounded-lg bg-bg-surface hover:bg-bg-elevated"><Minus size={20} /></button>
          <span className="text-sm font-semibold">{speedKmh.toFixed(1)} km/h</span>
          <button onClick={handleSpeedUp} className="p-2 rounded-lg bg-bg-surface hover:bg-bg-elevated"><Plus size={20} /></button>
        </div>
      )}

      {/* Incline controls */}
      {connected && (
        <div className="flex items-center justify-between gap-4">
          <button onClick={handleInclineDown} className="p-2 rounded-lg bg-bg-surface hover:bg-bg-elevated"><Minus size={20} /></button>
          <span className="text-sm font-semibold">{inclinePercent.toFixed(1)}%</span>
          <button onClick={handleInclineUp} className="p-2 rounded-lg bg-bg-surface hover:bg-bg-elevated"><Plus size={20} /></button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TreadmillPanel.tsx
git commit -m "feat(ble): add TreadmillPanel UI component"
```

---

### Task 7: Integration in WorkoutTracker + App Modal

**Files:**
- Modify: `src/components/WorkoutTracker.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: In App.tsx, add connect option to the workout modal**

In the `workoutToStart` modal (around line 1036), after the "Simular GPS" checkbox, add:

```tsx
{workoutToStart.mode === 'treadmill' && (
  <div className="mt-3 p-3 bg-bg-elevated rounded-lg">
    <button
      onClick={() => { /* could open BLE scanner inline */ }}
      className="flex items-center gap-2 text-sm text-accent-secondary"
    >
      <Bluetooth size={16} />
      Conectar esteira Bluetooth (opcional)
    </button>
    <p className="text-[10px] text-text-muted mt-1">
      Se conectado, a velocidade do treino será ajustada automaticamente
    </p>
  </div>
)}
```

- [ ] **Step 2: In WorkoutTracker.tsx, integrate useTreadmill + panel**

Add import:
```typescript
import TreadmillPanel from './TreadmillPanel';
import { useTreadmill } from '../lib/use-treadmill';
```

Add hook call:
```typescript
const treadmill = useTreadmill();
```

Add speed sync effect (auto-adjust on step transition):
```typescript
// Sync speed to treadmill on step change
const prevStepRef = useRef(currentStepIndex);
useEffect(() => {
  if (prevStepRef.current !== currentStepIndex && treadmill.connected) {
    const step = plan.steps[currentStepIndex];
    if (step?.targetPace && step.targetPace > 0) {
      treadmill.setSpeed(60 / step.targetPace);
    }
  }
  prevStepRef.current = currentStepIndex;
}, [currentStepIndex, treadmill.connected]);
```

Add TreadmillPanel in the JSX after the distance card (before speed controls):
```tsx
{mode === 'treadmill' && (
  <div className="flex-shrink-0 mt-2">
    <TreadmillPanel
      treadmill={treadmill}
      targetSpeedKmh={(() => {
        const step = plan.steps[currentStepIndex];
        return step?.targetPace ? 60 / step.targetPace : undefined;
      })()}
      onSpeedChange={(s) => { setCurrentSpeed(s); speedRef.current = s; }}
      onInclineChange={(i) => { if (treadmill.connected) treadmill.setIncline(i); }}
    />
  </div>
)}
```

Wire the manual speed buttons to also send BLE commands:
```typescript
// In the speed adjust handler
treadmill.connected && treadmill.setSpeed(newValue);
```

- [ ] **Step 3: Build to verify**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/WorkoutTracker.tsx
git commit -m "feat(ble): integrate treadmill BLE in workout flow"
```

---

### Task 8: Build + Smoke Test

- [ ] **Step 1: Full web build**

```bash
Copy-Item -Path ".env.apk" -Destination ".env" -Force
npm run build
```

- [ ] **Step 2: Start web server and test mock flow**

```bash
npm run dev
```

Open localhost:3000, start a treadmill workout, click "Conectar esteira", verify scan shows "Esteira Simulada", connect, verify telemetry appears, verify setSpeed/setIncline work.

- [ ] **Step 3: Android build**

```bash
npx cap sync android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotfix"
cd android && gradlew assembleDebug
```

- [ ] **Step 4: Test APK on device with real FTMS treadmill**

Install APK, connect to Matrix T600x, verify:
- Scan finds the treadmill
- Connect + handshake completes
- Speed/incline commands work
- Telemetry updates in real-time
- Auto-speed on step transition works
- Disconnection alert shows
