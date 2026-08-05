import { describe, it, expect, vi } from 'vitest';
import { MockTransport } from '../ble-transport';
import { parseTreadmillMetrics, encodeSetSpeed, encodeSetIncline } from '../ftms-protocol';

describe('MockTransport', () => {
  it('emits a device during scan', async () => {
    const transport = new MockTransport();
    const device = await new Promise<any>(resolve => {
      transport.scan(d => resolve(d));
    });
    expect(device.name).toContain('Esteira Simulada');
    expect(device.address).toBe('00:11:22:33:44:55');
  });

  it('starts emitting metrics after connect', async () => {
    const transport = new MockTransport();
    const metrics = await new Promise<any>(resolve => {
      transport.onMetrics(data => resolve(data));
      transport.connect('00:11:22:33:44:55');
    });
    const parsed = parseTreadmillMetrics(metrics);
    expect(typeof parsed.instantSpeedKmh).toBe('number');
  });

  it('applies speed command and emits control point response', async () => {
    const transport = new MockTransport();
    await transport.connect('00:11:22:33:44:55');

    const cpResponse = await new Promise<any>(resolve => {
      transport.onControlPointResponse(data => resolve(data));
      transport.sendCommand(encodeSetSpeed(8.0));
    });
    expect(cpResponse.getUint8(0)).toBe(0x80);
    expect(cpResponse.getUint8(1)).toBe(0x02);
    expect(cpResponse.getUint8(2)).toBe(0x00);
  });

  it('reflects set speed in subsequent metrics', async () => {
    const transport = new MockTransport();
    await transport.connect('00:11:22:33:44:55');

    await transport.sendCommand(encodeSetSpeed(8.0));

    await new Promise(r => setTimeout(r, 150));

    const metrics = await new Promise<any>(resolve => {
      transport.onMetrics(data => resolve(data));
    });
    const parsed = parseTreadmillMetrics(metrics);
    expect(parsed.instantSpeedKmh).toBe(8.0);
  });

  it('reflects set incline in subsequent metrics', async () => {
    const transport = new MockTransport();
    await transport.connect('00:11:22:33:44:55');

    await transport.sendCommand(encodeSetIncline(3.0));

    await new Promise(r => setTimeout(r, 150));

    const metrics = await new Promise<any>(resolve => {
      transport.onMetrics(data => resolve(data));
    });
    const parsed = parseTreadmillMetrics(metrics);
    expect(parsed.instantaneousInclinePercent).toBe(3.0);
  });

  it('fires disconnect listeners on disconnect', async () => {
    const transport = new MockTransport();
    await transport.connect('00:11:22:33:44:55');

    const disconnectSpy = vi.fn();
    transport.onDisconnect(disconnectSpy);
    await transport.disconnect();

    expect(disconnectSpy).toHaveBeenCalledOnce();
  });

  it('cleanup functions remove listeners', () => {
    const transport = new MockTransport();
    const spy = vi.fn();
    const cleanup = transport.onMetrics(spy);
    cleanup();
    expect((transport as any).metricsListeners.length).toBe(0);
  });
});
