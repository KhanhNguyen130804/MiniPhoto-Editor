import { filters, type FabricImage } from 'fabric';
import type { EditorSnapshot } from './snapshot';

export type ImageAdjustments = Pick<EditorSnapshot['imageAppearance'], 'brightness' | 'contrast' | 'saturation'>;

export function createAdjustmentFilters(adjustments: ImageAdjustments): FabricImage['filters'] {
  for (const value of [adjustments.brightness, adjustments.contrast, adjustments.saturation]) {
    if (!Number.isInteger(value) || value < -100 || value > 100) {
      throw new RangeError('Image adjustments must be integers from -100 to 100.');
    }
  }

  return [
    ...(adjustments.brightness ? [new filters.Brightness({ brightness: adjustments.brightness / 100 })] : []),
    ...(adjustments.contrast ? [new filters.Contrast({ contrast: adjustments.contrast / 100 })] : []),
    ...(adjustments.saturation ? [new filters.Saturation({ saturation: adjustments.saturation / 100 })] : []),
  ];
}

export function applyImageAdjustments(image: FabricImage, adjustments: ImageAdjustments): void {
  image.filters = createAdjustmentFilters(adjustments);
  image.applyFilters();
}
