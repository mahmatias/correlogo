import { registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

export interface WorkoutExport {
  startTime: number;
  endTime: number;
  durationSeconds: number;
  distanceKm: number;
  exerciseType: 'treadmill' | 'running';
  avgSpeedKmh: number;
  route?: Array<{
    lat: number;
    lng: number;
    altitude?: number;
    timestamp: number;
  }>;
}

export type SyncStatus = 'synced' | 'pending' | 'failed';

interface SamsungHealthPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  getPermissionStatus(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  exportWorkout(options: { workout: WorkoutExport }): Promise<{ success: boolean }>;
}

const SamsungHealth = registerPlugin<SamsungHealthPlugin>('SamsungHealth');

export async function isSamsungHealthAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try { return (await SamsungHealth.isAvailable()).available; }
  catch { return false; }
}

export async function getHealthPermissionStatus(): Promise<boolean> {
  if (!isNative()) return false;
  try { return (await SamsungHealth.getPermissionStatus()).granted; }
  catch { return false; }
}

export async function requestHealthPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try { return (await SamsungHealth.requestPermission()).granted; }
  catch { return false; }
}

export async function exportWorkoutToSamsungHealth(data: WorkoutExport): Promise<{ success: boolean; status: SyncStatus }> {
  if (!isNative()) return { success: false, status: 'failed' };
  try {
    if (!await isSamsungHealthAvailable()) return { success: false, status: 'failed' };
    if (!await getHealthPermissionStatus()) {
      if (!await requestHealthPermission()) return { success: false, status: 'pending' };
    }
    await SamsungHealth.exportWorkout({ workout: data });
    return { success: true, status: 'synced' };
  } catch (e) {
    console.warn('[samsung-health] export failed:', e);
    return { success: false, status: 'pending' };
  }
}
