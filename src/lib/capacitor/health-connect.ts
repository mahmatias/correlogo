import { registerPlugin } from '@capacitor/core';
import { isNative } from './platform';
import type { WatchWorkout } from '../../types';

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

interface HealthConnectPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  checkHcPermissions(): Promise<{ granted: boolean }>;
  requestHcPermissions(): Promise<{ granted: boolean }>;
  checkReadPermissions(): Promise<{ granted: boolean }>;
  requestReadPermissions(): Promise<{ granted: boolean }>;
  readWorkouts(options: { startMs: number; endMs: number }): Promise<{ workouts: WatchWorkout[] }>;
  exportWorkout(options: { workout: WorkoutExport }): Promise<{ success: boolean }>;
}

const HealthConnect = registerPlugin<HealthConnectPlugin>('HealthConnect');

export async function isHealthConnectAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try { return (await HealthConnect.isAvailable()).available; }
  catch { return false; }
}

export async function checkHealthPermissions(): Promise<boolean | null> {
  if (!isNative()) return null;
  try { return (await HealthConnect.checkHcPermissions()).granted; }
  catch { return null; }
}

export async function requestHealthPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try { return (await HealthConnect.requestHcPermissions()).granted; }
  catch { return false; }
}

export async function exportWorkoutToHealthConnect(data: WorkoutExport): Promise<{ success: boolean; status: SyncStatus; error?: string }> {
  if (!isNative()) return { success: false, status: 'failed' };
  try {
    const available = await isHealthConnectAvailable();
    if (!available) return { success: false, status: 'failed' };
    await HealthConnect.exportWorkout({ workout: data });
    return { success: true, status: 'synced' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[health-connect] export failed:', msg);
    return { success: false, status: 'pending', error: msg };
  }
}

export async function checkReadHealthPermissions(): Promise<boolean | null> {
  if (!isNative()) return null;
  try { return (await HealthConnect.checkReadPermissions()).granted; }
  catch { return null; }
}

export async function requestReadHealthPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try { return (await HealthConnect.requestReadPermissions()).granted; }
  catch { return false; }
}

export async function readWorkoutsFromHealthConnect(startMs: number, endMs: number): Promise<WatchWorkout[]> {
  if (!isNative()) return [];
  try {
    const available = await isHealthConnectAvailable();
    if (!available) return [];
    const res = await HealthConnect.readWorkouts({ startMs, endMs });
    return (res.workouts || []) as WatchWorkout[];
  } catch (e) {
    console.warn('[health-connect] readWorkouts failed:', e);
    return [];
  }
}
