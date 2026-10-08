import { FabricImage } from 'fabric';
import { applyDocumentTransform, cropDocument, resizeDocument, transformDocument } from '../../src/features/editor/engine/geometry';
import { commitHistory, createHistory, currentSnapshot, redoHistory, undoHistory } from '../../src/features/editor/engine/history';
import type { ImageImportCandidate } from '../../src/features/editor/engine/imageImport';
import { createFabricOverlay } from '../../src/features/editor/engine/scene';
import { createImageBaselineSnapshot, MAX_TEXT_CODE_POINTS, normalizeTextContent, type EditorSnapshot, type TextOverlaySnapshot } from '../../src/features/editor/engine/snapshot';
import { createDefaultTextObject, ensureTextFontReady, putTextOverlay, removeTextOverlay, serializeTextObject } from '../../src/features/editor/engine/text';
import { exportImage } from '../../src/features/editor/engine/exportImage';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLElement>('#results')!;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectReject(action: () => Promise<unknown>, message: string): Promise<void> {
  let rejected = false;
  try {
    await action();
  } catch {
    rejected = true;
  }
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
    assetId: 'day15-text-fixture',
    source: new File([], 'day15.png', { type: 'image/png' }),
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
    return {
      width: bitmap.width,
      height: bitmap.height,
      data: context.getImageData(0, 0, bitmap.width, bitmap.height).data,
    };
  } finally {
    bitmap.close();
  }
}

function overlaySnapshot(snapshot: EditorSnapshot): TextOverlaySnapshot {
  const created = createDefaultTextObject(snapshot, 'day15-text');
  created.object.dispose();
  return { ...created.overlay, text: 'Tiếng Việt: Ắ ễ đ ộ · a\u0301\nNhiều dòng' };
}

async function runAssertions(): Promise<string[]> {
  const lines: string[] = [];
  const limited = normalizeTextContent(`${'a'.repeat(MAX_TEXT_CODE_POINTS - 1)}😀x`);
  assert(Array.from(limited).length === MAX_TEXT_CODE_POINTS && limited.endsWith('😀'),
    'The text limit must count Unicode code points and preserve the last complete code point.');
  assert(normalizeTextContent('dòng 1\r\ndòng 2\rdòng 3') === 'dòng 1\ndòng 2\ndòng 3',
    'CRLF and CR newlines were not normalized to LF.');
  lines.push('PASS newline normalization and 2,000 Unicode code point limit');

  for (const family of ['Noto Sans', 'Noto Serif']) {
    for (const style of ['normal', 'italic'] as const) {
      for (const weight of [400, 700] as const) await ensureTextFontReady(family, style, weight);
    }
  }
  await expectReject(() => ensureTextFontReady('Missing Font'), 'An unavailable font family must fail closed.');
  lines.push('PASS self-hosted Noto Sans/Serif regular, bold, italic and bold-italic; unknown font rejected');

  const fixture = createFixture(160, 100);
  try {
    const baseline = createImageBaselineSnapshot(fixture.assetId, fixture.width, fixture.height);
    const { object, overlay } = createDefaultTextObject(baseline, 'day15-default');
    assert(overlay.fontFamily === 'Noto Sans' && overlay.fontSize === 8 && overlay.fill === '#111827',
      'Default font, short-edge size clamp, or fill is incorrect.');
    assert(Math.abs(overlay.width - fixture.width * 0.8) < 0.01,
      'Default textbox width must be 80% of the document width.');
    const center = object.getCenterPoint();
    assert(Math.abs(center.x - fixture.width / 2) < 0.01 && Math.abs(center.y - fixture.height / 2) < 0.01,
      'The new textbox is not centered in the document.');
    lines.push('PASS default textbox style, dimensions and centered placement');

    const transformed = resizeDocument(
      transformDocument(cropDocument(baseline, { x: 10, y: 5, width: 140, height: 80 }, 'free'), 'rotate-right'),
      { width: 120, height: 210 },
      1.5,
    );
    const transformedText = createDefaultTextObject(transformed, 'day15-transformed');
    const restored = createFabricOverlay(transformedText.overlay) as typeof object;
    applyDocumentTransform(restored, transformed.documentTransform);
    const transformedCenter = restored.getCenterPoint();
    assert(Math.abs(transformedCenter.x - transformed.document.width / 2) < 0.1
      && Math.abs(transformedCenter.y - transformed.document.height / 2) < 0.1
      && Math.abs(restored.angle) < 0.01,
    'Adding text after crop/rotate/resize did not keep it centered and upright.');
    restored.dispose();
    lines.push('PASS add-after-crop/rotate/resize keeps textbox centered and upright');

    const first = putTextOverlay(baseline, overlaySnapshot(baseline));
    let history = commitHistory(createHistory(baseline), first);
    assert(history.revision === 1, 'Adding a textbox must produce one history step.');
    const editedObject = createFabricOverlay(overlay, true) as typeof object;
    editedObject.set('text', 'Tiếng Việt đã sửa: Ắ ễ đ ộ');
    editedObject.initDimensions();
    const edited = putTextOverlay(first, serializeTextObject(first, editedObject, overlay));
    history = commitHistory(history, edited);
    assert(history.revision === 2, 'One text editing session must produce one history step.');
    history = commitHistory(history, removeTextOverlay(edited, overlay.id));
    assert(history.revision === 3, 'Deleting a textbox must produce one history step.');
    const emptyNewTextHistory = commitHistory(createHistory(baseline), removeTextOverlay(baseline, 'pending-empty-text'));
    assert(emptyNewTextHistory.revision === 0,
      'Finishing a new empty textbox must not create a history step.');
    assert(JSON.stringify(currentSnapshot(undoHistory(history))) === JSON.stringify(edited),
      'Undo did not restore the edited Vietnamese text.');
    assert(JSON.stringify(currentSnapshot(redoHistory(undoHistory(history)))) === JSON.stringify(removeTextOverlay(edited, overlay.id)),
      'Redo did not restore textbox deletion.');
    editedObject.dispose();
    object.dispose();
    lines.push('PASS add/edit/delete history; empty new text is a no-op; undo/redo restore text');

    const textSnapshot = putTextOverlay(baseline, overlaySnapshot(baseline));
    const plain = await pixels(await exportImage(fixture, baseline, { format: 'png', quality: 90, backgroundColor: '#ffffff' }));
    const rendered = await pixels(await exportImage(fixture, textSnapshot, { format: 'png', quality: 90, backgroundColor: '#ffffff' }));
    assert(plain.width === fixture.width && plain.height === fixture.height
      && rendered.width === fixture.width && rendered.height === fixture.height,
    'PNG export dimensions must match the document dimensions.');
    const changedPixels = rendered.data.reduce((count, value, index) => count + (value !== plain.data[index] ? 1 : 0), 0);
    assert(changedPixels > 20, 'Vietnamese multiline text did not render into the PNG export.');
    lines.push(`PASS Vietnamese multiline PNG export changes ${changedPixels} channels; source dimensions retained`);
  } finally {
    fixture.dispose();
  }

  const baseline = createImageBaselineSnapshot('day15-limit', 16, 16);
  const capped = {
    ...baseline,
    scene: [...baseline.scene, ...Array.from({ length: 50 }, (_, index) => ({
      id: `day15-shape-${index}`, role: 'shape' as const, shape: 'rectangle' as const,
      left: 0, top: 0, width: 1, height: 1, fill: '#000000', stroke: null, strokeWidth: 0,
      scaleX: 1, scaleY: 1, angle: 0, flipX: false, flipY: false, visible: true, opacity: 1,
    }))],
  };
  let rejected = false;
  try {
    putTextOverlay(capped, overlaySnapshot(baseline));
  } catch {
    rejected = true;
  }
  assert(rejected, 'The combined 50-overlay cap was not enforced for a new textbox.');
  rejected = false;
  try {
    createDefaultTextObject(capped, 'day15-over-limit');
  } catch {
    rejected = true;
  }
  assert(rejected, 'Adding a 51st textbox must fail before creating an uncommittable preview.');
  lines.push('PASS 50 text/shape overlay limit');
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
