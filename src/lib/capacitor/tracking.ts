import { registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  timestamp: number;
  steps?: number;
}

export interface StepUpdate {
  steps: number;
}

export interface TrackingPlugin {
  requestLocationPermission(): Promise<{ location: string }>;
  checkLocationPermissions(): Promise<{ location: string; background: string }>;
  requestBackgroundLocationPermission(): Promise<{ background: string }>;
  startTracking(): Promise<void>;
  stopTracking(): Promise<void>;
  startKeepAlive(): Promise<void>;
  stopKeepAlive(): Promise<void>;
  startTimer(options: { elapsedSeconds: number }): Promise<void>;
  pauseTimer(): Promise<void>;
  resumeTimer(): Promise<void>;
  stopTimer(): Promise<void>;
  openAppSettings(): Promise<void>;
  getStepCount(): Promise<{ steps: number }>;
  addListener(eventName: 'locationUpdate', listener: (data: LocationUpdate) => void): Promise<void>;
  addListener(eventName: 'stepUpdate', listener: (data: StepUpdate) => void): Promise<void>;
  addListener(eventName: 'timerTick', listener: (data: { elapsed: number }) => void): Promise<void>;
  removeAllListeners(): Promise<void>;
}

export const Tracking = registerPlugin<TrackingPlugin>('Tracking');

export type TrackCallback = (point: { lat: number; lng: number; timestamp: number; steps?: number }) => void;

export async function startTracking(onPosition: TrackCallback): Promise<{ stop: () => void }> {
  if (isNative()) {
    console.log('[tracking] startTracking called (native)');
    // First check current permission state
    let status = await Tracking.checkLocationPermissions();
    console.log('[tracking] initial permission status:', status);
    if (status.location !== 'granted') {
      console.log('[tracking] requesting location permission...');
      const permResult = await Tracking.requestLocationPermission();
      console.log('[tracking] location permission result:', permResult);
      if (permResult.location !== 'granted') {
        throw new Error('Permissão de localização não concedida. Ative em Configurações → Aplicativos → Corre Logo → Permissões → Localização.');
      }
      // Re-check after asking
      status = await Tracking.checkLocationPermissions();
    }
    if (status.location !== 'granted') {
      throw new Error('Permissão de localização negada. Ative manualmente em Configurações do Android.');
    }

    try {
      if (status.background !== 'granted') {
        console.log('[tracking] requesting background location permission...');
        await Tracking.requestBackgroundLocationPermission();
      }
    } catch (e) {
      console.warn('[tracking] Background location not granted, tracking may stop when minimized:', e);
    }

    console.log('[tracking] calling startTracking native...');
    await Tracking.startTracking();
    console.log('[tracking] startTracking native resolved');

    await Tracking.addListener('locationUpdate', (data) => {
      onPosition({
        lat: data.latitude,
        lng: data.longitude,
        timestamp: data.timestamp,
        steps: data.steps,
      });
    });

    return {
      stop: async () => {
        await Tracking.stopTracking();
        await Tracking.removeAllListeners();
      },
    };
  }

  let cleanup: (() => void) | null = null;

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      onPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: pos.coords.timestamp,
      });
    },
    (err) => console.error(err),
    { enableHighAccuracy: true },
  );

  cleanup = () => navigator.geolocation.clearWatch(watchId);

  return {
    stop: () => {
      if (cleanup) cleanup();
    },
  };
}

export async function startKeepAlive(): Promise<void> {
  if (!isNative()) return;
  try {
    await Tracking.startKeepAlive();
  } catch (e) {
    console.warn('[tracking] startKeepAlive failed:', e);
  }
}

export async function stopKeepAlive(): Promise<void> {
  if (!isNative()) return;
  try {
    await Tracking.stopKeepAlive();
  } catch (e) {
    console.warn('[tracking] stopKeepAlive failed:', e);
  }
}

export async function startNativeTimer(elapsedSeconds: number): Promise<void> {
  if (!isNative()) return;
  try {
    await Tracking.startTimer({ elapsedSeconds });
  } catch (e) {
    console.warn('[tracking] startTimer failed:', e);
  }
}

export async function pauseNativeTimer(): Promise<void> {
  if (!isNative()) return;
  try {
    await Tracking.pauseTimer();
  } catch (e) {
    console.warn('[tracking] pauseTimer failed:', e);
  }
}

export async function resumeNativeTimer(): Promise<void> {
  if (!isNative()) return;
  try {
    await Tracking.resumeTimer();
  } catch (e) {
    console.warn('[tracking] resumeTimer failed:', e);
  }
}

export async function stopNativeTimer(): Promise<void> {
  if (!isNative()) return;
  try {
    await Tracking.stopTimer();
  } catch (e) {
    console.warn('[tracking] stopTimer failed:', e);
  }
}

export function onTimerTick(callback: (elapsed: number) => void): Promise<import('@capacitor/core').PluginListenerHandle> | null {
  if (!isNative()) return null;
  return Tracking.addListener('timerTick', (data) => callback(data.elapsed));
}
