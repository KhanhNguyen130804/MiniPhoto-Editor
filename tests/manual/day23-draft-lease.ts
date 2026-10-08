import { FabricImage } from 'fabric';
import {
  acquireDraftLease,
  deleteCurrentDraft,
  DraftLeaseError,
  DRAFT_DATABASE_NAME,
  inspectCurrentDraft,
  readCurrentDraft,
  readDraftLease,
  releaseDraftLease,
  renewDraftLease,
  saveCurrentDraft,
} from '../../src/features/editor/engine/draftStore';
import { decodeWithFabricUrl } from '../../src/features/editor/engine/imageImport';
import type { ImageImportCandidate } from '../../src/features/editor/engine/imageImport';
import { createImageBaselineSnapshot } from '../../src/features/editor/engine/snapshot';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const seedUiButton = document.querySelector<HTMLButtonElement>('#seed-ui')!;
const inspectButton = document.querySelector<HTMLButtonElement>('#inspect')!;
const results = document.querySelector<HTMLElement>('#results')!;
const SIZE = { width: 64, height: 48 };
const SESSION_A = crypto.randomUUID();
const SESSION_B = crypto.randomUUID();
const SESSION_RECOVERY = crypto.randomUUID();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function createCandidate(assetId: string, name: string, sourceBytes: number[]): ImageImportCandidate {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE.width;
  canvas.height = SIZE.height;
  const context = canvas.getContext('2d');
  assert(context, 'Canvas 2D context is unavailable.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, SIZE.width, SIZE.height);
  context.fillStyle = '#2563eb';
  context.fillRect(8, 8, 36, 26);
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

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DATABASE_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the draft database.'));
  });
}

async function expireLease(): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction('meta', 'readwrite');
  const done = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Lease expiry transaction aborted.'));
  });
  const store = transaction.objectStore('meta');
  const request = store.get('draft-owner');
  request.onsuccess = () => {
    const lease = request.result as { id: string; ownerSessionId: string; leaseId: string; leaseExpiresAt: number } | undefined;
    assert(lease, 'An active lease is required to simulate a crashed tab.');
    store.put({ ...lease, leaseExpiresAt: Date.now() - 1 });
  };
  try { await done; } finally { db.close(); }
}

async function expectLeaseError(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
    throw new Error('Expected the write to be rejected without the current lease.');
  } catch (error) {
    assert(error instanceof DraftLeaseError, 'A stale or non-owner write must fail with DraftLeaseError.');
  }
}

async function runAssertions(): Promise<string[]> {
  assert(window.location.hostname === '127.0.0.1' && window.location.port === '5177', 'Run this harness at http://127.0.0.1:5177 only.');
  const first = createCandidate('day23-asset-first', 'first.png', [1, 2, 3, 4]);
  const second = createCandidate('day23-asset-second', 'second.png', [5, 6, 7, 8]);
  let activeOwner = '';
  let activeLeaseId = '';
  const passed: string[] = [];
  try {
    const observed = await readDraftLease();
    const claims = await Promise.all([
      acquireDraftLease(SESSION_A, observed),
      acquireDraftLease(SESSION_B, observed),
    ]);
    const acquired = claims.filter((claim) => claim.kind === 'acquired');
    const held = claims.filter((claim) => claim.kind === 'held');
    assert(acquired.length === 1 && held.length === 1, 'Two simultaneous tabs must produce exactly one lease owner.');
    const ownerClaim = acquired[0]!;
    activeOwner = ownerClaim.lease.ownerSessionId;
    activeLeaseId = ownerClaim.lease.leaseId;
    const otherSession = activeOwner === SESSION_A ? SESSION_B : SESSION_A;
    passed.push('Atomic simultaneous claim permits one writer and reports the competing tab as held');

    const firstSnapshot = createImageBaselineSnapshot(first.assetId, first.width, first.height);
    await saveCurrentDraft(activeOwner, activeLeaseId, first, firstSnapshot, 1);
    const original = await readCurrentDraft();
    assert(original?.asset.id === first.assetId && original.draft.revision === 1, 'The lease owner must be able to persist its source and snapshot.');
    const beforeHeartbeat = await readDraftLease();
    assert(beforeHeartbeat, 'The successful writer must retain its lease.');
    await new Promise((resolve) => window.setTimeout(resolve, 2));
    const heartbeat = await renewDraftLease(activeOwner, activeLeaseId);
    assert(heartbeat && heartbeat.leaseExpiresAt > beforeHeartbeat.leaseExpiresAt, 'The owner heartbeat must extend the lease.');
    assert(await renewDraftLease(otherSession, activeLeaseId) === null, 'A non-owner must not renew the lease.');
    await releaseDraftLease(otherSession, activeLeaseId);
    assert((await readDraftLease())?.ownerSessionId === activeOwner, 'A non-owner release must not clear another tab’s lease.');
    await expectLeaseError(() => saveCurrentDraft(otherSession, activeLeaseId, second, createImageBaselineSnapshot(second.assetId, second.width, second.height), 2));
    await expectLeaseError(() => deleteCurrentDraft(otherSession, activeLeaseId));
    const unchanged = await readCurrentDraft();
    assert(unchanged?.asset.id === first.assetId && unchanged.draft.revision === 1, 'Rejected writes and deletes must preserve the saved draft.');
    passed.push('Heartbeat renewal, wrong-owner renew/release/save/delete rejection, and data preservation');

    const confirmed = await readDraftLease();
    assert(confirmed, 'The old owner lease must remain available for explicit takeover.');
    const takeover = await acquireDraftLease(otherSession, confirmed);
    assert(takeover.kind === 'acquired' && takeover.lease.ownerSessionId === otherSession, 'An exact user-confirmed lease may be taken over.');
    activeOwner = otherSession;
    activeLeaseId = takeover.lease.leaseId;
    assert(activeLeaseId !== ownerClaim.lease.leaseId, 'A takeover must create a new fencing token.');
    const staleTakeover = await acquireDraftLease(ownerClaim.lease.ownerSessionId, confirmed);
    assert(staleTakeover.kind === 'held', 'A confirmation captured before another tab took over must not replace the new owner.');
    await saveCurrentDraft(activeOwner, activeLeaseId, second, createImageBaselineSnapshot(second.assetId, second.width, second.height), 2);
    await expectLeaseError(() => saveCurrentDraft(ownerClaim.lease.ownerSessionId, ownerClaim.lease.leaseId, first, firstSnapshot, 3));
    await expectLeaseError(() => deleteCurrentDraft(ownerClaim.lease.ownerSessionId, ownerClaim.lease.leaseId));
    const replaced = await readCurrentDraft();
    assert(replaced?.asset.id === second.assetId && replaced.draft.revision === 2, 'The takeover snapshot must replace the old one; the stale tab cannot overwrite or delete it.');
    passed.push('Confirmed takeover replaces the draft and blocks writes from the former owner');

    await expireLease();
    const recovered = await acquireDraftLease(SESSION_RECOVERY);
    assert(recovered.kind === 'acquired' && recovered.lease.ownerSessionId === SESSION_RECOVERY, 'A fresh tab must recover an expired lease after a crash.');
    activeOwner = SESSION_RECOVERY;
    activeLeaseId = recovered.lease.leaseId;
    await expectLeaseError(() => saveCurrentDraft(otherSession, takeover.lease.leaseId, second, createImageBaselineSnapshot(second.assetId, second.width, second.height), 4));
    await expireLease();
    const sameSessionRetry = await acquireDraftLease(SESSION_RECOVERY);
    assert(sameSessionRetry.kind === 'lost', 'A tab that lost its expired lease must not silently reacquire it.');
    const freshSessionRetry = await acquireDraftLease(SESSION_A);
    assert(freshSessionRetry.kind === 'acquired' && freshSessionRetry.lease.ownerSessionId === SESSION_A, 'A different tab may claim the expired lease.');
    activeOwner = SESSION_A;
    activeLeaseId = freshSessionRetry.lease.leaseId;
    await saveCurrentDraft(activeOwner, activeLeaseId, second, createImageBaselineSnapshot(second.assetId, second.width, second.height), 2);
    await expireLease();
    const observedExpiredLease = await readDraftLease();
    assert(observedExpiredLease, 'The same-session fencing test needs to observe its expired lease.');
    const sameSessionTakeover = await acquireDraftLease(SESSION_A, observedExpiredLease);
    assert(sameSessionTakeover.kind === 'acquired' && sameSessionTakeover.lease.leaseId !== activeLeaseId, 'Explicitly reclaiming an expired lease in the same tab must rotate its fencing token.');
    activeLeaseId = sameSessionTakeover.lease.leaseId;
    await expectLeaseError(() => saveCurrentDraft(SESSION_A, freshSessionRetry.lease.leaseId, first, firstSnapshot, 3));
    const afterSameSessionStaleWrite = await readCurrentDraft();
    assert(afterSameSessionStaleWrite?.asset.id === second.assetId && afterSameSessionStaleWrite.draft.revision === 2, 'An async save from the same tab’s earlier lease must not replace the reclaimed draft.');
    passed.push('Expired recovery, no silent reacquisition, and fencing of stale writes after same-tab re-claim');

    await deleteCurrentDraft(activeOwner, activeLeaseId);
    assert(await readCurrentDraft() === null, 'The test draft must be removed from the isolated harness origin.');
    return passed;
  } finally {
    await deleteCurrentDraft(activeOwner, activeLeaseId).catch(() => undefined);
    await releaseDraftLease(activeOwner, activeLeaseId).catch(() => undefined);
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

seedUiButton.addEventListener('click', async () => {
  seedUiButton.disabled = true;
  let candidate: ImageImportCandidate | undefined;
  let claimLeaseId = '';
  const sessionId = crypto.randomUUID();
  try {
    const claim = await acquireDraftLease(sessionId, await readDraftLease());
    assert(claim.kind === 'acquired', 'Close other tabs using this isolated draft database before seeding.');
    claimLeaseId = claim.lease.leaseId;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE.width;
    canvas.height = SIZE.height;
    const context = canvas.getContext('2d');
    assert(context, 'Canvas 2D context is unavailable.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, SIZE.width, SIZE.height);
    context.fillStyle = '#2563eb';
    context.fillRect(8, 8, 36, 26);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG encode failed.')), 'image/png'));
    canvas.width = 0;
    canvas.height = 0;
    candidate = await decodeWithFabricUrl(new File([blob], 'day23-ui-smoke.png', { type: 'image/png' }));
    const snapshot = createImageBaselineSnapshot(candidate.assetId, candidate.width, candidate.height);
    await saveCurrentDraft(sessionId, claimLeaseId, candidate, snapshot, 0);
    results.textContent = 'Đã tạo draft PNG hợp lệ. Mở ứng dụng ở hai tab tại http://127.0.0.1:5177/ để kiểm tra quyền lưu.';
  } catch (error) {
    results.textContent = `Không tạo được draft UI: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    if (candidate) candidate.dispose();
    if (claimLeaseId) await releaseDraftLease(sessionId, claimLeaseId).catch(() => undefined);
    seedUiButton.disabled = false;
  }
});

inspectButton.addEventListener('click', async () => {
  try {
    const draft = await inspectCurrentDraft();
    const draftStatus = draft.kind === 'ready'
      ? `Bản nháp đang lưu: ${draft.saved.draft.snapshot.document.width} × ${draft.saved.draft.snapshot.document.height} px, revision ${draft.saved.draft.revision}.`
      : `Trạng thái bản nháp: ${draft.kind}.`;
    const lease = await readDraftLease();
    const leaseStatus = lease
      ? lease.leaseExpiresAt > Date.now() ? 'Lease đang được giữ.' : 'Lease đã hết hạn.'
      : 'Không có lease đang được giữ.';
    results.textContent = `${draftStatus}\n${leaseStatus}`;
  } catch (error) {
    results.textContent = `Không đọc được draft: ${error instanceof Error ? error.message : String(error)}`;
  }
});
