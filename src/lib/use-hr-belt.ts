import { useState, useEffect, useRef, useCallback } from 'react';
import type { HrBleTransport, HrDevice, HrSample } from './hr-ble';
import { createHrTransport } from './hr-ble';

export type HrBeltState = 'DISCONNECTED' | 'SCANNING' | 'CONNECTING' | 'CONNECTED';

export interface HrBeltConnection {
  state: HrBeltState;
  connected: boolean;
  devices: HrDevice[];
  bpm: number | null;
  error: string | null;
  lastConnectedDevice: HrDevice | null;
  scan: () => Promise<void>;
  connect: (address: string, name?: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

interface UseHrBeltOptions {
  registeredDevice?: { name: string; address: string } | null;
  onDeviceRegistered?: (device: { name: string; address: string }) => void;
}

export function useHrBelt(options?: UseHrBeltOptions): HrBeltConnection {
  const [state, setState] = useState<HrBeltState>('DISCONNECTED');
  const [devices, setDevices] = useState<HrDevice[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastConnectedDevice, setLastConnectedDevice] = useState<HrDevice | null>(null);
  const transportRef = useRef<HrBleTransport | null>(null);
  const cleanupsRef = useRef<Array<() => void>>([]);
  const autoConnectAttemptedRef = useRef(false);

  const ensureTransport = useCallback(() => {
    if (transportRef.current) return transportRef.current;
    const transport = createHrTransport();
    transportRef.current = transport;
    const c1 = transport.onSample((s: HrSample) => setBpm(s.bpm));
    const c2 = transport.onDisconnect(() => {
      setState('DISCONNECTED');
      setBpm(null);
    });
    const c3 = transport.onError((msg) => setError(msg));
    cleanupsRef.current = [c1, c2, c3];
    return transport;
  }, []);

  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearScanTimeout = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearScanTimeout();
    transportRef.current?.disconnect();
    cleanupsRef.current.forEach(fn => fn());
  }, [clearScanTimeout]);

  const scan = useCallback(async () => {
    setDevices([]);
    setError(null);
    setState('SCANNING');
    clearScanTimeout();
    scanTimeoutRef.current = setTimeout(() => setState('DISCONNECTED'), 16000);
    try {
      await ensureTransport().scan((device) => {
        setDevices(prev => {
          if (prev.find(d => d.address === device.address)) return prev;
          return [...prev, device];
        });
      });
    } catch (err: any) {
      clearScanTimeout();
      setError(err.message);
      setState('DISCONNECTED');
    }
  }, [ensureTransport, clearScanTimeout]);

  const connect = useCallback(async (address: string, name?: string) => {
    clearScanTimeout();
    setError(null);
    setState('CONNECTING');
    try {
      await ensureTransport().connect(address);
      setState('CONNECTED');
      const device = { name: name ?? address, address };
      setLastConnectedDevice(device);
      options?.onDeviceRegistered?.(device);
    } catch (err: any) {
      setError(err.message);
      setState('DISCONNECTED');
    }
  }, [ensureTransport, clearScanTimeout, options]);

  const disconnect = useCallback(async () => {
    clearScanTimeout();
    await ensureTransport().disconnect();
    setState('DISCONNECTED');
    setDevices([]);
    setBpm(null);
    setError(null);
  }, [ensureTransport, clearScanTimeout]);

  // Auto-connect to registered device on first mount
  useEffect(() => {
    if (autoConnectAttemptedRef.current) return;
    if (options?.registeredDevice && state === 'DISCONNECTED') {
      autoConnectAttemptedRef.current = true;
      connect(options.registeredDevice.address, options.registeredDevice.name);
    }
  }, [options?.registeredDevice, state, connect]);

  return {
    state,
    connected: state === 'CONNECTED',
    devices,
    bpm,
    error,
    lastConnectedDevice,
    scan,
    connect,
    disconnect,
  };
}
