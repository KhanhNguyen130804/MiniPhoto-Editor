import type { ImageImportCandidate, ImageFileMetadata } from './imageImport';
import { MAX_IMPORT_FILE_BYTES, MAX_IMAGE_EDGE, MAX_IMAGE_PIXELS } from './imageImport';
import { DRAFT_THUMBNAIL_MAX_BYTES, renderDraftThumbnail } from './draftThumbnail';
import { CURRENT_PRESET_VERSION } from './adjustmentFilters';
import { validateEditorSnapshot } from './draftValidation';
import type { EditorSnapshot } from './snapshot';
import { createUuid } from './uuid';

export const DRAFT_DATABASE_NAME = 'miniphoto-local';
const DATABASE_VERSION = 1;
const CURRENT_DRAFT = 'current';
const DRAFT_OWNER = 'draft-owner';
const MAX_SNAPSHOT_BYTES = 1024 * 1024;
export const DRAFT_LEASE_DURATION_MS = 60_000;
export const DRAFT_LEASE_HEARTBEAT_MS = 20_000;
let abortNextSaveForManualCheck = false;
let retainedLeaseDatabase: IDBDatabase | null = null;

export type DraftLeaseRecord = {
  id: typeof DRAFT_OWNER;
  ownerSessionId: string;
  leaseId: string;
  leaseExpiresAt: number;
};

export type DraftLeaseClaim =
  | { kind: 'acquired'; lease: DraftLeaseRecord }
  | { kind: 'held'; lease: DraftLeaseRecord }
  | { kind: 'lost'; lease?: DraftLeaseRecord };

export class DraftLeaseError extends Error {
  constructor() {
    super('Tab này không còn quyền lưu bản nháp. Hãy xác nhận lưu phiên hiện tại để thay bản nháp đã lưu.');
    this.name = 'DraftLeaseError';
  }
}

type AssetRecord = {
  id: string;
  blob: Blob;
  mimeType: ImageFileMetadata['mimeType'];
  byteSize: number;
  width: number;
  height: number;
  originalFileName: string;
  importedAt: number;
};

type CurrentDraftRecord = {
  id: typeof CURRENT_DRAFT;
  assetId: string;
  snapshot: EditorSnapshot;
  thumbnail: Blob;
  revision: number;
  updatedAt: number;
  schemaVersion: EditorSnapshot['schemaVersion'];
  presetVersion: number;
  appVersion: string;
  rendererVersion: string;
};

export type SavedCurrentDraft = { asset: AssetRecord; draft: CurrentDraftRecord };
export type CurrentDraftInspection =
  | { kind: 'none' }
  | { kind: 'ready'; saved: SavedCurrentDraft }
  | { kind: 'source-only'; saved: SavedCurrentDraft; reason: string }
  | { kind: 'unrecoverable'; assetId?: string; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0 && Number.isFinite(new Date(value as number).getTime());
}

function validAsset(value: unknown, id: string): value is AssetRecord {
  if (!isRecord(value) || !(value.blob instanceof Blob)) return false;
  return value.id === id
    && ['image/jpeg', 'image/png', 'image/webp'].includes(String(value.mimeType))
    && Number.isSafeInteger(value.byteSize) && value.byteSize === value.blob.size
    && value.byteSize > 0 && value.byteSize <= MAX_IMPORT_FILE_BYTES
    && Number.isSafeInteger(value.width) && (value.width as number) > 0 && (value.width as number) <= MAX_IMAGE_EDGE
    && Number.isSafeInteger(value.height) && (value.height as number) > 0 && (value.height as number) <= MAX_IMAGE_EDGE
    && (value.width as number) * (value.height as number) <= MAX_IMAGE_PIXELS
    && typeof value.originalFileName === 'string' && value.originalFileName.length > 0
    && validTimestamp(value.importedAt);
}

function validDraftMetadata(value: unknown, assetId: string): value is CurrentDraftRecord {
  return isRecord(value) && value.id === CURRENT_DRAFT && value.assetId === assetId
    && Number.isSafeInteger(value.revision) && (value.revision as number) >= 0
    && validTimestamp(value.updatedAt)
    && Number.isSafeInteger(value.schemaVersion) && Number.isSafeInteger(value.presetVersion)
    && typeof value.appVersion === 'string' && typeof value.rendererVersion === 'string';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'id' });
      const meta = db.objectStoreNames.contains('meta')
        ? request.transaction!.objectStore('meta')
        : db.createObjectStore('meta', { keyPath: 'id' });
      meta.put({ id: 'schema', version: DATABASE_VERSION });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        if (retainedLeaseDatabase === request.result) retainedLeaseDatabase = null;
      };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error('Không mở được kho bản nháp.'));
    request.onblocked = () => reject(new Error('Kho bản nháp đang bị chặn bởi tab khác.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new DOMException('Draft transaction aborted.', 'AbortError'));
  });
}

function validLease(value: unknown): value is DraftLeaseRecord {
  return isRecord(value) && value.id === DRAFT_OWNER
    && typeof value.ownerSessionId === 'string' && value.ownerSessionId.length > 0
    && typeof value.leaseId === 'string' && value.leaseId.length > 0
    && Number.isSafeInteger(value.leaseExpiresAt) && (value.leaseExpiresAt as number) > 0;
}

export async function readDraftLease(): Promise<DraftLeaseRecord | null> {
  const db = await openDatabase();
  const transaction = db.transaction('meta', 'readonly');
  const done = transactionDone(transaction);
  let value: unknown;
  transaction.objectStore('meta').get(DRAFT_OWNER).onsuccess = (event) => {
    value = (event.target as IDBRequest).result;
  };
  try {
    await done;
    return validLease(value) ? value : null;
  } finally {
    db.close();
  }
}

export async function acquireDraftLease(
  ownerSessionId: string,
  confirmedLease?: DraftLeaseRecord | null,
): Promise<DraftLeaseClaim> {
  if (!ownerSessionId) throw new TypeError('Draft lease owner is required.');
  const db = await openDatabase();
  const transaction = db.transaction('meta', 'readwrite');
  const done = transactionDone(transaction);
  let result: DraftLeaseClaim = { kind: 'lost' };
  let acquired = false;
  transaction.objectStore('meta').get(DRAFT_OWNER).onsuccess = (event) => {
    const raw = (event.target as IDBRequest).result;
    const current = validLease(raw) ? raw : null;
    const now = Date.now();
    const active = current !== null && current.leaseExpiresAt > now;
    const expectedMatches = confirmedLease !== undefined
      && (current === null
        ? confirmedLease === null
        : confirmedLease !== null
          && current.ownerSessionId === confirmedLease.ownerSessionId
          && current.leaseId === confirmedLease.leaseId);

    if (active && current.ownerSessionId !== ownerSessionId && !expectedMatches) {
      result = { kind: 'held', lease: current };
      return;
    }
    if (!active && current?.ownerSessionId === ownerSessionId && !expectedMatches) {
      result = { kind: 'lost', lease: current };
      return;
    }

    const lease: DraftLeaseRecord = {
      id: DRAFT_OWNER,
      ownerSessionId,
      leaseId: active && current?.ownerSessionId === ownerSessionId && confirmedLease === undefined
        ? current.leaseId
        : createUuid(),
      leaseExpiresAt: now + DRAFT_LEASE_DURATION_MS,
    };
    transaction.objectStore('meta').put(lease);
    acquired = true;
    result = { kind: 'acquired', lease };
  };
  try {
    await done;
    if (acquired) {
      if (retainedLeaseDatabase && retainedLeaseDatabase !== db) retainedLeaseDatabase.close();
      retainedLeaseDatabase = db;
    } else {
      db.close();
    }
    return result;
  } catch (error) {
    db.close();
    throw error;
  }
}

export async function renewDraftLease(ownerSessionId: string, leaseId: string): Promise<DraftLeaseRecord | null> {
  const db = await openDatabase();
  const transaction = db.transaction('meta', 'readwrite');
  const done = transactionDone(transaction);
  let renewed: DraftLeaseRecord | null = null;
  transaction.objectStore('meta').get(DRAFT_OWNER).onsuccess = (event) => {
    const raw = (event.target as IDBRequest).result;
    if (!validLease(raw) || raw.ownerSessionId !== ownerSessionId || raw.leaseId !== leaseId || raw.leaseExpiresAt <= Date.now()) return;
    renewed = { ...raw, leaseExpiresAt: Date.now() + DRAFT_LEASE_DURATION_MS };
    transaction.objectStore('meta').put(renewed);
  };
  try {
    await done;
    return renewed;
  } finally {
    db.close();
  }
}

export async function releaseDraftLease(ownerSessionId: string, leaseId: string): Promise<void> {
  const retained = retainedLeaseDatabase;
  const db = retained ?? await openDatabase();
  const transaction = db.transaction('meta', 'readwrite');
  const done = transactionDone(transaction);
  const meta = transaction.objectStore('meta');
  let released = false;
  meta.get(DRAFT_OWNER).onsuccess = (event) => {
    const raw = (event.target as IDBRequest).result;
    if (validLease(raw) && raw.ownerSessionId === ownerSessionId && raw.leaseId === leaseId) {
      released = true;
      meta.delete(DRAFT_OWNER);
    }
  };
  try {
    await done;
  } finally {
    if (!retained || released) {
      if (retainedLeaseDatabase === db) retainedLeaseDatabase = null;
      db.close();
    }
  }
}

function validateDraft(candidate: ImageImportCandidate, snapshot: EditorSnapshot, revision: number): ImageFileMetadata['mimeType'] {
  const mimeType = candidate.mimeType ?? candidate.source.type;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new TypeError('Định dạng ảnh nguồn không hợp lệ.');
  if (candidate.source.size < 1 || candidate.source.size > MAX_IMPORT_FILE_BYTES
    || !Number.isSafeInteger(candidate.width) || !Number.isSafeInteger(candidate.height)
    || candidate.width < 1 || candidate.height < 1 || candidate.width > MAX_IMAGE_EDGE || candidate.height > MAX_IMAGE_EDGE
    || candidate.width * candidate.height > MAX_IMAGE_PIXELS) {
    throw new RangeError('Ảnh nguồn vượt quá giới hạn lưu bản nháp.');
  }
  if (snapshot.document.sourceAssetId !== candidate.assetId
    || !Number.isSafeInteger(revision) || revision < 0) {
    throw new TypeError('Bản nháp không khớp với ảnh hoặc revision hiện tại.');
  }
  validateEditorSnapshot(snapshot, { id: candidate.assetId, width: candidate.width, height: candidate.height });
  if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > MAX_SNAPSHOT_BYTES) {
    throw new RangeError('Snapshot vượt quá giới hạn lưu bản nháp.');
  }
  return mimeType as ImageFileMetadata['mimeType'];
}

async function writeCurrentDraft(
  ownerSessionId: string,
  leaseId: string,
  candidate: ImageImportCandidate,
  snapshot: EditorSnapshot,
  revision: number,
  abortForManualCheck: boolean,
): Promise<void> {
  const mimeType = validateDraft(candidate, snapshot, revision);
  const thumbnail = await renderDraftThumbnail(candidate, snapshot);
  if (thumbnail.size > DRAFT_THUMBNAIL_MAX_BYTES) throw new RangeError('Thumbnail vượt quá giới hạn lưu trữ.');
  const asset: AssetRecord = {
    id: candidate.assetId,
    blob: candidate.source,
    mimeType,
    byteSize: candidate.source.size,
    width: candidate.width,
    height: candidate.height,
    originalFileName: candidate.source.name,
    importedAt: candidate.importedAt ?? Date.now(),
  };
  const draft: CurrentDraftRecord = {
    id: CURRENT_DRAFT,
    assetId: candidate.assetId,
    snapshot,
    thumbnail,
    revision,
    updatedAt: Date.now(),
    schemaVersion: snapshot.schemaVersion,
    presetVersion: snapshot.imageAppearance.presetVersion,
    appVersion: __APP_VERSION__,
    rendererVersion: __RENDERER_VERSION__,
  };

  const db = await openDatabase();
  const transaction = db.transaction(['assets', 'drafts', 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  const assets = transaction.objectStore('assets');
  const drafts = transaction.objectStore('drafts');
  let leaseError = false;
  transaction.objectStore('meta').get(DRAFT_OWNER).onsuccess = (event) => {
    const lease = (event.target as IDBRequest).result;
    if (!validLease(lease) || lease.ownerSessionId !== ownerSessionId || lease.leaseId !== leaseId || lease.leaseExpiresAt <= Date.now()) {
      leaseError = true;
      transaction.abort();
      return;
    }
    drafts.get(CURRENT_DRAFT).onsuccess = (draftEvent) => {
      const previous = (draftEvent.target as IDBRequest).result as CurrentDraftRecord | undefined;
      if (!previous || previous.assetId !== candidate.assetId) assets.put(asset);
      drafts.put(draft);
      if (previous && previous.assetId !== candidate.assetId) assets.delete(previous.assetId);
      if (abortForManualCheck || (import.meta.env.DEV && abortNextSaveForManualCheck)) {
        abortNextSaveForManualCheck = false;
        transaction.abort();
      }
    };
  };

  try {
    await done;
  } catch (error) {
    if (leaseError) throw new DraftLeaseError();
    throw error;
  } finally {
    db.close();
  }
}

export async function saveCurrentDraft(
  ownerSessionId: string,
  leaseId: string,
  candidate: ImageImportCandidate,
  snapshot: EditorSnapshot,
  revision: number,
): Promise<void> {
  return writeCurrentDraft(ownerSessionId, leaseId, candidate, snapshot, revision, false);
}

export async function readCurrentDraft(): Promise<SavedCurrentDraft | null> {
  const db = await openDatabase();
  const transaction = db.transaction(['assets', 'drafts'], 'readonly');
  const done = transactionDone(transaction);
  let result: SavedCurrentDraft | null = null;
  let loadError: Error | undefined;
  const draftRequest = transaction.objectStore('drafts').get(CURRENT_DRAFT);
  draftRequest.onsuccess = () => {
    const draft = draftRequest.result as CurrentDraftRecord | undefined;
    if (!draft) return;
    const assetRequest = transaction.objectStore('assets').get(draft.assetId);
    assetRequest.onsuccess = () => {
      const asset = assetRequest.result as AssetRecord | undefined;
      if (!asset) loadError = new Error('Saved draft source asset is missing.');
      else result = { asset, draft };
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

export async function inspectCurrentDraft(): Promise<CurrentDraftInspection> {
  const db = await openDatabase();
  const transaction = db.transaction(['assets', 'drafts'], 'readonly');
  const done = transactionDone(transaction);
  let rawDraft: unknown;
  let rawAsset: unknown;
  let assetId: string | undefined;
  const draftRequest = transaction.objectStore('drafts').get(CURRENT_DRAFT);
  draftRequest.onsuccess = () => {
    rawDraft = draftRequest.result;
    if (!isRecord(rawDraft)) return;
    if (typeof rawDraft.assetId === 'string' && rawDraft.assetId.length > 0) {
      assetId = rawDraft.assetId;
      const assetRequest = transaction.objectStore('assets').get(assetId);
      assetRequest.onsuccess = () => { rawAsset = assetRequest.result; };
    }
  };

  try {
    await done;
    if (rawDraft === undefined) return { kind: 'none' };
    if (!isRecord(rawDraft) || typeof rawDraft.assetId !== 'string' || !rawDraft.assetId) {
      return { kind: 'unrecoverable', reason: 'Bản nháp bị hỏng và không xác định được ảnh nguồn.' };
    }
    if (!rawAsset) return { kind: 'unrecoverable', assetId, reason: 'Không tìm thấy ảnh nguồn của bản nháp.' };
    if (!validAsset(rawAsset, rawDraft.assetId)) {
      return { kind: 'unrecoverable', assetId, reason: 'Dữ liệu ảnh nguồn của bản nháp không hợp lệ.' };
    }
    if (!validDraftMetadata(rawDraft, rawDraft.assetId)) {
      return { kind: 'source-only', saved: { asset: rawAsset, draft: rawDraft as unknown as CurrentDraftRecord }, reason: 'Thông tin bản nháp không hợp lệ; có thể mở ảnh nguồn mà không khôi phục các chỉnh sửa.' };
    }

    const saved = { asset: rawAsset, draft: rawDraft };
    try {
      if (saved.draft.schemaVersion !== 2 || saved.draft.presetVersion !== CURRENT_PRESET_VERSION) {
        throw new TypeError('Phiên bản bản nháp chưa được hỗ trợ.');
      }
      validateEditorSnapshot(saved.draft.snapshot, saved.asset);
      return { kind: 'ready', saved };
    } catch (error) {
      return {
        kind: 'source-only',
        saved,
        reason: error instanceof Error ? error.message : 'Snapshot không thể khôi phục.',
      };
    }
  } finally {
    db.close();
  }
}

export async function deleteCurrentDraft(ownerSessionId: string, leaseId: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(['assets', 'drafts', 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  let leaseError = false;
  const drafts = transaction.objectStore('drafts');
  transaction.objectStore('meta').get(DRAFT_OWNER).onsuccess = (event) => {
    const lease = (event.target as IDBRequest).result;
    if (!validLease(lease) || lease.ownerSessionId !== ownerSessionId || lease.leaseId !== leaseId || lease.leaseExpiresAt <= Date.now()) {
      leaseError = true;
      transaction.abort();
      return;
    }
    drafts.get(CURRENT_DRAFT).onsuccess = (draftEvent) => {
      const previous = (draftEvent.target as IDBRequest).result as { assetId?: unknown } | undefined;
      drafts.delete(CURRENT_DRAFT);
      if (typeof previous?.assetId === 'string' && previous.assetId) {
        transaction.objectStore('assets').delete(previous.assetId);
      }
    };
  };
  try {
    await done;
  } catch (error) {
    if (leaseError) throw new DraftLeaseError();
    throw error;
  } finally {
    db.close();
  }
}

export function armNextDraftSaveAbortForManualCheck(): void {
  if (!import.meta.env.DEV) throw new Error('Save failure injection is available only in development.');
  abortNextSaveForManualCheck = true;
}

// Manual harness uses a real IndexedDB abort to check rollback and the editor's save-error path.
export async function abortDraftSaveForManualCheck(
  ownerSessionId: string,
  leaseId: string,
  candidate: ImageImportCandidate,
  snapshot: EditorSnapshot,
  revision: number,
): Promise<void> {
  return writeCurrentDraft(ownerSessionId, leaseId, candidate, snapshot, revision, true);
}
