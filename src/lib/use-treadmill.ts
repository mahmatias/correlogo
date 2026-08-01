import { useState, useEffect, useRef, useCallback } from 'react';
import { isNative } from './capacitor/platform';
import type { BleTransport, BleDevice } from './ble-transport';
import { MockTransport } from './ble-transport';
import { NativeBleTransport } from './native-ble-transport';
import { parseTreadmillMetrics, encodeSetSpeed, encodeSetIncline } from './ftms-protocol';
import type { TreadmillMetrics } from './ftms-protocol';

export interface TreadmillConnection {
  state: string
  connected: boolean
  devices: BleDevice[]
  connectedDeviceName: string | null
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

export function useTreadmill(simulateBle?: boolean): TreadmillConnection {
  const [state, setState] = useState<string>('DISCONNECTED');
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [metrics, setMetrics] = useState<TreadmillMetrics | null>(null);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [inclinePercent, setInclinePercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  const transportRef = useRef<BleTransport | null>(null);
  const cleanupsRef = useRef<Array<() => void>>([]);
  const devicesRef = useRef<BleDevice[]>([]);
  const simulateRef = useRef(simulateBle);
  const transportTypeRef = useRef<'mock' | 'native'>(!isNative() ? 'mock' : 'native');

  simulateRef.current = simulateBle;

  const ensureTransport = useCallback(() => {
    const useMock = !isNative() || simulateRef.current;
    const desiredType: 'mock' | 'native' = useMock ? 'mock' : 'native';

    if (transportRef.current && transportTypeRef.current === desiredType) {
      return transportRef.current;
    }
    if (transportRef.current) {
      transportRef.current.disconnect();
      cleanupsRef.current.forEach(fn => fn());
    }
    transportTypeRef.current = desiredType;
    const transport: BleTransport = useMock ? new MockTransport() : new NativeBleTransport();
    transportRef.current = transport;

    const c1 = transport.onMetrics((data) => {
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
      setConnectedDeviceName(null);
    });

    const c3 = transport.onError((msg) => {
      setError(msg);
    });

    cleanupsRef.current = [c1, c2, c3];
    return transport;
  }, [simulateBle]);

  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScanTimeout = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearScanTimeout();
      transportRef.current?.disconnect();
      cleanupsRef.current.forEach(fn => fn());
    };
  }, [clearScanTimeout]);

  const scan = useCallback(async () => {
    setDevices([]);
    setError(null);
    setState('SCANNING');
    clearScanTimeout();
    // Caso o plugin nativo não emita um evento "scan finished", manter o estado SCANNING visível
    // até o timeout nativo (15s em TreadmillBleService.startScan) + pequena margem.
    scanTimeoutRef.current = setTimeout(() => {
      if (transportTypeRef.current) {
        setState('DISCONNECTED');
      }
    }, 16000);
    try {
      const transport = ensureTransport();
      await transport.scan((device) => {
        setDevices(prev => {
          if (prev.find(d => d.address === device.address)) return prev;
          const next = [...prev, device];
          devicesRef.current = next;
          return next;
        });
      });
      // Permanece em SCANNING — o plugin nativo continua escaneando até o timeout interno.
    } catch (err: any) {
      clearScanTimeout();
      setError(err.message);
      setState('DISCONNECTED');
    }
  }, [ensureTransport, clearScanTimeout]);

  const connect = useCallback(async (address: string) => {
    clearScanTimeout();
    setError(null);
    setState('CONNECTING');
    try {
      await ensureTransport().connect(address);
      const dev = devicesRef.current.find(d => d.address === address);
      setConnectedDeviceName(dev?.name ?? address);
      setState('CONTROLLED');
    } catch (err: any) {
      setError(err.message);
      setState('DISCONNECTED');
    }
  }, [ensureTransport, clearScanTimeout]);

  const disconnect = useCallback(async () => {
    clearScanTimeout();
    await ensureTransport().disconnect();
    setState('DISCONNECTED');
    setDevices([]);
    setMetrics(null);
    setSpeedKmh(0);
    setInclinePercent(0);
    setConnectedDeviceName(null);
  }, [ensureTransport, clearScanTimeout]);

  const setSpeed = useCallback(async (speed: number) => {
    setSpeedKmh(speed);
    try {
      await ensureTransport().sendCommand(encodeSetSpeed(speed));
    } catch (err: any) {
      setError(err.message);
    }
  }, [ensureTransport]);

  const setIncline = useCallback(async (incline: number) => {
    setInclinePercent(incline);
    try {
      await ensureTransport().sendCommand(encodeSetIncline(incline));
    } catch (err: any) {
      setError(err.message);
    }
  }, [ensureTransport]);

  return {
    state,
    connected: state === 'CONTROLLED',
    devices,
    connectedDeviceName,
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
