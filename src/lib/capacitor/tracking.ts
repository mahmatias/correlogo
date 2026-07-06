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
  openAppSettings(): Promise<void>;
  getStepCount(): Promise<{ steps: number }>;
  addListener(eventName: 'locationUpdate', listener: (data: LocationUpdate) => void): Promise<void>;
  addListener(eventName: 'stepUpdate', listener: (data: StepUpdate) => void): Promise<void>;
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
