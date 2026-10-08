import { filters, type FabricImage, type TMatColorMatrix } from 'fabric';
import type { EditorSnapshot, ImageAppearanceSnapshot, PresetId } from './snapshot';

export type ImageAdjustments = Pick<EditorSnapshot['imageAppearance'], 'brightness' | 'contrast' | 'saturation'>;
type FilterInput = ImageAdjustments | ImageAppearanceSnapshot;

export const CURRENT_PRESET_VERSION = 1;

export const PRESET_OPTIONS: readonly { id: PresetId; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'bw', label: 'B&W' },
  { id: 'fade', label: 'Fade' },
  { id: 'vivid', label: 'Vivid' },
  { id: 'film', label: 'Film' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'dramatic', label: 'Dramatic' },
];

type PresetRecipe = {
  brightness: number;
  contrast: number;
  saturation: number;
  rgbGain: readonly [number, number, number];
  mode: 'none' | 'grayscale' | 'sepia';
};

const PRESET_RECIPES: Record<PresetId, Partial<Record<number, PresetRecipe>>> = {
  original: { 1: { brightness: 0, contrast: 0, saturation: 0, rgbGain: [1, 1, 1], mode: 'none' } },
  warm: { 1: { brightness: 3, contrast: 4, saturation: 6, rgbGain: [1.05, 1, 0.95], mode: 'none' } },
  cool: { 1: { brightness: 1, contrast: 4, saturation: 4, rgbGain: [0.96, 1, 1.06], mode: 'none' } },
  vintage: { 1: { brightness: 4, contrast: -10, saturation: -20, rgbGain: [1.05, 1.02, 0.92], mode: 'none' } },
  bw: { 1: { brightness: 0, contrast: 8, saturation: 0, rgbGain: [1, 1, 1], mode: 'grayscale' } },
  fade: { 1: { brightness: 8, contrast: -18, saturation: -10, rgbGain: [1, 1, 1], mode: 'none' } },
  vivid: { 1: { brightness: 0, contrast: 12, saturation: 20, rgbGain: [1, 1, 1], mode: 'none' } },
  film: { 1: { brightness: 3, contrast: -6, saturation: -12, rgbGain: [1.03, 1.02, 0.97], mode: 'none' } },
  sepia: { 1: { brightness: 0, contrast: 0, saturation: 0, rgbGain: [1, 1, 1], mode: 'sepia' } },
  dramatic: { 1: { brightness: -4, contrast: 24, saturation: -12, rgbGain: [1, 1, 1], mode: 'none' } },
};

export function selectImagePreset(snapshot: EditorSnapshot, presetId: PresetId): EditorSnapshot {
  if (snapshot.imageAppearance.presetId === presetId
    && snapshot.imageAppearance.presetVersion === CURRENT_PRESET_VERSION) return snapshot;
  return {
    ...snapshot,
    imageAppearance: {
      ...snapshot.imageAppearance,
      presetId,
      presetVersion: CURRENT_PRESET_VERSION,
    },
  };
}

function sliderFilters(brightness: number, contrast: number, saturation: number): FabricImage['filters'] {
  return [
    ...(brightness ? [new filters.Brightness({ brightness: brightness / 100 })] : []),
    ...(contrast ? [new filters.Contrast({ contrast: contrast / 100 })] : []),
    ...(saturation ? [new filters.Saturation({ saturation: saturation / 100 })] : []),
  ];
}

export function createAdjustmentFilters(adjustments: FilterInput): FabricImage['filters'] {
  for (const value of [adjustments.brightness, adjustments.contrast, adjustments.saturation]) {
    if (!Number.isInteger(value) || value < -100 || value > 100) {
      throw new RangeError('Image adjustments must be integers from -100 to 100.');
    }
  }

  const hasPreset = 'presetId' in adjustments;
  const presetId = hasPreset ? adjustments.presetId : 'original';
  const presetVersion = hasPreset ? adjustments.presetVersion : CURRENT_PRESET_VERSION;
  const recipe = Number.isSafeInteger(presetVersion) ? PRESET_RECIPES[presetId]?.[presetVersion] : undefined;
  if (!recipe) throw new RangeError(`Unsupported image preset ${presetId} version ${presetVersion}.`);

  const filtersForPreset: FabricImage['filters'] = [];
  if (recipe.mode === 'grayscale') filtersForPreset.push(new filters.Grayscale());
  if (recipe.mode === 'sepia') filtersForPreset.push(new filters.Sepia());

  const [red, green, blue] = recipe.rgbGain;
  if (red !== 1 || green !== 1 || blue !== 1) {
    const matrix: TMatColorMatrix = [
      red, 0, 0, 0, 0,
      0, green, 0, 0, 0,
      0, 0, blue, 0, 0,
      0, 0, 0, 1, 0,
    ];
    filtersForPreset.push(new filters.ColorMatrix({ matrix, colorsOnly: true }));
  }

  return [
    ...filtersForPreset,
    ...sliderFilters(recipe.brightness, recipe.contrast, recipe.saturation),
    ...sliderFilters(adjustments.brightness, adjustments.contrast, adjustments.saturation),
  ];
}

export function applyImageAdjustments(image: FabricImage, adjustments: FilterInput): void {
  image.filters = createAdjustmentFilters(adjustments);
  image.applyFilters();
}
