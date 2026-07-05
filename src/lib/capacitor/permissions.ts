import { Capacitor } from '@capacitor/core';
import { Tracking } from './tracking';

export async function requestAllPermissions(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const results: string[] = [];

  try {
    const locResult = await Tracking.requestLocationPermission();
    results.push(`localização: ${locResult.location}`);
  } catch (e) {
    results.push(`localização: erro - ${e}`);
  }

  console.log('[permissions] Resultados:', results.join(', '));
}