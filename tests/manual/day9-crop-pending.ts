import { commitHistory, createHistory, currentSnapshot } from '../../src/features/editor/engine/history';
import { createImageBaselineSnapshot } from '../../src/features/editor/engine/snapshot';
import {
  createCropRect,
  resizeCropRect,
  validateCropRect,
  type CropRect,
} from '../../src/features/editor/engine/crop';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLElement>('#results')!;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function same(actual: CropRect, expected: CropRect): boolean {
  return actual.x === expected.x && actual.y === expected.y
    && actual.width === expected.width && actual.height === expected.height;
}

function run(): string[] {
  const lines: string[] = [];
  const record = (message: string) => lines.push(`PASS ${message}`);
  const bounds = { width: 160, height: 120 };
  const free = createCropRect(bounds, 'free');
  assert(free && same(free, { x: 0, y: 0, width: 160, height: 120 }), 'Free crop must start at the full document.');
  const square = createCropRect(bounds, '1:1');
  assert(square && same(square, { x: 20, y: 0, width: 120, height: 120 }), 'Square crop must be the largest centered integer ratio.');
  const landscape = createCropRect(bounds, '16:9');
  assert(landscape && same(landscape, { x: 0, y: 15, width: 160, height: 90 }), '16:9 crop must fit and center on whole ratio units.');
  const portrait = createCropRect(bounds, '3:4');
  assert(portrait && same(portrait, { x: 35, y: 0, width: 90, height: 120 }), '3:4 crop must fit and center on whole ratio units.');
  const vertical = createCropRect(bounds, '9:16');
  assert(vertical && same(vertical, { x: 48, y: 4, width: 63, height: 112 }), '9:16 crop must fit and center on whole ratio units.');
  const standard = createCropRect(bounds, '4:3');
  assert(standard && same(standard, { x: 0, y: 0, width: 160, height: 120 }), '4:3 crop must fit the full matching document.');
  assert(createCropRect({ width: 3, height: 1 }, '3:4') === null, 'An impossible ratio must be unavailable.');
  record('Free/full document, centered fixed ratios, and impossible-ratio detection');

  const movable = { x: 20, y: 10, width: 80, height: 60 };
  assert(same(resizeCropRect(movable, 'move', { x: 50, y: 40 }, { x: 500, y: 500 }, bounds, 'free'),
    { x: 80, y: 60, width: 80, height: 60 }), 'Moving must clamp the crop inside document bounds.');
  assert(same(resizeCropRect(movable, 'w', { x: 20, y: 40 }, { x: 500, y: 40 }, bounds, 'free'),
    { x: 99, y: 10, width: 1, height: 60 }), 'Free resize must retain at least one pixel.');
  assert(same(resizeCropRect(landscape, 'se', { x: 160, y: 105 }, { x: 40, y: 50 }, bounds, '16:9'),
    { x: 0, y: 15, width: 48, height: 27 }), 'Fixed-ratio resize must use whole units and preserve the opposite corner.');
  record('Free move/resize bounds and fixed-ratio corner resize');

  assert(validateCropRect({ x: 0, y: 0, width: 1.5, height: 1 }, bounds, 'free') === 'invalid-number',
    'Fractional crop values must be rejected.');
  assert(validateCropRect({ x: 159, y: 0, width: 2, height: 1 }, bounds, 'free') === 'outside-bounds',
    'An out-of-bounds crop must be rejected.');
  assert(validateCropRect({ x: 0, y: 0, width: 100, height: 60 }, bounds, '16:9') === 'invalid-ratio',
    'A fixed ratio mismatch must be rejected.');
  record('Numeric crop validation rejects fractional, out-of-bounds, and ratio-mismatched values');

  const snapshot = createImageBaselineSnapshot('crop-pending-asset', bounds.width, bounds.height);
  const history = createHistory(snapshot);
  const pending = resizeCropRect(square!, 'move', { x: 80, y: 60 }, { x: 100, y: 80 }, bounds, '1:1');
  assert(pending.x === 40 && pending.y === 0, 'The pending crop fixture did not change.');
  assert(JSON.stringify(currentSnapshot(history)) === JSON.stringify(snapshot) && history.revision === 0,
    'Editing a pending crop must not mutate snapshot or history.');
  assert(commitHistory(history, currentSnapshot(history)) === history,
    'Discarding a pending crop must leave history unchanged.');
  record('A pending/discarded crop stays outside the editor snapshot and history');
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
