import { registerPlugin } from '@capacitor/core';
import { isNative } from './capacitor/platform';

export interface HrSample {
  bpm: number;
  timestamp: number;
}

export interface HrDevice {
  name: string;
  address: string;
}

export interface HrBleTransport {
  scan(onDevice: (device: HrDevice) => void): Promise<void>;
  connect(address: string): Promise<void>;
  disconnect(): Promise<void>;
  onSample(cb: (sample: HrSample) => void): () => void;
  onDisconnect(cb: () => void): () => void;
  onError(cb: (error: string) => void): () => void;
}

interface HrBlePlugin {
  initHr(): Promise<void>;
  startHrScan(): Promise<void>;
  connectHr(options: { address: string }): Promise<void>;
  disconnectHr(): Promise<void>;
  requestHrBlePermissions(): Promise<{ bluetooth: string }>;
  addListener(eventName: string, callback: (data: any) => void): Promise<{ remove: () => void }>;
  removeAllListeners(): Promise<void>;
}

const HrPlugin = registerPlugin<HrBlePlugin>('HrBle');

export class MockHrTransport implements HrBleTransport {
  private sampleListeners: Array<(s: HrSample) => void> = [];
  private disconnectListeners: Array<() => void> = [];
  private errorListeners: Array<(msg: string) => void> = [];
  private interval: ReturnType<typeof setInterval> | null = null;
  private bpm = 115;

  async scan(onDevice: (device: HrDevice) => void): Promise<void> {
    setTimeout(() => onDevice({ name: 'Cinta Simulada (HR)', address: '00:11:22:33:44:66' }), 100);
  }

  async connect(_address: string): Promise<void> {
    this.interval = setInterval(() => {
      this.bpm = Math.max(90, Math.min(165, this.bpm + Math.floor(Math.random() * 5) - 2));
      const sample: HrSample = { bpm: this.bpm, timestamp: Date.now() };
      this.sampleListeners.forEach(cb => cb(sample));
    }, 1000);
  }

  async disconnect(): Promise<void> {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    this.disconnectListeners.forEach(cb => cb());
  }

  onSample(cb: (s: HrSample) => void): () => void {
    this.sampleListeners.push(cb);
    return () => { this.sampleListeners = this.sampleListeners.filter(l => l !== cb); };
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.push(cb);
    return () => { this.disconnectListeners = this.disconnectListeners.filter(l => l !== cb); };
  }

  onError(cb: (msg: string) => void): () => void {
    this.errorListeners.push(cb);
    return () => { this.errorListeners = this.errorListeners.filter(l => l !== cb); };
  }
}

export class NativeHrTransport implements HrBleTransport {
  private sampleListeners: Array<(s: HrSample) => void> = [];
  private disconnectListeners: Array<() => void> = [];
  private errorListeners: Array<(msg: string) => void> = [];
  private activeListeners: Array<{ remove: () => void }> = [];
  private initPromise: Promise<void> | null = null;
  private destroyed = false;

  private init(): Promise<void> {
    if (!isNative()) {
      this.fireError('BLE not available on this platform');
      return Promise.resolve();
    }
    if (!this.initPromise) {
      this.initPromise = HrPlugin.initHr().catch((err: any) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  private async ensureInitialized(): Promise<void> {
    if (!isNative()) throw new Error('BLE not available on this platform');
    await this.init();
    this.setupGlobalListeners();
  }

  async scan(onDevice: (device: HrDevice) => void): Promise<void> {
    await this.ensureInitialized();

    const scanHandle = await HrPlugin.addListener('hrScanResult', (d: any) => {
      if (d.name && d.address) onDevice({ name: d.name, address: d.address });
    });
    const errorHandle = await HrPlugin.addListener('hrError', (d: any) => {
      this.fireError(d.message || 'Erro BLE');
    });

    try {
      await HrPlugin.startHrScan();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('Permissão')) {
        const perm = await HrPlugin.requestHrBlePermissions().catch(() => ({ bluetooth: 'denied' }));
        if (perm.bluetooth === 'granted') {
          await HrPlugin.startHrScan();
          return;
        }
      }
      scanHandle.remove();
      errorHandle.remove();
      this.fireError(msg);
      throw err;
    }
  }

  async connect(address: string): Promise<void> {
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

      HrPlugin.addListener('hrState', (d: any) => {
        if (d.state === 'CONNECTED') {
          cleanup();
          resolve();
        } else if (d.state === 'DISCONNECTED') {
          cleanup();
          reject(new Error('Conexão falhou'));
        }
      }).then(h => { stateHandle = h; });

      HrPlugin.addListener('hrError', (d: any) => {
        cleanup();
        reject(new Error(d.message || 'Erro na conexão'));
      }).then(h => { errorHandle = h; });

      HrPlugin.connectHr({ address }).catch((err: any) => {
        cleanup();
        reject(err);
      });
    });
  }

  async disconnect(): Promise<void> {
    this.destroyed = true;
    this.sampleListeners = [];
    this.disconnectListeners = [];
    this.errorListeners = [];
    try {
      await HrPlugin.removeAllListeners();
      await HrPlugin.disconnectHr();
    } catch {}
  }

  onSample(cb: (s: HrSample) => void): () => void {
    this.sampleListeners.push(cb);
    return () => { this.sampleListeners = this.sampleListeners.filter(l => l !== cb); };
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.push(cb);
    return () => { this.disconnectListeners = this.disconnectListeners.filter(l => l !== cb); };
  }

  onError(cb: (msg: string) => void): () => void {
    this.errorListeners.push(cb);
    return () => { this.errorListeners = this.errorListeners.filter(l => l !== cb); };
  }

  private setupGlobalListeners(): void {
    if (this.destroyed || this.activeListeners.length > 0) return;

    HrPlugin.addListener('hrSample', (d: any) => {
      const bpm = Number(d.bpm);
      const timestamp = Number(d.timestamp);
      if (Number.isFinite(bpm) && bpm > 0) {
        this.sampleListeners.forEach(cb => cb({ bpm, timestamp }));
      }
    }).then(h => this.activeListeners.push(h));

    HrPlugin.addListener('hrState', (d: any) => {
      if (d.state === 'DISCONNECTED') {
        this.disconnectListeners.forEach(cb => cb());
      }
    }).then(h => this.activeListeners.push(h));

    HrPlugin.addListener('hrError', (d: any) => {
      this.fireError(d.message || 'Erro BLE');
    }).then(h => this.activeListeners.push(h));
  }

  private fireError(msg: string): void {
    this.errorListeners.forEach(cb => cb(msg));
  }
}

export function createHrTransport(): HrBleTransport {
  return isNative() ? new NativeHrTransport() : new MockHrTransport();
}
