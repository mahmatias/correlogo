import { registerPlugin, Capacitor } from '@capacitor/core';
import type { BleTransport, BleDevice, TreadmillControlMode } from './ble-transport';
import { isNative } from './capacitor/platform';

interface NativeTreadmillBlePlugin {
  initBle(): Promise<void>
  startBleScan(): Promise<void>
  connectTreadmill(options: { address: string; mode?: string }): Promise<void>
  disconnectTreadmill(): Promise<void>
  setTreadmillSpeed(options: { speed: number }): Promise<void>
  setTreadmillIncline(options: { incline: number }): Promise<void>
  addListener(eventName: string, callback: (data: any) => void): Promise<{ remove: () => void }>
  removeAllListeners(): Promise<void>
}

const Plugin = registerPlugin<NativeTreadmillBlePlugin>('TreadmillBle');

function parseJsonToDataView(jsonStr: string): DataView {
  const arr: number[] = JSON.parse(jsonStr);
  const buf = new ArrayBuffer(arr.length);
  const view = new DataView(buf);
  for (let i = 0; i < arr.length; i++) {
    view.setUint8(i, arr[i]);
  }
  return view;
}

function ftmsCommandToPlugin(view: DataView): { method: string; args: Record<string, number> } | null {
  const opcode = view.getUint8(0);
  if (opcode === 0x02) {
    const speed = view.getUint16(1, true) / 100;
    return { method: 'setTreadmillSpeed', args: { speed } };
  }
  if (opcode === 0x03) {
    const incline = view.getInt16(1, true) / 10;
    return { method: 'setTreadmillIncline', args: { incline } };
  }
  return null;
}

export class NativeBleTransport implements BleTransport {
  private metricsListeners: Array<(data: DataView) => void> = [];
  private controlPointListeners: Array<(data: DataView) => void> = [];
  private disconnectListeners: Array<() => void> = [];
  private errorListeners: Array<(err: string) => void> = [];
  private logFileListeners: Array<(path: string) => void> = [];
  private initPromise: Promise<void> | null = null;
  private activeListeners: Array<{ remove: () => void }> = [];
  private destroyed = false;

  private async init(): Promise<void> {
    if (!isNative()) {
      this.fireError('BLE not available on this platform');
      return;
    }
    if (!this.initPromise) {
      this.initPromise = Plugin.initBle().catch((err: any) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  async scan(onDevice: (device: BleDevice) => void): Promise<void> {
    await this.ensureInitialized();

    const scanHandle = await Plugin.addListener('treadmillScanResult', (data: any) => {
      if (data.name && data.address) {
        onDevice({ name: data.name, address: data.address });
      }
    });
    const errorHandle = await Plugin.addListener('treadmillError', (data: any) => {
      this.fireError(data.message || 'Unknown BLE error');
    });

    try {
      await Plugin.startBleScan();
    } catch (err: any) {
      scanHandle.remove();
      errorHandle.remove();
      this.fireError(err.message);
      throw err;
    }
  }

  async stopScan(): Promise<void> {
    try {
      Plugin.removeAllListeners();
    } catch {}
  }

  async connect(address: string, options?: { mode?: TreadmillControlMode }): Promise<void> {
    await this.ensureInitialized();

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timeout de conexão'));
      }, 30000);

      let stateHandle: { remove: () => void } | null = null;
      let errorHandle: { remove: () => void } | null = null;

      const cleanup = () => {
        clearTimeout(timeout);
        stateHandle?.remove();
        errorHandle?.remove();
      };

      Plugin.addListener('treadmillState', (data: any) => {
        if (data.state === 'CONTROLLED') {
          cleanup();
          resolve();
        } else if (data.state === 'DISCONNECTED') {
          cleanup();
          reject(new Error('Conexão falhou'));
        }
      }).then(h => { stateHandle = h; });

      Plugin.addListener('treadmillError', (data: any) => {
        cleanup();
        reject(new Error(data.message || 'Erro na conexão'));
      }).then(h => { errorHandle = h; });

      Plugin.connectTreadmill({ address, mode: options?.mode ?? 'A' }).catch((err: any) => {
        cleanup();
        reject(err);
      });
    });
  }

  async disconnect(): Promise<void> {
    this.destroyed = true;
    this.metricsListeners = [];
    this.controlPointListeners = [];
    this.disconnectListeners = [];
    this.errorListeners = [];
    this.logFileListeners = [];
    try {
      await Plugin.removeAllListeners();
      await Plugin.disconnectTreadmill();
    } catch {}
  }

  async sendCommand(data: ArrayBuffer): Promise<void> {
    const view = new DataView(data);
    const cmd = ftmsCommandToPlugin(view);
    if (!cmd) return;

    try {
      if (cmd.method === 'setTreadmillSpeed') {
        await Plugin.setTreadmillSpeed({ speed: cmd.args.speed });
      } else if (cmd.method === 'setTreadmillIncline') {
        await Plugin.setTreadmillIncline({ incline: cmd.args.incline });
      }
    } catch (err: any) {
      this.fireError(err.message);
    }
  }

  onMetrics(cb: (data: DataView) => void): () => void {
    this.metricsListeners.push(cb);
    return () => {
      this.metricsListeners = this.metricsListeners.filter(l => l !== cb);
    };
  }

  onControlPointResponse(cb: (data: DataView) => void): () => void {
    this.controlPointListeners.push(cb);
    return () => {
      this.controlPointListeners = this.controlPointListeners.filter(l => l !== cb);
    };
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.push(cb);
    return () => {
      this.disconnectListeners = this.disconnectListeners.filter(l => l !== cb);
    };
  }

  onError(cb: (err: string) => void): () => void {
    this.errorListeners.push(cb);
    return () => {
      this.errorListeners = this.errorListeners.filter(l => l !== cb);
    };
  }

  private async ensureInitialized(): Promise<void> {
    if (!isNative()) {
      throw new Error('BLE not available on this platform');
    }
    await this.init();
    this.setupGlobalListeners();
  }

  private setupGlobalListeners(): void {
    if (this.destroyed || this.activeListeners.length > 0) return;

    Plugin.addListener('treadmillMetrics', (data: any) => {
      if (!data.data) return;
      try {
        const view = parseJsonToDataView(data.data);
        this.metricsListeners.forEach(cb => cb(new DataView(view.buffer.slice(0))));
      } catch {}
    }).then(h => this.activeListeners.push(h));

    Plugin.addListener('treadmillControlPointResponse', (data: any) => {
      if (!data.data) return;
      try {
        const view = parseJsonToDataView(data.data);
        this.controlPointListeners.forEach(cb => cb(new DataView(view.buffer.slice(0))));
      } catch {}
    }).then(h => this.activeListeners.push(h));

    Plugin.addListener('treadmillState', (data: any) => {
      if (data.state === 'DISCONNECTED') {
        this.disconnectListeners.forEach(cb => cb());
      }
    }).then(h => this.activeListeners.push(h));

    Plugin.addListener('treadmillError', (data: any) => {
      this.fireError(data.message || 'Erro BLE');
    }).then(h => this.activeListeners.push(h));

    Plugin.addListener('treadmillLogFile', (data: any) => {
      if (data.path) {
        this.logFileListeners.forEach(cb => cb(data.path));
      }
    }).then(h => this.activeListeners.push(h));
  }

  onLogFile(cb: (path: string) => void): () => void {
    this.logFileListeners.push(cb);
    return () => {
      this.logFileListeners = this.logFileListeners.filter(l => l !== cb);
    };
  }

  private fireError(msg: string): void {
    this.errorListeners.forEach(cb => cb(msg));
  }
}
