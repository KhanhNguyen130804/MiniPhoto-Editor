import { FabricImage } from 'fabric';
import { createDraftAutosave, type DraftSaveStatus } from '../../src/features/editor/engine/draftAutosave';
import { abortDraftSaveForManualCheck, DRAFT_DATABASE_NAME, readCurrentDraft, saveCurrentDraft } from '../../src/features/editor/engine/draftStore';
import { commitHistory, createHistory, currentSnapshot, redoHistory, undoHistory } from '../../src/features/editor/engine/history';
import type { ImageImportCandidate } from '../../src/features/editor/engine/imageImport';
import { selectImagePreset } from '../../src/features/editor/engine/adjustmentFilters';
import { createImageBaselineSnapshot } from '../../src/features/editor/engine/snapshot';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLElement>('#results')!;
const SIZE = { width: 64, height: 48 };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function createCandidate(assetId: string, name: string, sourceBytes: number[]): ImageImportCandidate {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE.width;
  canvas.height = SIZE.height;
  const context = canvas.getContext('2d');
  assert(context, 'Canvas 2D context is unavailable.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, SIZE.width, SIZE.height);
  context.fillStyle = '#f87171';
  context.fillRect(8, 8, 32, 24);
  context.clearRect(0, 0, 2, 2);
  const image = new FabricImage(canvas);
  let disposed = false;
  return {
    assetId,
    source: new File([new Uint8Array(sourceBytes)], name, { type: 'image/png' }),
    mimeType: 'image/png',
    importedAt: Date.now(),
    image,
    sourceElement: canvas,
    ...SIZE,
    dispose() {
      if (disposed) return;
      disposed = true;
      image.dispose();
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

function countAssets(): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DATABASE_NAME, 1);
    request.onerror = () => reject(request.error ?? new Error('Could not open the draft database.'));
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('assets', 'readonly');
      const count = transaction.objectStore('assets').count();
      count.onsuccess = () => resolve(count.result);
      count.onerror = () => reject(count.error ?? new Error('Could not count saved assets.'));
      transaction.oncomplete = () => db.close();
      transaction.onabort = () => db.close();
    };
  });
}

async function checkDatabaseSchema(): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DATABASE_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the draft database.'));
  });
  assert(['assets', 'drafts', 'meta'].every((name) => db.objectStoreNames.contains(name)), 'Database must contain all three stores.');
  const transaction = db.transaction('meta', 'readonly');
  const transactionDone = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Schema read aborted.'));
  });
  const schemaRequest = transaction.objectStore('meta').get('schema');
  const schema = await new Promise<{ id: string; version: number }>((resolve, reject) => {
    schemaRequest.onsuccess = () => resolve(schemaRequest.result as { id: string; version: number });
    schemaRequest.onerror = () => reject(schemaRequest.error ?? new Error('Could not read schema metadata.'));
  });
  assert(schema.version === 1, 'Meta store must record schema version 1.');
  await transactionDone;
  db.close();
}

async function countAssetWrites(operation: () => Promise<void>): Promise<number> {
  const originalPut = IDBObjectStore.prototype.put;
  let writes = 0;
  const countedPut: typeof IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args) {
    if (this.name === 'assets') writes += 1;
    return originalPut.apply(this, args);
  };
  Object.defineProperty(IDBObjectStore.prototype, 'put', { configurable: true, writable: true, value: countedPut });
  try {
    await operation();
  } finally {
    Object.defineProperty(IDBObjectStore.prototype, 'put', { configurable: true, writable: true, value: originalPut });
  }
  return writes;
}

async function expectAbort(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
    throw new Error('Expected the IndexedDB transaction to abort.');
  } catch (error) {
    assert(error instanceof DOMException && error.name === 'AbortError', 'Forced failure must reject with AbortError.');
  }
}

async function runAssertions(): Promise<string[]> {
  assert(window.location.hostname === '127.0.0.1' && window.location.port === '5175', 'Run this harness at http://127.0.0.1:5175 only.');
  await checkDatabaseSchema();
  const first = createCandidate('day21-asset-first', 'first.png', [1, 2, 3, 4, 5]);
  const second = createCandidate('day21-asset-second', 'second.png', [9, 8, 7, 6]);
  const firstBaseline = createImageBaselineSnapshot(first.assetId, first.width, first.height);
  const secondBaseline = createImageBaselineSnapshot(second.assetId, second.width, second.height);
  const passed: string[] = [];

  try {
    const initialAssetWrites = await countAssetWrites(() => saveCurrentDraft(first, firstBaseline, 0));
    const savedFirst = await readCurrentDraft();
    assert(savedFirst?.draft.assetId === first.assetId && savedFirst.draft.revision === 0, 'Initial save must create the current draft.');
    assert(savedFirst.draft.snapshot.document.sourceAssetId === first.assetId, 'Saved snapshot must refer to the saved source.');
    assert(savedFirst.asset.byteSize === first.source.size && savedFirst.asset.originalFileName === first.source.name
      && savedFirst.asset.importedAt === first.importedAt, 'Asset metadata must match the imported source.');
    assert(savedFirst.asset.mimeType === 'image/png' && savedFirst.asset.width === first.width && savedFirst.asset.height === first.height, 'Asset MIME and oriented dimensions must be saved.');
    assert(savedFirst.draft.schemaVersion === firstBaseline.schemaVersion
      && savedFirst.draft.presetVersion === firstBaseline.imageAppearance.presetVersion
      && savedFirst.draft.appVersion === '0.1.0' && savedFirst.draft.rendererVersion === '7.4.0'
      && savedFirst.draft.updatedAt > 0, 'Draft must store schema, preset, app, renderer and update versions.');
    const storedBytes = new Uint8Array(await savedFirst.asset.blob.arrayBuffer());
    assert(storedBytes.join(',') === '1,2,3,4,5' && initialAssetWrites === 1, 'First save must persist the source Blob exactly once.');
    assert(savedFirst.draft.thumbnail.type === 'image/jpeg' && savedFirst.draft.thumbnail.size <= 256 * 1024, 'Thumbnail must be bounded JPEG.');
    const thumbnail = await createImageBitmap(savedFirst.draft.thumbnail);
    assert(Math.max(thumbnail.width, thumbnail.height) <= 256, 'Thumbnail longest edge must be at most 256 pixels.');
    const thumbnailCanvas = document.createElement('canvas');
    thumbnailCanvas.width = thumbnail.width;
    thumbnailCanvas.height = thumbnail.height;
    const thumbnailContext = thumbnailCanvas.getContext('2d');
    assert(thumbnailContext, 'Thumbnail canvas context is unavailable.');
    thumbnailContext.drawImage(thumbnail, 0, 0);
    const whiteCorner = thumbnailContext.getImageData(0, 0, 1, 1).data;
    assert(whiteCorner[0] > 245 && whiteCorner[1] > 245 && whiteCorner[2] > 245, 'Transparent source pixels must use the white JPEG matte.');
    thumbnail.close();
    passed.push('Schema, source Blob, metadata, snapshot, bounded JPEG thumbnail, matte and initial persistence');

    let history = createHistory(firstBaseline);
    history = commitHistory(history, selectImagePreset(currentSnapshot(history), 'warm'));
    history = undoHistory(history);
    history = redoHistory(history);
    assert(history.revision === 3, 'Commit, undo and redo must each advance revision.');
    const actualSaves: number[] = [];
    const actualStatuses: DraftSaveStatus[] = [];
    const autosave = createDraftAutosave(async (request: { candidate: ImageImportCandidate; snapshot: typeof firstBaseline; revision: number }) => {
      actualSaves.push(request.revision);
      await saveCurrentDraft(request.candidate, request.snapshot, request.revision);
    }, (status) => actualStatuses.push(status), 60_000);
    autosave.schedule({ candidate: first, snapshot: firstBaseline, revision: 1 });
    autosave.schedule({ candidate: first, snapshot: firstBaseline, revision: 2 });
    autosave.schedule({ candidate: first, snapshot: currentSnapshot(history), revision: history.revision });
    await autosave.flush();
    autosave.dispose();
    const latest = await readCurrentDraft();
    assert(actualSaves.length === 1 && actualSaves[0] === 3 && latest?.draft.revision === 3, 'Debounce must save only the latest revision.');
    assert(actualStatuses.includes('DIRTY') && actualStatuses.includes('SAVING') && actualStatuses.at(-1) === 'SAVED', 'Autosave must report dirty, saving and saved in order.');
    const updateAssetWrites = await countAssetWrites(() => saveCurrentDraft(first, currentSnapshot(history), history.revision));
    assert(updateAssetWrites === 0 && await countAssets() === 1, 'Same-asset updates must not write a second source asset.');
    assert((await readCurrentDraft())?.asset.blob.size === first.source.size, 'Same-asset update must retain the original Blob.');
    passed.push('Debounce coalescing, commit/undo/redo revision and source write-once');

    const completed: number[] = [];
    const staleStatuses: { status: DraftSaveStatus; completed: number[] }[] = [];
    let releaseFirstSave: (() => void) | undefined;
    const staleGuard = createDraftAutosave(async (request: { revision: number }) => {
      if (request.revision === 4) await new Promise<void>((resolve) => { releaseFirstSave = resolve; });
      completed.push(request.revision);
    }, (status) => staleStatuses.push({ status, completed: [...completed] }), 60_000);
    staleGuard.schedule({ revision: 4 });
    const firstFlush = staleGuard.flush();
    await Promise.resolve();
    staleGuard.schedule({ revision: 5 });
    const secondFlush = staleGuard.flush();
    assert(releaseFirstSave, 'First save must be pending for the stale-result check.');
    releaseFirstSave();
    await Promise.all([firstFlush, secondFlush]);
    staleGuard.dispose();
    const savedStatus = staleStatuses.find((entry) => entry.status === 'SAVED');
    assert(completed.join(',') === '4,5' && savedStatus?.completed.includes(5), 'An older save must not mark a newer revision SAVED.');
    passed.push('A revision change during an in-flight save rejects the stale SAVED result');

    await expectAbort(() => abortDraftSaveForManualCheck(second, secondBaseline, 0));
    const afterAbort = await readCurrentDraft();
    assert(afterAbort?.asset.id === first.assetId && afterAbort.draft.revision === 3, 'Aborted replacement must preserve the previous draft and source.');
    assert(await countAssets() === 1, 'Aborted replacement must not leave an orphan asset.');
    const errorStatuses: DraftSaveStatus[] = [];
    const failingAutosave = createDraftAutosave(
      () => abortDraftSaveForManualCheck(second, secondBaseline, 1),
      (status) => errorStatuses.push(status),
      60_000,
    );
    failingAutosave.schedule({ candidate: second, snapshot: secondBaseline, revision: 1 });
    await failingAutosave.flush();
    failingAutosave.dispose();
    assert(errorStatuses.at(-1) === 'SAVE_ERROR' && !errorStatuses.includes('SAVED'), 'A rejected transaction must report SAVE_ERROR, never SAVED.');
    assert((await readCurrentDraft())?.asset.id === first.assetId, 'Save error must leave the previous current draft readable.');
    passed.push('Atomic replacement rollback and SAVE_ERROR on an aborted transaction');

    await saveCurrentDraft(second, secondBaseline, 0);
    const replaced = await readCurrentDraft();
    assert(replaced?.asset.id === second.assetId && replaced.draft.assetId === second.assetId, 'Successful replacement must atomically point draft to the new source.');
    assert(await countAssets() === 1, 'Successful replacement must remove the prior source asset.');
    assert((await replaced.asset.blob.arrayBuffer()).byteLength === second.source.size, 'Replacement source Blob must remain readable after opening a fresh DB connection.');
    passed.push('Successful replacement updates asset and draft in one transaction');
    return passed;
  } finally {
    first.dispose();
    second.dispose();
  }
}

void readCurrentDraft().then((saved) => {
  results.textContent = saved
    ? `Bản nháp còn đọc được sau khi trang được nạp: revision ${saved.draft.revision}, ${saved.asset.originalFileName}.`
    : 'Chưa có bản nháp trước lần chạy này.';
}).catch((error: unknown) => {
  results.textContent = `Không đọc được bản nháp đã có: ${error instanceof Error ? error.message : String(error)}`;
});

runButton.addEventListener('click', async () => {
  runButton.disabled = true;
  results.textContent = 'Đang chạy…';
  try {
    const passed = await runAssertions();
    results.textContent = passed.map((item) => `PASS — ${item}`).join('\n');
  } catch (error) {
    results.textContent = `FAIL — ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    runButton.disabled = false;
  }
});
