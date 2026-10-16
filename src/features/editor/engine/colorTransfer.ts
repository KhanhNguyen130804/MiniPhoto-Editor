import { FabricImage, StaticCanvas } from 'fabric';
import { applyDocumentTransform } from './geometry';
import { decodeWithFabricUrl, MAX_IMAGE_EDGE, MAX_IMAGE_PIXELS, validateImageFile, type ImageImportCandidate } from './imageImport';
import type { ColorTransferSettings, EditorSnapshot } from './snapshot';

type Triple = [number, number, number];
export type ColorStatistics = { mean: Triple; deviation: Triple };
export type ColorReference = { settings: ColorTransferSettings; thumbnail: Blob; filename: string };
const SAMPLE_EDGE = 256;
const linearRgb = Float64Array.from({ length: 256 }, (_, value) => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
});
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const round = (value: number) => Math.round(value * 1e6) / 1e6;
// Conversion tables avoid per-pixel powers on the CPU; parity tests bound RGB error.
const TABLE_SIZE = 65536;
const cubeRoots = Float64Array.from({ length: TABLE_SIZE + 1 }, (_, index) => Math.cbrt(index / TABLE_SIZE));
const encodedRgb = Uint8ClampedArray.from({ length: TABLE_SIZE + 1 }, (_, index) => {
  const value = index / TABLE_SIZE;
  return 255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);
});
const labCurve = (value: number) => value > 216 / 24389
  ? cubeRoots[value >= 1 ? TABLE_SIZE : (value * TABLE_SIZE + 0.5) | 0]!
  : (24389 / 27 * value + 16) / 116;
const inverseLabCurve = (value: number) => value > 6 / 29 ? value * value * value : (116 * value - 16) / (24389 / 27);
const encodeRgb = (value: number) => {
  return value <= 0 ? 0 : value >= 1 ? 255 : encodedRgb[(value * TABLE_SIZE + 0.5) | 0]!;
};

export function rgbToLab(red: number, green: number, blue: number, output: number[]): void {
  const r = linearRgb[red]!;
  const g = linearRgb[green]!;
  const b = linearRgb[blue]!;
  const x = labCurve((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const y = labCurve(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const z = labCurve((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  output[0] = 116 * y - 16;
  output[1] = 500 * (x - y);
  output[2] = 200 * (y - z);
}

export function labToRgb(lightness: number, a: number, b: number, output: number[]): void {
  const fy = (clamp(lightness, 0, 100) + 16) / 116;
  const x = 0.95047 * inverseLabCurve(fy + a / 500);
  const y = inverseLabCurve(fy);
  const z = 1.08883 * inverseLabCurve(fy - b / 200);
  output[0] = encodeRgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z);
  output[1] = encodeRgb(-0.969266 * x + 1.8760108 * y + 0.041556 * z);
  output[2] = encodeRgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z);
}

export function analyzeColorPixels(pixels: ImageData): ColorStatistics {
  const mean: Triple = [0, 0, 0];
  const variance: Triple = [0, 0, 0];
  const lab = [0, 0, 0];
  let total = 0;
  for (let index = 0; index < pixels.data.length; index += 4) {
    const weight = pixels.data[index + 3]! / 255;
    if (!weight) continue;
    rgbToLab(pixels.data[index]!, pixels.data[index + 1]!, pixels.data[index + 2]!, lab);
    total += weight;
    for (let channel = 0; channel < 3; channel++) {
      const delta = lab[channel]! - mean[channel]!;
      mean[channel]! += weight / total * delta;
      variance[channel]! += weight * delta * (lab[channel]! - mean[channel]!);
    }
  }
  if (!total) throw new Error('Vùng ảnh không có pixel màu để phân tích. Hãy chọn ảnh có nội dung hiển thị.');
  return { mean, deviation: variance.map((value) => Math.sqrt(Math.max(0, value / total))) as Triple };
}

export function createColorTransferRecipe(source: ColorStatistics, reference: ColorStatistics): ColorTransferSettings {
  const gain = source.deviation.map((value, channel) => round(value < 0.1
    ? 1 : clamp(reference.deviation[channel]! / value, channel === 0 ? 0.25 : 0, 2))) as Triple;
  const offset = source.mean.map((value, channel) => round(reference.mean[channel]! - gain[channel]! * value)) as Triple;
  const settings: ColorTransferSettings = { algorithmVersion: 1, gain, offset, strength: 70 };
  validateColorTransfer(settings);
  return settings;
}

export function validateColorTransfer(value: unknown, allowZero = false): asserts value is ColorTransferSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Công thức màu mẫu không hợp lệ.');
  const item = value as Record<string, unknown>;
  const triple = (parts: unknown, minimum: number, maximum: number): parts is number[] => Array.isArray(parts)
    && parts.length === 3 && Array.from(parts).every((part) => typeof part === 'number' && Number.isFinite(part) && part >= minimum && part <= maximum);
  if (Object.keys(item).length !== 4 || !['algorithmVersion', 'gain', 'offset', 'strength'].every((key) => Object.prototype.hasOwnProperty.call(item, key))
    || item.algorithmVersion !== 1 || !triple(item.gain, 0, 2) || item.gain[0]! < 0.25
    || !triple(item.offset, -512, 512) || !Number.isInteger(item.strength)
    || (item.strength as number) < (allowZero ? 0 : 1) || (item.strength as number) > 100) {
    throw new TypeError('Phiên bản hoặc thông số màu mẫu không được hỗ trợ.');
  }
}

export function normalizeColorTransfer(value: ColorTransferSettings | null): ColorTransferSettings | null {
  if (!value) return null;
  validateColorTransfer(value, true);
  const gain = value.gain.map(round) as Triple;
  const offset = value.offset.map(round) as Triple;
  if (value.strength === 0 || gain.every((part) => part === 1) && offset.every((part) => part === 0)) return null;
  return { algorithmVersion: 1, gain, offset, strength: value.strength };
}

export function colorTransferKey(value: ColorTransferSettings | null): string {
  return value ? JSON.stringify([value.algorithmVersion, value.gain, value.offset]) : '';
}

export function applyColorTransferPixels(pixels: ImageData, settings: ColorTransferSettings): void {
  validateColorTransfer(settings, true);
  if (!normalizeColorTransfer(settings)) return;
  const lab = [0, 0, 0];
  const rgb = [0, 0, 0];
  const strength = settings.strength / 100;
  const gain = settings.gain.map((value) => 1 + strength * (value - 1));
  const offset = settings.offset.map((value) => strength * value);
  for (let index = 0; index < pixels.data.length; index += 4) {
    if (pixels.data[index + 3] === 0) continue;
    rgbToLab(pixels.data[index]!, pixels.data[index + 1]!, pixels.data[index + 2]!, lab);
    labToRgb(lab[0]! * gain[0]! + offset[0]!, lab[1]! * gain[1]! + offset[1]!, lab[2]! * gain[2]! + offset[2]!, rgb);
    pixels.data[index] = rgb[0]!;
    pixels.data[index + 1] = rgb[1]!;
    pixels.data[index + 2] = rgb[2]!;
  }
}

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Đã hủy phân tích ảnh mẫu.', 'AbortError');
}

function sampleCanvas(width: number, height: number): HTMLCanvasElement {
  const scale = Math.min(1, SAMPLE_EDGE / width, SAMPLE_EDGE / height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  return canvas;
}

export async function analyzeColorReference(
  candidate: ImageImportCandidate,
  snapshot: EditorSnapshot,
  file: File,
  signal: AbortSignal,
): Promise<ColorReference> {
  checkAbort(signal);
  await validateImageFile(file, signal);
  const reference = await decodeWithFabricUrl(file, signal);
  let renderer: StaticCanvas | undefined;
  let referenceCanvas: HTMLCanvasElement | undefined;
  try {
    checkAbort(signal);
    if (reference.width < 1 || reference.height < 1 || reference.width > MAX_IMAGE_EDGE
      || reference.height > MAX_IMAGE_EDGE || reference.width * reference.height > MAX_IMAGE_PIXELS) {
      throw new Error('Ảnh mẫu vượt giới hạn 12 MP hoặc cạnh 8192 px sau khi giải mã.');
    }
    const source = snapshot.scene[0];
    if (!source || source.role !== 'source-image' || source.assetId !== candidate.assetId
      || snapshot.document.sourceAssetId !== candidate.assetId) throw new Error('Ảnh nền không khớp với tài liệu.');
    const sample = sampleCanvas(snapshot.document.width, snapshot.document.height);
    renderer = new StaticCanvas(sample, { width: sample.width, height: sample.height, enableRetinaScaling: false, renderOnAddRemove: false });
    const image = new FabricImage(candidate.sourceElement, {
      left: source.left, top: source.top, scaleX: source.scaleX, scaleY: source.scaleY, angle: source.angle,
      flipX: source.flipX, flipY: source.flipY, visible: true, opacity: 1, originX: 'left', originY: 'top',
    });
    applyDocumentTransform(image, snapshot.documentTransform);
    renderer.setViewportTransform([sample.width / snapshot.document.width, 0, 0, sample.height / snapshot.document.height, 0, 0]);
    renderer.add(image);
    renderer.renderAll();
    const context = sample.getContext('2d');
    if (!context) throw new Error('Không tạo được vùng phân tích ảnh nền.');
    const sourceStats = analyzeColorPixels(context.getImageData(0, 0, sample.width, sample.height));
    referenceCanvas = sampleCanvas(reference.width, reference.height);
    const referenceContext = referenceCanvas.getContext('2d');
    if (!referenceContext) throw new Error('Không tạo được vùng phân tích ảnh mẫu.');
    referenceContext.drawImage(reference.sourceElement, 0, 0, referenceCanvas.width, referenceCanvas.height);
    const referenceStats = analyzeColorPixels(referenceContext.getImageData(0, 0, referenceCanvas.width, referenceCanvas.height));
    const settings = createColorTransferRecipe(sourceStats, referenceStats);
    const thumbnail = await new Promise<Blob>((resolve, reject) => referenceCanvas!.toBlob((blob) => {
      if (blob) resolve(blob); else reject(new Error('Không tạo được ảnh xem trước của mẫu.'));
    }, 'image/png'));
    checkAbort(signal);
    return { settings, thumbnail, filename: file.name };
  } finally {
    reference.dispose();
    await renderer?.dispose();
    if (referenceCanvas) referenceCanvas.width = referenceCanvas.height = 0;
  }
}
