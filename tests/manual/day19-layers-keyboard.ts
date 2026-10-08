import { FabricImage } from 'fabric';
import { commitHistory, createHistory, currentSnapshot, redoHistory, undoHistory } from '../../src/features/editor/engine/history';
import { exportImage } from '../../src/features/editor/engine/exportImage';
import { getLayerList, nudgeOverlayLayer, reorderOverlayLayer } from '../../src/features/editor/engine/layers';
import { createNudgeInput, pressNudgeKey, releaseNudgeKey } from '../../src/features/editor/engine/nudgeInput';
import type { ImageImportCandidate } from '../../src/features/editor/engine/imageImport';
import { createImageBaselineSnapshot, type EditorSnapshot, type ShapeOverlaySnapshot, type TextOverlaySnapshot } from '../../src/features/editor/engine/snapshot';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLElement>('#results')!;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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
    assetId: 'day19-layers-fixture',
    source: new File([], 'day19.png', { type: 'image/png' }),
    image,
    sourceElement,
    width,
    height,
    dispose: () => image.dispose(),
  };
}

async function pixel(blob: Blob, x: number, y: number): Promise<number[]> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    assert(context, 'Canvas 2D context is unavailable for export checks.');
    context.drawImage(bitmap, 0, 0);
    return Array.from(context.getImageData(x, y, 1, 1).data);
  } finally {
    bitmap.close();
  }
}

function makeSnapshot(sourceId: string): EditorSnapshot {
  const baseline = createImageBaselineSnapshot(sourceId, 32, 24);
  const rectangle = (id: string, fill: string): ShapeOverlaySnapshot => ({
    id, role: 'shape', shape: 'rectangle', left: 0, top: 0, scaleX: 1, scaleY: 1,
    angle: 0, flipX: false, flipY: false, visible: true, opacity: 1,
    width: 32, height: 24, fill, stroke: null, strokeWidth: 0,
  });
  const text: TextOverlaySnapshot = {
    id: 'day19-text', role: 'text', text: 'Layer label', left: 4, top: 5,
    scaleX: 1, scaleY: 1, angle: 0, flipX: false, flipY: false, visible: true,
    opacity: 1, width: 20, fontFamily: 'Noto Sans', fontSize: 8, fontWeight: 400,
    fontStyle: 'normal', textAlign: 'left', fill: '#111827',
  };
  return { ...baseline, scene: [baseline.scene[0]!, text, rectangle('day19-green', '#22c55e'), rectangle('day19-blue', '#2563eb')] };
}

async function runAssertions(): Promise<string[]> {
  const lines: string[] = [];
  const fixture = createFixture(32, 24);
  try {
    const snapshot = makeSnapshot(fixture.assetId);
    assert(getLayerList(snapshot).map((layer) => layer.id).join(',') === 'day19-blue,day19-green,day19-text,day19-layers-fixture',
      'The panel must show topmost first and keep the source image last.');
    const raised = reorderOverlayLayer(snapshot, 'day19-green', 'up');
    assert(raised.scene.map((item) => item.id).join(',') === 'day19-layers-fixture,day19-text,day19-blue,day19-green',
      'One step up must place the selected overlay above its neighbor.');
    assert(reorderOverlayLayer(snapshot, 'day19-blue', 'up') === snapshot
      && reorderOverlayLayer(snapshot, 'day19-text', 'down') === snapshot
      && reorderOverlayLayer(snapshot, fixture.assetId, 'up') === snapshot
      && reorderOverlayLayer(snapshot, 'missing', 'down') === snapshot,
    'Top/bottom boundaries, background and unknown IDs must be no-ops.');
    assert(snapshot.scene.map((item) => item.id).join(',') === 'day19-layers-fixture,day19-text,day19-green,day19-blue',
      'Reorder must not mutate the original snapshot.');
    lines.push('PASS topmost-first stack, one-step order, immutable no-op boundaries and fixed background');

    const history = commitHistory(createHistory(snapshot), raised);
    assert(history.entries.length === 2 && JSON.stringify(currentSnapshot(undoHistory(history))) === JSON.stringify(snapshot)
      && currentSnapshot(redoHistory(history)).scene.map((item) => item.id).join(',') === raised.scene.map((item) => item.id).join(','),
    'A reorder must be one undo/redo step.');
    assert(commitHistory(history, reorderOverlayLayer(raised, 'day19-green', 'up')) === history,
      'A boundary reorder no-op must not add history.');
    lines.push('PASS reorder history, undo/redo and no-op suppression');

    const nudged = nudgeOverlayLayer(snapshot, 'day19-green', 3, -2);
    const moved = nudged.scene.find((item) => item.id === 'day19-green');
    assert(moved?.left === 3 && moved.top === -2 && nudged.scene[0] === snapshot.scene[0]
      && nudged.scene[1] === snapshot.scene[1] && nudged.scene[3] === snapshot.scene[3],
    'Nudge must move only the chosen overlay and preserve other scene objects.');
    assert(nudgeOverlayLayer(snapshot, 'day19-green', 0, 0) === snapshot
      && nudgeOverlayLayer(snapshot, fixture.assetId, 1, 0) === snapshot
      && nudgeOverlayLayer(snapshot, 'missing', 1, 0) === snapshot
      && nudgeOverlayLayer(snapshot, 'day19-green', Number.NaN, 0) === snapshot,
    'Zero movement, source movement, missing IDs and invalid deltas must be no-ops.');
    const rotated: EditorSnapshot = { ...snapshot, documentTransform: [0, 1, -1, 0, 24, 0] };
    const rotatedNudge = nudgeOverlayLayer(rotated, 'day19-green', 10, 0).scene.find((item) => item.id === 'day19-green');
    assert(rotatedNudge?.left === 0 && rotatedNudge.top === -10,
      'A rightward document-space move after rotation must map through the inverse transform.');
    const scaled: EditorSnapshot = { ...snapshot, documentTransform: [2, 0, 0, 2, 0, 0] };
    const scaledNudge = nudgeOverlayLayer(scaled, 'day19-green', 10, 0).scene.find((item) => item.id === 'day19-green');
    assert(scaledNudge?.left === 5 && scaledNudge.top === 0,
      'Ten document pixels after 2× resize must map to five baseline pixels.');
    const nudgeInput = createNudgeInput();
    pressNudgeKey(nudgeInput, 'ArrowRight', 1);
    pressNudgeKey(nudgeInput, 'ArrowRight', 1);
    pressNudgeKey(nudgeInput, 'ArrowRight', 1);
    pressNudgeKey(nudgeInput, 'ArrowDown', 1);
    pressNudgeKey(nudgeInput, 'ArrowDown', 1);
    let grouped: EditorSnapshot | null = null;
    if (releaseNudgeKey(nudgeInput, 'ArrowRight')) {
      grouped = nudgeOverlayLayer(snapshot, 'day19-green', nudgeInput.x, nudgeInput.y);
    }
    assert(grouped === null && nudgeInput.x === 3 && nudgeInput.y === 2,
      'Repeated keydowns must accumulate while simultaneous arrow keys remain held.');
    if (releaseNudgeKey(nudgeInput, 'ArrowDown')) {
      grouped = nudgeOverlayLayer(snapshot, 'day19-green', nudgeInput.x, nudgeInput.y);
    }
    assert(grouped !== null,
      'A nudge transaction must finish only after the last held arrow key is released.');
    const nudgeHistory = commitHistory(createHistory(snapshot), grouped);
    assert(nudgeHistory.entries.length === 2
      && JSON.stringify(currentSnapshot(undoHistory(nudgeHistory))) === JSON.stringify(snapshot)
      && currentSnapshot(redoHistory(nudgeHistory)).scene.find((item) => item.id === 'day19-green')?.left === 3
      && currentSnapshot(redoHistory(nudgeHistory)).scene.find((item) => item.id === 'day19-green')?.top === 2,
    'Repeated and simultaneous arrow movement must serialize as a single undo step.');
    lines.push('PASS 1/10 px movement, document transform, safe boundaries, repeated keys and grouped history');

    const originalPng = await exportImage(fixture, snapshot, { format: 'png', quality: 90, backgroundColor: '#ffffff' });
    const raisedPng = await exportImage(fixture, raised, { format: 'png', quality: 90, backgroundColor: '#ffffff' });
    assert((await pixel(originalPng, 16, 12)).join(',') === '37,99,235,255'
      && (await pixel(raisedPng, 16, 12)).join(',') === '34,197,94,255',
    'PNG export must render the topmost rectangle after a reorder.');
    lines.push('PASS exported PNG pixel follows restored layer z-order');
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
