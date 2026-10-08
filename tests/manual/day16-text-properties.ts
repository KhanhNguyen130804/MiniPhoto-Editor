import { FabricImage } from 'fabric';
import { applyDocumentTransform, cropDocument, resizeDocument, transformDocument } from '../../src/features/editor/engine/geometry';
import { commitHistory, createHistory, currentSnapshot, redoHistory, undoHistory } from '../../src/features/editor/engine/history';
import type { ImageImportCandidate } from '../../src/features/editor/engine/imageImport';
import { createFabricOverlay } from '../../src/features/editor/engine/scene';
import { createImageBaselineSnapshot, type EditorSnapshot, type TextOverlaySnapshot } from '../../src/features/editor/engine/snapshot';
import { applyTextPropertiesPatch, createDefaultTextObject, ensureSnapshotTextFonts, ensureTextFontReady, putTextOverlay, restoreTextObject, serializeTextObject, textPropertiesFromObject, validateTextPropertiesPatch, type TextPropertiesPatch } from '../../src/features/editor/engine/text';
import { exportImage } from '../../src/features/editor/engine/exportImage';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLElement>('#results')!;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectThrow(action: () => unknown, message: string): void {
  let thrown = false;
  try { action(); } catch { thrown = true; }
  assert(thrown, message);
}

async function expectReject(action: () => Promise<unknown>, message: string): Promise<void> {
  let rejected = false;
  try { await action(); } catch { rejected = true; }
  assert(rejected, message);
}

function createFixture(width: number, height: number): ImageImportCandidate {
  const sourceElement = document.createElement('canvas');
  sourceElement.width = width;
  sourceElement.height = height;
  const context = sourceElement.getContext('2d');
  assert(context, 'Canvas 2D context is unavailable.');
  context.fillStyle = '#f8fafc';
  context.fillRect(0, 0, width, height);
  const image = new FabricImage(sourceElement);
  return {
    assetId: 'day16-properties-fixture',
    source: new File([], 'day16.png', { type: 'image/png' }),
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

function textIn(snapshot: EditorSnapshot, id: string): TextOverlaySnapshot {
  const overlay = snapshot.scene.find((item): item is TextOverlaySnapshot => item.role === 'text' && item.id === id);
  assert(overlay, `Text overlay ${id} is missing.`);
  return overlay;
}

async function runAssertions(): Promise<string[]> {
  const lines: string[] = [];
  const baseline = createImageBaselineSnapshot('day16-properties-fixture', 320, 220);
  assert(baseline.schemaVersion === 2, 'Text property fields require editor snapshot schema version 2.');
  const created = createDefaultTextObject(baseline, 'day16-text');
  assert(created.overlay.fontFamily === 'Noto Sans' && created.overlay.fontSize === 13
    && created.overlay.fontWeight === 400 && created.overlay.fontStyle === 'normal'
    && created.overlay.textAlign === 'left' && created.overlay.opacity === 1
    && created.overlay.fill === '#111827' && Math.abs(created.overlay.width - 256) < 0.01,
  'Default text style or document-relative width is incorrect.');
  lines.push('PASS schema 2 and FR-08 defaults');

  const invalid: TextPropertiesPatch[] = [
    { x: Number.NaN }, { angle: Number.POSITIVE_INFINITY }, { width: 0 }, { width: 8193 },
    { fontSize: 7 }, { fontSize: 513 }, { opacity: 1.01 }, { fontFamily: 'Arial' as TextPropertiesPatch['fontFamily'] },
    { fontWeight: 500 as TextPropertiesPatch['fontWeight'] }, { fontStyle: 'oblique' as TextPropertiesPatch['fontStyle'] },
    { textAlign: 'justify' as TextPropertiesPatch['textAlign'] }, { fill: 'red' },
  ];
  invalid.forEach((patch) => expectThrow(() => validateTextPropertiesPatch(patch), `Invalid text patch accepted: ${JSON.stringify(patch)}`));
  validateTextPropertiesPatch({ x: -40, y: 500, angle: -720, width: 8192, fontSize: 512, opacity: 0 });
  lines.push('PASS finite geometry, off-canvas positions, style enums and property bounds');

  const transformed = resizeDocument(
    transformDocument(cropDocument(baseline, { x: 20, y: 15, width: 280, height: 180 }, 'free'), 'rotate-right'),
    { width: 360, height: 560 },
    2,
  );
  const text = createDefaultTextObject(transformed, 'day16-text');
  const liveText = createFabricOverlay(text.overlay, true) as typeof text.object;
  applyDocumentTransform(liveText, transformed.documentTransform);
  assert(Math.abs(textPropertiesFromObject(liveText).fontSize - 22) < 0.1
    && Math.abs(textPropertiesFromObject(liveText).width - transformed.document.width * 0.8) < 0.1,
  'Properties must show the effective current-document size after resize.');
  await ensureTextFontReady('Noto Serif', 'italic', 700);
  const stylePatch: TextPropertiesPatch = {
    x: -24, y: 61, angle: 37.5, width: 300, fontFamily: 'Noto Serif', fontSize: 36,
    fontWeight: 700, fontStyle: 'italic', textAlign: 'right', fill: '#a21caf', opacity: 0.55,
  };
  applyTextPropertiesPatch(liveText, stylePatch);
  liveText.set('text', 'Tiếng Việt: Ắ ễ đ ộ\nNhiều dòng');
  liveText.initDimensions();
  const changed = putTextOverlay(transformed, serializeTextObject(transformed, liveText, text.overlay));
  const stored = textIn(changed, text.overlay.id);
  const restored = createFabricOverlay(stored) as typeof text.object;
  applyDocumentTransform(restored, transformed.documentTransform);
  assert(stored.fontFamily === 'Noto Serif' && stored.fontWeight === 700 && stored.fontStyle === 'italic'
    && stored.textAlign === 'right' && stored.fill === '#a21caf' && stored.opacity === 0.55
    && Math.abs(textPropertiesFromObject(restored).angle - 37.5) < 0.01
    && Math.abs(textPropertiesFromObject(restored).width - 300) < 0.1
    && Math.abs(restored.left - stylePatch.x!) < 0.1 && Math.abs(restored.top - stylePatch.y!) < 0.1,
  `Text property round-trip failed: ${JSON.stringify({ family: stored.fontFamily, weight: stored.fontWeight, style: stored.fontStyle, align: stored.textAlign, fill: stored.fill, opacity: stored.opacity, angle: textPropertiesFromObject(restored).angle, width: textPropertiesFromObject(restored).width, x: restored.left, y: restored.top })}`);
  restoreTextObject(transformed, liveText, text.overlay);
  const defaultObject = createFabricOverlay(text.overlay, true) as typeof text.object;
  applyDocumentTransform(defaultObject, transformed.documentTransform);
  const defaultProperties = textPropertiesFromObject(defaultObject);
  const cancelledProperties = textPropertiesFromObject(liveText);
  assert(liveText.text === text.overlay.text && JSON.stringify(cancelledProperties) === JSON.stringify(defaultProperties),
    'Cancelling a properties edit must restore the entire text style and geometry.');
  lines.push('PASS full-state property cancellation restores text, style, opacity and geometry');
  defaultObject.dispose();
  liveText.dispose();
  text.object.dispose();
  restored.dispose();
  lines.push('PASS all text properties round-trip after crop, rotation and resize');

  let history = createHistory(transformed);
  const firstAction = putTextOverlay(transformed, { ...textIn(changed, text.overlay.id), fontWeight: 400 });
  history = commitHistory(history, firstAction);
  assert(history.revision === 1, 'One discrete font weight action must create one history step.');
  const secondAction = putTextOverlay(firstAction, { ...textIn(firstAction, text.overlay.id), textAlign: 'center' });
  history = commitHistory(history, secondAction);
  assert(history.revision === 2, 'A second discrete alignment action must create one separate step.');
  history = commitHistory(history, secondAction);
  assert(history.revision === 2, 'A no-op property action must not create history.');
  const groupedGesture = putTextOverlay(secondAction, { ...textIn(secondAction, text.overlay.id), opacity: 0.2 });
  history = commitHistory(history, groupedGesture);
  assert(history.revision === 3 && JSON.stringify(currentSnapshot(undoHistory(history))) === JSON.stringify(secondAction)
    && JSON.stringify(currentSnapshot(redoHistory(undoHistory(history)))) === JSON.stringify(groupedGesture),
  'A grouped opacity gesture must undo and redo as one history step.');
  lines.push('PASS discrete actions, no-op, one-step gesture grouping, undo and redo');

  const fixture = createFixture(320, 220);
  try {
    const textContent = 'Tiếng Việt: Ắ ễ đ ộ\nNhiều dòng';
    const normalOverlay = { ...created.overlay, text: textContent };
    const exportText = createDefaultTextObject(baseline, 'day16-export');
    applyTextPropertiesPatch(exportText.object, { ...stylePatch, x: 24, y: 60 });
    exportText.object.set('text', textContent);
    exportText.object.initDimensions();
    const styledOverlay = serializeTextObject(baseline, exportText.object, exportText.overlay);
    const plainSnapshot = putTextOverlay(baseline, normalOverlay);
    const styledSnapshot = putTextOverlay(baseline, styledOverlay);
    const output = await pixels(await exportImage(fixture, styledSnapshot, { format: 'png', quality: 90, backgroundColor: '#ffffff' }));
    const reference = await pixels(await exportImage(fixture, plainSnapshot, { format: 'png', quality: 90, backgroundColor: '#ffffff' }));
    assert(output.width === fixture.width && output.height === fixture.height,
      'PNG export must keep the full document dimensions.');
    const changedPixels = output.data.reduce((count, value, index) => count + (value !== reference.data[index] ? 1 : 0), 0);
    assert(changedPixels > 100, 'The selected font/weight/style/alignment/color/opacity did not affect exported pixels.');
    lines.push(`PASS full-size PNG export loads selected Noto Serif bold italic (${changedPixels} changed channels)`);
    exportText.object.dispose();
  } finally {
    fixture.dispose();
  }
  const missingFont = { ...baseline, scene: [...baseline.scene, { ...created.overlay, fontFamily: 'Missing Font' as TextOverlaySnapshot['fontFamily'] }] };
  await expectReject(() => ensureSnapshotTextFonts(missingFont),
    'Export font preparation must reject an unavailable family instead of using fallback fonts.');
  created.object.dispose();
  lines.push('PASS export font readiness fails closed for an unavailable font');
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
