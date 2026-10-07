import {
  canRedo,
  canUndo,
  commitHistory,
  createHistory,
  currentSnapshot,
  MAX_HISTORY_BYTES,
  redoHistory,
  undoHistory,
} from '../../src/features/editor/engine/history';
import { createImageBaselineSnapshot, type EditorSnapshot } from '../../src/features/editor/engine/snapshot';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLElement>('#results')!;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectThrow(action: () => unknown, message: string): void {
  let threw = false;
  try {
    action();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

function run(): string[] {
  const lines: string[] = [];
  const record = (message: string) => lines.push(`PASS ${message}`);
  const baseline = createImageBaselineSnapshot('asset-a', 160, 120);
  let history = createHistory(baseline);
  assert(history.revision === 0 && !canUndo(history) && !canRedo(history), 'A new document must have one baseline.');
  assert(baseline.document.width === 160 && baseline.document.height === 120, 'Baseline dimensions are missing.');
  assert(baseline.imageAppearance.presetId === 'original' && baseline.imageAppearance.brightness === 0,
    'Baseline appearance is not neutral.');
  assert(baseline.scene.length === 1 && baseline.scene[0].assetId === 'asset-a'
    && baseline.scene[0].left === 0 && baseline.scene[0].scaleX === 1,
  'Baseline source image transform is incomplete.');
  assert(!('viewport' in baseline) && !('selection' in baseline) && !('source' in baseline),
    'Runtime or source file data leaked into the snapshot.');
  record('baseline captures the current document and source-image state as JSON');

  const edited: EditorSnapshot = {
    ...baseline,
    document: { ...baseline.document, width: 80 },
    imageAppearance: { ...baseline.imageAppearance, brightness: 12 },
    scene: baseline.scene.map((image) => ({ ...image, left: 7, scaleX: 0.5 })),
  };
  history = commitHistory(history, edited);
  assert(history.revision === 1 && canUndo(history), 'Commit must advance revision and enable undo.');
  assert(JSON.stringify(currentSnapshot(history)) === JSON.stringify(edited), 'Commit must retain the full snapshot.');
  const same = commitHistory(history, currentSnapshot(history));
  assert(same === history && same.revision === 1, 'No-op must not create a revision.');
  record('commit stores a full snapshot and an identical snapshot is a no-op');

  history = undoHistory(history);
  assert(history.revision === 2 && JSON.stringify(currentSnapshot(history)) === JSON.stringify(baseline),
    'Undo must restore the entire baseline and advance revision.');
  history = redoHistory(history);
  assert(history.revision === 3 && JSON.stringify(currentSnapshot(history)) === JSON.stringify(edited),
    'Redo must restore the entire committed snapshot and advance revision.');
  history = undoHistory(history);
  const branch: EditorSnapshot = { ...baseline, scene: baseline.scene.map((image) => ({ ...image, left: 24 })) };
  history = commitHistory(history, branch);
  assert(!canRedo(history) && currentSnapshot(history).scene[0].left === 24,
    'A new commit after undo must discard the redo branch.');
  record('undo/redo restore whole snapshots and a new commit drops the redo branch');

  let steps = createHistory({ value: 0 });
  for (let value = 1; value <= 51; value += 1) steps = commitHistory(steps, { value });
  for (let count = 0; count < 50; count += 1) steps = undoHistory(steps);
  assert(!canUndo(steps) && currentSnapshot(steps).value === 1,
    'History must retain no more than 50 undo steps.');
  record('the 50-step limit trims the oldest entry while keeping the current state');

  const payload = 'x'.repeat(1_000_000);
  let budget = createHistory({ value: 0, payload });
  for (let value = 1; value <= 11; value += 1) budget = commitHistory(budget, { value, payload });
  assert(budget.totalBytes <= MAX_HISTORY_BYTES && currentSnapshot(budget).value === 11,
    'History must remain within 10 MiB and preserve the current snapshot.');
  let budgetUndoCount = 0;
  while (canUndo(budget)) {
    budget = undoHistory(budget);
    budgetUndoCount += 1;
  }
  assert(budgetUndoCount === 9 && currentSnapshot(budget).value === 2,
    'The byte limit must discard oldest snapshots without losing the current one.');
  record('the 10 MiB UTF-8 JSON budget trims oldest snapshots and preserves current');

  const beforeInvalid = history;
  const invalid = { ...branch, invalid: 1n } as unknown as EditorSnapshot;
  expectThrow(() => commitHistory(history, invalid), 'A non-JSON snapshot must be rejected.');
  const invalidNumber = {
    ...branch,
    scene: branch.scene.map((image) => ({ ...image, left: Number.NaN })),
  };
  expectThrow(() => commitHistory(history, invalidNumber), 'A non-finite transform must be rejected.');
  const oversized = { payload: 'x'.repeat(MAX_HISTORY_BYTES) };
  expectThrow(() => commitHistory(history, oversized as unknown as EditorSnapshot),
    'An individually oversized snapshot must be rejected.');
  assert(history === beforeInvalid && history.revision === beforeInvalid.revision,
    'Rejected snapshots must not mutate history.');
  expectThrow(() => createImageBaselineSnapshot('asset-a', 0, 120), 'Invalid dimensions must be rejected.');
  expectThrow(() => createImageBaselineSnapshot('asset-a', 1.5, 120), 'Fractional dimensions must be rejected.');
  record('invalid and oversized snapshots are rejected before history changes');

  const replacement = createHistory(createImageBaselineSnapshot('asset-b', 48, 32));
  assert(replacement.revision === 0 && !canUndo(replacement)
    && currentSnapshot(replacement).document.sourceAssetId === 'asset-b',
  'A replacement image must begin a fresh baseline.');
  record('a new source image begins a separate baseline with no prior undo history');
  return lines;
}

runButton.addEventListener('click', () => {
  runButton.disabled = true;
  results.textContent = 'Đang chạy…';
  try {
    results.textContent = run().join('\n');
  } catch (error) {
    results.textContent = `FAIL ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    runButton.disabled = false;
  }
});
