import { FabricImage, type ImageSource } from 'fabric';

export const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 12_000_000;
export const MAX_IMAGE_EDGE = 8192;

export type ImageImportErrorCode =
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'ANIMATED_IMAGE'
  | 'IMAGE_TOO_LARGE'
  | 'DECODE_FAILED';

export class ImageImportError extends Error {
  constructor(readonly code: ImageImportErrorCode) {
    super(code);
    this.name = 'ImageImportError';
  }
}

export type ImageFileMetadata = {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
};

type ImageHeader = ImageFileMetadata & { animated: boolean };

const imageTypes = new Set<ImageFileMetadata['mimeType']>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function fourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function uint16BE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] * 256 + bytes[offset + 1];
}

function uint32BE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] * 0x1000000
    + bytes[offset + 1] * 0x10000
    + bytes[offset + 2] * 0x100
    + bytes[offset + 3];
}

function uint32LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset]
    + bytes[offset + 1] * 0x100
    + bytes[offset + 2] * 0x10000
    + bytes[offset + 3] * 0x1000000;
}

function uint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + bytes[offset + 1] * 0x100 + bytes[offset + 2] * 0x10000;
}

function jpegHeader(bytes: Uint8Array): ImageHeader | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > bytes.length) return null;

    const segmentLength = uint16BE(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    const isStartOfFrame = [
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
      0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ].includes(marker);
    if (isStartOfFrame) {
      if (segmentLength < 7) return null;
      return {
        mimeType: 'image/jpeg',
        height: uint16BE(bytes, offset + 3),
        width: uint16BE(bytes, offset + 5),
        animated: false,
      };
    }
    offset += segmentLength;
  }

  return null;
}

function pngHeader(bytes: Uint8Array): ImageHeader | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 33 || !signature.every((value, index) => bytes[index] === value)) return null;

  let width = 0;
  let height = 0;
  let animated = false;
  let offset = 8;
  let firstChunk = true;

  while (offset + 12 <= bytes.length) {
    const length = uint32BE(bytes, offset);
    const type = fourCC(bytes, offset + 4);
    const end = offset + 12 + length;
    if (end > bytes.length || (firstChunk && (type !== 'IHDR' || length !== 13))) return null;
    firstChunk = false;

    if (type === 'IHDR') {
      width = uint32BE(bytes, offset + 8);
      height = uint32BE(bytes, offset + 12);
    } else if (type === 'acTL') {
      animated = true;
    } else if (type === 'IEND') {
      break;
    }

    offset = end;
  }

  if (!width || !height) return null;
  return { mimeType: 'image/png', width, height, animated };
}

function webpHeader(bytes: Uint8Array): ImageHeader | null {
  if (bytes.length < 20 || fourCC(bytes, 0) !== 'RIFF' || fourCC(bytes, 8) !== 'WEBP') return null;
  const riffEnd = uint32LE(bytes, 4) + 8;
  if (riffEnd > bytes.length || riffEnd < 20) return null;

  let width = 0;
  let height = 0;
  let hasImageChunk = false;
  let animated = false;
  let offset = 12;

  while (offset + 8 <= riffEnd) {
    const type = fourCC(bytes, offset);
    const length = uint32LE(bytes, offset + 4);
    const dataOffset = offset + 8;
    const end = dataOffset + length;
    if (end > riffEnd || end + (length & 1) > riffEnd) return null;

    if (type === 'ANIM' || type === 'ANMF') animated = true;
    if (type === 'ANMF') hasImageChunk = true;
    if (type === 'VP8X') {
      if (length < 10) return null;
      animated ||= (bytes[dataOffset] & 0x02) !== 0;
      width = uint24LE(bytes, dataOffset + 4) + 1;
      height = uint24LE(bytes, dataOffset + 7) + 1;
    } else if (type === 'VP8 ' && length >= 10) {
      hasImageChunk = true;
      if (!width || !height) {
        if (bytes[dataOffset + 3] !== 0x9d || bytes[dataOffset + 4] !== 0x01 || bytes[dataOffset + 5] !== 0x2a) return null;
        width = (bytes[dataOffset + 6] | (bytes[dataOffset + 7] << 8)) & 0x3fff;
        height = (bytes[dataOffset + 8] | (bytes[dataOffset + 9] << 8)) & 0x3fff;
      }
    } else if (type === 'VP8L' && length >= 5) {
      hasImageChunk = true;
      if (!width || !height) {
        if (bytes[dataOffset] !== 0x2f) return null;
        width = 1 + bytes[dataOffset + 1] + ((bytes[dataOffset + 2] & 0x3f) << 8);
        height = 1 + (bytes[dataOffset + 2] >> 6) + (bytes[dataOffset + 3] << 2) + ((bytes[dataOffset + 4] & 0x0f) << 10);
      }
    }

    offset = end + (length & 1);
  }

  if (offset !== riffEnd || !hasImageChunk || !width || !height) return null;
  return { mimeType: 'image/webp', width, height, animated };
}

function inspectImage(bytes: Uint8Array): ImageHeader | null {
  return jpegHeader(bytes) ?? pngHeader(bytes) ?? webpHeader(bytes);
}

export async function validateImageFile(file: File, signal?: AbortSignal): Promise<ImageFileMetadata> {
  throwIfAborted(signal);
  if (file.size === 0) throw new ImageImportError('EMPTY_FILE');
  if (file.size > MAX_IMPORT_FILE_BYTES) throw new ImageImportError('FILE_TOO_LARGE');

  const header = inspectImage(new Uint8Array(await file.arrayBuffer()));
  throwIfAborted(signal);
  if (!header) throw new ImageImportError('UNSUPPORTED_FORMAT');
  if (header.animated) throw new ImageImportError('ANIMATED_IMAGE');
  if (imageTypes.has(file.type as ImageFileMetadata['mimeType']) && file.type !== header.mimeType) {
    throw new ImageImportError('UNSUPPORTED_FORMAT');
  }
  if (header.width < 1 || header.height < 1) throw new ImageImportError('DECODE_FAILED');
  if (header.width > MAX_IMAGE_EDGE || header.height > MAX_IMAGE_EDGE
    || header.width * header.height > MAX_IMAGE_PIXELS) {
    throw new ImageImportError('IMAGE_TOO_LARGE');
  }

  return { mimeType: header.mimeType, width: header.width, height: header.height };
}

export type ImageImportCandidate = {
  assetId: string;
  source: File;
  mimeType?: ImageFileMetadata['mimeType'];
  importedAt?: number;
  image: FabricImage;
  sourceElement: ImageSource;
  width: number;
  height: number;
  dispose(): void;
};

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
  }
}

function candidate(source: File, image: FabricImage, release = () => {}): ImageImportCandidate {
  const { width, height } = image.getOriginalSize();
  const sourceElement = image.getElement();
  let disposed = false;

  return {
    assetId: crypto.randomUUID(),
    source,
    importedAt: Date.now(),
    image,
    sourceElement,
    width,
    height,
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        image.dispose();
      } finally {
        release();
      }
    },
  };
}

export async function decodeWithFabricUrl(
  file: File,
  signal?: AbortSignal,
): Promise<ImageImportCandidate> {
  throwIfAborted(signal);
  const url = URL.createObjectURL(file);
  let image: FabricImage | undefined;

  try {
    image = await FabricImage.fromURL(url, { signal });
    throwIfAborted(signal);
    return candidate(file, image);
  } catch (error) {
    image?.dispose();
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function decodeSavedImageAsset(
  asset: { id: string; blob: Blob; mimeType: ImageFileMetadata['mimeType']; width: number; height: number; originalFileName: string; importedAt: number },
  signal?: AbortSignal,
): Promise<ImageImportCandidate> {
  const file = new File([asset.blob], asset.originalFileName, { type: asset.mimeType, lastModified: asset.importedAt });
  const metadata = await validateImageFile(file, signal);
  if (metadata.mimeType !== asset.mimeType) throw new ImageImportError('UNSUPPORTED_FORMAT');
  const decoded = await decodeWithFabricUrl(file, signal);
  if (decoded.width !== asset.width || decoded.height !== asset.height) {
    decoded.dispose();
    throw new ImageImportError('DECODE_FAILED');
  }
  decoded.assetId = asset.id;
  decoded.importedAt = asset.importedAt;
  decoded.mimeType = asset.mimeType;
  return decoded;
}

export async function decodeWithImageBitmap(
  file: File,
  signal?: AbortSignal,
): Promise<ImageImportCandidate> {
  throwIfAborted(signal);
  // ponytail: createImageBitmap cannot be aborted mid-decode; discard and close its result if cancelled.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  let canvas: HTMLCanvasElement | undefined;

  try {
    throwIfAborted(signal);
    canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context is unavailable.');
    context.drawImage(bitmap, 0, 0);
    return candidate(file, new FabricImage(canvas), () => {
      canvas!.width = 0;
      canvas!.height = 0;
    });
  } catch (error) {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    throw error;
  } finally {
    bitmap.close();
  }
}
