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
  let offset = 2;
  const result: TreadmillMetrics = { instantSpeedKmh: 0 };

  if (flags & 0x0001) {
    result.instantSpeedKmh = data.getUint16(offset, true) / 100;
    offset += 2;
  }
  if (flags & 0x0002) {
    result.totalDistanceMeters = data.getUint32(offset, true);
    offset += 4;
  }
  if (flags & 0x0004) {
    result.instantaneousInclinePercent = data.getInt16(offset, true) / 10;
    offset += 2;
  }
  if (flags & 0x0008) {
    result.elevationGainMeters = data.getInt16(offset, true);
    offset += 2;
  }
  if (flags & 0x0010) {
    result.stepRate = data.getUint16(offset, true);
    offset += 2;
  }
  if (flags & 0x0020) {
    result.heartRate = data.getUint8(offset);
    offset += 1;
  }
  if (flags & 0x0040) {
    result.elapsedTimeSeconds = data.getUint16(offset, true);
    offset += 2;
  }
  if (flags & 0x0080) {
    offset += 2;
  }
  if (flags & 0x0100) {
    offset += 2;
  }
  if (flags & 0x0200) {
    offset += 2;
  }

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
    resultCode: data.getUint8(1),
    requestedOpcode: data.getUint8(2),
  };
}
