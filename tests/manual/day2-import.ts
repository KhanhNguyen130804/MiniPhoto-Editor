import {
  decodeWithFabricUrl,
  decodeWithImageBitmap,
  type ImageImportCandidate,
} from '../../src/features/editor/engine/imageImport';

const button = document.querySelector<HTMLButtonElement>('#run')!;
const decoder = document.querySelector<HTMLSelectElement>('#decoder')!;
const results = document.querySelector<HTMLElement>('#results')!;
const fixtureBase = '/tests/fixtures/day2-import/';
const colors = {
  red: [220, 40, 40],
  green: [40, 210, 40],
  blue: [40, 50, 220],
  yellow: [230, 210, 30],
} as const;
const orientationCorners = [
  ['red', 'green', 'blue', 'yellow'],
  ['green', 'red', 'yellow', 'blue'],
  ['yellow', 'blue', 'green', 'red'],
  ['blue', 'yellow', 'red', 'green'],
  ['red', 'blue', 'green', 'yellow'],
  ['blue', 'red', 'yellow', 'green'],
  ['yellow', 'green', 'blue', 'red'],
  ['green', 'yellow', 'red', 'blue'],
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function fixture(name: string): Promise<File> {
  const response = await fetch(`${fixtureBase}${name}`);
  assert(response.ok, `Could not load fixture ${name} (${response.status}).`);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type });
}

function hash(bytes: ArrayBuffer): Promise<string> {
  return crypto.subtle.digest('SHA-256', bytes).then((digest) =>
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  );
}

function draw(candidate: ImageImportCandidate): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = candidate.width;
  canvas.height = candidate.height;
  const context = canvas.getContext('2d');
  assert(context, 'Canvas 2D context is unavailable.');
  context.drawImage(candidate.image.getElement(), 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function pixel(data: ImageData, x: number, y: number): readonly number[] {
  const i = (y * data.width + x) * 4;
  return [data.data[i], data.data[i + 1], data.data[i + 2], data.data[i + 3]];
}

function near(actual: readonly number[], expected: readonly number[], tolerance: number): boolean {
  return expected.every((value, index) => Math.abs(actual[index] - value) <= tolerance);
}

function verifyOrientation(candidate: ImageImportCandidate, orientation: number): void {
  const swapped = orientation >= 5;
  const width = swapped ? 48 : 64;
  const height = swapped ? 64 : 48;
  assert(candidate.width === width && candidate.height === height,
    `EXIF ${orientation}: got ${candidate.width}×${candidate.height}, expected ${width}×${height}.`);
  const data = draw(candidate);
  const points = [
    [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75],
  ] as const;
  const actualCorners = points.map(([x, y]) =>
    pixel(data, Math.floor(data.width * x), Math.floor(data.height * y)),
  );
  orientationCorners[orientation - 1].forEach((colorName, i) => {
    const actual = actualCorners[i];
    assert(near(actual, colors[colorName], 75),
      `EXIF ${orientation} quadrant ${i + 1}: unexpected pixel ${actual.join(',')}; all ${JSON.stringify(actualCorners)}.`);
  });
}

async function expectFailure(action: () => Promise<unknown>, label: string): Promise<void> {
  let rejected = false;
  try {
    await action();
  } catch {
    rejected = true;
  }
  assert(rejected, `${label} should reject.`);
}

async function run(): Promise<void> {
  const decode = decoder.value === 'fabric' ? decodeWithFabricUrl : decodeWithImageBitmap;
  const lines: string[] = [];
  const objectUrls = new Map<string, number>();
  const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')!;
  const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')!;
  const originalCreate = URL.createObjectURL.bind(URL);
  const originalRevoke = URL.revokeObjectURL.bind(URL);
  Object.defineProperty(URL, 'createObjectURL', {
    ...createDescriptor,
    value: (object: Blob | MediaSource) => {
      const url = originalCreate(object);
      objectUrls.set(url, 0);
      return url;
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    ...revokeDescriptor,
    value: (url: string) => {
      objectUrls.set(url, (objectUrls.get(url) ?? 0) + 1);
      originalRevoke(url);
    },
  });

  try {
    for (let orientation = 1; orientation <= 8; orientation++) {
      const file = await fixture(`jpeg-orientation-${orientation}.jpg`);
      const before = await hash(await file.arrayBuffer());
      const image = await decode(file);
      try {
        verifyOrientation(image, orientation);
        assert(before === await hash(await file.arrayBuffer()), `EXIF ${orientation}: source bytes changed.`);
      } finally {
        image.dispose();
        image.dispose();
      }
      lines.push(`PASS JPEG EXIF ${orientation}: orientation/dimensions, source unchanged, disposed`);
    }

    const pngFile = await fixture('png-alpha.png');
    const pngHash = await hash(await pngFile.arrayBuffer());
    const png = await decode(pngFile);
    try {
      assert(png.width === 3 && png.height === 1, `PNG dimensions were ${png.width}×${png.height}.`);
      const pngPixels = draw(png);
      const alpha = [0, 1, 2].map((x) => pixel(pngPixels, x, 0)[3]);
      assert(near(alpha, [0, 128, 255], 2), `PNG alpha was ${alpha.join(',')}.`);
      assert(pngHash === await hash(await pngFile.arrayBuffer()), 'PNG source bytes changed.');
    } finally {
      png.dispose();
    }
    lines.push('PASS PNG alpha: transparent/semitransparent/opaque, source unchanged');

    const webpFile = await fixture('webp-static.webp');
    const webpHash = await hash(await webpFile.arrayBuffer());
    const webp = await decode(webpFile);
    try {
      assert(webp.width > 0 && webp.height > 0, `Invalid WebP dimensions ${webp.width}×${webp.height}.`);
      const sample = pixel(draw(webp), Math.floor(webp.width / 2), Math.floor(webp.height / 2));
      assert(sample[3] > 0, 'WebP center pixel is transparent.');
      assert(webpHash === await hash(await webpFile.arrayBuffer()), 'WebP source bytes changed.');
    } finally {
      webp.dispose();
    }
    lines.push(`PASS static WebP: decoded ${webp.width}×${webp.height}, source unchanged`);

    const active = await decode(pngFile);
    try {
      const brokenFile = await fixture('corrupt.jpg');
      await expectFailure(() => decode(brokenFile), 'Corrupt JPEG decode');
      assert(pixel(draw(active), 1, 0)[3] === 128, 'Failed import changed the active candidate.');
    } finally {
      active.dispose();
    }
    lines.push('PASS corrupt JPEG rejects; prior candidate remains usable');

    if (decoder.value === 'fabric') {
      const controller = new AbortController();
      const pending = decode(await fixture('jpeg-orientation-1.jpg'), controller.signal);
      controller.abort();
      await expectFailure(() => pending, 'Aborted JPEG decode');
      lines.push('PASS Fabric URL decode aborts');
      assert(objectUrls.size === 13 && [...objectUrls.values()].every((count) => count === 1),
        `Expected 13 Blob URLs revoked exactly once; got ${objectUrls.size} URLs.`);
      lines.push(`PASS Blob URL cleanup: ${objectUrls.size} URLs revoked exactly once`);
    }

    results.textContent = lines.join('\n');
  } catch (error) {
    results.textContent = `${lines.join('\n')}\nFAIL ${error instanceof Error ? error.stack : String(error)}`;
    throw error;
  } finally {
    Object.defineProperty(URL, 'createObjectURL', createDescriptor);
    Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor);
  }
}

button.addEventListener('click', () => {
  button.disabled = true;
  results.textContent = 'Running…';
  void run().catch(() => undefined).finally(() => { button.disabled = false; });
});
