import { FabricImage, StaticCanvas } from 'fabric';
import { MAX_IMAGE_EDGE, MAX_IMAGE_PIXELS, type ImageImportCandidate } from './imageImport';
import { applyDocumentTransform } from './geometry';
import { applyImageAdjustments } from './adjustmentFilters';
import { createFabricOverlays } from './scene';
import type { EditorSnapshot } from './snapshot';
import { ensureSnapshotTextFonts } from './text';

export const DRAFT_THUMBNAIL_MAX_BYTES = 256 * 1024;

export async function renderDraftThumbnail(candidate: ImageImportCandidate, snapshot: EditorSnapshot): Promise<Blob> {
  const { width, height, sourceAssetId } = snapshot.document;
  const source = snapshot.scene[0];
  if (sourceAssetId !== candidate.assetId
    || !source || source.role !== 'source-image' || source.assetId !== candidate.assetId
    || snapshot.scene.filter((item) => item.role === 'source-image').length !== 1
    || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
    || width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE || width * height > MAX_IMAGE_PIXELS
    || snapshot.documentTransform.length !== 6 || !snapshot.documentTransform.every(Number.isFinite)) {
    throw new Error('Không thể tạo thumbnail cho tài liệu hiện tại.');
  }

  await ensureSnapshotTextFonts(snapshot);
  const scale = Math.min(1, 256 / width, 256 / height);
  const renderer = new StaticCanvas(document.createElement('canvas'), {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    backgroundColor: '#ffffff',
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
    const overlays = createFabricOverlays(snapshot.scene);
    overlays.forEach((overlay) => applyDocumentTransform(overlay, snapshot.documentTransform));
    renderer.setViewportTransform([scale, 0, 0, scale, 0, 0]);
    renderer.add(image, ...overlays);
    renderer.renderAll();

    return await new Promise<Blob>((resolve, reject) => {
      renderer.lowerCanvasEl.toBlob((blob) => {
        if (!blob) reject(new Error('Trình duyệt không tạo được thumbnail.'));
        else if (blob.type !== 'image/jpeg') reject(new Error('Trình duyệt không tạo được thumbnail JPEG.'));
        else if (blob.size > DRAFT_THUMBNAIL_MAX_BYTES) reject(new Error('Thumbnail vượt quá giới hạn lưu trữ.'));
        else resolve(blob);
      }, 'image/jpeg', 0.8);
    });
  } finally {
    await renderer.dispose();
  }
}
