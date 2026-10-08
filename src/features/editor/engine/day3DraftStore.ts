import type { Day3Asset, Day3Snapshot } from './day3Pipeline';

const DATABASE = 'miniphoto-day3-spike';
const DATABASE_VERSION = 1;
const CURRENT_DRAFT = 'current';

type DraftRecord = { id: string; assetId: string; snapshot: Day3Snapshot };
type StoredAsset = Day3Asset;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the Day 3 draft database.'));
    request.onblocked = () => reject(new Error('The Day 3 draft database is blocked by another tab.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new DOMException('Draft transaction aborted.', 'AbortError'));
  });
}

export async function saveDay3Draft(asset: Day3Asset, snapshot: Day3Snapshot): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(['assets', 'drafts'], 'readwrite');
  const done = transactionDone(transaction);
  const assets = transaction.objectStore('assets');
  const drafts = transaction.objectStore('drafts');
  const previousRequest = drafts.get(CURRENT_DRAFT);

  previousRequest.onsuccess = () => {
    const previous = previousRequest.result as DraftRecord | undefined;
    assets.put(asset satisfies StoredAsset);
    drafts.put({ id: CURRENT_DRAFT, assetId: asset.id, snapshot } satisfies DraftRecord);
    if (previous && previous.assetId !== asset.id) assets.delete(previous.assetId);
  };

  try {
    await done;
  } finally {
    db.close();
  }
}

export async function loadDay3Draft(): Promise<{ asset: Day3Asset; snapshot: Day3Snapshot } | null> {
  const db = await openDatabase();
  const transaction = db.transaction(['assets', 'drafts'], 'readonly');
  const done = transactionDone(transaction);
  let result: { asset: Day3Asset; snapshot: Day3Snapshot } | null = null;
  let loadError: Error | undefined;
  const draftRequest = transaction.objectStore('drafts').get(CURRENT_DRAFT);

  draftRequest.onsuccess = () => {
    const draft = draftRequest.result as DraftRecord | undefined;
    if (!draft) return;
    const assetRequest = transaction.objectStore('assets').get(draft.assetId);
    assetRequest.onsuccess = () => {
      const asset = assetRequest.result as Day3Asset | undefined;
      if (!asset) {
        loadError = new Error('Saved draft source asset is missing.');
        transaction.abort();
        return;
      }
      result = { asset, snapshot: draft.snapshot };
    };
  };

  try {
    await done;
    if (loadError) throw loadError;
    return result;
  } finally {
    db.close();
  }
}

export async function clearDay3Draft(): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(['assets', 'drafts'], 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore('assets').clear();
  transaction.objectStore('drafts').clear();
  try {
    await done;
  } finally {
    db.close();
  }
}

// Manual-harness check: abort a replacement after its writes are queued and verify the old draft survives.
export async function abortDay3ReplacementForManualCheck(
  asset: Day3Asset,
  snapshot: Day3Snapshot,
): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(['assets', 'drafts'], 'readwrite');
  const done = transactionDone(transaction);
  const request = transaction.objectStore('assets').put(asset);
  transaction.objectStore('drafts').put({ id: CURRENT_DRAFT, assetId: asset.id, snapshot } satisfies DraftRecord);
  request.onsuccess = () => transaction.abort();

  try {
    await done;
    throw new Error('The manual rollback check expected the transaction to abort.');
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== 'AbortError') throw error;
  } finally {
    db.close();
  }
}
