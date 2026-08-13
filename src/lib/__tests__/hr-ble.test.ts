import { describe, it, expect, vi } from 'vitest';
import { MockHrTransport } from '../hr-ble';

describe('MockHrTransport', () => {
  it('emite uma cinta durante o scan', async () => {
    const t = new MockHrTransport();
    const device = await new Promise<any>(resolve => t.scan(d => resolve(d)));
    expect(device.name).toContain('Cinta Simulada');
    expect(device.address).toBe('00:11:22:33:44:66');
  });

  it('emite amostras com bpm válido após connect', async () => {
    const t = new MockHrTransport();
    const sample = await new Promise<any>(resolve => {
      t.onSample(s => resolve(s));
      t.connect('00:11:22:33:44:66');
    });
    expect(sample.bpm).toBeGreaterThan(0);
    expect(sample.bpm).toBeLessThan(240);
    expect(typeof sample.timestamp).toBe('number');
  });

  it('dispara listeners de disconnect', async () => {
    const t = new MockHrTransport();
    await t.connect('00:11:22:33:44:66');
    const spy = vi.fn();
    t.onDisconnect(spy);
    await t.disconnect();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('cleanup remove listeners', () => {
    const t = new MockHrTransport();
    const spy = vi.fn();
    const cleanup = t.onSample(spy);
    cleanup();
    expect((t as any).sampleListeners.length).toBe(0);
  });
});
