import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { ApkInstaller } from './capacitor/apk-installer';

export interface UpdateInfo {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
}

export interface UpdateCheckResult {
  update: UpdateInfo | null;
  error?: string;
}

export type VersionStatus = 'outdated' | 'current' | 'prerelease';

const MANIFEST_URL_BASE = 'https://github.com/mahmatias/correlogo/releases/download/latest/update-manifest.json';
const FETCH_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;
const CONNECT_TIMEOUT_MS = 10000;
const MANIFEST_READ_TIMEOUT_MS = 15000;
const APK_READ_TIMEOUT_MS = 300000;

export async function checkForUpdate(currentVersionCode: number): Promise<UpdateCheckResult> {
  const manifestUrl = `${MANIFEST_URL_BASE}?v=${Date.now()}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      let status: number;
      let text: string;

      if (Capacitor.isNativePlatform()) {
        const resp = await CapacitorHttp.get({
          url: manifestUrl,
          responseType: 'text',
          connectTimeout: CONNECT_TIMEOUT_MS,
          readTimeout: MANIFEST_READ_TIMEOUT_MS,
        });
        status = resp.status;
        text = resp.data as string;
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
          const resp = await fetch(manifestUrl, { signal: controller.signal, cache: 'no-store' });
          status = resp.status;
          text = await resp.text();
        } finally {
          clearTimeout(timeoutId);
        }
      }

      if (status < 200 || status >= 300) {
        if (attempt < MAX_RETRIES - 1) {
          await backoff(attempt);
          continue;
        }
        return { update: null, error: `Manifest HTTP ${status}` };
      }

      const manifest: UpdateInfo = JSON.parse(text);

      if (typeof manifest.versionCode !== 'number' || typeof manifest.downloadUrl !== 'string') {
        return { update: null, error: 'Manifest inválido' };
      }

      if (manifest.versionCode > currentVersionCode) return { update: manifest };
      return { update: null };
    } catch (err) {
      if (attempt < MAX_RETRIES - 1) {
        await backoff(attempt);
        continue;
      }
      return { update: null, error: err instanceof Error ? err.message : 'Falha na rede' };
    }
  }
  return { update: null, error: 'Falha na rede' };
}

export function getVersionStatus(current: number, manifest: number): VersionStatus {
  if (manifest > current) return 'outdated';
  if (manifest === current) return 'current';
  return 'prerelease';
}

export async function downloadApkAndInstall(
  update: UpdateInfo,
  _onProgress?: (percent: number) => void
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const fileName = `correlogo-${update.versionCode}.apk`;
  const resp = await CapacitorHttp.get({
    url: update.downloadUrl,
    responseType: 'blob',
    connectTimeout: CONNECT_TIMEOUT_MS,
    readTimeout: APK_READ_TIMEOUT_MS,
  });
  if (resp.status < 200 || resp.status >= 300) throw new Error(`Erro ao baixar APK: ${resp.status}`);
  const base64 = resp.data as string;
  await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
  const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
  await ApkInstaller.installApk({ filePath: uri });
}

function backoff(attempt: number): Promise<void> {
  const delay = 1000 * Math.pow(2, attempt);
  return new Promise(r => setTimeout(r, delay));
}
