import { useState, useEffect, useRef, useCallback } from 'react';
import { registerPlugin } from '@capacitor/core';
import { isNative } from './capacitor/platform';
import type { BleTransport, BleDevice } from './ble-transport';
import { MockTransport } from './ble-transport';
import type { TreadmillMetrics } from './ftms-protocol';

export interface TreadmillBlePlugin {
  initBle(): Promise<void>
  startBleScan(): Promise<void>
  connectTreadmill(options: { address: string }): Promise<void>
  disconnectTreadmill(): Promise<void>
  setTreadmillSpeed(options: { speed: number }): Promise<void>
  setTreadmillIncline(options: { incline: number }): Promise<void>
  addListener(eventName: string, callback: (data: any) => void): Promise<{ remove: () => void }>
  removeAllListeners(): Promise<void>
}

const NativeTreadmillBle = registerPlugin<TreadmillBlePlugin>('TreadmillBle');

export interface TreadmillConnection {
  state: string
  connected: boolean
  devices: BleDevice[]
  metrics: TreadmillMetrics | null
  speedKmh: number
  inclinePercent: number
  error: string | null
  scan: () => Promise<void>
  connect: (address: string) => Promise<void>
  disconnect: () => Promise<void>
  setSpeed: (speed: number) => Promise<void>
  setIncline: (incline: number) => Promise<void>
}

function createTransport(): BleTransport {
  if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
    return new MockTransport();
  }
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
      const { parseTreadmillMetrics } = require('../lib/ftms-protocol');
      const m = parseTreadmillMetrics(data);
      setMetrics(m);
      setSpeedKmh(m.instantSpeedKmh);
      if (m.instantaneousInclinePercent !== undefined) {
        setInclinePercent(m.instantaneousInclinePercent);
      }
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
      const { encodeSetSpeed } = await import('../lib/ftms-protocol');
      await transportRef.current?.sendCommand(encodeSetSpeed(speed));
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const setIncline = useCallback(async (incline: number) => {
    setInclinePercent(incline);
    try {
      const { encodeSetIncline } = await import('../lib/ftms-protocol');
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
