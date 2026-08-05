export interface TreadmillMetrics {
  instantSpeedKmh: number
  averageSpeedKmh?: number
  totalDistanceMeters?: number
  instantaneousInclinePercent?: number
  elevationGainMeters?: number
  stepRate?: number
  heartRate?: number
  elapsedTimeSeconds?: number
}

export interface ControlPointResponse {
  resultCode: number
  requestedOpcode: number
}

export enum FtmsOpcode {
  REQUEST_CONTROL = 0x00,
  RESET = 0x01,
  SET_SPEED = 0x02,
  SET_INCLINE = 0x03,
  START = 0x07,
  STOP = 0x08,
}

export function parseTreadmillMetrics(data: DataView): TreadmillMetrics {
  const flags = data.getUint16(0, true);
  const result: TreadmillMetrics = { instantSpeedKmh: 0 };

  const readU8 = (off: number) =>
    off + 1 <= data.byteLength ? data.getUint8(off) : undefined;
  const readU16 = (off: number) =>
    off + 2 <= data.byteLength ? data.getUint16(off, true) : undefined;
  const readS16 = (off: number) =>
    off + 2 <= data.byteLength ? data.getInt16(off, true) : undefined;
  const readU24 = (off: number) =>
    off + 3 <= data.byteLength
      ? data.getUint8(off) | (data.getUint8(off + 1) << 8) | (data.getUint8(off + 2) << 16)
      : undefined;

  // bit0 = More Data: 0 => Instantaneous Speed present, 1 => not present
  let offset = 2;
  if ((flags & 0x0001) === 0) {
    const v = readU16(offset);
    if (v !== undefined) result.instantSpeedKmh = v / 100;
    offset += 2;
  }
  if (flags & 0x0002) {
    const v = readU16(offset);
    if (v !== undefined) result.averageSpeedKmh = v / 100;
    offset += 2;
  }
  if (flags & 0x0004) {
    const v = readU24(offset);
    if (v !== undefined) result.totalDistanceMeters = v;
    offset += 3;
  }
  if (flags & 0x0008) {
    // Inclination and Ramp Angle Setting (sint16 each)
    const incline = readS16(offset);
    if (incline !== undefined) result.instantaneousInclinePercent = incline / 10;
    offset += 4;
  }
  if (flags & 0x0010) {
    // Elevation Gain (sint16 positive + sint16 negative)
    const gain = readS16(offset);
    if (gain !== undefined) result.elevationGainMeters = gain;
    offset += 4;
  }
  if (flags & 0x0020) offset += 1; // Instantaneous Pace (uint8)
  if (flags & 0x0040) offset += 1; // Average Pace (uint8)
  if (flags & 0x0080) offset += 5; // Expended Energy (uint16 + uint16 + uint8)
  if (flags & 0x0100) {
    const hr = readU8(offset);
    if (hr !== undefined) result.heartRate = hr;
    offset += 1;
  }
  if (flags & 0x0200) offset += 1; // Metabolic Equivalent (uint8)
  if (flags & 0x0400) {
    const t = readU16(offset);
    if (t !== undefined) result.elapsedTimeSeconds = t;
    offset += 2;
  }
  if (flags & 0x0800) offset += 2; // Remaining Time (uint16)
  if (flags & 0x1000) offset += 4; // Force on Belt and Power Output (sint16 + sint16)
  if (flags & 0x2000) offset += 4; // Power Output (sint16 + sint16)

  return result;
}

export function encodeSetSpeed(speedKmh: number): ArrayBuffer {
  const speedRaw = Math.round(speedKmh * 100);
  const buf = new ArrayBuffer(3);
  const view = new DataView(buf);
  view.setUint8(0, FtmsOpcode.SET_SPEED);
  view.setUint16(1, speedRaw, true);
  return buf;
}

export function encodeSetIncline(inclinePercent: number): ArrayBuffer {
  const inclineRaw = Math.round(inclinePercent * 10);
  const buf = new ArrayBuffer(3);
  const view = new DataView(buf);
  view.setUint8(0, FtmsOpcode.SET_INCLINE);
  view.setInt16(1, inclineRaw, true);
  return buf;
}

export function encodeRequestControl(): ArrayBuffer {
  return new Uint8Array([FtmsOpcode.REQUEST_CONTROL]).buffer;
}

export function encodeReset(): ArrayBuffer {
  return new Uint8Array([FtmsOpcode.RESET]).buffer;
}

export function parseControlPointResponse(data: DataView): ControlPointResponse {
  return {
    requestedOpcode: data.getUint8(1),
    resultCode: data.getUint8(2),
  };
}
