import { describe, it, expect } from 'vitest';
import { createMachine } from '../treadmill-machine';

describe('treadmill state machine', () => {
  it('starts in DISCONNECTED state', () => {
    const machine = createMachine();
    expect(machine.getState()).toBe('DISCONNECTED');
  });

  it('transitions DISCONNECTED -> SCANNING on SCAN event', () => {
    const machine = createMachine();
    const result = machine.send({ type: 'SCAN' });
    expect(result.state).toBe('SCANNING');
    expect(result.actions).toEqual([{ type: 'START_SCAN' }]);
  });

  it('transitions SCANNING -> CONNECTING on DEVICE_SELECTED', () => {
    const machine = createMachine();
    machine.send({ type: 'SCAN' });
    const result = machine.send({ type: 'DEVICE_SELECTED', address: '00:11:22:33' });
    expect(result.state).toBe('CONNECTING');
    expect(result.selectedAddress).toBe('00:11:22:33');
    expect(result.actions).toContainEqual({ type: 'STOP_SCAN' });
    expect(result.actions).toContainEqual({ type: 'CONNECT_TO_DEVICE', address: '00:11:22:33' });
  });

  it('does nothing on unexpected event CONNECTED in DISCONNECTED', () => {
    const machine = createMachine();
    const result = machine.send({ type: 'CONNECTED' });
    expect(result.state).toBe('DISCONNECTED');
  });

  it('runs full connection handshake', () => {
    const machine = createMachine();
    machine.send({ type: 'SCAN' });
    machine.send({ type: 'DEVICE_SELECTED', address: '00:11:22:33' });
    machine.send({ type: 'CONNECTED' });
    expect(machine.getState()).toBe('DISCOVERING_SERVICES');
    machine.send({ type: 'SERVICES_DISCOVERED' });
    expect(machine.getState()).toBe('ENABLING_NOTIFICATIONS');
    machine.send({ type: 'NOTIFICATIONS_ENABLED' });
    expect(machine.getState()).toBe('ENABLING_INDICATIONS');
    const result = machine.send({ type: 'INDICATIONS_ENABLED' });
    expect(result.state).toBe('REQUESTING_CONTROL');
    expect(result.actions).toContainEqual({ type: 'SEND_COMMAND', data: expect.any(ArrayBuffer) });
    machine.send({ type: 'CONTROL_ACQUIRED' });
    expect(machine.getState()).toBe('CONTROLLED');
  });

  it('transitions CONTROLLED -> DISCONNECTED on disconnect', () => {
    const machine = createMachine();
    machine.send({ type: 'SCAN' });
    machine.send({ type: 'DEVICE_SELECTED', address: '00:11:22:33' });
    machine.send({ type: 'CONNECTED' });
    machine.send({ type: 'SERVICES_DISCOVERED' });
    machine.send({ type: 'NOTIFICATIONS_ENABLED' });
    machine.send({ type: 'INDICATIONS_ENABLED' });
    machine.send({ type: 'CONTROL_ACQUIRED' });
    expect(machine.getState()).toBe('CONTROLLED');

    const result = machine.send({ type: 'DISCONNECTED' });
    expect(result.state).toBe('DISCONNECTED');
    expect(result.actions).toContainEqual({ type: 'SHOW_ALERT', message: 'Esteira desconectada' });
  });

  it('transitions CONTROLLED -> DISCONNECTED on disconnection alert', () => {
    const machine = createMachine();
    machine.send({ type: 'SCAN' });
    machine.send({ type: 'DEVICE_SELECTED', address: '00:11:22:33' });
    machine.send({ type: 'CONNECTED' });
    machine.send({ type: 'SERVICES_DISCOVERED' });
    machine.send({ type: 'NOTIFICATIONS_ENABLED' });
    machine.send({ type: 'INDICATIONS_ENABLED' });
    machine.send({ type: 'CONTROL_ACQUIRED' });
    expect(machine.getState()).toBe('CONTROLLED');

    const result = machine.send({ type: 'DISCONNECTION_ALERT' });
    expect(result.state).toBe('DISCONNECTED');
    expect(result.actions).toContainEqual({
      type: 'SHOW_ALERT',
      message: expect.stringContaining('ajuste manual'),
    });
  });

  it('handles connection failure', () => {
    const machine = createMachine();
    machine.send({ type: 'SCAN' });
    machine.send({ type: 'DEVICE_SELECTED', address: '00:11:22:33' });
    const result = machine.send({ type: 'DISCONNECTED' });
    expect(result.state).toBe('DISCONNECTED');
    expect(result.actions).toContainEqual({ type: 'SHOW_ALERT', message: 'Falha ao conectar' });
  });

  it('transitions SCANNING -> DISCONNECTED on cancel', () => {
    const machine = createMachine();
    machine.send({ type: 'SCAN' });
    const result = machine.send({ type: 'SCAN_CANCELLED' });
    expect(result.state).toBe('DISCONNECTED');
    expect(result.actions).toContainEqual({ type: 'STOP_SCAN' });
  });
});
