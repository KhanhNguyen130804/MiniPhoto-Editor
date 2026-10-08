import { FabricImage, filters } from 'fabric';
import {
  applyImageAdjustments,
  createAdjustmentFilters,
  PRESET_OPTIONS,
  selectImagePreset,
} from '../../src/features/editor/engine/adjustmentFilters';
import { cropDocument, transformDocument } from '../../src/features/editor/engine/geometry';
import { commitHistory, createHistory, currentSnapshot, redoHistory, undoHistory } from '../../src/features/editor/engine/history';
import { exportImage } from '../../src/features/editor/engine/exportImage';
import type { ImageImportCandidate } from '../../src/features/editor/engine/imageImport';
import { renderPresetThumbnails } from '../../src/features/editor/engine/presetThumbnails';
import { createImageBaselineSnapshot, type EditorSnapshot, type PresetId } from '../../src/features/editor/engine/snapshot';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLElement>('#results')!;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectThrow(action: () => unknown, message: string): void {
  let threw = false;
  try {
    action();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

function createFixture(name: string, width: number, height: number): {
  candidate: ImageImportCandidate;
  canvas: HTMLCanvasElement;
  before: Uint8ClampedArray;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  assert(context, 'Canvas 2D context is unavailable.');
  const pixels = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      pixels.data[offset] = 28 + Math.round((x / Math.max(1, width - 1)) * 190);
      pixels.data[offset + 1] = 36 + Math.round((y / Math.max(1, height - 1)) * 180);
      pixels.data[offset + 2] = 210 - Math.round((x / Math.max(1, width - 1)) * 130);
      pixels.data[offset + 3] = x === 0 ? 0 : x === 1 ? 128 : 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const image = new FabricImage(canvas);
  return {
    canvas,
    before: Uint8ClampedArray.from(context.getImageData(0, 0, width, height).data),
    candidate: {
      assetId: `day14-${name}`,
      source: new File([], `${name}.png`, { type: 'image/png' }),
      image,
      sourceElement: canvas,
      width,
      height,
      dispose: () => image.dispose(),
    },
  };
}

function readCanvasPixels(source: CanvasImageSource, width: number, height: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  assert(context, 'Canvas 2D context is unavailable for pixel checks.');
  context.drawImage(source, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

async function readDataUrlPixels(dataUrl: string, width: number, height: number): Promise<Uint8ClampedArray> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  return readCanvasPixels(image, width, height);
}

async function readBlobPixels(blob: Blob): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const bitmap = await createImageBitmap(blob);
  try {
    return {
      width: bitmap.width,
      height: bitmap.height,
      data: readCanvasPixels(bitmap, bitmap.width, bitmap.height),
    };
  } finally {
    bitmap.close();
  }
}

function pixel(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * 4;
  return Array.from(data.slice(offset, offset + 4));
}

type RecipeStep =
  | { type: 'gain'; value: readonly [number, number, number] }
  | { type: 'brightness' | 'contrast' | 'saturation'; value: number }
  | { type: 'grayscale' | 'sepia' };

const EXPECTED_RECIPES: Record<PresetId, readonly RecipeStep[]> = {
  original: [],
  warm: [
    { type: 'gain', value: [1.05, 1, 0.95] }, { type: 'brightness', value: 0.03 },
    { type: 'contrast', value: 0.04 }, { type: 'saturation', value: 0.06 },
  ],
  cool: [
    { type: 'gain', value: [0.96, 1, 1.06] }, { type: 'brightness', value: 0.01 },
    { type: 'contrast', value: 0.04 }, { type: 'saturation', value: 0.04 },
  ],
  vintage: [
    { type: 'gain', value: [1.05, 1.02, 0.92] }, { type: 'brightness', value: 0.04 },
    { type: 'contrast', value: -0.1 }, { type: 'saturation', value: -0.2 },
  ],
  bw: [{ type: 'grayscale' }, { type: 'contrast', value: 0.08 }],
  fade: [
    { type: 'brightness', value: 0.08 }, { type: 'contrast', value: -0.18 },
    { type: 'saturation', value: -0.1 },
  ],
  vivid: [{ type: 'contrast', value: 0.12 }, { type: 'saturation', value: 0.2 }],
  film: [
    { type: 'gain', value: [1.03, 1.02, 0.97] }, { type: 'brightness', value: 0.03 },
    { type: 'contrast', value: -0.06 }, { type: 'saturation', value: -0.12 },
  ],
  sepia: [{ type: 'sepia' }],
  dramatic: [
    { type: 'brightness', value: -0.04 }, { type: 'contrast', value: 0.24 },
    { type: 'saturation', value: -0.12 },
  ],
};

function assertPresetRecipe(presetId: PresetId): void {
  const actual = createAdjustmentFilters({
    presetId, presetVersion: 1, brightness: 0, contrast: 0, saturation: 0,
  });
  const expected = EXPECTED_RECIPES[presetId];
  assert(actual.length === expected.length, `${presetId} has an unexpected filter count.`);
  expected.forEach((step, index) => {
    const filter = actual[index];
    if (step.type === 'gain') {
      assert(filter instanceof filters.ColorMatrix, `${presetId} RGB gain is missing or out of order.`);
      const matrix = filter.matrix;
      assert(matrix[0] === step.value[0] && matrix[6] === step.value[1] && matrix[12] === step.value[2]
        && matrix[3] === 0 && matrix[8] === 0 && matrix[13] === 0 && matrix[18] === 1
        && matrix[4] === 0 && matrix[9] === 0 && matrix[14] === 0 && matrix[19] === 0,
      `${presetId} RGB gain changed alpha or offsets, or has incorrect gains.`);
    } else if (step.type === 'grayscale') {
      assert(filter instanceof filters.Grayscale, `${presetId} grayscale mode is missing or out of order.`);
    } else if (step.type === 'sepia') {
      assert(filter instanceof filters.Sepia, `${presetId} sepia mode is missing or out of order.`);
    } else if (step.type === 'brightness') {
      assert(filter instanceof filters.Brightness && filter.brightness === step.value,
        `${presetId} brightness is missing, incorrect, or out of order.`);
    } else if (step.type === 'contrast') {
      assert(filter instanceof filters.Contrast && filter.contrast === step.value,
        `${presetId} contrast is missing, incorrect, or out of order.`);
    } else {
      assert(filter instanceof filters.Saturation && filter.saturation === step.value,
        `${presetId} saturation is missing, incorrect, or out of order.`);
    }
  });
}

function overlaySnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    ...snapshot,
    scene: [...snapshot.scene, {
      id: 'day14-overlay', role: 'shape', shape: 'rectangle', left: snapshot.document.width - 2, top: 1,
      width: 1, height: 1, fill: '#ef4444', stroke: null, strokeWidth: 0,
      scaleX: 1, scaleY: 1, angle: 0, flipX: false, flipY: false, visible: true, opacity: 1,
    }],
  };
}

function customAppearance(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    ...snapshot,
    imageAppearance: { ...snapshot.imageAppearance, brightness: 17, contrast: -11, saturation: 23 },
  };
}

async function verifyScene(name: string, width: number, height: number): Promise<string[]> {
  const lines: string[] = [];
  const { candidate, canvas, before } = createFixture(name, width, height);
  try {
    const base = customAppearance(createImageBaselineSnapshot(candidate.assetId, width, height));
    const thumbnails = await renderPresetThumbnails(candidate, base);
    for (const option of PRESET_OPTIONS) {
      const snapshot = selectImagePreset(base, option.id);
      const thumbnailPixels = await readDataUrlPixels(thumbnails[option.id], width, height);
      const preview = new FabricImage(canvas);
      let previewPixels: Uint8ClampedArray;
      try {
        applyImageAdjustments(preview, snapshot.imageAppearance);
        previewPixels = readCanvasPixels(preview.getElement(), width, height);
      } finally {
        preview.dispose();
      }
      const blob = await exportImage(candidate, snapshot, { format: 'png', quality: 90, backgroundColor: '#ffffff' });
      const output = await readBlobPixels(blob);
      assert(output.width === width && output.height === height, `${name}/${option.id} changed export dimensions.`);
      assert(thumbnailPixels.every((value, index) => value === output.data[index]),
        `${name}/${option.id} thumbnail and export pixels differ at the same resolution.`);
      assert(previewPixels.every((value, index) => value === output.data[index]),
        `${name}/${option.id} live preview and export pixels differ.`);
      assert(pixel(output.data, width, 1, Math.floor(height / 2))[3] === 128,
        `${name}/${option.id} changed semi-transparent alpha.`);
    }
    const sourceAfter = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
    assert(before.every((value, index) => value === sourceAfter[index]),
      `${name} processing mutated source pixels.`);
    lines.push(`PASS ${name} synthetic image: all 10 thumbnail recipes match PNG export; alpha and source preserved`);
  } finally {
    candidate.dispose();
  }
  return lines;
}

async function runAssertions(): Promise<string[]> {
  const lines: string[] = [];
  const baseline = createImageBaselineSnapshot('day14-history', 12, 8);
  const customized = {
    ...baseline,
    imageAppearance: { ...baseline.imageAppearance, brightness: 21, contrast: -8, saturation: 14 },
  };
  const warm = selectImagePreset(customized, 'warm');
  assert(warm.imageAppearance.presetVersion === 1 && warm.imageAppearance.presetId === 'warm',
    'Selecting Warm did not set preset version 1.');
  assert(warm.imageAppearance.brightness === 21 && warm.imageAppearance.contrast === -8
    && warm.imageAppearance.saturation === 14, 'Selecting a preset changed user sliders.');
  assert(warm.documentTransform === baseline.documentTransform && warm.scene === baseline.scene,
    'Selecting a preset changed geometry or scene.');
  assert(selectImagePreset(warm, 'warm') === warm, 'Selecting the current preset must be a no-op.');
  let history = commitHistory(createHistory(customized), warm);
  assert(history.revision === 1, 'One preset selection must create one history step.');
  assert(JSON.stringify(currentSnapshot(undoHistory(history))) === JSON.stringify(customized),
    'Undo did not restore the prior preset/sliders.');
  history = redoHistory(undoHistory(history));
  assert(JSON.stringify(currentSnapshot(history)) === JSON.stringify(warm), 'Redo did not restore the selected preset.');
  const original = selectImagePreset(warm, 'original');
  assert(original.imageAppearance.brightness === 21 && original.imageAppearance.contrast === -8
    && original.imageAppearance.saturation === 14, 'Original reset user sliders.');
  lines.push('PASS v1 selection preserves sliders/geometry; one history step, same-preset no-op, undo/redo, Original');

  for (const option of PRESET_OPTIONS) assertPresetRecipe(option.id);
  const recipeFilters = createAdjustmentFilters({
    presetId: 'warm', presetVersion: 1, brightness: 9, contrast: -5, saturation: 20,
  });
  assert(recipeFilters.length === 7, 'Warm plus three non-neutral user sliders should create seven filters.');
  assert(recipeFilters[0] instanceof filters.ColorMatrix, 'Warm RGB gain must run before preset sliders.');
  assert(recipeFilters[1] instanceof filters.Brightness && recipeFilters[1].brightness === 0.03,
    'Warm preset brightness is missing or out of order.');
  assert(recipeFilters[2] instanceof filters.Contrast && recipeFilters[2].contrast === 0.04,
    'Warm preset contrast is missing or out of order.');
  assert(recipeFilters[3] instanceof filters.Saturation && recipeFilters[3].saturation === 0.06,
    'Warm preset saturation is missing or out of order.');
  assert(recipeFilters[4] instanceof filters.Brightness && recipeFilters[4].brightness === 0.09,
    'User brightness must run after preset sliders.');
  const grayscaleFilters = createAdjustmentFilters({
    presetId: 'bw', presetVersion: 1, brightness: 0, contrast: 0, saturation: 0,
  });
  assert(grayscaleFilters[0] instanceof filters.Grayscale && grayscaleFilters[1] instanceof filters.Contrast,
    'B&W must run grayscale before its preset contrast.');
  assert(createAdjustmentFilters({
    presetId: 'sepia', presetVersion: 1, brightness: 0, contrast: 0, saturation: 0,
  })[0] instanceof filters.Sepia, 'Sepia mode was not applied.');
  expectThrow(() => createAdjustmentFilters({
    presetId: 'warm', presetVersion: 2, brightness: 0, contrast: 0, saturation: 0,
  }), 'An unavailable preset formula version must be rejected.');
  lines.push('PASS preset mode/RGB/preset B-C-S/user B-C-S ordering and version validation');

  const { candidate, canvas, before } = createFixture('cropped-rotated', 32, 24);
  try {
    const cropped = cropDocument(
      customAppearance(createImageBaselineSnapshot(candidate.assetId, candidate.width, candidate.height)),
      { x: 2, y: 1, width: 28, height: 21 },
      'free',
    );
    const snapshot = selectImagePreset(transformDocument(cropped, 'rotate-right'), 'cool');
    const thumbnail = await renderPresetThumbnails(candidate, snapshot);
    const output = await readBlobPixels(await exportImage(candidate, snapshot, {
      format: 'png', quality: 90, backgroundColor: '#ffffff',
    }));
    assert(output.width === snapshot.document.width && output.height === snapshot.document.height,
      'Crop/rotate export dimensions do not match the document.');
    const thumbnailPixels = await readDataUrlPixels(thumbnail.cool, output.width, output.height);
    assert(thumbnailPixels.every((value, index) => value === output.data[index]),
      'Crop/rotate thumbnail does not use the current document transform.');

    const overlayBase = selectImagePreset(customAppearance(createImageBaselineSnapshot(candidate.assetId, candidate.width, candidate.height)), 'cool');
    const withOverlay = overlaySnapshot(overlayBase);
    const overlayOutput = await readBlobPixels(await exportImage(candidate, withOverlay, {
      format: 'png', quality: 90, backgroundColor: '#ffffff',
    }));
    assert(pixel(overlayOutput.data, overlayOutput.width, candidate.width - 2, 1)
      .slice(0, 3).every((value, index) => Math.abs(value - [239, 68, 68][index]) < 4),
    'Preset export changed or omitted an overlay.');
    const sourceAfter = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    assert(before.every((value, index) => value === sourceAfter[index]),
      'Crop/rotate thumbnail or export mutated source pixels.');
    lines.push('PASS crop/rotate thumbnail follows document geometry; overlay export and retained source remain intact');
  } finally {
    candidate.dispose();
  }

  lines.push(...await verifyScene('portrait', 32, 48));
  lines.push(...await verifyScene('product', 48, 48));
  lines.push(...await verifyScene('landscape', 64, 36));
  lines.push(`ENV ${navigator.userAgent} | viewport ${window.innerWidth}×${window.innerHeight} | DPR ${window.devicePixelRatio}`);
  return lines;
}

runButton.addEventListener('click', async () => {
  runButton.disabled = true;
  results.textContent = 'Đang chạy…';
  try {
    results.textContent = (await runAssertions()).join('\n');
  } catch (error) {
    results.textContent = `FAIL ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    runButton.disabled = false;
  }
});
