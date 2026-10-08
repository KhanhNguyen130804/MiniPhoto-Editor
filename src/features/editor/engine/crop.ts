export type CropRatio = 'free' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16';
export type CropRect = { x: number; y: number; width: number; height: number };
export type CropBounds = { width: number; height: number };
export type CropHandle = 'move' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export type CropValidationError = 'invalid-document' | 'invalid-number' | 'outside-bounds' | 'invalid-ratio';

export const CROP_RATIOS: readonly { id: CropRatio; label: string; width?: number; height?: number }[] = [
  { id: 'free', label: 'Tự do' },
  { id: '1:1', label: '1:1', width: 1, height: 1 },
  { id: '4:3', label: '4:3', width: 4, height: 3 },
  { id: '3:4', label: '3:4', width: 3, height: 4 },
  { id: '16:9', label: '16:9', width: 16, height: 9 },
  { id: '9:16', label: '9:16', width: 9, height: 16 },
];

function ratioSize(ratio: CropRatio) {
  const option = CROP_RATIOS.find((item) => item.id === ratio);
  return option?.width && option.height ? { width: option.width, height: option.height } : null;
}

function validBounds(bounds: CropBounds): boolean {
  return Number.isSafeInteger(bounds.width) && Number.isSafeInteger(bounds.height)
    && bounds.width > 0 && bounds.height > 0;
}

export function createCropRect(bounds: CropBounds, ratio: CropRatio): CropRect | null {
  if (!validBounds(bounds)) return null;
  const size = ratioSize(ratio);
  if (!size) return { x: 0, y: 0, width: bounds.width, height: bounds.height };

  const units = Math.min(Math.floor(bounds.width / size.width), Math.floor(bounds.height / size.height));
  if (units < 1) return null;
  const width = units * size.width;
  const height = units * size.height;
  return {
    x: Math.floor((bounds.width - width) / 2),
    y: Math.floor((bounds.height - height) / 2),
    width,
    height,
  };
}

export function validateCropRect(
  rect: CropRect,
  bounds: CropBounds,
  ratio: CropRatio,
): CropValidationError | null {
  if (!validBounds(bounds)) return 'invalid-document';
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isSafeInteger)) return 'invalid-number';
  if (rect.width < 1 || rect.height < 1 || rect.x < 0 || rect.y < 0
    || rect.x + rect.width > bounds.width || rect.y + rect.height > bounds.height) return 'outside-bounds';

  const size = ratioSize(ratio);
  if (size && rect.width * size.height !== rect.height * size.width) return 'invalid-ratio';
  return null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function resizeCropRect(
  rect: CropRect,
  handle: CropHandle,
  start: { x: number; y: number },
  current: { x: number; y: number },
  bounds: CropBounds,
  ratio: CropRatio,
): CropRect {
  if (validateCropRect(rect, bounds, ratio) || !Number.isFinite(start.x + start.y + current.x + current.y)) return rect;
  const dx = Math.round(current.x - start.x);
  const dy = Math.round(current.y - start.y);
  if (handle === 'move') {
    return {
      ...rect,
      x: clamp(rect.x + dx, 0, bounds.width - rect.width),
      y: clamp(rect.y + dy, 0, bounds.height - rect.height),
    };
  }

  const fixed = ratioSize(ratio);
  if (fixed) {
    const corners: Partial<Record<CropHandle, { x: -1 | 1; y: -1 | 1 }>> = {
      nw: { x: -1, y: -1 }, ne: { x: 1, y: -1 },
      se: { x: 1, y: 1 }, sw: { x: -1, y: 1 },
    };
    const direction = corners[handle];
    if (!direction) return rect;

    const anchorX = direction.x > 0 ? rect.x : rect.x + rect.width;
    const anchorY = direction.y > 0 ? rect.y : rect.y + rect.height;
    const maxWidth = direction.x > 0 ? bounds.width - anchorX : anchorX;
    const maxHeight = direction.y > 0 ? bounds.height - anchorY : anchorY;
    const maxUnits = Math.floor(Math.min(maxWidth / fixed.width, maxHeight / fixed.height));
    const requestedWidth = direction.x * (start.x + dx - anchorX);
    const requestedHeight = direction.y * (start.y + dy - anchorY);
    const units = clamp(Math.round(Math.min(
      requestedWidth / fixed.width,
      requestedHeight / fixed.height,
    )), 1, maxUnits);
    const width = units * fixed.width;
    const height = units * fixed.height;
    return {
      x: direction.x > 0 ? anchorX : anchorX - width,
      y: direction.y > 0 ? anchorY : anchorY - height,
      width,
      height,
    };
  }

  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;
  if (handle.includes('w')) left = clamp(left + dx, 0, right - 1);
  if (handle.includes('e')) right = clamp(right + dx, left + 1, bounds.width);
  if (handle.includes('n')) top = clamp(top + dy, 0, bottom - 1);
  if (handle.includes('s')) bottom = clamp(bottom + dy, top + 1, bounds.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
