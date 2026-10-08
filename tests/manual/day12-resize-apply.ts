import { FabricImage } from 'fabric';
import { commitHistory, createHistory, currentSnapshot, redoHistory, undoHistory } from '../../src/features/editor/engine/history';
import { cropDocument, resizeDocument, transformDocument, transformDocumentPoint } from '../../src/features/editor/engine/geometry';
import { exportImage } from '../../src/features/editor/engine/exportImage';
import type { ImageImportCandidate } from '../../src/features/editor/engine/imageImport';
import { createImageBaselineSnapshot, type EditorSnapshot, type ShapeOverlaySnapshot, type TextOverlaySnapshot } from '../../src/features/editor/engine/snapshot';
import { calculateResize } from '../../src/features/editor/engine/resize';

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
  const rectangle: ShapeOverlaySnapshot = {
    id: 'day12-rectangle', role: 'shape', shape: 'rectangle', left: 12, top: 10,
    width: 8, height: 6, fill: '#ef4444', stroke: null, strokeWidth: 0, ...transform,
  };
  const circle: ShapeOverlaySnapshot = {
    id: 'day12-circle', role: 'shape', shape: 'circle', left: 32, top: 28,
    radius: 4, fill: '#22c55e', stroke: null, strokeWidth: 0, ...transform,
  };
  const line: ShapeOverlaySnapshot = {
    id: 'day12-line', role: 'shape', shape: 'line', left: 18, top: 40,
    x2: 36, y2: 40, stroke: '#ffffff', strokeWidth: 2, ...transform,
  };
  const text: TextOverlaySnapshot = {
    id: 'day12-text', role: 'text', left: 38, top: 5, width: 20,
    text: 'T', fontFamily: 'Noto Sans', fontSize: 16, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', fill: '#000000', ...transform,
  };
  const hidden: ShapeOverlaySnapshot = {
    id: 'day12-hidden', role: 'shape', shape: 'rectangle', left: 20, top: 32,
    width: 6, height: 6, fill: '#facc15', stroke: null, strokeWidth: 0,
    ...transform, visible: false,
  };
  return { ...snapshot, scene: [...snapshot.scene, rectangle, circle, line, text, hidden] };
}

function createCandidate(): { candidate: ImageImportCandidate; sourceCanvas: HTMLCanvasElement } {
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = 64;
  sourceCanvas.height = 48;
  const context = sourceCanvas.getContext('2d');
  assert(context, 'Canvas 2D context is unavailable.');
  context.fillStyle = '#203040';
  context.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  context.fillStyle = '#facc15';
  context.fillRect(4, 4, 4, 4);
  const image = new FabricImage(sourceCanvas);
  return {
    sourceCanvas,
    candidate: {
      assetId: 'day12-source',
      source: new File([], 'day12-fixture.png', { type: 'image/png' }),
      image,
      sourceElement: sourceCanvas,
      width: sourceCanvas.width,
      height: sourceCanvas.height,
      dispose: () => image.dispose(),
    },
  };
}

function imagePixel(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * 4;
  return Array.from(data.slice(offset, offset + 4));
}

function isColor(actual: readonly number[], expected: readonly number[], tolerance = 3): boolean {
  return expected.every((value, index) => Math.abs(actual[index] - value) <= tolerance);
}

async function verifyExport(candidate: ImageImportCandidate, sourceCanvas: HTMLCanvasElement, snapshot: EditorSnapshot): Promise<void> {
  const sourceContext = sourceCanvas.getContext('2d')!;
  const before = Uint8ClampedArray.from(sourceContext.getImageData(0, 0, 64, 48).data);
  const blob = await exportImage(candidate, snapshot, {
    format: 'png', quality: 90, backgroundColor: '#ffffff',
  });
  assert(blob.type === 'image/png', `Resized export MIME was ${blob.type}.`);
  const bitmap = await createImageBitmap(blob);
  try {
    assert(bitmap.width === 32 && bitmap.height === 24,
      `Resized export dimensions were ${bitmap.width}×${bitmap.height}.`);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    assert(context, 'Canvas 2D context is unavailable for export verification.');
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    assert(isColor(imagePixel(pixels, bitmap.width, 2, 2), [250, 204, 21, 255]),
      'Resized source landmark moved or changed color.');
    assert(isColor(imagePixel(pixels, bitmap.width, 7, 6), [239, 68, 68, 255]),
      'Rectangle overlay did not follow the resize transform.');
    assert(isColor(imagePixel(pixels, bitmap.width, 18, 16), [34, 197, 94, 255]),
      'Circle overlay did not follow the resize transform.');
    const whiteLinePoints: [number, number][] = [];
    for (let y = 0; y < bitmap.height; y += 1) {
      for (let x = 0; x < bitmap.width; x += 1) {
        const color = imagePixel(pixels, bitmap.width, x, y);
        if (color[0] > 100 && color[1] > 100 && color[2] > 100 && color[3] > 200) whiteLinePoints.push([x, y]);
      }
    }
    assert(whiteLinePoints.length > 0, 'Line overlay was not exported.');
    const lineBounds = whiteLinePoints.reduce(([minX, minY, maxX, maxY], [x, y]) => [
      Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y),
    ], [bitmap.width, bitmap.height, 0, 0]);
    assert(lineBounds[0] >= 8 && lineBounds[2] <= 20 && lineBounds[1] >= 18 && lineBounds[3] <= 22,
      `Line overlay moved outside its resized bounds: ${lineBounds.join(',')}.`);
    let darkTextPixels = 0;
    for (let y = 2; y < 13; y += 1) {
      for (let x = 19; x < 32; x += 1) {
        const color = imagePixel(pixels, bitmap.width, x, y);
        if (color[0] < 20 && color[1] < 20 && color[2] < 20 && color[3] > 200) darkTextPixels += 1;
      }
    }
    assert(darkTextPixels > 0, 'Text overlay did not follow the resize transform.');
    assert(isColor(imagePixel(pixels, bitmap.width, 11, 17), [32, 48, 64, 255]), 'Hidden overlay was exported.');
  } finally {
    bitmap.close();
  }
  const after = sourceContext.getImageData(0, 0, 64, 48).data;
  assert(before.every((value, index) => value === after[index]), 'Resize or export changed the immutable source pixels.');
}

async function runAssertions(candidate: ImageImportCandidate, sourceCanvas: HTMLCanvasElement): Promise<string[]> {
  const lines: string[] = [];
  const baseline = fixtureScene(createImageBaselineSnapshot('day12-source', 64, 48));
  const result = calculateResize(baseline.document, 'width', '32');
  assert(result.valid, 'Valid 50% resize dimensions were rejected.');
  const resized = resizeDocument(baseline, result.dimensions, result.scale);
  assert(resized.document.width === 32 && resized.document.height === 24, 'Resize changed dimensions incorrectly.');
  assert(resized.scene === baseline.scene, 'Resize must retain source and ordered scene records.');
  assert(JSON.stringify(resized.documentTransform) === JSON.stringify([0.5, 0, 0, 0.5, 0, 0]),
    'Resize did not prepend a uniform scale to the shared document matrix.');
  assert(resizeDocument(baseline, { width: 64, height: 48 }, 1) === baseline, 'A same-size resize must preserve snapshot identity.');
  expectThrow(() => resizeDocument(baseline, { width: 32, height: 24 }, 0.25), 'A mismatched scale must be rejected.');
  expectThrow(() => resizeDocument(baseline, { width: 32, height: 24 }, Number.NaN), 'A non-finite scale must be rejected.');
  expectThrow(() => resizeDocument(baseline, { width: 32, height: 24 }, 0), 'A non-positive scale must be rejected.');
  expectThrow(() => resizeDocument(baseline, { width: 8193, height: 6145 }, 128.015625), 'An edge above the limit must be rejected.');
  expectThrow(() => resizeDocument(baseline, { width: 8192, height: 6144 }, 128), 'A document above 12 MP must be rejected.');
  lines.push('PASS uniform resize, unchanged scene/source references, no-op, and command validation');

  const cropped = cropDocument(baseline, { x: 4, y: 6, width: 48, height: 36 }, 'free');
  const rotated = transformDocument(cropped, 'rotate-right');
  const scaled = resizeDocument(rotated, { width: 18, height: 24 }, 0.5);
  const pointBefore = transformDocumentPoint(rotated.documentTransform, 20, 10);
  const pointAfter = transformDocumentPoint(scaled.documentTransform, 20, 10);
  assert(near(pointAfter[0], pointBefore[0] * 0.5) && near(pointAfter[1], pointBefore[1] * 0.5),
    'Resize did not compose in current-document coordinates after crop/rotation.');
  assert(scaled.document.width === 18 && scaled.document.height === 24, 'Resize after rotation used stale dimensions.');
  lines.push('PASS resize composes with prior crop/rotation in current-document coordinates');

  let history = createHistory(baseline);
  const noOpHistory = commitHistory(history, resizeDocument(baseline, { width: 64, height: 48 }, 1));
  assert(noOpHistory === history && history.revision === 0, 'A no-op resize must not create history.');
  history = commitHistory(history, resized);
  assert(history.revision === 1, 'Apply must create exactly one history revision.');
  const undone = undoHistory(history);
  assert(JSON.stringify(currentSnapshot(undone)) === JSON.stringify(baseline), 'Undo did not restore the original snapshot.');
  const redone = redoHistory(undone);
  assert(JSON.stringify(currentSnapshot(redone)) === JSON.stringify(resized), 'Redo did not restore the exact resized snapshot.');
  lines.push('PASS one-step history commit, exact undo, and redo');

  await verifyExport(candidate, sourceCanvas, resized);
  lines.push('PASS resized PNG dimensions and source/text/shape pixels; original source pixels unchanged');
  return lines;
}

runButton.addEventListener('click', async () => {
  runButton.disabled = true;
  results.textContent = 'Đang chạy…';
  const { candidate, sourceCanvas } = createCandidate();
  try {
    results.textContent = (await runAssertions(candidate, sourceCanvas)).join('\n');
  } catch (error) {
    results.textContent = `FAIL ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    candidate.dispose();
    runButton.disabled = false;
  }
});
