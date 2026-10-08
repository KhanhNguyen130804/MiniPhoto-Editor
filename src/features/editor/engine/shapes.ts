import { Circle, Line, Point, Rect, util, type FabricObject } from 'fabric';
import { applyDocumentTransform } from './geometry';
import { createFabricOverlay, MAX_OVERLAYS } from './scene';
import type { EditorSnapshot, ShapeOverlaySnapshot } from './snapshot';

export type ShapeKind = ShapeOverlaySnapshot['shape'];
type RectangleShape = Extract<ShapeOverlaySnapshot, { shape: 'rectangle' }>;
type CircleShape = Extract<ShapeOverlaySnapshot, { shape: 'circle' }>;
type LineShape = Extract<ShapeOverlaySnapshot, { shape: 'line' }>;

export type ShapeProperties = {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
};

export type ShapePropertiesPatch = Partial<ShapeProperties>;

export type SelectedShape = {
  id: string;
  shape: ShapeKind;
  properties: ShapeProperties;
};

export const DEFAULT_SHAPE_COLOR = '#2563eb';

function isColor(value: string | null): boolean {
  return value === null || /^#[\da-f]{6}$/i.test(value);
}

function kindOf(object: FabricObject): ShapeKind {
  if (object instanceof Circle) return 'circle';
  if (object instanceof Line) return 'line';
  return 'rectangle';
}

function validateProperties(kind: ShapeKind, properties: ShapeProperties): void {
  if (kind !== 'line' && !isColor(properties.fill)) throw new TypeError('Màu tô phải là mã hex sáu chữ số hoặc trong suốt.');
  if (!isColor(properties.stroke) || !Number.isFinite(properties.strokeWidth)
    || properties.strokeWidth < 0 || properties.strokeWidth > 50) {
    throw new RangeError('Viền phải dùng màu hợp lệ và có độ rộng từ 0 đến 50 px.');
  }
  if (properties.stroke === null && properties.strokeWidth !== 0) {
    throw new RangeError('Viền trong suốt phải có độ rộng 0 px.');
  }
  if (kind === 'line' && (!properties.stroke || properties.strokeWidth <= 0)) {
    throw new RangeError('Đường thẳng cần màu viền và độ rộng lớn hơn 0 px.');
  }
  if (!Number.isFinite(properties.opacity) || properties.opacity < 0 || properties.opacity > 1) {
    throw new RangeError('Độ mờ phải nằm trong khoảng 0–100%.');
  }
}

export function validateShapePropertiesPatch(kind: ShapeKind, patch: ShapePropertiesPatch): void {
  if (kind === 'line' && patch.fill !== undefined) throw new TypeError('Đường thẳng không có màu tô.');
  if (kind === 'line' && patch.stroke === null) throw new TypeError('Đường thẳng cần màu viền.');
  if (patch.fill !== undefined && !isColor(patch.fill)) throw new TypeError('Màu tô phải là mã hex sáu chữ số hoặc trong suốt.');
  if (patch.stroke !== undefined && !isColor(patch.stroke)) throw new TypeError('Màu viền phải là mã hex sáu chữ số hoặc trong suốt.');
  if (patch.strokeWidth !== undefined && (!Number.isFinite(patch.strokeWidth) || patch.strokeWidth < 0 || patch.strokeWidth > 50)) {
    throw new RangeError('Độ rộng viền phải từ 0 đến 50 px.');
  }
  if (kind === 'line' && patch.strokeWidth !== undefined && patch.strokeWidth <= 0) {
    throw new RangeError('Đường thẳng cần độ rộng viền lớn hơn 0 px.');
  }
  if (patch.opacity !== undefined && (!Number.isFinite(patch.opacity) || patch.opacity < 0 || patch.opacity > 1)) {
    throw new RangeError('Độ mờ phải nằm trong khoảng 0–100%.');
  }
}

export function shapePropertiesFromObject(object: FabricObject): ShapeProperties {
  return {
    fill: object instanceof Line ? null : object.fill as string | null,
    stroke: object.stroke as string | null,
    strokeWidth: object.strokeWidth,
    opacity: object.opacity,
  };
}

export function applyShapePropertiesPatch(object: FabricObject, patch: ShapePropertiesPatch): ShapeProperties {
  const kind = kindOf(object);
  validateShapePropertiesPatch(kind, patch);
  const next = { ...shapePropertiesFromObject(object), ...patch };
  validateProperties(kind, next);
  object.set(patch);
  object.setCoords();
  return shapePropertiesFromObject(object);
}

export function createDefaultShapeObject(snapshot: EditorSnapshot, id: string, shape: 'rectangle'): { object: Rect; overlay: RectangleShape };
export function createDefaultShapeObject(snapshot: EditorSnapshot, id: string, shape: 'circle'): { object: Circle; overlay: CircleShape };
export function createDefaultShapeObject(snapshot: EditorSnapshot, id: string, shape: 'line'): { object: Line; overlay: LineShape };
export function createDefaultShapeObject(snapshot: EditorSnapshot, id: string, shape: ShapeKind): {
  object: FabricObject;
  overlay: ShapeOverlaySnapshot;
};
export function createDefaultShapeObject(snapshot: EditorSnapshot, id: string, shape: ShapeKind): {
  object: FabricObject;
  overlay: ShapeOverlaySnapshot;
} {
  if (!id || snapshot.scene.some((item) => item.id === id)) throw new TypeError('Shape ID must be unique.');
  if (snapshot.scene.filter((item) => item.role !== 'source-image').length >= MAX_OVERLAYS) {
    throw new RangeError('Bạn chỉ có thể thêm tối đa 50 lớp chữ và hình.');
  }
  const size = Math.max(1, Math.min(snapshot.document.width, snapshot.document.height) * 0.2);
  const common = {
    id,
    role: 'shape' as const,
    left: 0,
    top: 0,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    flipX: false,
    flipY: false,
    visible: true,
    opacity: 1,
  };
  const overlay: ShapeOverlaySnapshot = shape === 'rectangle'
    ? { ...common, shape, width: size, height: size, fill: DEFAULT_SHAPE_COLOR, stroke: null, strokeWidth: 0 }
    : shape === 'circle'
      ? { ...common, shape, radius: size / 2, fill: DEFAULT_SHAPE_COLOR, stroke: null, strokeWidth: 0 }
      : {
        ...common,
        shape,
        x2: size / 2,
        y2: 0,
        stroke: DEFAULT_SHAPE_COLOR,
        strokeWidth: Math.max(1, Math.min(50, Math.round(4 * Math.min(snapshot.document.width, snapshot.document.height) / 1024))),
      };
  const object = createFabricOverlay(overlay, true);
  object.setPositionByOrigin(
    new Point(snapshot.document.width / 2, snapshot.document.height / 2),
    'center',
    'center',
  );
  object.setCoords();
  return { object, overlay: serializeShapeObject(snapshot, object, overlay) };
}

export function serializeShapeObject(snapshot: EditorSnapshot, object: FabricObject, baseline: RectangleShape): RectangleShape;
export function serializeShapeObject(snapshot: EditorSnapshot, object: FabricObject, baseline: CircleShape): CircleShape;
export function serializeShapeObject(snapshot: EditorSnapshot, object: FabricObject, baseline: LineShape): LineShape;
export function serializeShapeObject(snapshot: EditorSnapshot, object: FabricObject, baseline: ShapeOverlaySnapshot): ShapeOverlaySnapshot;
export function serializeShapeObject(
  snapshot: EditorSnapshot,
  object: FabricObject,
  baseline: ShapeOverlaySnapshot,
): ShapeOverlaySnapshot {
  const properties = shapePropertiesFromObject(object);
  let normalized: ShapeOverlaySnapshot;
  if (baseline.shape === 'line') {
    if (!properties.stroke) throw new TypeError('Line stroke must have a color.');
    normalized = { ...baseline, stroke: properties.stroke, strokeWidth: properties.strokeWidth, opacity: properties.opacity };
  } else {
    normalized = {
      ...baseline,
      fill: properties.fill,
      stroke: properties.stroke,
      strokeWidth: properties.strokeWidth,
      opacity: properties.opacity,
    };
  }
  validateShapeOverlay(normalized);
  const baseObject = createFabricOverlay(normalized) as FabricObject;
  try {
    const inverse = util.invertTransform(snapshot.documentTransform);
    util.applyTransformToObject(baseObject, util.multiplyTransformMatrices(inverse, object.calcTransformMatrix()));
    baseObject.setCoords();
    return {
      ...normalized,
      left: baseObject.left,
      top: baseObject.top,
      scaleX: baseObject.scaleX,
      scaleY: baseObject.scaleY,
      angle: baseObject.angle,
      flipX: baseObject.flipX,
      flipY: baseObject.flipY,
      visible: object.visible,
    } as ShapeOverlaySnapshot;
  } finally {
    baseObject.dispose();
  }
}

export function restoreShapeObject(snapshot: EditorSnapshot, object: FabricObject, baseline: ShapeOverlaySnapshot): void {
  const restored = createFabricOverlay(baseline, true);
  applyDocumentTransform(restored, snapshot.documentTransform);
  object.set({
    fill: baseline.shape === 'line' ? null : baseline.fill,
    stroke: baseline.stroke,
    strokeWidth: baseline.strokeWidth,
    opacity: baseline.opacity,
    left: restored.left,
    top: restored.top,
    scaleX: restored.scaleX,
    scaleY: restored.scaleY,
    angle: restored.angle,
    flipX: restored.flipX,
    flipY: restored.flipY,
    visible: baseline.visible,
  });
  restored.dispose();
  object.setCoords();
}

export function validateShapeOverlay(overlay: ShapeOverlaySnapshot): void {
  if (!overlay.id || ![overlay.left, overlay.top, overlay.scaleX, overlay.scaleY, overlay.angle].every(Number.isFinite)
    || overlay.scaleX <= 0 || overlay.scaleY <= 0) throw new TypeError('Invalid shape geometry.');
  validateProperties(overlay.shape, {
    fill: overlay.shape === 'line' ? null : overlay.fill,
    stroke: overlay.stroke,
    strokeWidth: overlay.strokeWidth,
    opacity: overlay.opacity,
  });
  if (overlay.shape === 'rectangle' && (!Number.isFinite(overlay.width) || !Number.isFinite(overlay.height)
    || overlay.width <= 0 || overlay.height <= 0)) throw new TypeError('Rectangle dimensions must be greater than 0.');
  if (overlay.shape === 'circle' && (!Number.isFinite(overlay.radius) || overlay.radius <= 0)) {
    throw new TypeError('Circle radius must be greater than 0.');
  }
  if (overlay.shape === 'line' && (![overlay.x2, overlay.y2].every(Number.isFinite)
    || (overlay.x2 === 0 && overlay.y2 === 0))) throw new TypeError('Line endpoints must be finite and distinct.');
}

export function putShapeOverlay(snapshot: EditorSnapshot, overlay: ShapeOverlaySnapshot): EditorSnapshot {
  validateShapeOverlay(overlay);
  const index = snapshot.scene.findIndex((item) => item.id === overlay.id);
  const scene = [...snapshot.scene];
  if (index >= 0) {
    if (scene[index]?.role !== 'shape') throw new TypeError('Shape ID belongs to another overlay.');
    scene[index] = overlay;
  } else {
    if (scene.filter((item) => item.role !== 'source-image').length >= MAX_OVERLAYS) {
      throw new RangeError('Bạn chỉ có thể thêm tối đa 50 lớp chữ và hình.');
    }
    scene.push(overlay);
  }
  return { ...snapshot, scene };
}
