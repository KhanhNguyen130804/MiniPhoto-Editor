import { createDefaultTextObject } from '../../src/features/editor/engine/text';
import { decodeWithFabricUrl } from '../../src/features/editor/engine/imageImport';
import { exportImage, probeExportFormat } from '../../src/features/editor/engine/exportImage';
import { createImageBaselineSnapshot, type EditorSnapshot } from '../../src/features/editor/engine/snapshot';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const results = document.querySelector<HTMLElement>('#results')!;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function fixture(name: string, type: string): Promise<File> {
  const response = await fetch(`/tests/fixtures/day2-import/${name}`);
  assert(response.ok, `Fixture request failed (${response.status}).`);
  return new File([await response.blob()], name, { type });
}

async function imagePixels(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    assert(context, 'Canvas 2D context is unavailable.');
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

async function expectFailure(action: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert(pattern.test(error instanceof Error ? error.message : String(error)), 'Failure message did not explain the export error.');
    return;
  }
  throw new Error('Expected export to fail.');
}

async function withToBlob<T>(replacement: typeof HTMLCanvasElement.prototype.toBlob, action: () => Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'toBlob');
  assert(original, 'Canvas toBlob descriptor is unavailable.');
  try {
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', { ...original, value: replacement });
    return await action();
  } finally {
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', original);
  }
}

async function run(): Promise<string[]> {
  const lines: string[] = [];
  const [pngSupported, jpegSupported, webpSupported] = await Promise.all(
    (['png', 'jpeg', 'webp'] as const).map(probeExportFormat),
  );
  assert(pngSupported && jpegSupported, 'Browser must support PNG and JPG encoders.');
  lines.push(`PASS encoder probe reports PNG/JPG and WebP=${webpSupported ? 'supported' : 'unsupported'}`);

  const candidate = await decodeWithFabricUrl(await fixture('png-alpha.png', 'image/png'));
  try {
    const baseline = createImageBaselineSnapshot(candidate.assetId, candidate.width, candidate.height);
    const before = JSON.stringify(baseline);
    const png = await exportImage(candidate, baseline, { format: 'png', quality: 90, backgroundColor: '#ffffff' });
    const pngPixels = await imagePixels(png);
    assert(png.type === 'image/png' && pngPixels.width === 3 && pngPixels.height === 1, 'PNG MIME or dimensions were wrong.');
    assert([0, 1, 2].every((x, index) => Math.abs(pngPixels.data[x * 4 + 3]! - [0, 128, 255][index]!) <= 2), 'PNG alpha was not preserved.');
    lines.push('PASS PNG MIME, exact dimensions, and transparent/semitransparent pixels');

    if (webpSupported) {
      const webp = await exportImage(candidate, baseline, { format: 'webp', quality: 90, backgroundColor: '#ffffff' });
      const webpPixels = await imagePixels(webp);
      assert(webp.type === 'image/webp' && webpPixels.width === 3 && webpPixels.height === 1, 'WebP MIME or dimensions were wrong.');
      assert([0, 1, 2].every((x, index) => Math.abs(webpPixels.data[x * 4 + 3]! - [0, 128, 255][index]!) <= 3), 'WebP alpha was not preserved.');
      lines.push('PASS WebP MIME, dimensions, and alpha');
    } else {
      lines.push('SKIP WebP pixel check because this browser has no WebP encoder');
    }

    const jpeg = await exportImage(candidate, baseline, { format: 'jpeg', quality: 100, backgroundColor: '#ff0000' });
    const jpegPixels = await imagePixels(jpeg);
    assert(jpeg.type === 'image/jpeg' && jpegPixels.width === 3 && jpegPixels.height === 1, 'JPG MIME or dimensions were wrong.');
    assert(jpegPixels.data[0]! > 220 && jpegPixels.data[1]! < 35 && jpegPixels.data[2]! < 35
      && jpegPixels.data[3] === 255, 'Transparent source pixel was not composited onto the selected JPG background.');
    lines.push('PASS JPG MIME, dimensions, opaque output, and selected matte');

    let seenQuality: number | undefined;
    const nativeToBlob = HTMLCanvasElement.prototype.toBlob;
    await withToBlob(function (this: HTMLCanvasElement, callback: BlobCallback, type?: string, quality?: number) {
      seenQuality = quality;
      return nativeToBlob.call(this, callback, type, quality);
    }, async () => {
      await exportImage(candidate, baseline, { format: 'jpeg', quality: 37, backgroundColor: '#ffffff' });
      if (webpSupported) await exportImage(candidate, baseline, { format: 'webp', quality: 61, backgroundColor: '#ffffff' });
    });
    assert(seenQuality === (webpSupported ? 0.61 : 0.37), `Lossy encoder quality was ${seenQuality}.`);
    lines.push('PASS quality is scaled from 1–100 for lossy encoders');
    for (const quality of [1, 100]) {
      const boundary = await exportImage(candidate, baseline, { format: 'jpeg', quality, backgroundColor: '#ffffff' });
      assert(boundary.type === 'image/jpeg', `JPG quality ${quality} did not encode.`);
    }
    await expectFailure(
      () => exportImage(candidate, baseline, { format: 'jpeg', quality: 0, backgroundColor: '#ffffff' }),
      /Chất lượng/i,
    );
    lines.push('PASS lossy quality boundaries 1 and 100; rejects values outside range');

    await withToBlob(function (callback) {
      callback(new Blob(['wrong format'], { type: 'image/png' }));
    }, async () => {
      assert(!(await probeExportFormat('webp')), 'WebP probe accepted a PNG response.');
      await expectFailure(
        () => exportImage(candidate, baseline, { format: 'webp', quality: 90, backgroundColor: '#ffffff' }),
        /MIME.*yêu cầu/i,
      );
    });
    lines.push('PASS wrong encoder MIME is rejected instead of mislabeled');

    await withToBlob(function (callback) { callback(null); }, () => expectFailure(
      () => exportImage(candidate, baseline, { format: 'png', quality: 90, backgroundColor: '#ffffff' }),
      /bộ nhớ|thử lại/i,
    ));
    assert(JSON.stringify(baseline) === before, 'Encode failure changed the document snapshot.');
    lines.push('PASS null encode reports memory/encode failure and leaves snapshot unchanged');

    const text = createDefaultTextObject(baseline, 'day24-font-check').overlay;
    const withText: EditorSnapshot = { ...baseline, scene: [...baseline.scene, text] };
    const fonts = document.fonts;
    const nativeLoad = fonts.load;
    fonts.load = (() => Promise.reject(new Error('blocked font'))) as typeof fonts.load;
    try {
      await expectFailure(
        () => exportImage(candidate, withText, { format: 'png', quality: 90, backgroundColor: '#ffffff' }),
        /font|chữ/i,
      );
    } finally {
      fonts.load = nativeLoad;
    }
    const retried = await exportImage(candidate, withText, { format: 'png', quality: 90, backgroundColor: '#ffffff' });
    assert(retried.type === 'image/png' && JSON.stringify(withText) !== before, 'Font retry did not produce the text export.');
    lines.push('PASS font failure retains snapshot and retry succeeds after font service recovers');
    assert(JSON.stringify(baseline) === before, 'Successful exports mutated the original snapshot.');

    const largeCandidate = await decodeWithFabricUrl(await fixture('webp-static.webp', 'image/webp'));
    try {
      const largeSnapshot = createImageBaselineSnapshot(largeCandidate.assetId, largeCandidate.width, largeCandidate.height);
      const largeWithText: EditorSnapshot = {
        ...largeSnapshot,
        scene: [...largeSnapshot.scene, createDefaultTextObject(largeSnapshot, 'day24-large-text').overlay],
      };
      const fullSize = await exportImage(largeCandidate, largeSnapshot, {
        format: 'png', quality: 90, backgroundColor: '#ffffff',
      });
      const withText = await exportImage(largeCandidate, largeWithText, {
        format: 'png', quality: 90, backgroundColor: '#ffffff',
      });
      const [fullSizePixels, textPixels] = await Promise.all([imagePixels(fullSize), imagePixels(withText)]);
      assert(fullSize.type === 'image/png' && fullSizePixels.width === largeCandidate.width
        && fullSizePixels.height === largeCandidate.height, 'Export did not use the full-resolution source dimensions.');
      const changedPixels = fullSizePixels.data.reduce((count, value, index) => count + Number(value !== textPixels.data[index]), 0);
      assert(changedPixels > 100, 'Full-resolution export omitted the text overlay.');
      lines.push(`PASS export uses source resolution ${largeCandidate.width}×${largeCandidate.height} and includes text overlay`);
    } finally {
      largeCandidate.dispose();
    }
    lines.push(`ENV ${navigator.userAgent} | viewport ${innerWidth}×${innerHeight} | DPR ${devicePixelRatio}`);
    return lines;
  } finally {
    candidate.dispose();
  }
}

runButton.addEventListener('click', async () => {
  runButton.disabled = true;
  results.textContent = 'Đang chạy…';
  try {
    results.textContent = (await run()).join('\n');
  } catch (error) {
    results.textContent = `FAIL ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    runButton.disabled = false;
  }
});
