import { describe, it, expect } from 'vitest';
import { GRADIENT_PRESETS, LOGO_SWOOSH_PATHS, LOGO_COLOR } from '../gradients';

describe('GRADIENT_PRESETS', () => {
  it('exporta exatamente 6 presets', () => {
    expect(GRADIENT_PRESETS).toHaveLength(6);
  });

  it('todos têm id único, label e css linear-gradient', () => {
    const ids = new Set(GRADIENT_PRESETS.map(p => p.id));
    expect(ids.size).toBe(GRADIENT_PRESETS.length);
    for (const p of GRADIENT_PRESETS) {
      expect(p.label).toBeTruthy();
      expect(p.css).toContain('linear-gradient');
    }
  });
});

describe('logo swoosh', () => {
  it('tem 2 paths e cor #FF006E', () => {
    expect(LOGO_SWOOSH_PATHS).toHaveLength(2);
    expect(LOGO_SWOOSH_PATHS[0]).toContain('M20 65');
    expect(LOGO_COLOR).toBe('#FF006E');
  });
});
