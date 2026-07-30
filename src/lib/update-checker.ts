import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { ApkInstaller } from './capacitor/apk-installer';

export interface UpdateInfo {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
}

const MANIFEST_URL = 'https://github.com/mahmatias/correlogo/releases/download/latest/update-manifest.json';

export async function checkForUpdate(currentVersionCode: number): Promise<UpdateInfo | null> {
  try {
    const resp = await fetch(MANIFEST_URL, { cache: 'no-cache' });
    if (!resp.ok) return null;
    const manifest: UpdateInfo = await resp.json();
    if (manifest.versionCode > currentVersionCode) return manifest;
    return null;
  } catch {
    return null;
  }
}

export async function downloadApkAndInstall(update: UpdateInfo): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const fileName = `correlogo-${update.versionCode}.apk`;
  const resp = await fetch(update.downloadUrl);
  if (!resp.ok) throw new Error(`Erro ao baixar APK: ${resp.status}`);
  const blob = await resp.blob();
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
