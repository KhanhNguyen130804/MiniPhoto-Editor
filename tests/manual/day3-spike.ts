import {
  createDay3Snapshot,
  cropDay3Document,
  DAY3_MAX_PROXY_EDGE,
  exportDay3Png,
  renderDay3Preview,
  resizeDay3Document,
  rotateDay3DocumentClockwise,
  transformDay3Point,
  type Day3Asset,
  type Day3Preview,
  type Day3Snapshot,
} from '../../src/features/editor/engine/day3Pipeline';
import { decodeWithFabricUrl } from '../../src/features/editor/engine/imageImport';
import {
  abortDay3ReplacementForManualCheck,
  clearDay3Draft,
  loadDay3Draft,
  saveDay3Draft,
} from '../../src/features/editor/engine/day3DraftStore';

const runButton = document.querySelector<HTMLButtonElement>('#run')!;
const restoreButton = document.querySelector<HTMLButtonElement>('#restore')!;
const rollbackButton = document.querySelector<HTMLButtonElement>('#rollback')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset')!;
const results = document.querySelector<HTMLElement>('#results')!;
const previewHost = document.querySelector<HTMLElement>('#preview')!;
const download = document.querySelector<HTMLAnchorElement>('#download')!;
const expectedHashKey = 'day3-spike-source-hash';
const expectedSnapshotKey = 'day3-spike-snapshot';
const sourceWidth = 3072;
const sourceHeight = 1536;
const expectedDocumentSize = { width: 1920, height: 3456 };
let activePreview: Day3Preview | undefined;
let downloadUrl: string | undefined;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function record(lines: string[], message: string): void {
  lines.push(`PASS ${message}`);
  results.textContent = lines.join('\n');
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createSourceFile(): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext('2d');
  assert(context, 'Canvas 2D context is unavailable.');
  context.fillStyle = '#ef4444';
  context.fillRect(0, 0, sourceWidth / 2, sourceHeight / 2);
  context.fillStyle = '#22c55e';
  context.fillRect(sourceWidth / 2, 0, sourceWidth / 2, sourceHeight / 2);
  context.fillStyle = '#3b82f6';
  context.fillRect(0, sourceHeight / 2, sourceWidth / 2, sourceHeight / 2);
  context.fillStyle = '#facc15';
  context.fillRect(sourceWidth / 2, sourceHeight / 2, sourceWidth / 2, sourceHeight / 2);
  for (let x = 2200; x < 2456; x++) {
    context.fillStyle = x % 2 ? '#ffffff' : '#111827';
    context.fillRect(x, 900, 1, 256);
  }
  context.clearRect(450, 450, 200, 200);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not create the PNG source fixture.')), 'image/png');
  });
  canvas.width = 0;
  canvas.height = 0;
  return new File([blob], 'day3-source.png', { type: 'image/png' });
}

async function createAsset(): Promise<Day3Asset> {
  return {
    id: crypto.randomUUID(),
    blob: await createSourceFile(),
    mime: 'image/png',
    width: sourceWidth,
    height: sourceHeight,
  };
}

async function createWebpFixtureAsset(): Promise<Day3Asset> {
  const response = await fetch('/tests/fixtures/day2-import/webp-static.webp');
  assert(response.ok, `Could not load static WebP fixture (${response.status}).`);
  const blob = await response.blob();
  const decoded = await decodeWithFabricUrl(new File([blob], 'webp-static.webp', { type: 'image/webp' }));
  try {
    return {
      id: crypto.randomUUID(),
      blob,
      mime: 'image/webp',
      width: decoded.width,
      height: decoded.height,
    };
  } finally {
    decoded.dispose();
  }
}

function expectedSnapshot(assetId: string): Day3Snapshot {
  let snapshot = createDay3Snapshot(assetId, sourceWidth, sourceHeight);
  snapshot = cropDay3Document(snapshot, { x: 384, y: 128, width: 2304, height: 1280 });
  snapshot = resizeDay3Document(snapshot, 3456);
  return rotateDay3DocumentClockwise(snapshot);
}

async function showPreview(asset: Day3Asset, snapshot: Day3Snapshot): Promise<Day3Preview> {
  await activePreview?.dispose();
  const preview = await renderDay3Preview(asset, snapshot);
  preview.canvas.style.display = 'block';
  preview.canvas.style.maxWidth = '100%';
  preview.canvas.style.maxHeight = '460px';
  preview.canvas.style.width = 'auto';
  preview.canvas.style.height = 'auto';
  previewHost.replaceChildren(preview.canvas);
  activePreview = preview;
  return preview;
}

async function checkPngPixel(blob: Blob, x: number, y: number): Promise<readonly number[]> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    assert(context, 'Canvas 2D context is unavailable for PNG verification.');
    context.drawImage(bitmap, x, y, 1, 1, 0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  } finally {
    bitmap.close();
  }
}

async function countBrightPixels(blob: Blob, centerX: number, centerY: number): Promise<number> {
  const bitmap = await createImageBitmap(blob);
  try {
    const size = 240;
    const x = Math.max(0, Math.round(centerX - size / 2));
    const y = Math.max(0, Math.round(centerY - size / 2));
    const width = Math.min(size, bitmap.width - x);
    const height = Math.min(size, bitmap.height - y);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    assert(context, 'Canvas 2D context is unavailable for overlay verification.');
    context.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    let bright = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 230 && pixels[i + 1] > 230 && pixels[i + 2] > 230 && pixels[i + 3] > 220) bright++;
    }
    return bright;
  } finally {
    bitmap.close();
  }
}

async function checkHighFrequencyDetail(blob: Blob, start: readonly number[], end: readonly number[]): Promise<void> {
  const bitmap = await createImageBitmap(blob);
  try {
    const x = Math.round(start[0]);
    const y = Math.round(Math.min(start[1], end[1]) + 8);
    const height = Math.round(Math.abs(end[1] - start[1]) - 16);
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    assert(context, 'Canvas 2D context is unavailable for source-detail verification.');
    context.drawImage(bitmap, x, y, 1, height, 0, 0, 1, height);
    const pixels = context.getImageData(0, 0, 1, height).data;
    let dark = 0;
    let bright = 0;
    let min = 255;
    let max = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const luminance = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      min = Math.min(min, luminance);
      max = Math.max(max, luminance);
      if (luminance < 70) dark++;
      if (luminance > 160) bright++;
    }
    assert(dark > 20 && bright > 20 && max - min > 80,
      `Full-resolution stripe detail was not preserved (dark=${dark}, bright=${bright}, range=${min.toFixed(0)}-${max.toFixed(0)}).`);
  } finally {
    bitmap.close();
  }
}

async function runSpike(): Promise<void> {
  const lines: string[] = [];
  results.textContent = 'Đang chạy…';
  runButton.disabled = true;
  try {
    const asset = await createAsset();
    const sourceHash = await sha256(asset.blob);
    const snapshot = expectedSnapshot(asset.id);
    assert(snapshot.document.width === expectedDocumentSize.width
      && snapshot.document.height === expectedDocumentSize.height, 'Unexpected final document dimensions.');
    const [textX, textY] = transformDay3Point(snapshot, 2000, 700);
    assert(textX === 1062 && textY === 2424, `Text anchor transformed to ${textX},${textY}.`);
    record(lines, `geometry: crop 2304×1280 → resize 3456×1920 → rotate 1920×3456; text anchor ${textX},${textY}`);

    const preview = await showPreview(asset, snapshot);
    assert(Math.max(preview.proxyWidth, preview.proxyHeight) === DAY3_MAX_PROXY_EDGE,
      `Proxy edge was ${preview.proxyWidth}×${preview.proxyHeight}.`);
    assert(preview.proxyWidth === 2048 && preview.proxyHeight === 1024,
      `Unexpected proxy dimensions ${preview.proxyWidth}×${preview.proxyHeight}.`);
    record(lines, `preview proxy ${preview.proxyWidth}×${preview.proxyHeight}; snapshot retains document-pixel transform`);

    const png = await exportDay3Png(asset, snapshot);
    assert(png.type === 'image/png', `PNG MIME was ${png.type}.`);
    const bitmap = await createImageBitmap(png);
    try {
      assert(bitmap.width === expectedDocumentSize.width && bitmap.height === expectedDocumentSize.height,
        `PNG dimensions were ${bitmap.width}×${bitmap.height}.`);
    } finally {
      bitmap.close();
    }
    const transparentPixel = await checkPngPixel(png, 1287, 249);
    assert(transparentPixel[3] === 0, `Expected transparent crop marker, got alpha ${transparentPixel[3]}.`);
    const brightTextPixels = await countBrightPixels(png, textX, textY);
    assert(brightTextPixels > 30, `Expected exported text pixels near its transformed anchor; found ${brightTextPixels}.`);
    const stripeStart = transformDay3Point(snapshot, 2200, 1000);
    const stripeEnd = transformDay3Point(snapshot, 2455, 1000);
    await checkHighFrequencyDetail(png, stripeStart, stripeEnd);
    assert(sourceHash === await sha256(asset.blob), 'Source Blob changed during preview or export.');
    record(lines, `PNG export image/png ${expectedDocumentSize.width}×${expectedDocumentSize.height}; overlay pixels, full-resolution detail, alpha marker and source hash verified`);

    const fixtureAsset = await createWebpFixtureAsset();
    const fixtureHash = await sha256(fixtureAsset.blob);
    let fixtureSnapshot = createDay3Snapshot(fixtureAsset.id, fixtureAsset.width, fixtureAsset.height);
    fixtureSnapshot = {
      ...fixtureSnapshot,
      overlay: {
        ...fixtureSnapshot.overlay,
        text: 'WebP fixture',
        left: fixtureAsset.width / 2,
        top: fixtureAsset.height / 2,
        fontSize: 48,
      },
    };
    const cropX = 16;
    const cropY = 16;
    fixtureSnapshot = cropDay3Document(fixtureSnapshot, {
      x: cropX,
      y: cropY,
      width: fixtureAsset.width - cropX * 2,
      height: fixtureAsset.height - cropY * 2,
    });
    fixtureSnapshot = rotateDay3DocumentClockwise(fixtureSnapshot);
    const fixturePoint = transformDay3Point(fixtureSnapshot, fixtureAsset.width / 2, fixtureAsset.height / 2);
    const fixturePreview = await renderDay3Preview(fixtureAsset, fixtureSnapshot);
    assert(fixturePreview.canvas.width === fixtureSnapshot.document.width
      && fixturePreview.canvas.height === fixtureSnapshot.document.height,
    'Static WebP preview dimensions do not match transformed document dimensions.');
    await fixturePreview.dispose();
    const fixturePng = await exportDay3Png(fixtureAsset, fixtureSnapshot);
    const fixtureBitmap = await createImageBitmap(fixturePng);
    try {
      assert(fixturePng.type === 'image/png', `WebP fixture export MIME was ${fixturePng.type}.`);
      assert(fixtureBitmap.width === fixtureSnapshot.document.width
        && fixtureBitmap.height === fixtureSnapshot.document.height,
      'Static WebP export dimensions do not match transformed document dimensions.');
    } finally {
      fixtureBitmap.close();
    }
    const fixtureTextPixels = await countBrightPixels(fixturePng, fixturePoint[0], fixturePoint[1]);
    assert(fixtureTextPixels > 30, `Expected WebP overlay pixels near its transformed anchor; found ${fixtureTextPixels}.`);
    assert(fixtureHash === await sha256(fixtureAsset.blob), 'Static WebP source bytes changed during geometry or export.');
    record(lines, `static WebP source ${fixtureAsset.width}×${fixtureAsset.height}; crop/rotate preview and PNG export include overlay`);

    await saveDay3Draft(fixtureAsset, fixtureSnapshot);
    sessionStorage.setItem(expectedHashKey, fixtureHash);
    sessionStorage.setItem(expectedSnapshotKey, JSON.stringify(fixtureSnapshot));
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(png);
    download.href = downloadUrl;
    download.download = 'day3-spike.png';
    download.hidden = false;
    restoreButton.disabled = false;
    rollbackButton.disabled = false;
    record(lines, `static WebP source and snapshot saved atomically; high-resolution PNG download ready; reload, then restore the draft`);
  } catch (error) {
    results.textContent = `${lines.join('\n')}${lines.length ? '\n' : ''}FAIL ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    runButton.disabled = false;
  }
}

async function restoreDraft(): Promise<void> {
  const lines: string[] = [];
  try {
    const saved = await loadDay3Draft();
    assert(saved, 'No saved Day 3 draft was found.');
    const expectedHash = sessionStorage.getItem(expectedHashKey);
    const expected = sessionStorage.getItem(expectedSnapshotKey);
    assert(expectedHash && expected, 'Reload this tab after running the spike before checking restore.');
    assert(await sha256(saved.asset.blob) === expectedHash, 'Restored source Blob hash does not match the saved source.');
    assert(JSON.stringify(saved.snapshot) === expected, 'Restored snapshot differs from the saved geometry state.');
    const preview = await showPreview(saved.asset, saved.snapshot);
    assert(preview.canvas.width === saved.snapshot.document.width
      && preview.canvas.height === saved.snapshot.document.height, 'Restored preview has incorrect dimensions.');
    record(lines, `reload restore: WebP source hash, snapshot, transforms and ${preview.canvas.width}×${preview.canvas.height} preview match`);
  } catch (error) {
    results.textContent = `${lines.join('\n')}${lines.length ? '\n' : ''}FAIL ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function checkTransactionAbort(): Promise<void> {
  const lines: string[] = [];
  try {
    const previous = await loadDay3Draft();
    assert(previous, 'Save a draft before running the abort check.');
    const previousHash = await sha256(previous.asset.blob);
    const replacement = await createAsset();
    await abortDay3ReplacementForManualCheck(replacement, createDay3Snapshot(replacement.id, replacement.width, replacement.height));
    const afterAbort = await loadDay3Draft();
    assert(afterAbort?.asset.id === previous.asset.id, 'Aborted replacement changed the current draft asset.');
    assert(await sha256(afterAbort.asset.blob) === previousHash, 'Aborted replacement changed the saved source Blob.');
    record(lines, 'aborted replacement rolled back; previous draft and source Blob remain readable');
  } catch (error) {
    results.textContent = `${lines.join('\n')}${lines.length ? '\n' : ''}FAIL ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function resetSpikeData(): Promise<void> {
  await clearDay3Draft();
  sessionStorage.removeItem(expectedHashKey);
  sessionStorage.removeItem(expectedSnapshotKey);
  await activePreview?.dispose();
  activePreview = undefined;
  previewHost.replaceChildren();
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = undefined;
  download.hidden = true;
  restoreButton.disabled = true;
  rollbackButton.disabled = true;
  results.textContent = 'Đã xóa dữ liệu của database spike.';
}

runButton.addEventListener('click', () => void runSpike());
restoreButton.addEventListener('click', () => void restoreDraft());
rollbackButton.addEventListener('click', () => void checkTransactionAbort());
resetButton.addEventListener('click', () => void resetSpikeData().catch((error) => {
  results.textContent = `FAIL ${error instanceof Error ? error.message : String(error)}`;
}));

void loadDay3Draft().then((saved) => {
  restoreButton.disabled = !saved;
  rollbackButton.disabled = !saved;
}).catch((error: unknown) => {
  results.textContent = `IndexedDB không khả dụng: ${error instanceof Error ? error.message : String(error)}`;
});
