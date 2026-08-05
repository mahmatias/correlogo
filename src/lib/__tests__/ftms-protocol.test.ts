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
  it('parses instant speed when More Data bit is 0', () => {
    // Flags (uint16 LE): 0x0000 -> bit0 (More Data) = 0 => Instantaneous Speed present
    // Speed: 10.0 km/h = 1000 -> 0xE8 0x03 (LE)
    const buf = new Uint8Array([0x00, 0x00, 0xE8, 0x03]).buffer;
    const result = parseTreadmillMetrics(new DataView(buf));
    expect(result.instantSpeedKmh).toBe(10.0);
    expect(result.totalDistanceMeters).toBeUndefined();
    expect(result.instantaneousInclinePercent).toBeUndefined();
  });

  it('does not read speed when More Data bit is 1 (no speed field)', () => {
    // Flags: 0x0001 -> bit0 (More Data) = 1 => NO Instantaneous Speed field
    const buf = new Uint8Array([0x01, 0x00, 0xE8, 0x03]).buffer;
    const result = parseTreadmillMetrics(new DataView(buf));
    expect(result.instantSpeedKmh).toBe(0);
  });

  it('parses speed + total distance (24-bit) when flags indicate both', () => {
    // Flags: bit0=0 (speed) | bit2 (0x0004) distance = 0x0004
    // Speed: 12.5 km/h = 1250 -> 0xE2 0x04 (LE)
    // Distance: 1500m = 0x0005DC (24-bit LE) -> 0xDC 0x05 0x00
    const buf = new Uint8Array([0x04, 0x00, 0xE2, 0x04, 0xDC, 0x05, 0x00]).buffer;
    const result = parseTreadmillMetrics(new DataView(buf));
    expect(result.instantSpeedKmh).toBe(12.5);
    expect(result.totalDistanceMeters).toBe(1500);
  });

  it('parses speed + inclination + elapsed time', () => {
    // Flags: bit0=0 (speed) | bit3 (0x0008) inclination+ramp | bit10 (0x0400) elapsed = 0x0408
    // Speed: 10.0 km/h = 1000 -> 0xE8 0x03
    // Incline: 2.0% = raw 20 (sint16 LE) -> 0x14 0x00 ; Ramp: 0.5 deg = raw 5 -> 0x05 0x00
    // Time: 300s = 300 -> 0x2C 0x01
    const buf = new Uint8Array([0x08, 0x04, 0xE8, 0x03, 0x14, 0x00, 0x05, 0x00, 0x2C, 0x01]).buffer;
    const result = parseTreadmillMetrics(new DataView(buf));
    expect(result.instantSpeedKmh).toBe(10.0);
    expect(result.instantaneousInclinePercent).toBe(2.0);
    expect(result.elapsedTimeSeconds).toBe(300);
  });

  it('parses heart rate and expended energy', () => {
    // Flags: bit0=0 (speed) | bit7 (0x0080) energy | bit8 (0x0100) heart rate = 0x0180
    // Speed: 10.0 km/h = 1000
    // Energy: total 10 kcal (0x000A) + per-hour 100 kcal (0x0064) + per-minute 2 (0x02)
    // Heart rate: 150 bpm -> 0x96
    const buf = new Uint8Array([
      0x80, 0x01, 0xE8, 0x03, 0x0A, 0x00, 0x64, 0x00, 0x02, 0x96,
    ]).buffer;
    const result = parseTreadmillMetrics(new DataView(buf));
    expect(result.instantSpeedKmh).toBe(10.0);
    expect(result.heartRate).toBe(150);
  });

  it('returns zero speed when flags are zero and no extra data', () => {
    const buf = new Uint8Array([0x00, 0x00]).buffer;
    const result = parseTreadmillMetrics(new DataView(buf));
    expect(result.instantSpeedKmh).toBe(0);
  });

  it('does not throw on a truncated packet (bounds-guarded)', () => {
    // Flags claim incline present but packet has no data bytes.
    const buf = new Uint8Array([0x08, 0x00]).buffer;
    expect(() => parseTreadmillMetrics(new DataView(buf))).not.toThrow();
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
  it('parses control point response (spec: [0x80][requested opcode][result])', () => {
    const buf = new Uint8Array([0x80, 0x02, 0x00]).buffer;
    const result = parseControlPointResponse(new DataView(buf));
    expect(result.requestedOpcode).toBe(0x02);
    expect(result.resultCode).toBe(0x00);
  });

  it('parses control point failure result', () => {
    const buf = new Uint8Array([0x80, 0x03, 0x05]).buffer;
    const result = parseControlPointResponse(new DataView(buf));
    expect(result.requestedOpcode).toBe(0x03);
    expect(result.resultCode).toBe(0x05);
  });
});
