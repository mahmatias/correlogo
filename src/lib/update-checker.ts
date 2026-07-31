import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { ApkInstaller } from './capacitor/apk-installer';

export interface UpdateInfo {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
}

export type VersionStatus = 'outdated' | 'current' | 'prerelease';

const MANIFEST_URL = 'https://github.com/mahmatias/correlogo/releases/download/latest/update-manifest.json';
const FETCH_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;

export async function checkForUpdate(currentVersionCode: number): Promise<UpdateInfo | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const resp = await fetch(MANIFEST_URL, {
        signal: controller.signal,
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        if (attempt < MAX_RETRIES - 1) {
          await backoff(attempt);
          continue;
        }
        return null;
      }

      const manifest: UpdateInfo = await resp.json();

      if (typeof manifest.versionCode !== 'number' || typeof manifest.downloadUrl !== 'string') {
        return null;
      }

      if (manifest.versionCode > currentVersionCode) return manifest;
      return null;
    } catch {
      if (attempt < MAX_RETRIES - 1) {
        await backoff(attempt);
        continue;
      }
      return null;
    }
  }
  return null;
}

export function getVersionStatus(current: number, manifest: number): VersionStatus {
  if (manifest > current) return 'outdated';
  if (manifest === current) return 'current';
  return 'prerelease';
}

export async function downloadApkAndInstall(
  update: UpdateInfo,
  onProgress?: (percent: number) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const fileName = `correlogo-${update.versionCode}.apk`;
  const resp = await fetch(update.downloadUrl);
  if (!resp.ok) throw new Error(`Erro ao baixar APK: ${resp.status}`);

  let blob: Blob;
  const total = parseInt(resp.headers.get('content-length') || '0');
  if (total > 0 && resp.body) {
    const reader = resp.body.getReader();
    const chunks: Uint8Array[] = [];
    let downloaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      downloaded += value.length;
      onProgress?.(Math.round((downloaded / total) * 100));
    }
    blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
  } else {
    blob = await resp.blob();
  }

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
  const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
  await ApkInstaller.installApk({ filePath: uri });
}

function backoff(attempt: number): Promise<void> {
  const delay = 1000 * Math.pow(2, attempt);
  return new Promise(r => setTimeout(r, delay));
}
