import { FabricImage } from 'fabric';
import { applyDocumentTransform, cropDocument, resizeDocument, transformDocument } from '../../src/features/editor/engine/geometry';
import { commitHistory, createHistory, currentSnapshot, redoHistory, undoHistory } from '../../src/features/editor/engine/history';
import type { ImageImportCandidate } from '../../src/features/editor/engine/imageImport';
import { createFabricOverlay, createFabricOverlays } from '../../src/features/editor/engine/scene';
import { createImageBaselineSnapshot, type EditorSnapshot, type ShapeOverlaySnapshot } from '../../src/features/editor/engine/snapshot';
import { applyShapePropertiesPatch, createDefaultShapeObject, putShapeOverlay, serializeShapeObject, validateShapeOverlay, validateShapePropertiesPatch } from '../../src/features/editor/engine/shapes';
import { exportImage } from '../../src/features/editor/engine/exportImage';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLElement>('#results')!;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function near(actual: number, expected: number, tolerance = 0.05): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function expectThrow(action: () => unknown, message: string): void {
  let thrown = false;
  try { action(); } catch { thrown = true; }
  assert(thrown, message);
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
    assetId: 'day17-shapes-fixture',
    source: new File([], 'day17.png', { type: 'image/png' }),
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

function shapeIn(snapshot: EditorSnapshot, id: string): ShapeOverlaySnapshot {
  const overlay = snapshot.scene.find((item): item is ShapeOverlaySnapshot => item.role === 'shape' && item.id === id);
  assert(overlay, `Shape overlay ${id} is missing.`);
  return overlay;
}

async function runAssertions(): Promise<string[]> {
  const lines: string[] = [];
  const baseline = createImageBaselineSnapshot('day17-shapes-fixture', 320, 220);
  const rectangle = createDefaultShapeObject(baseline, 'day17-rectangle', 'rectangle');
  const circle = createDefaultShapeObject(baseline, 'day17-circle', 'circle');
  const line = createDefaultShapeObject(baseline, 'day17-line', 'line');
  assert(rectangle.overlay.width === 44 && rectangle.overlay.height === 44
    && near(rectangle.overlay.left, 138) && near(rectangle.overlay.top, 88),
  'Rectangle default must be a centered 20% square.');
  assert(circle.overlay.radius === 22 && circle.object.get('lockUniScaling') === true,
    'Circle default must be centered, 20% wide and locked to uniform scaling.');
  assert(line.overlay.strokeWidth === 1 && Number.isFinite(line.overlay.x2) && Number.isFinite(line.overlay.y2)
    && (line.overlay.x2 !== 0 || line.overlay.y2 !== 0),
  'Line default must have a finite, non-zero centered endpoint vector and a visible document-relative stroke.');
  assert(rectangle.overlay.fill === '#2563eb' && rectangle.overlay.opacity === 1
    && rectangle.overlay.stroke === null && rectangle.overlay.strokeWidth === 0,
  'Shape defaults must use the accent fill, full opacity and no visible rectangle border.');
  lines.push('PASS centered defaults, accent style, line endpoints and uniform circle scaling');

  const tiny = createImageBaselineSnapshot('day17-tiny', 1, 1);
  for (const kind of ['rectangle', 'circle', 'line'] as const) {
    const created = createDefaultShapeObject(tiny, `tiny-${kind}`, kind);
    validateShapeOverlay(created.overlay);
    assert([created.overlay.left, created.overlay.top, created.overlay.scaleX, created.overlay.scaleY,
      created.overlay.opacity].every(Number.isFinite), `Tiny ${kind} has a non-finite value.`);
    if (created.overlay.shape === 'rectangle') assert(created.overlay.width > 0 && created.overlay.height > 0, 'Tiny rectangle must remain valid.');
    if (created.overlay.shape === 'circle') assert(created.overlay.radius > 0, 'Tiny circle must remain valid.');
    created.object.dispose();
  }
  lines.push('PASS minimum 1×1 document creates no zero-sized or non-finite shape');

  const invalid: Array<readonly [ 'rectangle' | 'circle' | 'line', { fill?: string | null; stroke?: string | null; strokeWidth?: number; opacity?: number } ]> = [
    ['rectangle', { fill: 'blue' }], ['circle', { fill: '#ffffff00' }],
    ['rectangle', { strokeWidth: -0.1 }], ['circle', { strokeWidth: 50.1 }],
    ['line', { strokeWidth: 0 }], ['line', { stroke: null }],
    ['rectangle', { opacity: Number.NaN }], ['circle', { opacity: 1.01 }],
    ['line', { fill: null }],
  ];
  invalid.forEach(([kind, patch]) => expectThrow(
    () => validateShapePropertiesPatch(kind, patch),
    `Invalid ${kind} properties were accepted: ${JSON.stringify(patch)}`,
  ));
  validateShapePropertiesPatch('rectangle', { fill: null, strokeWidth: 0, opacity: 0 });
  validateShapePropertiesPatch('circle', { strokeWidth: 50, opacity: 1 });
  validateShapePropertiesPatch('line', { strokeWidth: 0.1, stroke: '#123456', opacity: 1 });
  expectThrow(() => createFabricOverlay({ ...rectangle.overlay, width: 0 }), 'Zero-width rectangle was rendered.');
  expectThrow(() => createFabricOverlay({ ...circle.overlay, radius: Number.NaN }), 'NaN circle radius was rendered.');
  expectThrow(() => createFabricOverlay({ ...line.overlay, x2: 0, y2: 0 }), 'Coincident line endpoints were rendered.');
  lines.push('PASS command-boundary limits, transparent fill and rejection of invalid geometry/style');

  const changedRect = applyShapePropertiesPatch(rectangle.object, {
    fill: null, stroke: '#111827', strokeWidth: 3, opacity: 0.4,
  });
  assert(changedRect.fill === null && changedRect.stroke === '#111827' && changedRect.strokeWidth === 3 && changedRect.opacity === 0.4,
    'Rectangle style patch did not apply all fields.');
  const unchangedOnError = serializeShapeObject(baseline, rectangle.object, rectangle.overlay);
  expectThrow(() => applyShapePropertiesPatch(rectangle.object, { opacity: 1.1 }), 'Invalid property update was accepted.');
  assert(JSON.stringify(serializeShapeObject(baseline, rectangle.object, rectangle.overlay)) === JSON.stringify(unchangedOnError),
    'Rejected property patch must leave the live shape unchanged.');
  lines.push('PASS property patches are atomic and preserve transparent fill/stroke/opacity');

  const transformed = resizeDocument(
    transformDocument(cropDocument(baseline, { x: 20, y: 15, width: 280, height: 180 }, 'free'), 'rotate-right'),
    { width: 360, height: 560 },
    2,
  );
  const transformedCircle = createDefaultShapeObject(transformed, 'transformed-circle', 'circle');
  const liveCircle = createFabricOverlay(transformedCircle.overlay, true);
  applyDocumentTransform(liveCircle, transformed.documentTransform);
  liveCircle.set({
    left: liveCircle.left + 12,
    top: liveCircle.top + 8,
    scaleX: liveCircle.scaleX * 1.4,
    scaleY: liveCircle.scaleY * 1.4,
    angle: 31,
  });
  liveCircle.setCoords();
  const serializedCircle = serializeShapeObject(transformed, liveCircle, transformedCircle.overlay);
  const restoredCircle = createFabricOverlay(serializedCircle, true);
  applyDocumentTransform(restoredCircle, transformed.documentTransform);
  const actualMatrix = liveCircle.calcTransformMatrix();
  const restoredMatrix = restoredCircle.calcTransformMatrix();
  assert(actualMatrix.every((value, index) => near(value, restoredMatrix[index] ?? Number.NaN, 0.1)),
    'Circle transform did not round-trip through current document geometry.');
  assert(near(liveCircle.scaleX, liveCircle.scaleY, 0.01),
    'Circle must remain round after uniform scaling.');
  const transformedSnapshot = putShapeOverlay(transformed, serializedCircle);
  const transformedOverlay = shapeIn(transformedSnapshot, 'transformed-circle');
  assert(transformedOverlay.shape === 'circle' && transformedOverlay.opacity === 1 && transformedOverlay.radius > 0,
    'Transformed circle snapshot lost valid dimensions or style.');
  lines.push('PASS crop/rotate/resize transform round-trip and uniform circle geometry');
  restoredCircle.dispose();
  liveCircle.dispose();
  transformedCircle.object.dispose();

  const transformedLine = createDefaultShapeObject(transformed, 'transformed-line', 'line');
  const liveLine = createFabricOverlay(transformedLine.overlay, true);
  applyDocumentTransform(liveLine, transformed.documentTransform);
  liveLine.set({ left: liveLine.left + 12, top: liveLine.top + 8, scaleX: liveLine.scaleX * 1.4, angle: 31 });
  liveLine.setCoords();
  const serializedLine = serializeShapeObject(transformed, liveLine, transformedLine.overlay);
  const restoredLine = createFabricOverlay(serializedLine, true);
  applyDocumentTransform(restoredLine, transformed.documentTransform);
  assert(liveLine.calcTransformMatrix().every((value, index) => near(value, restoredLine.calcTransformMatrix()[index] ?? Number.NaN, 0.1)),
    'Line translation, scaling, and rotation did not round-trip after crop/rotate/resize.');
  assert(near(serializedLine.x2, transformedLine.overlay.x2) && near(serializedLine.y2, transformedLine.overlay.y2),
    'Line transform must stay separate from its centered endpoint vector.');
  lines.push('PASS line translation/scale/rotation round-trip after crop/rotate/resize');
  restoredLine.dispose();
  liveLine.dispose();
  transformedLine.object.dispose();

  let history = createHistory(baseline);
  const added = putShapeOverlay(baseline, rectangle.overlay);
  history = commitHistory(history, added);
  assert(history.revision === 1, 'Adding one shape must create one history entry.');
  const styled = putShapeOverlay(added, { ...rectangle.overlay, opacity: 0.5 });
  history = commitHistory(history, styled);
  assert(history.revision === 2, 'One property change must create one history entry.');
  history = commitHistory(history, styled);
  assert(history.revision === 2, 'A no-op shape update must not create history.');
  assert(JSON.stringify(currentSnapshot(undoHistory(history))) === JSON.stringify(added)
    && JSON.stringify(currentSnapshot(redoHistory(undoHistory(history)))) === JSON.stringify(styled),
  'Shape undo/redo must restore exact snapshots.');
  let capped = baseline;
  for (let index = 0; index < 50; index++) {
    const item = createDefaultShapeObject(capped, `cap-${index}`, 'rectangle');
    capped = putShapeOverlay(capped, item.overlay);
    item.object.dispose();
  }
  expectThrow(() => createDefaultShapeObject(capped, 'cap-overflow', 'circle'), 'The 51st overlay was accepted.');
  lines.push('PASS add/property/no-op undo-redo transactions and 50-overlay cap');

  const fixture = createFixture(320, 220);
  try {
    const exportRect = createDefaultShapeObject(baseline, 'export-rect', 'rectangle');
    exportRect.object.set({ left: 20, top: 20, opacity: 0.75 });
    exportRect.object.setCoords();
    const rectOverlay = serializeShapeObject(baseline, exportRect.object, exportRect.overlay);
    const filledSnapshot = putShapeOverlay(baseline, rectOverlay);
    const transparentSnapshot = putShapeOverlay(baseline, { ...rectOverlay, fill: null, stroke: '#ef4444', strokeWidth: 2 });
    const liveOverlays = createFabricOverlays(filledSnapshot.scene, true);
    const liveRect = liveOverlays[0];
    assert(liveRect?.fill === '#2563eb' && liveRect.opacity === 0.75,
      'Interactive preview must receive the stored fill and opacity.');
    liveOverlays.forEach((object) => object.dispose());
    const filled = await pixels(await exportImage(fixture, filledSnapshot, { format: 'png', quality: 90, backgroundColor: '#ffffff' }));
    const transparent = await pixels(await exportImage(fixture, transparentSnapshot, { format: 'png', quality: 90, backgroundColor: '#ffffff' }));
    assert(filled.width === 320 && filled.height === 220, 'Shape export must keep full document dimensions.');
    assert(pixelAt(filled, 40, 40)[2]! > pixelAt(filled, 40, 40)[0]!, 'Filled shape did not color the expected export pixel.');
    assert(pixelAt(transparent, 40, 40).every((value, index) => value === [248, 250, 252, 255][index]),
      'Transparent fill must reveal the source image inside the shape.');
    const changedChannels = filled.data.reduce((count, value, index) => count + (value !== transparent.data[index] ? 1 : 0), 0);
    assert(changedChannels > 500, 'Fill, stroke and opacity did not affect exported pixels.');

    const exportCircle = createDefaultShapeObject(baseline, 'export-circle', 'circle');
    exportCircle.object.set({ left: 100, top: 20 });
    applyShapePropertiesPatch(exportCircle.object, { fill: '#10b981', stroke: '#111827', strokeWidth: 2, opacity: 0.5 });
    const circleSnapshot = putShapeOverlay(baseline, serializeShapeObject(baseline, exportCircle.object, exportCircle.overlay));
    const circlePreview = createFabricOverlays(circleSnapshot.scene, true)[0];
    assert(circlePreview && circlePreview.fill === '#10b981' && circlePreview.stroke === '#111827' && circlePreview.opacity === 0.5,
      'Interactive circle preview must receive its stored style.');
    circlePreview.dispose();
    const circlePixels = await pixels(await exportImage(fixture, circleSnapshot, { format: 'png', quality: 90, backgroundColor: '#ffffff' }));
    assert(pixelAt(circlePixels, 122, 42)[1]! > pixelAt(circlePixels, 122, 42)[0]!,
      'Circle fill and opacity did not affect the expected export pixel.');

    const exportLine = createDefaultShapeObject(baseline, 'export-line', 'line');
    exportLine.object.set({ left: 190, top: 30, angle: 20 });
    applyShapePropertiesPatch(exportLine.object, { stroke: '#f97316', strokeWidth: 4, opacity: 1 });
    const lineSnapshot = putShapeOverlay(baseline, serializeShapeObject(baseline, exportLine.object, exportLine.overlay));
    const linePreview = createFabricOverlays(lineSnapshot.scene, true)[0];
    assert(linePreview && linePreview.stroke === '#f97316' && linePreview.strokeWidth === 4,
      'Interactive line preview must receive its stored stroke.');
    linePreview.dispose();
    const linePixels = await pixels(await exportImage(fixture, lineSnapshot, { format: 'png', quality: 90, backgroundColor: '#ffffff' }));
    const lineChanged = linePixels.data.reduce((count, value, index) => count + (value !== [248, 250, 252, 255][index % 4] ? 1 : 0), 0);
    assert(lineChanged > 100, `Line stroke and angle did not affect exported pixels (${lineChanged} channels): ${JSON.stringify(shapeIn(lineSnapshot, 'export-line'))}`);
    lines.push(`PASS full-size PNG preview/export styles for rectangle, circle and line (${changedChannels} rectangle channels, ${lineChanged} line channels)`);
    exportRect.object.dispose();
    exportCircle.object.dispose();
    exportLine.object.dispose();
  } finally {
    fixture.dispose();
  }

  rectangle.object.dispose();
  circle.object.dispose();
  line.object.dispose();
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
