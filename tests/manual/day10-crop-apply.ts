import { Canvas, FabricImage, Rect } from 'fabric';
import { commitHistory, createHistory, currentSnapshot, redoHistory, undoHistory } from '../../src/features/editor/engine/history';
import { cropDocument, transformDocument, transformDocumentPoint, applyDocumentTransform } from '../../src/features/editor/engine/geometry';
import { exportImage } from '../../src/features/editor/engine/exportImage';
import { createFabricOverlays } from '../../src/features/editor/engine/scene';
import { createImageBaselineSnapshot, type EditorSnapshot, type ShapeOverlaySnapshot, type TextOverlaySnapshot } from '../../src/features/editor/engine/snapshot';
import { validateCropRect, type CropRatio, type CropRect } from '../../src/features/editor/engine/crop';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLElement>('#results')!;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function near(actual: number, expected: number, tolerance = 0.001): boolean {
  return Math.abs(actual - expected) <= tolerance;
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

function fixtureScene(snapshot: EditorSnapshot): EditorSnapshot {
  const transform = {
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    flipX: false,
    flipY: false,
    visible: true,
    opacity: 1,
  };
  const text: TextOverlaySnapshot = {
    id: 'day10-text', role: 'text', left: 16, top: 8, width: 24,
    text: 'T', fontFamily: 'Noto Sans', fontSize: 20, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', fill: '#000000', ...transform,
  };
  const rectangle: ShapeOverlaySnapshot = {
    id: 'day10-rectangle', role: 'shape', shape: 'rectangle', left: 12, top: 10,
    width: 8, height: 6, fill: '#ef4444', stroke: null, strokeWidth: 0, ...transform,
  };
  const topLayer: ShapeOverlaySnapshot = {
    id: 'day10-top-layer', role: 'shape', shape: 'rectangle', left: 14, top: 12,
    width: 3, height: 3, fill: '#2563eb', stroke: null, strokeWidth: 0, ...transform,
  };
  const circle: ShapeOverlaySnapshot = {
    id: 'day10-circle', role: 'shape', shape: 'circle', left: 30, top: 12,
    radius: 5, fill: '#22c55e', stroke: null, strokeWidth: 0, ...transform,
  };
  const line: ShapeOverlaySnapshot = {
    id: 'day10-line', role: 'shape', shape: 'line', left: 10, top: 32,
    x2: 42, y2: 32, stroke: '#ffffff', strokeWidth: 2, ...transform,
  };
  const hidden: ShapeOverlaySnapshot = {
    id: 'day10-hidden', role: 'shape', shape: 'rectangle', left: 12, top: 24,
    width: 4, height: 4, fill: '#facc15', stroke: null, strokeWidth: 0,
    ...transform, visible: false,
  };
  const outsideCrop: ShapeOverlaySnapshot = {
    id: 'day10-outside-crop', role: 'shape', shape: 'rectangle', left: 52, top: 40,
    width: 8, height: 8, fill: '#a855f7', stroke: null, strokeWidth: 0, ...transform,
  };
  return { ...snapshot, scene: [...snapshot.scene, text, rectangle, topLayer, circle, line, hidden, outsideCrop] };
}

function createCandidate() {
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = 64;
  sourceCanvas.height = 48;
  const context = sourceCanvas.getContext('2d');
  assert(context, 'Canvas 2D context is unavailable.');
  context.fillStyle = '#203040';
  context.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  const image = new FabricImage(sourceCanvas);
  return {
    assetId: 'day10-source',
    source: new File([], 'day10-fixture.png', { type: 'image/png' }),
    image,
    sourceElement: sourceCanvas,
    width: sourceCanvas.width,
    height: sourceCanvas.height,
    dispose: () => image.dispose(),
  };
}

function pixel(context: CanvasRenderingContext2D, x: number, y: number): number[] {
  return [...context.getImageData(x, y, 1, 1).data];
}

function isColor(actual: readonly number[], expected: readonly number[], tolerance = 3): boolean {
  return expected.every((value, index) => Math.abs(actual[index] - value) <= tolerance);
}

function imagePixel(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * 4;
  return Array.from(data.slice(offset, offset + 4));
}

async function imagePixels(blob: Blob): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
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

function cropAndHistory(): { snapshot: EditorSnapshot; cropped: EditorSnapshot; lines: string[] } {
  const lines: string[] = [];
  const baseline = createImageBaselineSnapshot('day10-source', 64, 48);
  const snapshot = fixtureScene(baseline);
  const rect: CropRect = { x: 8, y: 6, width: 40, height: 32 };
  const cropped = cropDocument(snapshot, rect, 'free');
  assert(cropped.document.width === 40 && cropped.document.height === 32, 'Crop dimensions do not match the selected rectangle.');
  assert(JSON.stringify(cropped.documentTransform) === JSON.stringify([1, 0, 0, 1, -8, -6]),
    'Crop did not prepend the negative crop offset to the shared scene matrix.');
  assert(cropped.scene === snapshot.scene, 'Crop must retain the original scene records and z-order.');
  lines.push('PASS crop dimensions, shared offset, and unchanged ordered scene');

  assert(validateCropRect(rect, snapshot.document, 'free') === null, 'A valid free crop was rejected.');
  expectThrow(() => cropDocument(snapshot, { ...rect, x: Number.NaN }, 'free'), 'NaN crop coordinates must be rejected.');
  expectThrow(() => cropDocument(snapshot, { ...rect, x: 63, width: 2 }, 'free'), 'Out-of-bounds crop must be rejected.');
  expectThrow(() => cropDocument(snapshot, { ...rect, width: 32, height: 24 }, '16:9'), 'A mismatched fixed ratio must be rejected.');
  expectThrow(() => cropDocument(snapshot, rect, 'invalid' as CropRatio), 'An unknown ratio must be rejected.');
  const ratioSnapshot = createImageBaselineSnapshot('ratio-source', 80, 60);
  const ratioCrop = cropDocument(ratioSnapshot, { x: 8, y: 6, width: 64, height: 48 }, '4:3');
  assert(ratioCrop.document.width === 64 && ratioCrop.document.height === 48, 'Valid fixed-ratio crop changed its dimensions.');
  lines.push('PASS command-boundary rejects invalid numbers, bounds, ratio mismatch, and unknown ratio');

  assert(cropDocument(snapshot, { x: 0, y: 0, width: 64, height: 48 }, 'free') === snapshot,
    'A full-document crop must preserve snapshot identity.');
  let history = createHistory(snapshot);
  const unchangedHistory = commitHistory(history, cropDocument(snapshot, { x: 0, y: 0, width: 64, height: 48 }, 'free'));
  assert(unchangedHistory === history && unchangedHistory.revision === 0, 'A crop no-op must not commit history.');
  history = commitHistory(history, cropped);
  assert(history.revision === 1, 'Apply must create exactly one history revision.');
  const undone = undoHistory(history);
  assert(JSON.stringify(currentSnapshot(undone)) === JSON.stringify(snapshot), 'Undo did not restore the full prior scene and matrix.');
  const redone = redoHistory(undone);
  assert(JSON.stringify(currentSnapshot(redone)) === JSON.stringify(cropped), 'Redo did not restore the exact crop snapshot.');
  lines.push('PASS no-op, one-step commit, exact undo, and redo');

  const rotated = transformDocument(snapshot, 'rotate-right');
  const pointBeforeCrop = transformDocumentPoint(rotated.documentTransform, 16, 8);
  const rotatedCrop = cropDocument(rotated, { x: 2, y: 3, width: 40, height: 50 }, 'free');
  const pointAfterCrop = transformDocumentPoint(rotatedCrop.documentTransform, 16, 8);
  assert(near(pointAfterCrop[0], pointBeforeCrop[0] - 2) && near(pointAfterCrop[1], pointBeforeCrop[1] - 3),
    'Crop after rotation did not translate scene geometry in current-document coordinates.');
  lines.push('PASS crop after rotation preserves shared geometry mapping');
  return { snapshot, cropped, lines };
}

async function verifyPreviewClip(candidate: ReturnType<typeof createCandidate>, snapshot: EditorSnapshot): Promise<void> {
  const preview = new Canvas(document.createElement('canvas'), {
    width: 64,
    height: 48,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
    selection: false,
  });
  const source = snapshot.scene[0];
  assert(source?.role === 'source-image', 'Preview fixture must put the source image at the bottom.');
  const image = new FabricImage(candidate.image.getElement(), {
    left: source.left,
    top: source.top,
    width: source.width,
    height: source.height,
    originX: 'left',
    originY: 'top',
  });
  applyDocumentTransform(image, snapshot.documentTransform);
  preview.add(image);
  const overlays = createFabricOverlays(snapshot.scene);
  overlays.forEach((object) => applyDocumentTransform(object, snapshot.documentTransform));
  if (overlays.length) preview.add(...overlays);
  preview.clipPath = new Rect({
    left: 0,
    top: 0,
    width: snapshot.document.width,
    height: snapshot.document.height,
    originX: 'left',
    originY: 'top',
    selectable: false,
    evented: false,
  });
  preview.setViewportTransform([1, 0, 0, 1, 12, 8]);
  preview.renderAll();
  const context = preview.lowerCanvasEl.getContext('2d');
  assert(context, 'Preview canvas context is unavailable.');
  assert(isColor(pixel(context, 17, 13), [239, 68, 68, 255]), 'Preview overlay did not follow crop plus pan.');
  assert(isColor(pixel(context, 19, 15), [37, 99, 235, 255]), 'Preview did not preserve overlay z-order.');
  assert(pixel(context, 55, 20)[3] === 0, 'Preview did not clip source pixels beyond the cropped document bounds.');
  await preview.dispose();
}

async function verifyExport(candidate: ReturnType<typeof createCandidate>, snapshot: EditorSnapshot): Promise<void> {
  const sourceCanvas = candidate.image.getElement() as HTMLCanvasElement;
  const before = [...sourceCanvas.getContext('2d')!.getImageData(0, 0, 64, 48).data].join(',');
  const blob = await exportImage(candidate, snapshot, {
    format: 'png', quality: 90, backgroundColor: '#ffffff',
  });
  assert(blob.type === 'image/png', `Cropped export MIME was ${blob.type}.`);
  const image = await imagePixels(blob);
  assert(image.width === 40 && image.height === 32, `Cropped export dimensions were ${image.width}×${image.height}.`);
  assert(isColor(imagePixel(image.data, image.width, 5, 5), [239, 68, 68, 255]), 'Rectangle overlay was not translated into the export.');
  assert(isColor(imagePixel(image.data, image.width, 7, 7), [37, 99, 235, 255]), 'Export did not preserve overlay z-order.');
  assert(isColor(imagePixel(image.data, image.width, 27, 11), [34, 197, 94, 255]), 'Circle overlay was not translated into the export.');
  assert(isColor(imagePixel(image.data, image.width, 15, 26), [255, 255, 255, 255]), 'Line overlay was not translated into the export.');
  assert(isColor(imagePixel(image.data, image.width, 5, 19), [32, 48, 64, 255]), 'Hidden overlay was rendered.');
  assert(isColor(imagePixel(image.data, image.width, 39, 31), [32, 48, 64, 255]), 'Overlay outside crop leaked into exported pixels.');
  let darkTextPixels = 0;
  for (let y = 2; y < 28; y += 1) {
    for (let x = 8; x < 30; x += 1) {
      const color = imagePixel(image.data, image.width, x, y);
      if (color[0] < 20 && color[1] < 20 && color[2] < 20 && color[3] > 200) darkTextPixels += 1;
    }
  }
  assert(darkTextPixels > 5, `Text overlay did not render in the cropped export (${darkTextPixels} dark pixels).`);
  const after = [...sourceCanvas.getContext('2d')!.getImageData(0, 0, 64, 48).data].join(',');
  assert(before === after, 'Export changed the immutable source pixels.');
}

runButton.addEventListener('click', async () => {
  runButton.disabled = true;
  results.textContent = 'Đang chạy…';
  const candidate = createCandidate();
  try {
    const { cropped, lines } = cropAndHistory();
    await verifyPreviewClip(candidate, cropped);
    lines.push('PASS preview clip follows the cropped document through viewport pan');
    await verifyExport(candidate, cropped);
    lines.push('PASS cropped PNG dimensions, text/shape pixels, clipping, and unchanged source');
    results.textContent = lines.join('\n');
  } catch (error) {
    results.textContent = `FAIL ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    candidate.dispose();
    runButton.disabled = false;
  }
});
