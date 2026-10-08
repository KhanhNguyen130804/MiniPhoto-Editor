import { MAX_IMAGE_EDGE, MAX_IMAGE_PIXELS } from './imageImport';
import { CURRENT_PRESET_VERSION, PRESET_OPTIONS } from './adjustmentFilters';
import { MAX_OVERLAYS, createFabricOverlay } from './scene';
import { validateShapeOverlay } from './shapes';
import { MAX_TEXT_CODE_POINTS, normalizeTextContent, type EditorSnapshot, type SceneObjectSnapshot, type ShapeOverlaySnapshot, type TextOverlaySnapshot } from './snapshot';
import { validateTextPropertiesPatch } from './text';

const MAX_SNAPSHOT_BYTES = 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function hasKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateTransform(value: unknown): asserts value is number[] {
  if (!Array.isArray(value) || value.length !== 6 || !value.every(finite)) throw new TypeError('Ma trận biến đổi không hợp lệ.');
  const determinant = value[0]! * value[3]! - value[1]! * value[2]!;
  if (!Number.isFinite(determinant) || determinant === 0) throw new TypeError('Ma trận biến đổi không thể khôi phục.');
}

function validateSource(value: unknown, assetId: string, width: number, height: number): value is SceneObjectSnapshot {
  if (!isRecord(value) || !hasKeys(value, [
    'id', 'role', 'assetId', 'width', 'height', 'left', 'top', 'scaleX', 'scaleY', 'angle', 'flipX', 'flipY', 'visible', 'opacity',
  ])) throw new TypeError('Ảnh nguồn trong snapshot không hợp lệ.');
  if (value.role !== 'source-image' || value.id !== assetId || value.assetId !== assetId
    || value.width !== width || value.height !== height
    || ![value.left, value.top, value.scaleX, value.scaleY, value.angle, value.opacity].every(finite)
    || (value.scaleX as number) <= 0 || (value.scaleY as number) <= 0
    || typeof value.flipX !== 'boolean' || typeof value.flipY !== 'boolean'
    || typeof value.visible !== 'boolean' || (value.opacity as number) < 0 || (value.opacity as number) > 1) {
    throw new TypeError('Ảnh nguồn không khớp với asset đã lưu.');
  }
  return true;
}

function validateOverlay(value: unknown): asserts value is SceneObjectSnapshot {
  if (!isRecord(value)) throw new TypeError('Lớp trong snapshot không hợp lệ.');
  const common = ['id', 'role', 'left', 'top', 'scaleX', 'scaleY', 'angle', 'flipX', 'flipY', 'visible', 'opacity'];
  if (typeof value.id !== 'string' || value.id.length === 0 || !['text', 'shape'].includes(String(value.role))
    || ![value.left, value.top, value.scaleX, value.scaleY, value.angle, value.opacity].every(finite)
    || (value.scaleX as number) <= 0 || (value.scaleY as number) <= 0
    || typeof value.flipX !== 'boolean' || typeof value.flipY !== 'boolean'
    || typeof value.visible !== 'boolean' || (value.opacity as number) < 0 || (value.opacity as number) > 1) {
    throw new TypeError('Biến đổi lớp không hợp lệ.');
  }

  if (value.role === 'text') {
    if (!hasKeys(value, [...common, 'text', 'width', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textAlign', 'fill'])
      || typeof value.text !== 'string' || !value.text || normalizeTextContent(value.text) !== value.text
      || Array.from(value.text).length > MAX_TEXT_CODE_POINTS) throw new TypeError('Lớp chữ không hợp lệ.');
    validateTextPropertiesPatch({
      width: value.width as number,
      fontFamily: value.fontFamily as never,
      fontSize: value.fontSize as number,
      fontWeight: value.fontWeight as never,
      fontStyle: value.fontStyle as never,
      textAlign: value.textAlign as never,
      fill: value.fill as string,
      opacity: value.opacity as number,
      x: value.left as number,
      y: value.top as number,
      angle: value.angle as number,
    });
    const object = createFabricOverlay(value as unknown as TextOverlaySnapshot);
    object.dispose();
    return;
  }

  if (value.role !== 'shape') throw new TypeError('Loại lớp không được hỗ trợ.');
  if (value.shape === 'rectangle' && !hasKeys(value, [...common, 'shape', 'width', 'height', 'fill', 'stroke', 'strokeWidth'])) {
    throw new TypeError('Hình chữ nhật không hợp lệ.');
  }
  if (value.shape === 'circle' && !hasKeys(value, [...common, 'shape', 'radius', 'fill', 'stroke', 'strokeWidth'])) {
    throw new TypeError('Hình tròn không hợp lệ.');
  }
  if (value.shape === 'line' && !hasKeys(value, [...common, 'shape', 'x2', 'y2', 'stroke', 'strokeWidth'])) {
    throw new TypeError('Đường thẳng không hợp lệ.');
  }
  if (!['rectangle', 'circle', 'line'].includes(String(value.shape))) throw new TypeError('Loại hình không được hỗ trợ.');
  validateShapeOverlay(value as unknown as ShapeOverlaySnapshot);
  const object = createFabricOverlay(value as unknown as ShapeOverlaySnapshot);
  object.dispose();
}

export function validateEditorSnapshot(value: unknown, asset: { id: string; width: number; height: number }): asserts value is EditorSnapshot {
  if (!isRecord(value) || !hasKeys(value, ['schemaVersion', 'document', 'documentTransform', 'imageAppearance', 'scene'])
    || value.schemaVersion !== 2) throw new TypeError('Phiên bản snapshot không được hỗ trợ.');
  const serialized = JSON.stringify(value);
  if (new TextEncoder().encode(serialized).byteLength > MAX_SNAPSHOT_BYTES) throw new RangeError('Snapshot vượt quá giới hạn 1 MiB.');

  const document = value.document;
  if (!isRecord(document) || !hasKeys(document, ['width', 'height', 'sourceAssetId'])
    || !Number.isSafeInteger(document.width) || !Number.isSafeInteger(document.height)
    || (document.width as number) < 1 || (document.height as number) < 1
    || (document.width as number) > MAX_IMAGE_EDGE || (document.height as number) > MAX_IMAGE_EDGE
    || (document.width as number) * (document.height as number) > MAX_IMAGE_PIXELS
    || document.sourceAssetId !== asset.id) throw new TypeError('Kích thước hoặc asset của tài liệu không hợp lệ.');

  validateTransform(value.documentTransform);
  const appearance = value.imageAppearance;
  if (!isRecord(appearance) || !hasKeys(appearance, ['presetId', 'presetVersion', 'brightness', 'contrast', 'saturation'])
    || !PRESET_OPTIONS.some((preset) => preset.id === appearance.presetId)
    || appearance.presetVersion !== CURRENT_PRESET_VERSION
    || ![appearance.brightness, appearance.contrast, appearance.saturation].every((part) => Number.isInteger(part) && (part as number) >= -100 && (part as number) <= 100)) {
    throw new TypeError('Bộ lọc hoặc điều chỉnh trong snapshot không được hỗ trợ.');
  }

  if (!Array.isArray(value.scene) || value.scene.length < 1 || value.scene.length > MAX_OVERLAYS + 1
    || !validateSource(value.scene[0], asset.id, asset.width, asset.height)
    || value.scene.filter((item) => isRecord(item) && item.role === 'source-image').length !== 1) {
    throw new TypeError('Cấu trúc lớp trong snapshot không hợp lệ.');
  }
  const ids = new Set<string>([asset.id]);
  for (const item of value.scene.slice(1)) {
    validateOverlay(item);
    if (ids.has(item.id)) throw new TypeError('ID lớp bị trùng.');
    ids.add(item.id);
  }
}
