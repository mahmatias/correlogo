import { registerPlugin, Capacitor } from '@capacitor/core';

export interface ApkInstallerPlugin {
  installApk(options: { filePath: string }): Promise<void>;
  canRequestPackageInstalls(): Promise<{ canRequestPackageInstalls: boolean }>;
  openInstallSettings(): Promise<void>;
}

const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller');

export { ApkInstaller };

export function isApkInstallerAvailable(): boolean {
  return Capacitor.isNativePlatform();
}
