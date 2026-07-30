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

export type MachineAction =
  | { type: 'START_SCAN' }
  | { type: 'STOP_SCAN' }
  | { type: 'CONNECT_TO_DEVICE'; address: string }
  | { type: 'DISCONNECT' }
  | { type: 'SEND_COMMAND'; data: ArrayBuffer }
  | { type: 'SHOW_ALERT'; message: string };

export interface MachineState {
  state: BleState;
  actions: MachineAction[];
  selectedAddress?: string;
  error?: string;
}

type TransitionFn = (state: MachineState, event: MachineEvent) => MachineState;
type TransitionMap = Partial<Record<string, TransitionFn>>;
type Transitions = Record<BleState, TransitionMap>;

const transitions: Transitions = {
  DISCONNECTED: {
    SCAN: (s) => ({ state: 'SCANNING', actions: [{ type: 'START_SCAN' }] }),
  },
  SCANNING: {
    SCAN_CANCELLED: (s) => ({ state: 'DISCONNECTED', actions: [{ type: 'STOP_SCAN' }] }),
    DEVICE_SELECTED: (s, e) => {
      const event = e as Extract<MachineEvent, { type: 'DEVICE_SELECTED' }>;
      return {
        state: 'CONNECTING',
        selectedAddress: event.address,
        actions: [{ type: 'STOP_SCAN' }, { type: 'CONNECT_TO_DEVICE', address: event.address }],
      };
    },
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
    CONTROL_FAILED: (s) => ({
      state: 'DISCONNECTED',
      actions: [{ type: 'SHOW_ALERT', message: 'Falha ao obter controle da esteira' }],
    }),
    DISCONNECTED: (s) => ({ state: 'DISCONNECTED' }),
  },
  CONTROLLED: {
    DISCONNECTED: (s) => ({ state: 'DISCONNECTED', actions: [{ type: 'SHOW_ALERT', message: 'Esteira desconectada' }] }),
    DISCONNECTION_ALERT: (s) => ({
      state: 'DISCONNECTED',
      actions: [{ type: 'SHOW_ALERT', message: 'Esteira desconectada — ajuste manual' }],
    }),
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
