import { FabricImage, StaticCanvas } from 'fabric';
import {
  MAX_IMAGE_EDGE,
  MAX_IMAGE_PIXELS,
  type ImageImportCandidate,
} from './imageImport';
import { applyDocumentTransform } from './geometry';
import { createFabricOverlays } from './scene';
import type { EditorSnapshot } from './snapshot';
import { applyImageAdjustments } from './adjustmentFilters';
import { ensureSnapshotTextFonts } from './text';

export type ExportFormat = 'png' | 'jpeg' | 'webp';

const MIME_TYPES: Record<ExportFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export async function probeExportFormat(format: ExportFormat): Promise<boolean> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  try {
    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob?.type === MIME_TYPES[format]), MIME_TYPES[format], 0.9);
    });
  } catch {
    return false;
  } finally {
    canvas.width = canvas.height = 0;
  }
}

export type ExportOptions = {
  format: ExportFormat;
  quality: number;
  backgroundColor: string;
};

function validDocument(snapshot: EditorSnapshot): boolean {
  const { width, height } = snapshot.document;
  return Number.isSafeInteger(width) && Number.isSafeInteger(height)
    && width > 0 && height > 0
    && width <= MAX_IMAGE_EDGE && height <= MAX_IMAGE_EDGE
    && width * height <= MAX_IMAGE_PIXELS
    && snapshot.documentTransform.length === 6
    && snapshot.documentTransform.every(Number.isFinite);
}

function canvasBlob(canvas: HTMLCanvasElement, options: ExportOptions): Promise<Blob> {
  const mimeType = MIME_TYPES[options.format];
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Không đủ bộ nhớ hoặc trình duyệt không tạo được file ảnh. Hãy giảm kích thước hoặc thử lại.'));
        } else if (blob.type !== mimeType) {
          reject(new Error(`Trình duyệt không trả về MIME ${mimeType} như yêu cầu. Hãy chọn định dạng khác rồi thử lại.`));
        } else {
          resolve(blob);
        }
      },
      mimeType,
      options.format === 'png' ? undefined : options.quality / 100,
    );
  });
}

export async function exportImage(
  candidate: ImageImportCandidate,
  snapshot: EditorSnapshot,
  options: ExportOptions,
): Promise<Blob> {
  if (!validDocument(snapshot)) throw new Error('Kích thước tài liệu không hợp lệ để xuất ảnh.');
  if (snapshot.document.sourceAssetId !== candidate.assetId) {
    throw new Error('Ảnh nguồn không khớp với tài liệu đang mở.');
  }
  if (options.format !== 'png' && (!Number.isInteger(options.quality) || options.quality < 1 || options.quality > 100)) {
    throw new RangeError('Chất lượng JPG/WebP phải từ 1 đến 100.');
  }
  if (options.format === 'jpeg' && !/^#[\da-f]{6}$/i.test(options.backgroundColor)) {
    throw new TypeError('Màu nền JPG không hợp lệ.');
  }

  const sources = snapshot.scene.filter((item) => item.role === 'source-image');
  const source = sources[0];
  if (sources.length !== 1 || !source || snapshot.scene[0] !== source || source.assetId !== candidate.assetId) {
    throw new Error('Snapshot không có ảnh nguồn hợp lệ ở lớp nền.');
  }

  await ensureSnapshotTextFonts(snapshot);

  const renderer = new StaticCanvas(document.createElement('canvas'), {
    width: snapshot.document.width,
    height: snapshot.document.height,
    backgroundColor: options.format === 'jpeg' ? options.backgroundColor : undefined,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });

  try {
    const image = new FabricImage(candidate.sourceElement, {
      left: source.left,
      top: source.top,
      scaleX: source.scaleX,
      scaleY: source.scaleY,
      angle: source.angle,
      flipX: source.flipX,
      flipY: source.flipY,
      opacity: source.opacity,
      visible: source.visible,
      originX: 'left',
      originY: 'top',
    });
    applyImageAdjustments(image, snapshot.imageAppearance);
    applyDocumentTransform(image, snapshot.documentTransform);
    renderer.add(image);

    const overlays = createFabricOverlays(snapshot.scene);
    overlays.forEach((object) => applyDocumentTransform(object, snapshot.documentTransform));
    if (overlays.length) renderer.add(...overlays);
    renderer.renderAll();

    const blob = await canvasBlob(renderer.lowerCanvasEl, options);
    const decoded = await createImageBitmap(blob);
    try {
      if (decoded.width !== snapshot.document.width || decoded.height !== snapshot.document.height) {
        throw new Error('Kích thước file xuất không khớp với tài liệu.');
      }
    } finally {
      decoded.close();
    }
    return blob;
  } finally {
    await renderer.dispose();
  }
}
