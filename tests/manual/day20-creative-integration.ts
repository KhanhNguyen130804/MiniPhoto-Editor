import { FabricImage } from 'fabric';
import { applyShapePropertiesPatch, createDefaultShapeObject, putShapeOverlay, serializeShapeObject, type ShapeKind, type ShapePropertiesPatch } from '../../src/features/editor/engine/shapes';
import { commitHistory, createHistory, currentSnapshot, redoHistory, undoHistory, canUndo, canRedo } from '../../src/features/editor/engine/history';
import { exportImage } from '../../src/features/editor/engine/exportImage';
import { cropDocument, resizeDocument, transformDocument } from '../../src/features/editor/engine/geometry';
import { createImageBaselineSnapshot, type EditorSnapshot } from '../../src/features/editor/engine/snapshot';
import { deleteOverlayLayer, reorderOverlayLayer, setLayerVisibility } from '../../src/features/editor/engine/layers';
import { selectImagePreset } from '../../src/features/editor/engine/adjustmentFilters';
import { createDefaultTextObject, putTextOverlay, serializeTextObject } from '../../src/features/editor/engine/text';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLElement>('#results')!;
const FIXTURE_ID = 'day20-creative-integration-fixture';
const RECTANGLE_ID = 'day20-green-rectangle';
const CIRCLE_ID = 'day20-blue-circle';
const LINE_ID = 'day20-red-line';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nearColor(actual: number[], expected: number[], tolerance = 8): boolean {
  return actual.slice(0, 3).every((channel, index) => Math.abs(channel - expected[index]!) <= tolerance);
}

function createFixture() {
  const sourceElement = document.createElement('canvas');
  sourceElement.width = 64;
  sourceElement.height = 48;
  const context = sourceElement.getContext('2d');
  assert(context, 'Canvas 2D context is unavailable.');
  context.fillStyle = '#808080';
  context.fillRect(0, 0, sourceElement.width, sourceElement.height);
  context.fillStyle = '#f87171';
  context.fillRect(0, 0, 16, 16);
  context.fillStyle = '#2563eb';
  context.fillRect(48, 0, 16, 16);
  context.clearRect(56, 40, 4, 4);
  const image = new FabricImage(sourceElement);
  return {
    candidate: {
      assetId: FIXTURE_ID,
      source: new File([], 'day20.png', { type: 'image/png' }),
      image,
      sourceElement,
      width: sourceElement.width,
      height: sourceElement.height,
      dispose: () => image.dispose(),
    },
    dispose: () => image.dispose(),
  };
}

async function readPixels(blob: Blob): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    assert(context, 'Canvas 2D context is unavailable for output checks.');
    context.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height, data: context.getImageData(0, 0, bitmap.width, bitmap.height).data };
  } finally {
    bitmap.close();
  }
}

function pixel(image: { width: number; data: Uint8ClampedArray }, x: number, y: number): number[] {
  const offset = (y * image.width + x) * 4;
  return Array.from(image.data.slice(offset, offset + 4));
}

function addShape(snapshot: EditorSnapshot, id: string, kind: ShapeKind, patch: ShapePropertiesPatch): EditorSnapshot {
  const created = createDefaultShapeObject(snapshot, id, kind);
  try {
    applyShapePropertiesPatch(created.object, patch);
    const overlay = serializeShapeObject(snapshot, created.object, created.overlay);
    return putShapeOverlay(snapshot, overlay);
  } finally {
    created.object.dispose();
  }
}

function addVietnameseText(snapshot: EditorSnapshot): EditorSnapshot {
  const created = createDefaultTextObject(snapshot, 'day20-vietnamese-text');
  try {
    created.object.set({ text: 'Tiếng Việt: Ắ ễ đ ộ\nMùa hè' , left: 1, top: 1 });
    created.object.initDimensions();
    created.object.setCoords();
    return putTextOverlay(snapshot, serializeTextObject(snapshot, created.object, created.overlay));
  } finally {
    created.object.dispose();
  }
}

async function runAssertions(): Promise<string[]> {
  const lines: string[] = [];
  const fixture = createFixture();
  try {
    const baseline = createImageBaselineSnapshot(FIXTURE_ID, 64, 48);
    let history = createHistory(baseline);
    const checkpoints: EditorSnapshot[] = [currentSnapshot(history)];
    const commit = (snapshot: EditorSnapshot) => {
      const next = commitHistory(history, snapshot);
      assert(next !== history, 'Every non-no-op user action must commit one history step.');
      history = next;
      checkpoints.push(currentSnapshot(history));
    };

    commit(cropDocument(currentSnapshot(history), { x: 4, y: 4, width: 56, height: 40 }, 'free'));
    commit(resizeDocument(currentSnapshot(history), { width: 112, height: 80 }, 2));
    commit(transformDocument(currentSnapshot(history), 'rotate-right'));
    assert(currentSnapshot(history).document.width === 80 && currentSnapshot(history).document.height === 112,
      'Crop, resize and rotate must compose document dimensions in pixel space.');
    lines.push('PASS crop → 2× resize → rotate preserves a valid 80×112 document');

    commit(selectImagePreset(currentSnapshot(history), 'warm'));
    const appearance = currentSnapshot(history).imageAppearance;
    commit({
      ...currentSnapshot(history),
      imageAppearance: { ...appearance, brightness: 18, contrast: -9, saturation: 11 },
    });
    commit(addShape(currentSnapshot(history), RECTANGLE_ID, 'rectangle', {
      fill: '#22c55e', stroke: '#111827', strokeWidth: 2, opacity: 1,
    }));
    commit(addShape(currentSnapshot(history), CIRCLE_ID, 'circle', {
      fill: '#2563eb', stroke: null, strokeWidth: 0, opacity: 0.5,
    }));
    commit(addShape(currentSnapshot(history), LINE_ID, 'line', {
      stroke: '#ef4444', strokeWidth: 4, opacity: 1,
    }));
    commit(addVietnameseText(currentSnapshot(history)));
    lines.push('PASS preset and sliders, Vietnamese multiline text, and rectangle/circle/line styles');

    const withLine = currentSnapshot(history);
    const withLineBlob = await exportImage(fixture.candidate, withLine, {
      format: 'png', quality: 90, backgroundColor: '#ffffff',
    });
    const withLinePixels = await readPixels(withLineBlob);
    assert(withLineBlob.type === 'image/png' && withLinePixels.width === 80 && withLinePixels.height === 112,
      'PNG export must preserve the current document dimensions and MIME.');
    assert(nearColor(pixel(withLinePixels, 40, 56), [239, 68, 68]),
      'The line stroke must render above overlapping shapes before deletion.');

    commit(deleteOverlayLayer(withLine, LINE_ID));
    const withoutLine = currentSnapshot(history);
    const withoutLineBlob = await exportImage(fixture.candidate, withoutLine, {
      format: 'png', quality: 90, backgroundColor: '#ffffff',
    });
    const withoutLinePixels = await readPixels(withoutLineBlob);
    assert(nearColor(pixel(withoutLinePixels, 40, 56), [35.5, 148, 164.5], 12),
      'Deleting the line must reveal the half-opacity blue circle over the green rectangle.');

    const reordered = reorderOverlayLayer(withoutLine, RECTANGLE_ID, 'up');
    commit(reordered);
    const reorderedBlob = await exportImage(fixture.candidate, currentSnapshot(history), {
      format: 'png', quality: 90, backgroundColor: '#ffffff',
    });
    const reorderedPixels = await readPixels(reorderedBlob);
    assert(nearColor(pixel(reorderedPixels, 40, 56), [34, 197, 94]),
      'Reordering must make the opaque green rectangle render above the circle.');
    assert(reordered.scene[0]?.role === 'source-image'
      && deleteOverlayLayer(reordered, FIXTURE_ID) === reordered
      && reorderOverlayLayer(reordered, FIXTURE_ID, 'up') === reordered,
    'The source image must stay at the bottom and cannot be deleted or reordered.');
    lines.push('PASS delete and reorder change exported pixels while protecting the background');

    commit(setLayerVisibility(currentSnapshot(history), CIRCLE_ID, false));
    const hidden = currentSnapshot(history);
    const hiddenBlob = await exportImage(fixture.candidate, hidden, {
      format: 'png', quality: 90, backgroundColor: '#ffffff',
    });
    const hiddenPixels = await readPixels(hiddenBlob);
    assert(nearColor(pixel(hiddenPixels, 40, 56), [34, 197, 94]),
      'A hidden circle must not affect the exported topmost rectangle.');
    assert(pixel(hiddenPixels, 4, 106)[3] === 0,
      'PNG export must retain alpha through crop, resize and rotation.');
    assert(hidden.scene.find((item) => item.id === CIRCLE_ID)?.visible === false,
      'Layer visibility must remain part of the exported snapshot.');
    lines.push('PASS hidden-layer export, alpha, and transformed output dimensions');

    const afterExport = history;
    assert(commitHistory(history, currentSnapshot(history)) === history && history === afterExport,
      'No-op snapshots and export must not create history.');
    let cursor = history;
    for (let index = checkpoints.length - 1; index >= 0; index -= 1) {
      assert(JSON.stringify(currentSnapshot(cursor)) === JSON.stringify(checkpoints[index]),
        `Undo/redo sequence failed at checkpoint ${index}.`);
      if (index > 0) cursor = undoHistory(cursor);
    }
    assert(!canUndo(cursor), 'Undo must return to the initial source baseline.');
    for (let index = 1; index < checkpoints.length; index += 1) {
      cursor = redoHistory(cursor);
      assert(JSON.stringify(currentSnapshot(cursor)) === JSON.stringify(checkpoints[index]),
        `Redo failed to restore checkpoint ${index}.`);
    }
    assert(!canRedo(cursor), 'Redo must finish at the final integrated snapshot.');

    const branchBase = undoHistory(cursor);
    const branchCurrent = currentSnapshot(branchBase);
    const circleVisible = branchCurrent.scene.find((item) => item.id === CIRCLE_ID)?.visible;
    assert(typeof circleVisible === 'boolean', 'The branch test circle must still exist.');
    const branchSnapshot = setLayerVisibility(branchCurrent, CIRCLE_ID, !circleVisible);
    const branch = commitHistory(branchBase, branchSnapshot);
    assert(canRedo(branchBase) && !canRedo(branch), 'A new edit after Undo must discard the redo branch.');
    lines.push('PASS full-snapshot Undo/Redo, one-step commits, no-op suppression and redo-branch invalidation');
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
