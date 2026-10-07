import { FabricImage } from 'fabric';
import { commitHistory, createHistory, currentSnapshot, redoHistory, undoHistory } from '../../src/features/editor/engine/history';
import { decodeWithFabricUrl } from '../../src/features/editor/engine/imageImport';
import { exportImage } from '../../src/features/editor/engine/exportImage';
import { transformDocument, transformDocumentPoint } from '../../src/features/editor/engine/geometry';
import { createImageBaselineSnapshot, type EditorSnapshot } from '../../src/features/editor/engine/snapshot';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLElement>('#results')!;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function near(actual: number, expected: number, tolerance = 0.001): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function identity(matrix: readonly number[]): boolean {
  return matrix.length === 6 && matrix.every((value, index) => near(value, [1, 0, 0, 1, 0, 0][index]));
}

async function fixture(name: string, type: string): Promise<File> {
  const response = await fetch(`/tests/fixtures/day2-import/${name}`);
  assert(response.ok, `Fixture request failed (${response.status}).`);
  return new File([await response.blob()], name, { type });
}

async function imagePixels(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    assert(context, 'Canvas 2D context is unavailable.');
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

function runGeometry(): string[] {
  const lines: string[] = [];
  const baseline = createImageBaselineSnapshot('geometry-asset', 3, 1);
  const right = transformDocument(baseline, 'rotate-right');
  assert(right.document.width === 1 && right.document.height === 3, 'Clockwise rotation did not swap dimensions.');
  assert(JSON.stringify(transformDocumentPoint(right.documentTransform, 0, 0)) === JSON.stringify([1, 0]),
    'Clockwise rotation did not map the top-left point.');
  assert(JSON.stringify(transformDocumentPoint(right.documentTransform, 2, 0)) === JSON.stringify([1, 2]),
    'Clockwise rotation did not map the bottom-right point.');

  let fourTurns: EditorSnapshot = baseline;
  for (let count = 0; count < 4; count += 1) fourTurns = transformDocument(fourTurns, 'rotate-right');
  assert(fourTurns.document.width === 3 && fourTurns.document.height === 1
    && identity(fourTurns.documentTransform), 'Four quarter-turns did not return to identity.');
  assert(identity(transformDocument(transformDocument(baseline, 'flip-horizontal'), 'flip-horizontal').documentTransform),
    'Two horizontal flips did not return to identity.');
  assert(identity(transformDocument(transformDocument(baseline, 'flip-vertical'), 'flip-vertical').documentTransform),
    'Two vertical flips did not return to identity.');
  assert(identity(transformDocument(right, 'rotate-left').documentTransform), 'Opposite quarter-turns did not cancel.');
  lines.push('PASS rotation and flip matrices, dimensions, and inverse sequences');

  const syntheticLayers = [
    { id: 'hidden', visible: false, x: -2, y: 4 },
    { id: 'off-canvas', visible: true, x: 8, y: -1 },
  ];
  const projected = syntheticLayers.map((layer) => ({
    id: layer.id,
    visible: layer.visible,
    point: transformDocumentPoint(right.documentTransform, layer.x, layer.y),
  }));
  assert(projected[0].id === 'hidden' && !projected[0].visible
    && JSON.stringify(projected[0].point) === JSON.stringify([-3, -2]), 'Hidden synthetic layer metadata/geometry changed.');
  assert(projected[1].id === 'off-canvas' && projected[1].visible
    && JSON.stringify(projected[1].point) === JSON.stringify([2, 8]), 'Off-canvas synthetic layer geometry changed.');
  assert(right.scene === baseline.scene, 'Geometry must retain scene metadata while recording the shared document transform.');
  lines.push('PASS shared document matrix maps hidden/off-canvas sample points without changing metadata');

  let history = createHistory(baseline);
  history = commitHistory(history, right);
  const undone = undoHistory(history);
  assert(currentSnapshot(undone).document.width === 3, 'Undo did not restore the original document.');
  assert(currentSnapshot(redoHistory(undone)).document.height === 3, 'Redo did not restore the rotation.');
  lines.push('PASS a geometry command commits as one undo/redo snapshot');
  return lines;
}

async function runExports(): Promise<string[]> {
  const lines: string[] = [];
  const candidate = await decodeWithFabricUrl(await fixture('png-alpha.png', 'image/png'));
  try {
    const baseline = createImageBaselineSnapshot(candidate.assetId, candidate.width, candidate.height);
    const png = await exportImage(candidate, baseline, {
      format: 'png', quality: 90, backgroundColor: '#ffffff',
    });
    assert(png.type === 'image/png', `PNG MIME was ${png.type}.`);
    const pngPixels = await imagePixels(png);
    assert(pngPixels.width === 3 && pngPixels.height === 1, 'PNG output dimensions did not match the document.');
    assert([0, 1, 2].every((x, index) => Math.abs(pngPixels.data[x * 4 + 3] - [0, 128, 255][index]) <= 2),
      'PNG output did not preserve source alpha.');

    const rotated = await exportImage(candidate, transformDocument(baseline, 'rotate-right'), {
      format: 'png', quality: 90, backgroundColor: '#ffffff',
    });
    const rotatedPixels = await imagePixels(rotated);
    assert(rotatedPixels.width === 1 && rotatedPixels.height === 3, 'Rotated PNG dimensions were not 1×3.');
    assert([0, 1, 2].every((y, index) => Math.abs(rotatedPixels.data[y * 4 + 3] - [0, 128, 255][index]) <= 2),
      'Rotated PNG alpha pixels were not mapped with the document.');
    lines.push('PASS full-resolution PNG MIME, dimensions, alpha, and rotated output');

    const largeCandidate = await decodeWithFabricUrl(await fixture('webp-static.webp', 'image/webp'));
    try {
      const largeBaseline = createImageBaselineSnapshot(
        largeCandidate.assetId, largeCandidate.width, largeCandidate.height,
      );
      const largePng = await exportImage(largeCandidate, largeBaseline, {
        format: 'png', quality: 90, backgroundColor: '#ffffff',
      });
      const largeBitmap = await createImageBitmap(largePng);
      try {
        assert(largeBitmap.width === largeCandidate.width && largeBitmap.height === largeCandidate.height,
          `Full-size WebP export was ${largeBitmap.width}×${largeBitmap.height}, expected ${largeCandidate.width}×${largeCandidate.height}.`);
      } finally {
        largeBitmap.close();
      }
      lines.push(`PASS source-size export preserves ${largeCandidate.width}×${largeCandidate.height} pixels`);
    } finally {
      largeCandidate.dispose();
    }

    const transparentCanvas = document.createElement('canvas');
    transparentCanvas.width = 2;
    transparentCanvas.height = 2;
    const image = new FabricImage(transparentCanvas);
    const transparentCandidate = {
      assetId: 'transparent-jpeg-asset',
      source: new File([], 'transparent.png', { type: 'image/png' }),
      image,
      width: 2,
      height: 2,
      dispose: () => image.dispose(),
    };
    try {
      const transparentSnapshot = createImageBaselineSnapshot(transparentCandidate.assetId, 2, 2);
      const jpeg = await exportImage(transparentCandidate, transparentSnapshot, {
        format: 'jpeg', quality: 100, backgroundColor: '#ff0000',
      });
      assert(jpeg.type === 'image/jpeg', `JPG MIME was ${jpeg.type}.`);
      const jpegPixels = await imagePixels(jpeg);
      assert(jpegPixels.width === 2 && jpegPixels.height === 2, 'JPG output dimensions did not match the document.');
      assert(Array.from({ length: 4 }, (_, index) => {
        const offset = index * 4;
        return jpegPixels.data[offset] > 220 && jpegPixels.data[offset + 1] < 35
          && jpegPixels.data[offset + 2] < 35 && jpegPixels.data[offset + 3] === 255;
      }).every(Boolean), 'JPG output did not flatten transparent pixels onto the requested background.');
      lines.push('PASS JPG MIME, dimensions, opaque output, and selected background color');
    } finally {
      transparentCandidate.dispose();
    }
  } finally {
    candidate.dispose();
  }
  return lines;
}

runButton.addEventListener('click', async () => {
  runButton.disabled = true;
  results.textContent = 'Đang chạy…';
  try {
    const lines = runGeometry();
    lines.push(...await runExports());
    results.textContent = lines.join('\n');
  } catch (error) {
    results.textContent = `FAIL ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    runButton.disabled = false;
  }
});
