export type SizingMode = 'fill' | 'fit' | 'fixed' | 'relative';

export function detectSizingMode(value: string, axis: 'width' | 'height'): SizingMode {
  const normalized = value.trim().toLowerCase();

  if (normalized === '100%' || normalized === '[100%]' || normalized === '1fr') {
    return 'fill';
  }

  if (
    normalized === 'fit'
    || normalized === 'fit-content'
    || normalized === 'auto'
    || normalized === 'max-content'
    || normalized === 'min-content'
  ) {
    return 'fit';
  }

  if (
    normalized.includes('%')
    || normalized.includes('vw')
    || normalized.includes('vh')
    || normalized.includes('svh')
    || normalized.includes('lvh')
    || normalized.includes('dvh')
  ) {
    return 'relative';
  }

  if (!normalized) {
    return axis === 'height' ? 'fit' : 'fill';
  }

  return 'fixed';
}
