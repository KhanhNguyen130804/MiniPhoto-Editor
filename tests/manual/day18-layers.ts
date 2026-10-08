import { FabricImage } from 'fabric';
import { commitHistory, createHistory, currentSnapshot, redoHistory, undoHistory } from '../../src/features/editor/engine/history';
import { exportImage } from '../../src/features/editor/engine/exportImage';
import { deleteOverlayLayer, getLayerList, setLayerVisibility } from '../../src/features/editor/engine/layers';
import type { ImageImportCandidate } from '../../src/features/editor/engine/imageImport';
import { createFabricOverlays } from '../../src/features/editor/engine/scene';
import { createImageBaselineSnapshot, type EditorSnapshot, type ShapeOverlaySnapshot, type TextOverlaySnapshot } from '../../src/features/editor/engine/snapshot';
import { createDefaultShapeObject, putShapeOverlay } from '../../src/features/editor/engine/shapes';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLElement>('#results')!;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeShape(snapshot: EditorSnapshot, id: string, shape: 'rectangle' | 'circle' | 'line'): EditorSnapshot {
  const created = createDefaultShapeObject(snapshot, id, shape);
  try { return putShapeOverlay(snapshot, created.overlay); }
  finally { created.object.dispose(); }
}

function createFixture(width: number, height: number): ImageImportCandidate {
  const sourceElement = document.createElement('canvas');
  sourceElement.width = width;
  sourceElement.height = height;
  const context = sourceElement.getContext('2d');
  assert(context, 'Canvas 2D context is unavailable.');
  context.fillStyle = '#f87171';
  context.fillRect(0, 0, width, height);
  const image = new FabricImage(sourceElement);
  return {
    assetId: 'day18-layers-fixture',
    source: new File([], 'day18.png', { type: 'image/png' }),
    image,
    sourceElement,
    width,
    height,
    dispose: () => image.dispose(),
  };
}

async function pixels(blob: Blob): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    assert(context, 'Canvas 2D context is unavailable for export checks.');
    context.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height, data: context.getImageData(0, 0, bitmap.width, bitmap.height).data };
  } finally {
    bitmap.close();
  }
}

function pixelAt(image: { width: number; data: Uint8ClampedArray }, x: number, y: number): number[] {
  const offset = (y * image.width + x) * 4;
  return Array.from(image.data.slice(offset, offset + 4));
}

function nearColor(actual: number[], expected: number[], tolerance = 12): boolean {
  return actual.slice(0, 3).every((channel, index) => Math.abs(channel - expected[index]!) <= tolerance);
}

async function runAssertions(): Promise<string[]> {
  const lines: string[] = [];
  const baseline = createImageBaselineSnapshot('day18-layers-fixture', 320, 220);
  const text: TextOverlaySnapshot = {
    id: 'layer-text', role: 'text', text: 'Tiêu đề\nphụ để kiểm tra tên lớp',
    left: 4, top: 5, scaleX: 1, scaleY: 1, angle: 0, flipX: false, flipY: false,
    visible: true, opacity: 1, width: 160, fontFamily: 'Noto Sans', fontSize: 24,
    fontWeight: 400, fontStyle: 'normal', textAlign: 'left', fill: '#111827',
  };
  let snapshot: EditorSnapshot = { ...baseline, scene: [...baseline.scene, text] };
  snapshot = makeShape(snapshot, 'rectangle-one', 'rectangle');
  snapshot = makeShape(snapshot, 'rectangle-two', 'rectangle');
  snapshot = makeShape(snapshot, 'circle-one', 'circle');
  snapshot = makeShape(snapshot, 'line-one', 'line');

  const layers = getLayerList(snapshot);
  assert(layers.map((layer) => layer.id).join(',') === 'line-one,circle-one,rectangle-two,rectangle-one,layer-text,day18-layers-fixture',
    'Layers must be listed topmost first with the background last.');
  assert(layers.map((layer) => layer.name).join('|') === 'Đường thẳng 1|Hình tròn 1|Hình chữ nhật 2|Hình chữ nhật 1|Tiêu đề phụ để kiểm tra tên lớp|Ảnh nền',
    'Layer names must use shape ordinals and the beginning of text content.');
  lines.push('PASS topmost-first order, background last, text label and per-shape numbering');

  const hidden = setLayerVisibility(snapshot, 'rectangle-two', false);
  assert(hidden !== snapshot && hidden.scene.map((item) => item.id).join(',') === snapshot.scene.map((item) => item.id).join(','),
    'Visibility changes must preserve scene order and IDs.');
  assert(hidden.scene.find((item) => item.id === 'rectangle-two')?.visible === false
    && hidden.scene.find((item) => item.id === 'rectangle-one')?.visible === true,
  'Visibility changes must affect only the requested layer.');
  assert(setLayerVisibility(hidden, 'rectangle-two', false) === hidden
    && setLayerVisibility(snapshot, 'missing-layer', false) === snapshot,
  'Visibility no-ops and missing IDs must preserve the original snapshot.');
  const hiddenBackground = setLayerVisibility(snapshot, 'day18-layers-fixture', false);
  assert(hiddenBackground.scene[0]?.visible === false && hiddenBackground.scene[0]?.role === 'source-image',
    'The background must be hideable while remaining the first scene object.');
  lines.push('PASS immutable visibility, no-op identity, stable order and hideable background');

  const deletedText = deleteOverlayLayer(snapshot, 'layer-text');
  const deletedShape = deleteOverlayLayer(deletedText, 'rectangle-two');
  assert(deletedShape.scene[0]?.role === 'source-image' && deletedShape.scene.some((item) => item.id === 'rectangle-one')
    && !deletedShape.scene.some((item) => item.id === 'layer-text' || item.id === 'rectangle-two'),
  'Deleting text and shape overlays must retain the source and remaining scene order.');
  assert(deleteOverlayLayer(snapshot, 'day18-layers-fixture') === snapshot
    && deleteOverlayLayer(snapshot, 'missing-layer') === snapshot,
  'The background and a missing layer must not be deletable.');
  lines.push('PASS overlay deletion, source retention and protected background');

  let history = createHistory(snapshot);
  history = commitHistory(history, hidden);
  assert(commitHistory(history, hidden) === history, 'A visibility no-op must not add a history step.');
  assert(currentSnapshot(undoHistory(history)).scene.find((item) => item.id === 'rectangle-two')?.visible === true,
    'Undo must restore layer visibility.');
  assert(currentSnapshot(redoHistory(history)).scene.find((item) => item.id === 'rectangle-two')?.visible === false,
    'Redo must restore hidden visibility.');
  history = commitHistory(history, deletedShape);
  const undoDelete = currentSnapshot(undoHistory(history));
  assert(undoDelete.scene.map((item) => item.id).join(',') === hidden.scene.map((item) => item.id).join(','),
    'Undo after deletion must restore the prior layer stack.');
  assert(currentSnapshot(redoHistory(history)).scene.map((item) => item.id).join(',') === deletedShape.scene.map((item) => item.id).join(','),
    'Redo after deletion must restore the deleted layer state.');
  lines.push('PASS visibility and deletion history, no-op suppression, undo and redo');

  const fixture = createFixture(32, 24);
  try {
    const smallBaseline = createImageBaselineSnapshot(fixture.assetId, fixture.width, fixture.height);
    const created = createDefaultShapeObject(smallBaseline, 'pixel-shape', 'rectangle');
    const greenRectangle: ShapeOverlaySnapshot = {
      ...created.overlay, fill: '#22c55e', stroke: null, strokeWidth: 0, visible: false,
    };
    created.object.dispose();
    const hiddenShapeSnapshot = putShapeOverlay(smallBaseline, greenRectangle);
    const interactive = createFabricOverlays(hiddenShapeSnapshot.scene, true)[0];
    assert(interactive && interactive.selectable === false && interactive.evented === false,
      'Hidden overlays must be excluded from Fabric selection and hit testing.');
    interactive?.dispose();

    const hiddenShapePng = await pixels(await exportImage(fixture, hiddenShapeSnapshot, {
      format: 'png', quality: 90, backgroundColor: '#ffffff',
    }));
    assert(pixelAt(hiddenShapePng, 16, 12).join(',') === '248,113,113,255',
      'A hidden shape must not affect PNG export pixels.');

    const emptySnapshot = setLayerVisibility(hiddenShapeSnapshot, fixture.assetId, false);
    const transparentPng = await pixels(await exportImage(fixture, emptySnapshot, {
      format: 'png', quality: 90, backgroundColor: '#ffffff',
    }));
    assert(pixelAt(transparentPng, 16, 12).join(',') === '0,0,0,0',
      'A hidden background and hidden overlays must export transparent PNG pixels.');

    const matte = [36, 104, 172];
    const jpeg = await pixels(await exportImage(fixture, emptySnapshot, {
      format: 'jpeg', quality: 100, backgroundColor: '#2468ac',
    }));
    assert(nearColor(pixelAt(jpeg, 16, 12), matte), 'An empty JPEG export must use the chosen matte color.');
    lines.push('PASS hidden overlay hit testing/export, transparent PNG and selected JPEG matte');
  } finally {
    fixture.dispose();
  }

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
