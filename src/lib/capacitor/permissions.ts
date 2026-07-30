import { Capacitor, registerPlugin } from '@capacitor/core';
import { Tracking } from './tracking';

interface PermissionsPlugin {
  requestAll(): Promise<{ notifications: string; activity: string }>;
  checkAll(): Promise<{ notifications: string; activity: string }>;
}

interface TreadmillBlePermissionsPlugin {
  requestBlePermissions(): Promise<{ bluetooth: string }>;
}

const Permissions = registerPlugin<PermissionsPlugin>('Permissions');
const TreadmillBle = registerPlugin<TreadmillBlePermissionsPlugin>('TreadmillBle');

export async function requestAllPermissions(): Promise<void> {
  console.log('[permissions] requestAllPermissions called, isNative=', Capacitor.isNativePlatform());
  if (!Capacitor.isNativePlatform()) return;

  const results: string[] = [];

  try {
    console.log('[permissions] requesting location...');
    const loc = await Tracking.requestLocationPermission();
    console.log('[permissions] location result:', loc);
    results.push(`localização: ${loc.location}`);
  } catch (e: any) {
    console.warn('[permissions] local error:', e?.message || e);
    results.push(`localização: erro`);
  }

  try {
    console.log('[permissions] requesting notif+activity...');
    const other = await Permissions.requestAll();
    console.log('[permissions] notif+activity result:', other);
    results.push(`notificações: ${other.notifications}`);
    results.push(`atividade: ${other.activity}`);
  } catch (e: any) {
    console.warn('[permissions] notif/activity error:', e?.message || e);
  }

  try {
    console.log('[permissions] requesting bluetooth...');
    const ble = await TreadmillBle.requestBlePermissions();
    console.log('[permissions] bluetooth result:', ble);
    results.push(`bluetooth: ${ble.bluetooth}`);
  } catch (e: any) {
    console.warn('[permissions] bluetooth error:', e?.message || e);
    results.push(`bluetooth: erro`);
  }

  console.log('[perms] Resultados:', results.join(', '));
}
