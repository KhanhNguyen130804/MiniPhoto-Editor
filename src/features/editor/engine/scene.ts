import { Circle, Line, Rect, Textbox, type FabricObject } from 'fabric';
import { MAX_TEXT_CODE_POINTS, normalizeTextContent, type SceneObjectSnapshot, type ShapeOverlaySnapshot, type TextOverlaySnapshot } from './snapshot';

export const MAX_OVERLAYS = 50;

function overlayOptions(snapshot: TextOverlaySnapshot | ShapeOverlaySnapshot, interactive: boolean) {
  if (!snapshot.id || ![snapshot.left, snapshot.top, snapshot.scaleX, snapshot.scaleY,
    snapshot.angle, snapshot.opacity].every(Number.isFinite)
    || snapshot.scaleX <= 0 || snapshot.scaleY <= 0 || snapshot.opacity < 0 || snapshot.opacity > 1) {
    throw new TypeError('Invalid overlay transform.');
  }
  return {
    angle: snapshot.angle,
    scaleX: snapshot.scaleX,
    scaleY: snapshot.scaleY,
    flipX: snapshot.flipX,
    flipY: snapshot.flipY,
    opacity: snapshot.opacity,
    visible: snapshot.visible,
    originX: 'left' as const,
    originY: 'top' as const,
    selectable: interactive && snapshot.visible,
    evented: interactive && snapshot.visible,
    hasControls: interactive && snapshot.visible,
    hasBorders: interactive && snapshot.visible,
    lockUniScaling: snapshot.role === 'text' || (snapshot.role === 'shape' && snapshot.shape === 'circle'),
    lockScalingY: false,
  };
}

function validStroke(stroke: string | null, strokeWidth: number): boolean {
  return Number.isFinite(strokeWidth) && strokeWidth >= 0 && strokeWidth <= 50
    && (stroke === null ? strokeWidth === 0 : /^#[\da-f]{6}$/i.test(stroke));
}

function validFill(fill: string | null): boolean {
  return fill === null || /^#[\da-f]{6}$/i.test(fill);
}

export function createFabricOverlay(snapshot: TextOverlaySnapshot | ShapeOverlaySnapshot, interactive = false): FabricObject {
  const common = overlayOptions(snapshot, interactive);
  if (snapshot.role === 'text') {
    if (!snapshot.text || !['Noto Sans', 'Noto Serif'].includes(snapshot.fontFamily)
      || !Number.isFinite(snapshot.width) || snapshot.width <= 0
      || Array.from(snapshot.text).length > MAX_TEXT_CODE_POINTS || normalizeTextContent(snapshot.text) !== snapshot.text
      || !Number.isFinite(snapshot.fontSize) || snapshot.fontSize <= 0
      || ![400, 700].includes(snapshot.fontWeight)
      || !['normal', 'italic'].includes(snapshot.fontStyle)
      || !['left', 'center', 'right'].includes(snapshot.textAlign)
      || !snapshot.fill) {
      throw new TypeError('Invalid text overlay.');
    }
    const textbox = new Textbox(snapshot.text, {
      ...common,
      left: snapshot.left,
      top: snapshot.top,
      width: snapshot.width,
      fontFamily: snapshot.fontFamily,
      fontSize: snapshot.fontSize,
      fontWeight: snapshot.fontWeight,
      fontStyle: snapshot.fontStyle,
      textAlign: snapshot.textAlign,
      fill: snapshot.fill,
    });
    if (interactive) textbox.setControlsVisibility({ ml: false, mt: false, mr: false, mb: false });
    return textbox;
  }

  if (!validStroke(snapshot.stroke, snapshot.strokeWidth)
    || (snapshot.shape !== 'line' && !validFill(snapshot.fill))) throw new TypeError('Invalid shape style.');
  if (snapshot.shape === 'rectangle') {
    if (!Number.isFinite(snapshot.width) || !Number.isFinite(snapshot.height)
      || snapshot.width <= 0 || snapshot.height <= 0) throw new TypeError('Invalid rectangle overlay.');
    return new Rect({
      ...common,
      left: snapshot.left,
      top: snapshot.top,
      width: snapshot.width,
      height: snapshot.height,
      fill: snapshot.fill,
      stroke: snapshot.stroke,
      strokeWidth: snapshot.strokeWidth,
    });
  }
  if (snapshot.shape === 'circle') {
    if (!Number.isFinite(snapshot.radius) || snapshot.radius <= 0) throw new TypeError('Invalid circle overlay.');
    return new Circle({
      ...common,
      left: snapshot.left,
      top: snapshot.top,
      radius: snapshot.radius,
      fill: snapshot.fill,
      stroke: snapshot.stroke,
      strokeWidth: snapshot.strokeWidth,
    });
  }

  if (![snapshot.x2, snapshot.y2].every(Number.isFinite)
    || (snapshot.x2 === 0 && snapshot.y2 === 0)
    || snapshot.strokeWidth <= 0 || !snapshot.stroke) throw new TypeError('Invalid line overlay.');
  return new Line([-snapshot.x2, -snapshot.y2, snapshot.x2, snapshot.y2], {
    ...common,
    originX: 'center',
    originY: 'center',
    left: snapshot.left,
    top: snapshot.top,
    stroke: snapshot.stroke,
    strokeWidth: snapshot.strokeWidth,
    fill: null,
  });
}

export function createFabricOverlays(scene: readonly SceneObjectSnapshot[], interactive = false): FabricObject[] {
  const overlays = scene.filter((item): item is TextOverlaySnapshot | ShapeOverlaySnapshot => item.role !== 'source-image');
  if (overlays.length > MAX_OVERLAYS) throw new RangeError('A document cannot contain more than 50 overlays.');
  return overlays.map((overlay) => createFabricOverlay(overlay, interactive));
}
