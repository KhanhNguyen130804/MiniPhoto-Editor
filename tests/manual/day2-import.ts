import {
  decodeWithFabricUrl,
  decodeWithImageBitmap,
  ImageImportError,
  MAX_IMAGE_EDGE,
  MAX_IMAGE_PIXELS,
  MAX_IMPORT_FILE_BYTES,
  validateImageFile,
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

function uint32BE(value: number): Uint8Array {
  return new Uint8Array([value >>> 24, value >>> 16, value >>> 8, value]);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  return new Uint8Array([
    ...uint32BE(data.length),
    ...new TextEncoder().encode(type),
    ...data,
    0, 0, 0, 0,
  ]);
}

function syntheticPng(width: number, height: number, animated = false): File {
  const ihdr = new Uint8Array(13);
  ihdr.set(uint32BE(width), 0);
  ihdr.set(uint32BE(height), 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const chunks = [pngChunk('IHDR', ihdr)];
  if (animated) chunks.push(pngChunk('acTL', new Uint8Array(8)));
  chunks.push(pngChunk('IEND', new Uint8Array()));
  const bytes = concatBytes([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ...chunks,
  ]);
  return new File([bytes.slice().buffer as ArrayBuffer], 'synthetic.png', { type: 'image/png' });
}

function webpChunk(type: string, data: Uint8Array): Uint8Array {
  const length = data.length;
  return new Uint8Array([
    ...new TextEncoder().encode(type),
    length, length >>> 8, length >>> 16, length >>> 24,
    ...data,
    ...(length % 2 ? [0] : []),
  ]);
}

function syntheticAnimatedWebp(): File {
  const extended = new Uint8Array(10);
  extended[0] = 0x02;
  extended.set([0, 0, 0], 4);
  extended.set([0, 0, 0], 7);
  const chunks = [webpChunk('VP8X', extended), webpChunk('ANMF', new Uint8Array())];
  const riffSize = 4 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = concatBytes([
    new TextEncoder().encode('RIFF'),
    new Uint8Array([riffSize, riffSize >>> 8, riffSize >>> 16, riffSize >>> 24]),
    new TextEncoder().encode('WEBP'),
    ...chunks,
  ]);
  return new File([bytes.slice().buffer as ArrayBuffer], 'synthetic.webp', { type: 'image/webp' });
}

async function expectImportCode(action: () => Promise<unknown>, code: ImageImportError['code'], label: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(error instanceof ImageImportError && error.code === code,
      `${label}: expected ${code}, got ${error instanceof ImageImportError ? error.code : String(error)}.`);
    return;
  }
  throw new Error(`${label}: expected ${code}.`);
}

async function verifyValidation(): Promise<string[]> {
  const lines: string[] = [];
  const jpeg = await fixture('jpeg-orientation-1.jpg');
  const png = await fixture('png-alpha.png');
  const webp = await fixture('webp-static.webp');
  const jpegMetadata = await validateImageFile(new File([await jpeg.arrayBuffer()], 'renamed.txt', { type: '' }));
  const pngMetadata = await validateImageFile(png);
  const webpMetadata = await validateImageFile(webp);
  assert(jpegMetadata.mimeType === 'image/jpeg' && pngMetadata.mimeType === 'image/png'
    && webpMetadata.mimeType === 'image/webp', 'Header detection failed for a supported format.');
  lines.push('PASS header detection: JPEG/PNG/static WebP; blank MIME and extension ignored');

  await expectImportCode(() => validateImageFile(new File([], 'empty.png')), 'EMPTY_FILE', 'Empty file');
  const oversized = {
    size: MAX_IMPORT_FILE_BYTES + 1,
    type: 'image/png',
    arrayBuffer: async () => new ArrayBuffer(0),
  } as File;
  await expectImportCode(() => validateImageFile(oversized), 'FILE_TOO_LARGE', 'Oversized file');
  const mismatchedMime = new File([await jpeg.arrayBuffer()], 'wrong-mime.png', { type: 'image/png' });
  await expectImportCode(() => validateImageFile(mismatchedMime), 'UNSUPPORTED_FORMAT', 'Mismatched MIME');
  await expectImportCode(() => validateImageFile(new File([new Uint8Array([1, 2, 3])], 'bad.png')),
    'UNSUPPORTED_FORMAT', 'Bad header');
  lines.push('PASS empty/oversize/mismatched MIME/bad header rejected');

  const atPixelLimit = await validateImageFile(syntheticPng(4000, 3000));
  const atEdgeLimit = await validateImageFile(syntheticPng(MAX_IMAGE_EDGE, 1));
  assert(atPixelLimit.width * atPixelLimit.height === MAX_IMAGE_PIXELS && atEdgeLimit.width === MAX_IMAGE_EDGE,
    'Inclusive image dimensions were rejected.');
  await expectImportCode(() => validateImageFile(syntheticPng(4001, 3000)), 'IMAGE_TOO_LARGE', 'Pixel limit');
  await expectImportCode(() => validateImageFile(syntheticPng(MAX_IMAGE_EDGE + 1, 1)), 'IMAGE_TOO_LARGE', 'Edge limit');
  lines.push('PASS dimensions: 12 MP and 8192 px accepted; larger inputs rejected');

  await expectImportCode(() => validateImageFile(syntheticPng(1, 1, true)), 'ANIMATED_IMAGE', 'APNG');
  await expectImportCode(() => validateImageFile(syntheticAnimatedWebp()), 'ANIMATED_IMAGE', 'Animated WebP');
  lines.push('PASS APNG and animated WebP rejected');
  return lines;
}

async function run(): Promise<void> {
  const decode = decoder.value === 'fabric' ? decodeWithFabricUrl : decodeWithImageBitmap;
  const lines = await verifyValidation();
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
