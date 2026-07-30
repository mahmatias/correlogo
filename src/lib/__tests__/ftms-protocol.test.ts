import { describe, it, expect } from 'vitest';
import {
  parseTreadmillMetrics,
  encodeSetSpeed,
  encodeSetIncline,
  encodeRequestControl,
  encodeReset,
  parseControlPointResponse,
} from '../ftms-protocol';

describe('parseTreadmillMetrics', () => {
  it('parses instant speed from FTMS measurement', () => {
    // Flags (uint16): 0x0001 = instant speed present
    // Speed: 10.0 km/h = 1000 -> 0xE8 0x03 (LE)
    const buf = new Uint8Array([0x01, 0x00, 0xE8, 0x03]).buffer;
    const result = parseTreadmillMetrics(new DataView(buf));
    expect(result.instantSpeedKmh).toBe(10.0);
    expect(result.totalDistanceMeters).toBeUndefined();
  });

  it('parses speed + distance when flags indicate both', () => {
    // Flags: 0x0001 (speed) | 0x0002 (distance) = 0x0003
    // Speed: 12.5 km/h = 1250 -> 0xE2 0x04
    // Distance: 1500m -> 0xDC 0x05 0x00 0x00 (uint32 LE)
    const buf = new Uint8Array([0x03, 0x00, 0xE2, 0x04, 0xDC, 0x05, 0x00, 0x00]).buffer;
    const result = parseTreadmillMetrics(new DataView(buf));
    expect(result.instantSpeedKmh).toBe(12.5);
    expect(result.totalDistanceMeters).toBe(1500);
  });

  it('parses speed + incline + elapsed time', () => {
    // Flags: 0x0001 (speed) | 0x0004 (incline) | 0x0040 (time) = 0x0045
    // Speed: 10.0 km/h = 1000 -> 0xE8 0x03
    // Incline: 2.0% -> 0x14 0x00
    // Time: 300s = 300 -> 0x2C 0x01
    const buf = new Uint8Array([0x45, 0x00, 0xE8, 0x03, 0x14, 0x00, 0x2C, 0x01]).buffer;
    const result = parseTreadmillMetrics(new DataView(buf));
    expect(result.instantSpeedKmh).toBe(10.0);
    expect(result.instantaneousInclinePercent).toBe(2.0);
    expect(result.elapsedTimeSeconds).toBe(300);
  });

  it('returns zero speed when no flags present', () => {
    const buf = new Uint8Array([0x00, 0x00]).buffer;
    const result = parseTreadmillMetrics(new DataView(buf));
    expect(result.instantSpeedKmh).toBe(0);
  });
});

describe('encodeSetSpeed', () => {
  it('encodes set speed command', () => {
    const result = encodeSetSpeed(10.0);
    const view = new Uint8Array(result);
    expect(view).toEqual(new Uint8Array([0x02, 0xE8, 0x03]));
  });

  it('encodes set speed at 0 km/h', () => {
    const result = encodeSetSpeed(0);
    const view = new Uint8Array(result);
    expect(view).toEqual(new Uint8Array([0x02, 0x00, 0x00]));
  });

  it('rounds speed to nearest 0.01 km/h', () => {
    // 5.555 * 100 = 555.5 -> round to 556 -> 0x022C LE
    const result = encodeSetSpeed(5.555);
    const view = new Uint8Array(result);
    expect(view).toEqual(new Uint8Array([0x02, 0x2C, 0x02]));
  });
});

describe('encodeSetIncline', () => {
  it('encodes set incline command', () => {
    // 2.0% -> 2.0 * 10 = 20 -> 0x0014 LE
    const result = encodeSetIncline(2.0);
    const view = new Uint8Array(result);
    expect(view).toEqual(new Uint8Array([0x03, 0x14, 0x00]));
  });

  it('encodes negative incline', () => {
    // -1.5% -> -1.5 * 10 = -15 -> 0xFFF1 (int16 LE)
    const result = encodeSetIncline(-1.5);
    const view = new Uint8Array(result);
    expect(view).toEqual(new Uint8Array([0x03, 0xF1, 0xFF]));
  });
});

describe('encodeRequestControl', () => {
  it('encodes request control command', () => {
    const result = encodeRequestControl();
    expect(new Uint8Array(result)).toEqual(new Uint8Array([0x00]));
  });
});

describe('encodeReset', () => {
  it('encodes reset command', () => {
    const result = encodeReset();
    expect(new Uint8Array(result)).toEqual(new Uint8Array([0x01]));
  });
});

describe('parseControlPointResponse', () => {
  it('parses control point response', () => {
    const buf = new Uint8Array([0x80, 0x01, 0x00]).buffer;
    const result = parseControlPointResponse(new DataView(buf));
    expect(result.resultCode).toBe(0x01);
    expect(result.requestedOpcode).toBe(0x00);
  });

  it('parses control point failure', () => {
    const buf = new Uint8Array([0x80, 0x05, 0x02]).buffer;
    const result = parseControlPointResponse(new DataView(buf));
    expect(result.resultCode).toBe(0x05);
    expect(result.requestedOpcode).toBe(0x02);
  });
});
