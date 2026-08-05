export interface BleDevice {
  name: string
  address: string
}

export interface BleTransport {
  scan(onDevice: (device: BleDevice) => void): Promise<void>
  stopScan(): Promise<void>
  connect(address: string): Promise<void>
  disconnect(): Promise<void>
  sendCommand(data: ArrayBuffer): Promise<void>
  onMetrics(cb: (data: DataView) => void): () => void
  onControlPointResponse(cb: (data: DataView) => void): () => void
  onDisconnect(cb: () => void): () => void
  onError(cb: (error: string) => void): () => void
}

export class MockTransport implements BleTransport {
  private metricsListeners: Array<(data: DataView) => void> = [];
  private controlPointListeners: Array<(data: DataView) => void> = [];
  private disconnectListeners: Array<() => void> = [];
  private errorListeners: Array<(err: string) => void> = [];
  private metricsInterval: ReturnType<typeof setInterval> | null = null;
  private _connected = false;
  private _speedKmh = 0;
  private _inclinePct = 0;
  private _distanceM = 0;
  private _time = 0;

  async scan(onDevice: (device: BleDevice) => void): Promise<void> {
    setTimeout(() => {
      onDevice({ name: 'Esteira Simulada (FTMS)', address: '00:11:22:33:44:55' });
    }, 100);
  }

  async stopScan(): Promise<void> {}

  async connect(_address: string): Promise<void> {
    this._connected = true;
    this.metricsInterval = setInterval(() => {
      this._time++;
      if (this._speedKmh > 0) {
        this._distanceM += (this._speedKmh * 1000) / 3600;
      }
      // Standard FTMS Treadmill Data: flags bit0 (More Data)=0 => speed present,
      // bit2=total distance (24-bit), bit3=inclination+ramp, bit10=elapsed time.
      const flags = 0x0004 | 0x0008 | 0x0400;
      const buf = new ArrayBuffer(13);
      const view = new DataView(buf);
      view.setUint16(0, flags, true);
      view.setUint16(2, Math.round(this._speedKmh * 100), true);
      view.setUint8(4, Math.round(this._distanceM) & 0xff);
      view.setUint8(5, (Math.round(this._distanceM) >> 8) & 0xff);
      view.setUint8(6, (Math.round(this._distanceM) >> 16) & 0xff);
      view.setInt16(7, Math.round(this._inclinePct * 10), true);
      view.setInt16(9, 0, true);
      view.setUint16(11, this._time, true);
      this.metricsListeners.forEach(cb => cb(new DataView(buf.slice(0))));
    }, 100);
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    this.disconnectListeners.forEach(cb => cb());
  }

  async sendCommand(data: ArrayBuffer): Promise<void> {
    const view = new DataView(data);
    const opcode = view.getUint8(0);
    if (opcode === 0x02) {
      this._speedKmh = view.getUint16(1, true) / 100;
      this.controlPointListeners.forEach(cb => {
        const resp = new Uint8Array([0x80, 0x02, 0x00]).buffer;
        cb(new DataView(resp));
      });
    } else if (opcode === 0x03) {
      this._inclinePct = view.getInt16(1, true) / 10;
      this.controlPointListeners.forEach(cb => {
        const resp = new Uint8Array([0x80, 0x03, 0x00]).buffer;
        cb(new DataView(resp));
      });
    } else if (opcode === 0x00) {
      this.controlPointListeners.forEach(cb => {
        const resp = new Uint8Array([0x80, 0x00, 0x00]).buffer;
        cb(new DataView(resp));
      });
    }
  }

  onMetrics(cb: (data: DataView) => void): () => void {
    this.metricsListeners.push(cb);
    return () => { this.metricsListeners = this.metricsListeners.filter(l => l !== cb); };
  }

  onControlPointResponse(cb: (data: DataView) => void): () => void {
    this.controlPointListeners.push(cb);
    return () => { this.controlPointListeners = this.controlPointListeners.filter(l => l !== cb); };
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.push(cb);
    return () => { this.disconnectListeners = this.disconnectListeners.filter(l => l !== cb); };
  }

  onError(cb: (err: string) => void): () => void {
    this.errorListeners.push(cb);
    return () => { this.errorListeners = this.errorListeners.filter(l => l !== cb); };
  }
}
