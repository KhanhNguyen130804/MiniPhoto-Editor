import { FabricImage, StaticCanvas, filters } from 'fabric';
import { applyImageAdjustments, createAdjustmentFilters, type ImageAdjustments } from '../../src/features/editor/engine/adjustmentFilters';
import { commitHistory, createHistory, currentSnapshot, redoHistory, undoHistory } from '../../src/features/editor/engine/history';
import { exportImage } from '../../src/features/editor/engine/exportImage';
import type { ImageImportCandidate } from '../../src/features/editor/engine/imageImport';
import { createImageBaselineSnapshot, type EditorSnapshot } from '../../src/features/editor/engine/snapshot';

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

function createFixture(): { candidate: ImageImportCandidate; canvas: HTMLCanvasElement; before: Uint8ClampedArray } {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 4;
  const context = canvas.getContext('2d');
  assert(context, 'Canvas 2D context is unavailable.');
  const pixels = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      pixels.data[offset] = 42 + x * 17;
      pixels.data[offset + 1] = 70 + y * 24;
      pixels.data[offset + 2] = 130 + x * 9;
      pixels.data[offset + 3] = x === 0 ? 0 : x === 1 ? 128 : 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const image = new FabricImage(canvas);
  return {
    canvas,
    before: Uint8ClampedArray.from(context.getImageData(0, 0, canvas.width, canvas.height).data),
    candidate: {
      assetId: 'day13-source',
      source: new File([], 'day13-fixture.png', { type: 'image/png' }),
      image,
      sourceElement: canvas,
      width: canvas.width,
      height: canvas.height,
      dispose: () => image.dispose(),
    },
  };
}

function overlaySnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    ...snapshot,
    scene: [...snapshot.scene, {
      id: 'day13-overlay', role: 'shape', shape: 'rectangle', left: 6, top: 1,
      width: 1, height: 1, fill: '#ef4444', stroke: null, strokeWidth: 0,
      scaleX: 1, scaleY: 1, angle: 0, flipX: false, flipY: false, visible: true, opacity: 1,
    }],
  };
}

async function decodedPixels(blob: Blob): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    assert(context, 'Canvas 2D context is unavailable for export verification.');
    context.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height, data: context.getImageData(0, 0, bitmap.width, bitmap.height).data };
  } finally {
    bitmap.close();
  }
}

function pixel(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * 4;
  return Array.from(data.slice(offset, offset + 4));
}

async function runAssertions(candidate: ImageImportCandidate, sourceCanvas: HTMLCanvasElement, before: Uint8ClampedArray): Promise<string[]> {
  const lines: string[] = [];
  const mapped = createAdjustmentFilters({ brightness: -100, contrast: 25, saturation: 100 });
  assert(mapped.length === 3, 'All non-neutral adjustment filters should be created.');
  assert(mapped[0] instanceof filters.Brightness && mapped[0].brightness === -1, 'Brightness did not map to -1 or appear first.');
  assert(mapped[1] instanceof filters.Contrast && mapped[1].contrast === 0.25, 'Contrast did not map to 0.25 or appear second.');
  assert(mapped[2] instanceof filters.Saturation && mapped[2].saturation === 1, 'Saturation did not map to 1 or appear third.');
  assert(createAdjustmentFilters({ brightness: 0, contrast: 0, saturation: 0 }).length === 0,
    'Neutral adjustments should not allocate filters.');
  expectThrow(() => createAdjustmentFilters({ brightness: 1.5, contrast: 0, saturation: 0 } as ImageAdjustments),
    'A decimal adjustment must be rejected.');
  expectThrow(() => createAdjustmentFilters({ brightness: 101, contrast: 0, saturation: 0 }),
    'An adjustment over 100 must be rejected.');
  lines.push('PASS UI range maps to Fabric -1..1 in Brightness → Contrast → Saturation order; neutral and invalid values handled');

  const baseline = overlaySnapshot(createImageBaselineSnapshot(candidate.assetId, candidate.width, candidate.height));
  const adjustments: ImageAdjustments = { brightness: 24, contrast: -18, saturation: 37 };
  const adjusted: EditorSnapshot = {
    ...baseline,
    imageAppearance: { ...baseline.imageAppearance, ...adjustments },
  };
  applyImageAdjustments(candidate.image, adjusted.imageAppearance);
  const previewElement = candidate.image.getElement();
  assert(previewElement instanceof HTMLCanvasElement, 'Fabric preview filter output was not a canvas.');
  const previewContext = previewElement.getContext('2d');
  assert(previewContext, 'Canvas 2D context is unavailable for preview verification.');
  const preview = previewContext.getImageData(0, 0, previewElement.width, previewElement.height).data;
  assert(!Array.from(before).every((value, index) => value === preview[index]), 'Adjustments did not change preview pixels.');
  assert(pixel(preview, previewElement.width, 1, 2)[3] === 128, 'Preview adjustment changed semi-transparent alpha.');
  const sourceAfterPreview = sourceCanvas.getContext('2d')!.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
  assert(before.every((value, index) => value === sourceAfterPreview[index]), 'Preview adjustment mutated the retained source element.');
  lines.push('PASS live filter changes source-image preview while preserving source pixels and PNG alpha');

  let history = createHistory(baseline);
  const noOp = commitHistory(history, { ...baseline, imageAppearance: { ...baseline.imageAppearance } });
  assert(noOp === history && history.revision === 0, 'An unchanged adjustment must not create history.');
  history = commitHistory(history, adjusted);
  assert(history.revision === 1, 'One adjustment operation must create one history step.');
  assert(JSON.stringify(currentSnapshot(undoHistory(history))) === JSON.stringify(baseline), 'Undo did not restore baseline appearance.');
  assert(JSON.stringify(currentSnapshot(redoHistory(undoHistory(history)))) === JSON.stringify(adjusted), 'Redo did not restore adjusted appearance.');
  lines.push('PASS one-step history commit, no-op, undo, and redo');

  const blob = await exportImage(candidate, adjusted, { format: 'png', quality: 90, backgroundColor: '#ffffff' });
  assert(blob.type === 'image/png', `PNG output MIME was ${blob.type}.`);
  const output = await decodedPixels(blob);
  assert(output.width === candidate.width && output.height === candidate.height, 'Adjusted export dimensions changed.');
  assert(pixel(output.data, output.width, 3, 2).every((value, index) => value === pixel(preview, previewElement.width, 3, 2)[index]),
    'Export did not use the same filter output as the live preview.');
  assert(pixel(output.data, output.width, 1, 2)[3] === 128, 'Adjusted PNG export changed semi-transparent alpha.');
  assert(pixel(output.data, output.width, 6, 1).slice(0, 3).every((value, index) => Math.abs(value - [239, 68, 68][index]) < 4),
    'Color adjustment changed the overlay.');
  const sourceAfterExport = sourceCanvas.getContext('2d')!.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
  assert(before.every((value, index) => value === sourceAfterExport[index]), 'Export mutated the retained source element.');
  lines.push('PASS full-resolution PNG uses the same adjustments once; alpha, overlay pixels, and retained source stay intact');

  const performanceCanvas = document.createElement('canvas');
  performanceCanvas.width = 2048;
  performanceCanvas.height = 1536;
  const performanceContext = performanceCanvas.getContext('2d');
  assert(performanceContext, 'Canvas 2D context is unavailable for performance verification.');
  performanceContext.fillStyle = '#789abc';
  performanceContext.fillRect(0, 0, performanceCanvas.width, performanceCanvas.height);
  const performanceImage = new FabricImage(performanceCanvas);
  const performanceRenderer = new StaticCanvas(document.createElement('canvas'), {
    width: performanceCanvas.width,
    height: performanceCanvas.height,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  performanceRenderer.add(performanceImage);
  try {
    applyImageAdjustments(performanceImage, { brightness: 12, contrast: 8, saturation: -14 });
    performanceRenderer.renderAll();
    const durations: number[] = [];
    for (let index = 0; index < 12; index += 1) {
      const start = performance.now();
      applyImageAdjustments(performanceImage, {
        brightness: 12 + (index % 4), contrast: 8, saturation: -14,
      });
      performanceRenderer.renderAll();
      durations.push(performance.now() - start);
    }
    const filteredElement = performanceImage.getElement();
    assert(filteredElement instanceof HTMLCanvasElement
      && filteredElement.width === performanceCanvas.width && filteredElement.height === performanceCanvas.height,
    'Performance fixture did not produce a full-size filtered canvas.');
    const filteredContext = filteredElement.getContext('2d');
    assert(filteredContext, 'Canvas 2D context is unavailable for performance output.');
    const filteredPixel = filteredContext.getImageData(0, 0, 1, 1).data;
    assert(filteredPixel[0] !== 120 || filteredPixel[1] !== 154 || filteredPixel[2] !== 188,
      'Performance fixture adjustments did not change pixels.');
    durations.sort((left, right) => left - right);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
    lines.push(`MEASURE filter + canvas render 2048×1536 p95 ${p95.toFixed(1)} ms (12 measured iterations; max nearest-rank sample)`);
    lines.push(`ENV ${navigator.userAgent} | viewport ${window.innerWidth}×${window.innerHeight} | DPR ${window.devicePixelRatio}`);
  } finally {
    performanceRenderer.remove(performanceImage);
    await performanceRenderer.dispose();
    performanceImage.dispose();
  }
  return lines;
}

runButton.addEventListener('click', async () => {
  runButton.disabled = true;
  results.textContent = 'Đang chạy…';
  const { candidate, canvas, before } = createFixture();
  try {
    results.textContent = (await runAssertions(candidate, canvas, before)).join('\n');
  } catch (error) {
    results.textContent = `FAIL ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    candidate.dispose();
    runButton.disabled = false;
  }
});
