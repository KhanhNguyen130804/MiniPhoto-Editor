import { FabricImage, StaticCanvas } from 'fabric';
import type { ImageImportCandidate } from './imageImport';
import { applyDocumentTransform } from './geometry';
import { applyImageAdjustments, CURRENT_PRESET_VERSION, PRESET_OPTIONS } from './adjustmentFilters';
import type { EditorSnapshot, PresetId } from './snapshot';

const THUMBNAIL_MAX_WIDTH = 96;
const THUMBNAIL_MAX_HEIGHT = 72;

export async function renderPresetThumbnails(
  candidate: ImageImportCandidate,
  snapshot: EditorSnapshot,
): Promise<Record<PresetId, string>> {
  const source = snapshot.scene[0];
  const { width, height } = snapshot.document;
  if (snapshot.document.sourceAssetId !== candidate.assetId
    || !source || source.role !== 'source-image' || source.assetId !== candidate.assetId
    || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
    || snapshot.documentTransform.length !== 6
    || !snapshot.documentTransform.every(Number.isFinite)) {
    throw new Error('Không thể tạo thumbnail cho tài liệu hiện tại.');
  }

  const scale = Math.min(1, THUMBNAIL_MAX_WIDTH / width, THUMBNAIL_MAX_HEIGHT / height);
  const thumbnailWidth = Math.max(1, Math.round(width * scale));
  const thumbnailHeight = Math.max(1, Math.round(height * scale));
  const renderer = new StaticCanvas(document.createElement('canvas'), {
    width: thumbnailWidth,
    height: thumbnailHeight,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  let sourceImage: FabricImage | null = null;

  try {
    sourceImage = new FabricImage(candidate.sourceElement, {
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
    applyDocumentTransform(sourceImage, snapshot.documentTransform);
    renderer.setViewportTransform([scale, 0, 0, scale, 0, 0]);
    renderer.add(sourceImage);
    renderer.renderAll();

    const baseThumbnail = document.createElement('canvas');
    baseThumbnail.width = thumbnailWidth;
    baseThumbnail.height = thumbnailHeight;
    const baseContext = baseThumbnail.getContext('2d');
    if (!baseContext) throw new Error('Không tạo được canvas thumbnail.');
    baseContext.drawImage(renderer.lowerCanvasEl, 0, 0);

    const thumbnails = {} as Record<PresetId, string>;
    for (const option of PRESET_OPTIONS) {
      const thumbnailImage = new FabricImage(baseThumbnail);
      try {
        applyImageAdjustments(thumbnailImage, {
          ...snapshot.imageAppearance,
          presetId: option.id,
          presetVersion: CURRENT_PRESET_VERSION,
        });
        const output = document.createElement('canvas');
        output.width = thumbnailWidth;
        output.height = thumbnailHeight;
        const outputContext = output.getContext('2d');
        if (!outputContext) throw new Error('Không tạo được canvas thumbnail đã lọc.');
        outputContext.drawImage(thumbnailImage.getElement(), 0, 0, thumbnailWidth, thumbnailHeight);
        thumbnails[option.id] = output.toDataURL('image/png');
      } finally {
        thumbnailImage.dispose();
      }
    }
    return thumbnails;
  } finally {
    if (sourceImage) {
      renderer.remove(sourceImage);
      sourceImage.dispose();
    }
    await renderer.dispose();
  }
}
