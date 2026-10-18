import { Canvas2dFilterBackend, FabricImage, getFilterBackend, setFilterBackend, StaticCanvas, WebGLFilterBackend } from 'fabric';
import { analyzeColorPixels, analyzeColorReference, applyColorTransferPixels, createColorTransferRecipe, labToRgb, normalizeColorTransfer, rgbToLab, validateColorTransfer } from '../../src/features/editor/engine/colorTransfer';
import { applyImageAdjustments, createCompareSnapshot, selectImagePreset } from '../../src/features/editor/engine/adjustmentFilters';
import { createImageBaselineSnapshot, type ColorTransferSettings, type EditorSnapshot } from '../../src/features/editor/engine/snapshot';
import { parseEditorSnapshot, validateEditorSnapshot } from '../../src/features/editor/engine/draftValidation';
import { decodeWithFabricUrl, validateImageFile } from '../../src/features/editor/engine/imageImport';
import { createHistory, commitHistory, undoHistory, redoHistory, canRedo, currentSnapshot } from '../../src/features/editor/engine/history';
import { acquireDraftLease, deleteCurrentDraft, DRAFT_DATABASE_NAME, inspectCurrentDraft, readCurrentDraft, releaseDraftLease, saveCurrentDraft } from '../../src/features/editor/engine/draftStore';
import { cropDocument, resizeDocument, transformDocument } from '../../src/features/editor/engine/geometry';
import { exportImage, probeExportFormat } from '../../src/features/editor/engine/exportImage';
import { renderPresetThumbnails } from '../../src/features/editor/engine/presetThumbnails';
import { renderDraftThumbnail } from '../../src/features/editor/engine/draftThumbnail';
import { createFabricOverlays } from '../../src/features/editor/engine/scene';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function expectFailure(action: () => unknown, message: string): void {
  try { action(); } catch { return; }
  throw new Error(message);
}
async function expectAsyncFailure(action: () => Promise<unknown>, message: string): Promise<void> {
  try { await action(); } catch { return; }
  throw new Error(message);
}
function makeCanvas(width = 320, height = 240, warm = false): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d')!;
  const data = context.createImageData(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    data.data[i] = Math.min(255, Math.round(x / Math.max(1, width - 1) * 200 + (warm ? 40 : 15)));
    data.data[i + 1] = Math.round(y / Math.max(1, height - 1) * 180 + 20);
    data.data[i + 2] = warm ? 35 : 120 + (x + y) % 100;
    data.data[i + 3] = 255;
  }
  context.putImageData(data, 0, 0);
  return canvas;
}
async function fileFromCanvas(canvas: HTMLCanvasElement, name = 'source.png'): Promise<File> {
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), 'image/png'));
  return new File([blob], name, { type: blob.type });
}
async function blobPixels(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } finally { bitmap.close(); }
}
const settings: ColorTransferSettings = { algorithmVersion: 1, gain: [1.15, 0.7, 1.4], offset: [-4, 12, 18], strength: 70 };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function metadataPng(width: number, height: number, animated = false): File {
  const u32 = (value: number) => [value >>> 24, value >>> 16 & 255, value >>> 8 & 255, value & 255];
  const chunk = (name: string, data: number[]) => [...u32(data.length), ...new TextEncoder().encode(name), ...data, 0, 0, 0, 0];
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10,
    ...chunk('IHDR', [...u32(width), ...u32(height), 8, 6, 0, 0, 0]),
    ...(animated ? chunk('acTL', [0, 0, 0, 1, 0, 0, 0, 0]) : []), ...chunk('IEND', [])]);
  return new File([bytes], 'metadata-only.png', { type: 'image/png' });
}

async function rawDraft(update?: (value: Record<string, unknown>) => void): Promise<Record<string, unknown>> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DATABASE_NAME); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  try {
    const transaction = db.transaction('drafts', update ? 'readwrite' : 'readonly');
    const done = new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error); });
    let result: Record<string, unknown>;
    transaction.objectStore('drafts').get('current').onsuccess = (event) => {
      result = (event.target as IDBRequest).result as Record<string, unknown>;
      if (update) { update(result); transaction.objectStore('drafts').put(result); }
    };
    await done; return result!;
  } finally { db.close(); }
}

async function run(): Promise<string[]> {
  assert((await inspectCurrentDraft()).kind === 'none', 'Use an isolated origin without an existing draft.');
  const lines: string[] = [];
  const lab = [0, 0, 0], rgb = [0, 0, 0];
  for (const pixel of [[0, 0, 0], [255, 255, 255], [50, 80, 210], [190, 110, 55]]) {
    rgbToLab(pixel[0]!, pixel[1]!, pixel[2]!, lab); labToRgb(lab[0]!, lab[1]!, lab[2]!, rgb);
    assert(pixel.every((value, i) => Math.abs(value - rgb[i]!) <= 1), 'Lab roundtrip changed an RGB channel.');
  }
  const weighted = new ImageData(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 0]), 2, 1);
  const weightedStats = analyzeColorPixels(weighted);
  rgbToLab(255, 0, 0, lab);
  assert(weightedStats.mean.every((value, i) => Math.abs(value - lab[i]!) < 1e-8), 'Transparent pixel influenced statistics.');
  const partial = new ImageData(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 128]), 2, 1);
  const partialStats = analyzeColorPixels(partial);
  const blueLab = [0, 0, 0]; rgbToLab(0, 0, 255, blueLab);
  assert(partialStats.mean.every((value, i) => Math.abs(value - (lab[i]! + blueLab[i]! * 128 / 255) / (1 + 128 / 255)) < 1e-7), 'Semitransparent weight was incorrect.');
  expectFailure(() => analyzeColorPixels(new ImageData(1, 1)), 'Transparent sample must fail.');
  const flat = createColorTransferRecipe(weightedStats, weightedStats);
  assert(normalizeColorTransfer(flat) === null, 'Identical flat samples must be neutral.');
  const extremes = createColorTransferRecipe({ mean: [0, 0, 0], deviation: [1, 1, 1] }, { mean: [100, 100, 100], deviation: [100, 100, 100] });
  assert(extremes.gain.every((value) => value === 2), 'Gain cap failed.');
  expectFailure(() => validateColorTransfer({ ...settings, gain: [0, 1, 1] }), 'Invalid luminance gain accepted.');
  expectFailure(() => validateColorTransfer({ ...settings, offset: [NaN, 0, 0] }), 'NaN accepted.');
  expectFailure(() => validateColorTransfer({ ...settings, gain: Array(3) }), 'Sparse gain accepted.');
  expectFailure(() => validateColorTransfer({ ...settings, algorithmVersion: 2 }), 'Unknown algorithm accepted.');
  const originalHasOwn = Object.hasOwn;
  try {
    Object.hasOwn = undefined as unknown as typeof Object.hasOwn;
    validateColorTransfer(settings);
    validateEditorSnapshot(createImageBaselineSnapshot('compatibility', 1, 1), { id: 'compatibility', width: 1, height: 1 });
  } finally { Object.hasOwn = originalHasOwn; }
  lines.push('PASS Lab roundtrip, alpha-weighted statistics, flat/transparent/degenerate inputs, bounds and versions');

  const zero = new ImageData(new Uint8ClampedArray([20, 30, 40, 128, 7, 8, 9, 0]), 2, 1);
  const zeroBefore = [...zero.data]; applyColorTransferPixels(zero, { ...settings, strength: 0 });
  assert(zero.data.every((value, i) => value === zeroBefore[i]), 'Zero strength was not exact identity.');
  applyColorTransferPixels(zero, settings);
  assert(zero.data[3] === 128 && zero.data[7] === 0 && zero.data[4] === 7, 'Alpha or fully transparent pixel changed.');

  const previousBackend = getFilterBackend();
  const source = makeCanvas(257, 129);
  const dense = source.getContext('2d')!.getImageData(0, 0, source.width, source.height);
  for (let i = 0; i < dense.data.length; i += 4) {
    const n = i / 4;
    dense.data[i] = (n * 37) % 256; dense.data[i + 1] = Math.floor(n / 256) * 2; dense.data[i + 2] = (n * 79) % 256;
  }
  source.getContext('2d')!.putImageData(dense, 0, 0);
  const filterPixels = (backend: Canvas2dFilterBackend | WebGLFilterBackend, recipe: ColorTransferSettings): ImageData => {
    setFilterBackend(backend);
    const image = new FabricImage(source);
    try {
      applyImageAdjustments(image, { brightness: 0, contrast: 0, saturation: 0, presetId: 'original', presetVersion: 1, colorTransfer: recipe });
      return (image.getElement() as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, source.width, source.height);
    } finally { image.dispose(); }
  };
  try {
    const gpuBackend = new WebGLFilterBackend();
    assert(gpuBackend.gl, 'WebGL is unavailable; do not report GPU parity as passed.');
    try {
      let maximum = 0;
      for (const recipe of [settings, { ...settings, gain: [2, 2, 0] as const, offset: [30, -80, 100] as const, strength: 100 }]) {
        const cpu = filterPixels(new Canvas2dFilterBackend(), recipe);
        const gpu = filterPixels(gpuBackend, recipe);
        for (let i = 0; i < cpu.data.length; i++) {
          if (i % 4 === 3) assert(cpu.data[i] === gpu.data[i], 'GPU alpha differs.');
          else maximum = Math.max(maximum, Math.abs(cpu.data[i]! - gpu.data[i]!));
        }
      }
      assert(maximum <= 3, `CPU/WebGL max channel difference ${maximum} exceeds 3.`);
      const wide = new FabricImage(makeCanvas(8192, 4));
      try {
        setFilterBackend(gpuBackend);
        applyImageAdjustments(wide, { brightness: 0, contrast: 0, saturation: 0, presetId: 'original', presetVersion: 1, colorTransfer: settings });
        const output = (wide.getElement() as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 8192, 4);
        assert(output.data[(8192 - 1) * 4 + 3] === 255, '8192px source was clipped by WebGL canvas size.');
        assert(getFilterBackend() === gpuBackend, 'Oversize fallback changed the shared backend.');
      } finally { wide.dispose(); }
      const originalGetError = gpuBackend.gl.getError;
      try {
        gpuBackend.gl.getError = () => gpuBackend.gl.INVALID_OPERATION;
        expectFailure(() => filterPixels(gpuBackend, settings), 'WebGL render error was silently accepted.');
      } finally { gpuBackend.gl.getError = originalGetError; }
      lines.push(`PASS CPU/WebGL parity (max RGB difference ${maximum}); zero strength exact; alpha unchanged`);
    } finally { gpuBackend.dispose(); }
  } finally { setFilterBackend(previousBackend); }

  const candidate = await decodeWithFabricUrl(await fileFromCanvas(makeCanvas()));
  const reference = await fileFromCanvas(makeCanvas(320, 240, true), 'reference.png');
  const baseline = createImageBaselineSnapshot(candidate.assetId, candidate.width, candidate.height);
  const asset = { id: candidate.assetId, width: candidate.width, height: candidate.height };
  try {
    await validateImageFile(candidate.source);
    const before = JSON.stringify(baseline);
    const same = await analyzeColorReference(candidate, baseline, candidate.source, new AbortController().signal);
    assert(normalizeColorTransfer(same.settings) === null, 'Image used as its own reference was not neutral.');
    const result = await analyzeColorReference(candidate, baseline, reference, new AbortController().signal);
    const thumb = await blobPixels(result.thumbnail);
    assert(Math.max(thumb.width, thumb.height) === 256, 'Analysis thumbnail is not bounded to 256.');
    const hidden = { ...baseline, scene: baseline.scene.map((item) => ({ ...item, visible: false, opacity: 0 })) };
    const hiddenResult = await analyzeColorReference(candidate, hidden, reference, new AbortController().signal);
    assert(JSON.stringify(result.settings) === JSON.stringify(hiddenResult.settings), 'Layer visibility/opacity affected analysis.');
    const cropped = cropDocument(baseline, { x: 0, y: 0, width: 80, height: 100 }, 'free');
    const cropResult = await analyzeColorReference(candidate, cropped, reference, new AbortController().signal);
    assert(JSON.stringify(result.settings) !== JSON.stringify(cropResult.settings), 'Crop was ignored by source sampling.');
    await expectAsyncFailure(() => analyzeColorReference(candidate, baseline, new File(['bad'], 'bad.png', { type: 'image/png' }), new AbortController().signal), 'Bad reference accepted.');
    await expectAsyncFailure(() => analyzeColorReference(candidate, baseline, new File([], 'empty.png', { type: 'image/png' }), new AbortController().signal), 'Empty reference accepted.');
    await expectAsyncFailure(() => analyzeColorReference(candidate, baseline, new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }), new AbortController().signal), 'Oversize reference accepted.');
    await expectAsyncFailure(() => analyzeColorReference(candidate, baseline, metadataPng(4001, 3000), new AbortController().signal), 'Over 12MP reference accepted.');
    await expectAsyncFailure(() => analyzeColorReference(candidate, baseline, metadataPng(8193, 1), new AbortController().signal), 'Over 8192px reference accepted.');
    await expectAsyncFailure(() => analyzeColorReference(candidate, baseline, metadataPng(1, 1, true), new AbortController().signal), 'Animated reference accepted.');
    const transparent = document.createElement('canvas'); transparent.width = transparent.height = 1;
    const transparentFile = await fileFromCanvas(transparent);
    await expectAsyncFailure(() => analyzeColorReference(candidate, baseline, transparentFile, new AbortController().signal), 'Transparent reference accepted.');
    const exifResponse = await fetch('/tests/fixtures/day2-import/jpeg-orientation-8.jpg');
    const exifFile = new File([await exifResponse.blob()], 'orientation-8.jpg', { type: 'image/jpeg' });
    const exifCandidate = await decodeWithFabricUrl(exifFile);
    try {
      assert(exifCandidate.width === 48 && exifCandidate.height === 64, 'EXIF orientation was not normalized.');
      const exifResult = await analyzeColorReference(exifCandidate, createImageBaselineSnapshot(exifCandidate.assetId, 48, 64), exifFile, new AbortController().signal);
      assert(normalizeColorTransfer(exifResult.settings) === null, 'Reference EXIF was applied twice.');
    } finally { exifCandidate.dispose(); }
    const webpResponse = await fetch('/tests/fixtures/day2-import/webp-static.webp');
    const webpFile = new File([await webpResponse.blob()], 'landscape.webp', { type: 'image/webp' });
    const webpCandidate = await decodeWithFabricUrl(webpFile);
    try {
      const webpBase = createImageBaselineSnapshot(webpCandidate.assetId, webpCandidate.width, webpCandidate.height);
      const webpSelf = await analyzeColorReference(webpCandidate, webpBase, webpFile, new AbortController().signal);
      assert(normalizeColorTransfer(webpSelf.settings) === null, 'WebP used as its own reference was not neutral.');
      const webpSample = await analyzeColorReference(candidate, baseline, webpFile, new AbortController().signal);
      validateColorTransfer(webpSample.settings);
    } finally { webpCandidate.dispose(); }
    assert(JSON.stringify(baseline) === before, 'Reference analysis mutated the canonical snapshot.');
    lines.push('PASS reference analysis: self identity, raw crop, hidden source, size/header validation and immutable baseline');

    const edited: EditorSnapshot = { ...baseline, imageAppearance: { ...baseline.imageAppearance, colorTransfer: result.settings } };
    validateEditorSnapshot(edited, asset);
    const old = clone(baseline) as unknown as Record<string, unknown>;
    old.schemaVersion = 2; delete (old.imageAppearance as Record<string, unknown>).colorTransfer;
    const oldBefore = JSON.stringify(old);
    const migrated = parseEditorSnapshot(old, asset);
    assert(migrated.schemaVersion === 3 && migrated.imageAppearance.colorTransfer === null && JSON.stringify(old) === oldBefore, 'Schema 2 migration mutated input or dropped data.');
    expectFailure(() => parseEditorSnapshot({ ...old, schemaVersion: 99 }, asset), 'Unknown snapshot accepted.');
    let history = createHistory(baseline);
    history = commitHistory(history, edited);
    assert(history.index === 1 && commitHistory(history, clone(edited)) === history, 'Commit/no-op history incorrect.');
    assert(JSON.stringify(currentSnapshot(undoHistory(history))) === before, 'Undo failed.');
    assert(JSON.stringify(currentSnapshot(redoHistory(undoHistory(history)))) === JSON.stringify(edited), 'Redo failed.');
    const branched = commitHistory(undoHistory(history), selectImagePreset(baseline, 'warm'));
    assert(!canRedo(branched), 'Redo branch survived a new commit.');
    const compared = createCompareSnapshot(edited);
    assert(compared.imageAppearance.colorTransfer === null && edited.imageAppearance.colorTransfer !== null, 'Compare changed canonical transfer.');
    assert(selectImagePreset(selectImagePreset(edited, 'warm'), 'original').imageAppearance.colorTransfer === result.settings, 'Original removed transfer.');
    assert(JSON.stringify(transformDocument(edited, 'rotate-right').imageAppearance) === JSON.stringify(edited.imageAppearance), 'Geometry recomputed color recipe.');
    lines.push('PASS schema 2→3, strict versions, history/no-op/branch, Original and Compare');

    const withOverlay: EditorSnapshot = { ...edited, scene: [...edited.scene, {
      id: 'marker', role: 'shape', shape: 'rectangle', left: 10, top: 10, width: 30, height: 30,
      scaleX: 1, scaleY: 1, angle: 0, flipX: false, flipY: false, visible: true, opacity: 1, fill: '#ff00ff', stroke: null, strokeWidth: 0,
    }, {
      id: 'text-marker', role: 'text', text: 'Tiếng Việt', width: 240, left: 50, top: 80,
      scaleX: 1, scaleY: 1, angle: 0, flipX: false, flipY: false, visible: true, opacity: 1,
      fontFamily: 'Noto Sans', fontSize: 24, fontWeight: 700, fontStyle: 'normal', textAlign: 'left', fill: '#00ff00',
    }] };
    for (const format of ['png', 'jpeg', 'webp'] as const) {
      if (!await probeExportFormat(format)) { lines.push(`SKIP ${format} encoder unavailable`); continue; }
      const pixels = await blobPixels(await exportImage(candidate, withOverlay, { format, quality: 100, backgroundColor: '#ffffff' }));
      const marker = (20 * pixels.width + 20) * 4;
      assert(pixels.width === 320 && pixels.height === 240 && pixels.data[marker]! > 230 && pixels.data[marker + 1]! < 25 && pixels.data[marker + 2]! > 230, `${format} changed overlay or dimensions.`);
      let greenText = false;
      for (let y = 80; y < 120; y++) for (let x = 50; x < 240; x++) {
        const i = (y * pixels.width + x) * 4;
        if (pixels.data[i]! < 35 && pixels.data[i + 1]! > 220 && pixels.data[i + 2]! < 35) greenText = true;
      }
      assert(greenText, `${format} changed the green text overlay color.`);
    }
    await renderDraftThumbnail(candidate, withOverlay);
    const thumbnails = await renderPresetThumbnails(candidate, withOverlay);
    const plainThumbnails = await renderPresetThumbnails(candidate, baseline);
    assert(thumbnails.original !== plainThumbnails.original, 'Preset thumbnail omitted transfer.');
    const resized = resizeDocument(edited, { width: 640, height: 480 }, 2);
    const enlarged = await blobPixels(await exportImage(candidate, resized, { format: 'png', quality: 90, backgroundColor: '#ffffff' }));
    assert(enlarged.width === 640 && enlarged.height === 480, 'Export used a 256px analysis image.');
    const alphaResponse = await fetch('/tests/fixtures/day2-import/png-alpha.png');
    const alphaCandidate = await decodeWithFabricUrl(new File([await alphaResponse.blob()], 'alpha.png', { type: 'image/png' }));
    try {
      const alphaBase = createImageBaselineSnapshot(alphaCandidate.assetId, alphaCandidate.width, alphaCandidate.height);
      const alphaSnapshot = { ...alphaBase, imageAppearance: { ...alphaBase.imageAppearance, colorTransfer: settings } };
      for (const format of ['png', 'webp'] as const) {
        if (!await probeExportFormat(format)) continue;
        const output = await blobPixels(await exportImage(alphaCandidate, alphaSnapshot, { format, quality: 100, backgroundColor: '#ffffff' }));
        assert([0, 128, 255].every((value, i) => Math.abs(output.data[i * 4 + 3]! - value) <= (format === 'png' ? 2 : 3)), 'Export with transfer altered alpha.');
      }
    } finally { alphaCandidate.dispose(); }
    lines.push('PASS shared thumbnail/export pipeline, full document dimensions and unaffected overlay colors');

    const owner = 'color-transfer-harness';
    const lease = await acquireDraftLease(owner);
    assert(lease.kind === 'acquired', 'Another tab owns the test draft.');
    try {
      await saveCurrentDraft(owner, lease.lease.leaseId, candidate, withOverlay, 1);
      const loaded = await readCurrentDraft();
      assert(JSON.stringify(loaded?.draft.snapshot) === JSON.stringify(withOverlay), 'Stored color recipe roundtrip failed.');
      await rawDraft((record) => { record.schemaVersion = 2; record.snapshot = old; });
      const inspection = await inspectCurrentDraft();
      assert(inspection.kind === 'ready' && inspection.saved.draft.schemaVersion === 3, 'Legacy draft was not migrated in RAM.');
      assert((await rawDraft()).schemaVersion === 2, 'Reading silently rewrote legacy IndexedDB.');
      await rawDraft((record) => { record.snapshot = clone(edited); });
      assert((await inspectCurrentDraft()).kind === 'source-only', 'Mismatched record/snapshot versions were accepted.');
      assert((await rawDraft()).schemaVersion === 2, 'Recovery rewrote mismatched draft metadata.');
      await rawDraft((record) => {
        record.schemaVersion = 3; record.snapshot = clone(edited);
        const appearance = (record.snapshot as unknown as Record<string, Record<string, unknown>>).imageAppearance!;
        (appearance.colorTransfer as Record<string, unknown>).algorithmVersion = 99;
      });
      assert((await inspectCurrentDraft()).kind === 'source-only', 'Unknown algorithm did not enter source recovery.');
      assert((await rawDraft()).schemaVersion === 3, 'Recovery deleted the old draft.');
      lines.push('PASS draft roundtrip, non-writing legacy migration and preserved source-only recovery');
    } finally { await deleteCurrentDraft(owner, lease.lease.leaseId); await releaseDraftLease(owner, lease.lease.leaseId); }
  } finally { candidate.dispose(); }
  return lines;
}

async function performanceRun(): Promise<string[]> {
  const lines = [`${navigator.userAgent}; DPR=${devicePixelRatio}`];
  const original = getFilterBackend();
  try {
    for (const [width, height] of [[2048, 1536], [4000, 3000]]) {
      const candidate = await decodeWithFabricUrl(await fileFromCanvas(makeCanvas(width, height)));
      const baseline = createImageBaselineSnapshot(candidate.assetId, width, height);
      const snapshot: EditorSnapshot = { ...baseline, scene: [...baseline.scene, ...Array.from({ length: 5 }, (_, index) => ({
        id: `performance-${index}`, role: 'shape' as const, shape: 'rectangle' as const, left: 100 + index * 80, top: 100,
        width: 60, height: 60, scaleX: 1, scaleY: 1, angle: 0, flipX: false, flipY: false,
        visible: true, opacity: 1, fill: '#ff00ff', stroke: null, strokeWidth: 0,
      }))] };
      const edited = { ...snapshot, imageAppearance: { ...snapshot.imageAppearance, colorTransfer: settings } };
      const renderer = new StaticCanvas(document.createElement('canvas'), { width: 1024, height: 768, enableRetinaScaling: false, renderOnAddRemove: false });
      renderer.setViewportTransform([1024 / width, 0, 0, 768 / height, 0, 0]);
      renderer.add(candidate.image, ...createFabricOverlays(snapshot.scene));
      try {
        for (const [name, backend] of [['CPU', new Canvas2dFilterBackend()], ['WebGL', new WebGLFilterBackend()]] as const) {
          try {
            setFilterBackend(backend);
            const timings: number[] = [];
            const count = width === 2048 ? 20 : 2;
            for (let i = -2; i < count; i++) {
              const appearance = { ...edited.imageAppearance, colorTransfer: { ...settings, strength: 50 + (i + 2) % 50 } };
              const start = performance.now(); applyImageAdjustments(candidate.image, appearance); renderer.renderAll();
              if (i >= 0) timings.push(performance.now() - start);
              await new Promise((resolve) => requestAnimationFrame(resolve));
            }
            timings.sort((a, b) => a - b);
            const start = performance.now(); const blob = await exportImage(candidate, edited, { format: 'png', quality: 90, backgroundColor: '#ffffff' });
            lines.push(`${width}×${height} ${name}: filter+StaticCanvas+5 shapes ${count === 20 ? 'p95 (20 samples, 2 warmups)' : 'max (2 samples, 2 warmups)'}=${timings[Math.ceil(timings.length * .95) - 1]!.toFixed(1)}ms; PNG export=${(performance.now() - start).toFixed(1)}ms; bytes=${blob.size}`);
          } finally { if (backend instanceof WebGLFilterBackend) backend.dispose(); }
        }
      } finally { renderer.remove(candidate.image); await renderer.dispose(); candidate.dispose(); }
    }
  } finally { setFilterBackend(original); }
  return lines;
}

for (const [buttonId, outputId, action] of [['run', 'results', run], ['performance', 'performance-results', performanceRun]] as const) {
  const button = document.getElementById(buttonId) as HTMLButtonElement;
  const output = document.getElementById(outputId)!;
  button.onclick = async () => {
    const buttons = document.querySelectorAll<HTMLButtonElement>('#run, #performance');
    buttons.forEach((item) => { item.disabled = true; }); output.textContent = 'Đang chạy…';
    try { output.textContent = (await action()).join('\n'); }
    catch (error) { output.textContent = `FAIL ${error instanceof Error ? error.stack : error}`; }
    finally { buttons.forEach((item) => { item.disabled = false; }); }
  };
}
