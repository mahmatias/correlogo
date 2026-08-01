import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useTreadmill } from '../use-treadmill';

function BootProbe() {
  useTreadmill();
  return null;
}

describe('useTreadmill boot', () => {
  it('renderiza sem estourar (regressao APK 138: TDZ clearScanTimeout em deps antes da declaracao)', () => {
    expect(() => renderToStaticMarkup(<BootProbe />)).not.toThrow();
  });
});
