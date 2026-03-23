/**
 * Append a hex alpha suffix to a 6-digit hex color string.
 * e.g. withAlpha('#FF0000', 0.5) → '#FF000080'
 */
export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    console.warn(`withAlpha: expected #RRGGBB hex string, got "${hex}"`);
  }
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return hex + a;
}
