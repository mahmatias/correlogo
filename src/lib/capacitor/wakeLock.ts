import { KeepAwake } from '@capacitor-community/keep-awake';
import { isNative } from './platform';

export async function keepAwake() {
  if (isNative()) {
    await KeepAwake.keepAwake();
  } else if ('wakeLock' in navigator) {
    try {
      await (navigator as any).wakeLock.request('screen');
    } catch { /* not supported */ }
  }
}

export async function allowSleep() {
  if (isNative()) {
    await KeepAwake.allowSleep();
  }
}
