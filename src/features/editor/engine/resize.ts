import { MAX_IMAGE_EDGE, MAX_IMAGE_PIXELS } from './imageImport';

export type ResizeAxis = 'width' | 'height';
export type ResizeDimensions = { width: number; height: number };
export type ResizeError = 'invalid-document' | 'required' | 'integer' | 'positive' | 'edge-limit' | 'pixel-limit';
export type ResizeResult =
  | { valid: true; dimensions: ResizeDimensions; scale: number }
  | { valid: false; field: ResizeAxis; error: ResizeError };

export function calculateResize(
  base: ResizeDimensions,
  field: ResizeAxis,
  rawValue: string,
): ResizeResult {
  if (![base.width, base.height].every((value) => Number.isSafeInteger(value) && value >= 1 && value <= MAX_IMAGE_EDGE)
    || base.width * base.height > MAX_IMAGE_PIXELS) {
    return { valid: false, field, error: 'invalid-document' };
  }

  const value = rawValue.trim();
  if (!value) return { valid: false, field, error: 'required' };
  if (!/^[+-]?\d+$/.test(value)) return { valid: false, field, error: 'integer' };

  const requested = Number(value);
  if (!Number.isSafeInteger(requested)) return { valid: false, field, error: 'integer' };
  if (requested < 1) return { valid: false, field, error: 'positive' };
  if (requested > MAX_IMAGE_EDGE) return { valid: false, field, error: 'edge-limit' };

  const scale = requested / base[field];
  const dimensions = field === 'width'
    ? { width: requested, height: Math.round(base.height * scale) }
    : { width: Math.round(base.width * scale), height: requested };

  if (dimensions.width < 1 || dimensions.height < 1
    || dimensions.width > MAX_IMAGE_EDGE || dimensions.height > MAX_IMAGE_EDGE) {
    return { valid: false, field, error: 'edge-limit' };
  }
  if (dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
    return { valid: false, field, error: 'pixel-limit' };
  }

  return { valid: true, dimensions, scale };
}
