import { createHistory, currentSnapshot } from '../../src/features/editor/engine/history';
import { decodeWithFabricUrl } from '../../src/features/editor/engine/imageImport';
import { createCompareSnapshot } from '../../src/features/editor/engine/adjustmentFilters';
import { exportImage } from '../../src/features/editor/engine/exportImage';
import { createImageBaselineSnapshot, type EditorSnapshot, type ShapeOverlaySnapshot } from '../../src/features/editor/engine/snapshot';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLElement>('#results')!;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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

async function run(): Promise<string[]> {
  const lines: string[] = [];
  const response = await fetch('/tests/fixtures/day2-import/jpeg-orientation-1.jpg');
  assert(response.ok, `Fixture request failed (${response.status}).`);
  const file = new File([await response.blob()], 'jpeg-orientation-1.jpg', { type: 'image/jpeg' });
  const candidate = await decodeWithFabricUrl(file);
  try {
    const baseline = createImageBaselineSnapshot(candidate.assetId, candidate.width, candidate.height);
    const overlay: ShapeOverlaySnapshot = {
      id: 'compare-test-shape', role: 'shape', shape: 'rectangle', left: 0, top: 0,
      width: candidate.width, height: candidate.height, scaleX: 1, scaleY: 1, angle: 0,
      flipX: false, flipY: false, visible: true, opacity: 1, fill: '#ff0000', stroke: null, strokeWidth: 0,
    };
    const edited: EditorSnapshot = {
      ...baseline,
      documentTransform: [0, 1, -1, 0, candidate.height, 0],
      imageAppearance: { presetId: 'vivid', presetVersion: 1, brightness: 24, contrast: -15, saturation: 33 },
      scene: [{ ...baseline.scene[0]!, visible: false, left: 4, top: 6, angle: 90 }, overlay],
    };
    const originalJson = JSON.stringify(edited);
    const history = createHistory(edited);
    const historyJson = JSON.stringify(history);
    const compare = createCompareSnapshot(edited);

    assert(compare !== edited, 'Compare must return a render-only snapshot.');
    assert(compare.document.width === edited.document.width && compare.document.height === edited.document.height
      && compare.document.sourceAssetId === edited.document.sourceAssetId, 'Compare changed document dimensions or source identity.');
    assert(JSON.stringify(compare.documentTransform) === JSON.stringify(edited.documentTransform)
      && compare.scene[0]?.left === 4 && compare.scene[0]?.top === 6 && compare.scene[0]?.angle === 90,
    'Compare changed document geometry or transform.');
    lines.push('PASS compare preserves document size, crop/transform and source identity');

    assert(compare.imageAppearance.presetId === 'original' && compare.imageAppearance.brightness === 0
      && compare.imageAppearance.contrast === 0 && compare.imageAppearance.saturation === 0,
    'Compare did not reset the temporary appearance.');
    assert(compare.scene[0]?.visible === true && compare.scene[1]?.visible === false,
      'Compare did not temporarily show the source and hide the overlay.');
    lines.push('PASS compare temporarily restores Original/source visibility and hides overlay');

    assert(JSON.stringify(edited) === originalJson, 'Compare mutated the edited snapshot.');
    assert(JSON.stringify(history) === historyJson && JSON.stringify(currentSnapshot(history)) === originalJson,
      'Compare changed history or its current snapshot.');
    lines.push('PASS edited snapshot and history remain unchanged');

    const editedPng = await exportImage(candidate, edited, { format: 'png', quality: 90, backgroundColor: '#ffffff' });
    const comparePng = await exportImage(candidate, compare, { format: 'png', quality: 90, backgroundColor: '#ffffff' });
    const [editedPixels, comparePixels] = await Promise.all([imagePixels(editedPng), imagePixels(comparePng)]);
    assert(editedPixels.width === candidate.width && editedPixels.height === candidate.height
      && comparePixels.width === candidate.width && comparePixels.height === candidate.height,
    'Compare or edited export changed output dimensions.');
    assert(editedPixels.data[0] === 255 && editedPixels.data[1] === 0 && editedPixels.data[2] === 0,
      'Export did not render the edited snapshot supplied to it.');
    assert(comparePixels.data.some((value, index) => index % 4 !== 3 && value !== editedPixels.data[index]),
      'Compare export did not render its temporary preview snapshot.');
    assert(JSON.stringify(edited) === originalJson, 'Export changed the edited snapshot.');
    lines.push(`PASS export remains bound to its supplied edited snapshot at ${candidate.width}×${candidate.height}`);
    lines.push(`ENV ${navigator.userAgent} | viewport ${innerWidth}×${innerHeight} | DPR ${devicePixelRatio}`);
    return lines;
  } finally {
    candidate.dispose();
  }
}

runButton.addEventListener('click', async () => {
  runButton.disabled = true;
  results.textContent = 'Đang chạy…';
  try {
    results.textContent = (await run()).join('\n');
  } catch (error) {
    results.textContent = `FAIL ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    runButton.disabled = false;
  }
});
