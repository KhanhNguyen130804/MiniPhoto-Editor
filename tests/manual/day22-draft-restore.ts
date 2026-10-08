import { decodeSavedImageAsset, decodeWithFabricUrl } from '../../src/features/editor/engine/imageImport';
import { abortDraftSaveForManualCheck, deleteCurrentDraft, DRAFT_DATABASE_NAME, inspectCurrentDraft, saveCurrentDraft } from '../../src/features/editor/engine/draftStore';
import { canUndo, commitHistory, createHistory, currentSnapshot } from '../../src/features/editor/engine/history';
import { selectImagePreset } from '../../src/features/editor/engine/adjustmentFilters';
import { createImageBaselineSnapshot, type EditorSnapshot, type ShapeOverlaySnapshot, type TextOverlaySnapshot } from '../../src/features/editor/engine/snapshot';
import { validateEditorSnapshot } from '../../src/features/editor/engine/draftValidation';
import type { ImageImportCandidate } from '../../src/features/editor/engine/imageImport';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const seedButton = document.querySelector<HTMLButtonElement>('#seed-source-only')!;
const missingAssetButton = document.querySelector<HTMLButtonElement>('#seed-missing-asset')!;
const results = document.querySelector<HTMLElement>('#results')!;
const SIZE = { width: 64, height: 48 };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createCandidate(name: string): Promise<ImageImportCandidate> {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE.width;
  canvas.height = SIZE.height;
  const context = canvas.getContext('2d');
  assert(context, 'Canvas 2D context is unavailable.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, SIZE.width, SIZE.height);
  context.fillStyle = '#2563eb';
  context.fillRect(8, 8, 36, 26);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG encode failed.')), 'image/png'));
  canvas.width = 0;
  canvas.height = 0;
  return decodeWithFabricUrl(new File([blob], name, { type: 'image/png' }));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DATABASE_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open draft database.'));
  });
}

async function updateCurrentDraft(update: (draft: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction('drafts', 'readwrite');
  const done = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Draft update aborted.'));
  });
  const store = transaction.objectStore('drafts');
  const request = store.get('current');
  request.onsuccess = () => store.put(update(request.result as Record<string, unknown>));
  try { await done; } finally { db.close(); }
}

async function removeAsset(assetId: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction('assets', 'readwrite');
  const done = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Asset removal aborted.'));
  });
  transaction.objectStore('assets').delete(assetId);
  try { await done; } finally { db.close(); }
}

async function counts(): Promise<{ drafts: number; assets: number }> {
  const db = await openDatabase();
  const transaction = db.transaction(['assets', 'drafts'], 'readonly');
  const done = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Count transaction aborted.'));
  });
  const result = await Promise.all(['assets', 'drafts'].map((name) => new Promise<number>((resolve, reject) => {
    const request = transaction.objectStore(name).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`Could not count ${name}.`));
  })));
  await done;
  db.close();
  return { assets: result[0]!, drafts: result[1]! };
}

async function expectAbort(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
    throw new Error('Expected replacement to abort.');
  } catch (error) {
    assert(error instanceof DOMException && error.name === 'AbortError', 'Replacement must fail with AbortError.');
  }
}

async function runAssertions(): Promise<string[]> {
  assert(window.location.hostname === '127.0.0.1' && window.location.port === '5176', 'Run this harness at http://127.0.0.1:5176 only.');
  const first = await createCandidate('day22-first.png');
  const second = await createCandidate('day22-second.png');
  const baseline = createImageBaselineSnapshot(first.assetId, first.width, first.height);
  const text: TextOverlaySnapshot = {
    id: 'day22-text', role: 'text', left: 4, top: 3, scaleX: 1, scaleY: 1, angle: 0,
    flipX: false, flipY: false, visible: true, opacity: 1, text: 'Khôi phục', width: 42,
    fontFamily: 'Noto Sans', fontSize: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', fill: '#111827',
  };
  const hiddenShape: ShapeOverlaySnapshot = {
    id: 'day22-hidden-shape', role: 'shape', shape: 'rectangle', left: 8, top: 6, scaleX: 1, scaleY: 1, angle: 0,
    flipX: false, flipY: false, visible: false, opacity: 1, width: 12, height: 8, fill: '#2563eb', stroke: null, strokeWidth: 0,
  };
  const snapshot: EditorSnapshot = {
    ...baseline,
    imageAppearance: { ...baseline.imageAppearance, presetId: 'warm', brightness: 12, contrast: -5, saturation: 20 },
    scene: [...baseline.scene, text, hiddenShape],
  };
  const passed: string[] = [];

  try {
    await saveCurrentDraft(first, snapshot, 8);
    const ready = await inspectCurrentDraft();
    assert(ready.kind === 'ready' && ready.saved.asset.id === first.assetId, 'A supported snapshot and matching source must be ready to restore.');
    validateEditorSnapshot(ready.saved.draft.snapshot, ready.saved.asset);
    const restoredText = ready.saved.draft.snapshot.scene.find((item) => item.role === 'text');
    const restoredHiddenShape = ready.saved.draft.snapshot.scene.find((item) => item.id === hiddenShape.id);
    assert(ready.saved.draft.snapshot.imageAppearance.presetId === 'warm'
      && ready.saved.draft.snapshot.imageAppearance.brightness === 12
      && restoredText?.role === 'text' && restoredText.text === text.text
      && restoredHiddenShape?.role === 'shape' && restoredHiddenShape.visible === false,
    'Restore inspection must retain preset, adjustments, text and hidden-layer state.');
    const restored = await decodeSavedImageAsset(ready.saved.asset);
    assert(restored.assetId === first.assetId && restored.importedAt === first.importedAt
      && restored.width === first.width && restored.height === first.height, 'Restore must preserve source ID, import time and decoded dimensions.');
    const history = createHistory(ready.saved.draft.snapshot, ready.saved.draft.revision);
    assert(history.revision === 8 && currentSnapshot(history).document.sourceAssetId === first.assetId, 'Restore history must begin at saved revision with the saved snapshot as its only entry.');
    const edited = commitHistory(history, selectImagePreset(currentSnapshot(history), 'cool'));
    assert(edited.revision === 9 && !canUndo(history), 'The first post-restore commit must advance the stored revision without restoring old undo entries.');
    restored.dispose();
    passed.push('Supported draft validation, source identity/dimensions and history revision baseline');

    await expectAbort(() => abortDraftSaveForManualCheck(second, createImageBaselineSnapshot(second.assetId, second.width, second.height), 0));
    const afterAbort = await inspectCurrentDraft();
    assert(afterAbort.kind === 'ready' && afterAbort.saved.asset.id === first.assetId && afterAbort.saved.draft.revision === 8,
      'An aborted replacement must preserve the existing draft and source.');
    passed.push('Aborted image replacement leaves the saved draft and asset intact');

    await updateCurrentDraft((draft) => ({ ...draft, schemaVersion: 99, snapshot: { schemaVersion: 99 } }));
    const sourceOnly = await inspectCurrentDraft();
    assert(sourceOnly.kind === 'source-only' && sourceOnly.saved.asset.id === first.assetId,
      'Unsupported snapshot schema with a valid source must offer source-only recovery.');
    const source = await decodeSavedImageAsset(sourceOnly.saved.asset);
    assert(source.assetId === first.assetId && source.width === first.width, 'Source-only recovery must still decode the preserved source.');
    source.dispose();
    assert((await counts()).assets === 1, 'Inspection and source-only recovery must not auto-delete saved data.');
    passed.push('Unsupported snapshot is retained and exposes a decodable source-only recovery');

    await deleteCurrentDraft();
    assert((await inspectCurrentDraft()).kind === 'none', 'Discard must remove the current draft.');
    assert((await counts()).assets === 0, 'Discard must remove the draft asset in the same transaction.');
    passed.push('Confirmed-discard store operation removes draft and associated asset');

    await saveCurrentDraft(second, createImageBaselineSnapshot(second.assetId, second.width, second.height), 0);
    await removeAsset(second.assetId);
    const missing = await inspectCurrentDraft();
    assert(missing.kind === 'unrecoverable' && missing.assetId === second.assetId, 'A missing source must be reported as unrecoverable.');
    assert((await counts()).drafts === 1, 'Detection of a missing asset must preserve the draft record until explicit discard.');
    await deleteCurrentDraft();
    assert((await inspectCurrentDraft()).kind === 'none' && (await counts()).drafts === 0, 'Discard must clear an unrecoverable current draft.');
    passed.push('Missing source remains until explicit discard, then the dangling draft record is removed');
    return passed;
  } finally {
    first.dispose();
    second.dispose();
  }
}

runButton.addEventListener('click', async () => {
  runButton.disabled = true;
  results.textContent = 'Đang chạy…';
  try {
    results.textContent = (await runAssertions()).map((item) => `PASS — ${item}`).join('\n');
  } catch (error) {
    results.textContent = `FAIL — ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    runButton.disabled = false;
  }
});

seedButton.addEventListener('click', async () => {
  seedButton.disabled = true;
  try {
    assert((await inspectCurrentDraft()).kind === 'none', 'Discard the existing test draft in the app before seeding another one.');
    const candidate = await createCandidate('day22-recovery-source.png');
    try {
      await saveCurrentDraft(candidate, createImageBaselineSnapshot(candidate.assetId, candidate.width, candidate.height), 0);
      await updateCurrentDraft((draft) => ({ ...draft, schemaVersion: 99, snapshot: { schemaVersion: 99 } }));
    } finally {
      candidate.dispose();
    }
    results.textContent = 'Đã tạo mẫu snapshot không hỗ trợ. Mở ứng dụng tại / để kiểm tra recovery UI.';
  } catch (error) {
    results.textContent = `Không tạo được mẫu: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    seedButton.disabled = false;
  }
});

missingAssetButton.addEventListener('click', async () => {
  missingAssetButton.disabled = true;
  try {
    assert((await inspectCurrentDraft()).kind === 'none', 'Discard the existing test draft in the app before seeding another one.');
    const candidate = await createCandidate('day22-missing-asset.png');
    try {
      await saveCurrentDraft(candidate, createImageBaselineSnapshot(candidate.assetId, candidate.width, candidate.height), 0);
      await removeAsset(candidate.assetId);
    } finally {
      candidate.dispose();
    }
    results.textContent = 'Đã tạo mẫu thiếu asset. Mở ứng dụng tại / để kiểm tra UI chỉ giữ hướng dẫn bỏ draft.';
  } catch (error) {
    results.textContent = `Không tạo được mẫu: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    missingAssetButton.disabled = false;
  }
});
