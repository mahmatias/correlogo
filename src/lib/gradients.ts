export interface GradientPreset {
  id: string;
  label: string;
  css: string;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  { id: 'rosa', label: 'Rosa', css: 'linear-gradient(160deg, #1a0533 0%, #2d1b69 38%, #e8598b 74%, #ffb347 100%)' },
  { id: 'oceano', label: 'Oceano', css: 'linear-gradient(160deg, #041229 0%, #0b3a6b 42%, #00b4d8 78%, #90e0ef 100%)' },
  { id: 'lima', label: 'Lima', css: 'linear-gradient(160deg, #0a2e12 0%, #14532d 42%, #65a30d 78%, #facc15 100%)' },
  { id: 'fogo', label: 'Fogo', css: 'linear-gradient(160deg, #1c0303 0%, #4a0e0e 42%, #dc2626 78%, #fbbf24 100%)' },
  { id: 'neon', label: 'Neon', css: 'linear-gradient(160deg, #0d0d1a 0%, #1b1035 45%, #7c3aed 80%, #f472b6 100%)' },
  { id: 'minimal', label: 'Minimal', css: 'linear-gradient(160deg, #050505 0%, #1a1a1f 100%)' },
];

export const LOGO_SWOOSH_PATHS = [
  'M20 65 C30 65, 45 55, 55 45 C40 48, 30 45, 25 38 C40 38, 55 30, 85 20 C75 38, 60 62, 50 75 C52 65, 48 58, 42 56 C35 64, 25 65, 20 65 Z',
  'M15 50 C25 50, 35 43, 42 37 C35 39, 28 37, 25 33 C33 33, 45 27, 55 22 C48 32, 42 42, 38 48 C39 42, 36 38, 32 37 C28 44, 20 50, 15 50 Z',
];

export const LOGO_COLOR = '#FF006E';
