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
  startTracking(): Promise<void>;
  stopTracking(): Promise<void>;
  getStepCount(): Promise<{ steps: number }>;
  addListener(eventName: 'locationUpdate', listener: (data: LocationUpdate) => void): Promise<void>;
  addListener(eventName: 'stepUpdate', listener: (data: StepUpdate) => void): Promise<void>;
  removeAllListeners(): Promise<void>;
}

const Tracking = registerPlugin<TrackingPlugin>('Tracking');

export type TrackCallback = (point: { lat: number; lng: number; timestamp: number; steps?: number }) => void;

export async function startTracking(onPosition: TrackCallback): Promise<{ stop: () => void }> {
  if (isNative()) {
    const permResult = await Tracking.requestLocationPermission();
    if (permResult.location !== 'granted') {
      throw new Error('Permissão de localização não concedida');
    }
    await Tracking.startTracking();

    Tracking.addListener('locationUpdate', (data) => {
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
