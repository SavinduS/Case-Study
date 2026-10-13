// Consistent palette and sizing (UI evaluation: consistent colors, readable
// contrast, no status communicated by color alone)
export const colors = {
  primary: '#2E7D32',
  primaryDark: '#1B5E20',
  primarySoft: '#E8F5E9',
  bg: '#F6F8F6',
  surface: '#FFFFFF',
  text: '#1A2119',
  textMuted: '#5F6B63',
  border: '#D5DBD6',
  danger: '#B3261E',
  dangerSoft: '#FDECEA',
  warnSoft: '#FFF6E5',
  warnText: '#8A5A00',
  offlineSoft: '#ECEFF1',
  offlineText: '#37474F',
  disabled: '#A8CBA9',
  white: '#FFFFFF'
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 6, md: 10, lg: 16 };

/** Minimum touch-target height for interactive elements (accessibility). */
export const MIN_TOUCH_TARGET = 48;

export const font = {
  title: 22,
  section: 16,
  body: 15,
  small: 13,
  tiny: 12
};

function hexChannel(hex: string, index: 0 | 1 | 2): number {
  const v = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Relative luminance of an #rrggbb color (WCAG definition). */
export function luminance(hex: string): number {
  const [r, g, b] = [hexChannel(hex, 0), hexChannel(hex, 1), hexChannel(hex, 2)];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colors (1..21, AA needs ≥ 4.5). */
export function contrastRatio(foreground: string, background: string): number {
  const hi = Math.max(luminance(foreground), luminance(background));
  const lo = Math.min(luminance(foreground), luminance(background));
  return (hi + 0.05) / (lo + 0.05);
}
