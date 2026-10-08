import { calculateResize } from '../../src/features/editor/engine/resize';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLElement>('#results')!;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectInvalid(value: string, error: string, message: string): void {
  const result = calculateResize({ width: 1600, height: 1200 }, 'width', value);
  assert(!result.valid && result.error === error, message);
}

function runAssertions(): string[] {
  const lines: string[] = [];
  const widthChange = calculateResize({ width: 1600, height: 1200 }, 'width', '800');
  assert(widthChange.valid && widthChange.dimensions.width === 800 && widthChange.dimensions.height === 600,
    'Changing width did not preserve the original ratio.');
  const heightChange = calculateResize({ width: 1600, height: 1200 }, 'height', '900');
  assert(heightChange.valid && heightChange.dimensions.width === 1200 && heightChange.dimensions.height === 900,
    'Changing height did not preserve the original ratio.');
  const rounded = calculateResize({ width: 16, height: 9 }, 'width', '5');
  assert(rounded.valid && rounded.dimensions.height === 3, 'Derived edge was not rounded to the nearest integer.');
  lines.push('PASS width/height edits preserve the session ratio and round the derived edge');

  expectInvalid('', 'required', 'An empty field must be rejected.');
  expectInvalid('NaN', 'integer', 'NaN must be rejected.');
  expectInvalid('Infinity', 'integer', 'Infinity must be rejected.');
  expectInvalid('3.5', 'integer', 'A decimal must be rejected.');
  expectInvalid('-1', 'positive', 'A negative edge must be rejected.');
  expectInvalid('0', 'positive', 'A zero edge must be rejected.');
  lines.push('PASS blank, NaN, infinity, decimal, negative, and zero inputs are rejected');

  const edgeBoundary = calculateResize({ width: 8192, height: 1 }, 'width', '8192');
  assert(edgeBoundary.valid, 'The 8192 px edge boundary should be accepted when the pixel cap is met.');
  expectInvalid('8193', 'edge-limit', 'An edge above 8192 px must be rejected.');
  const derivedEdge = calculateResize({ width: 1, height: 8192 }, 'width', '8192');
  assert(!derivedEdge.valid && derivedEdge.error === 'edge-limit', 'A derived edge above 8192 px must be rejected.');
  const pixelBoundary = calculateResize({ width: 4000, height: 3000 }, 'width', '4000');
  assert(pixelBoundary.valid, 'The exact 12 MP boundary should be accepted.');
  const abovePixelBoundary = calculateResize({ width: 4000, height: 3000 }, 'width', '4001');
  assert(!abovePixelBoundary.valid && abovePixelBoundary.error === 'pixel-limit', 'A size above 12 MP must be rejected.');
  lines.push('PASS edge and 12 MP limits accept exact boundaries and reject overflow');

  const upscale = calculateResize({ width: 100, height: 50 }, 'width', '200');
  const downscale = calculateResize({ width: 100, height: 50 }, 'width', '50');
  assert(upscale.valid && upscale.scale > 1, 'Upscale scale was not reported.');
  assert(downscale.valid && downscale.scale < 1, 'Downscale scale was not reported.');
  assert(!calculateResize({ width: 0, height: 50 }, 'width', '100').valid, 'An invalid base document must be rejected.');
  lines.push('PASS scale direction and invalid source dimensions are reported');
  return lines;
}

runButton.addEventListener('click', () => {
  runButton.disabled = true;
  results.textContent = 'Đang chạy…';
  try {
    results.textContent = runAssertions().join('\n');
  } catch (error) {
    results.textContent = `FAIL ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    runButton.disabled = false;
  }
});
