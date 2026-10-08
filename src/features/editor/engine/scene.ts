import { Circle, Line, Rect, Textbox, type FabricObject } from 'fabric';
import type { SceneObjectSnapshot, ShapeOverlaySnapshot, TextOverlaySnapshot } from './snapshot';

const MAX_OVERLAYS = 50;

function overlayOptions(snapshot: TextOverlaySnapshot | ShapeOverlaySnapshot) {
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
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
  };
}

function validStroke(stroke: string | null, strokeWidth: number): boolean {
  return Number.isFinite(strokeWidth) && strokeWidth >= 0 && strokeWidth <= 50
    && (stroke !== null || strokeWidth === 0);
}

export function createFabricOverlay(snapshot: TextOverlaySnapshot | ShapeOverlaySnapshot): FabricObject {
  const common = overlayOptions(snapshot);
  if (snapshot.role === 'text') {
    if (!snapshot.text || !snapshot.fontFamily || !Number.isFinite(snapshot.width) || snapshot.width <= 0
      || !Number.isFinite(snapshot.fontSize) || snapshot.fontSize < 1 || !snapshot.fill) {
      throw new TypeError('Invalid text overlay.');
    }
    return new Textbox(snapshot.text, {
      ...common,
      left: snapshot.left,
      top: snapshot.top,
      width: snapshot.width,
      fontFamily: snapshot.fontFamily,
      fontSize: snapshot.fontSize,
      fill: snapshot.fill,
    });
  }

  if (!validStroke(snapshot.stroke, snapshot.strokeWidth)) throw new TypeError('Invalid shape stroke.');
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
    || (snapshot.left === snapshot.x2 && snapshot.top === snapshot.y2)
    || snapshot.strokeWidth <= 0 || !snapshot.stroke) throw new TypeError('Invalid line overlay.');
  return new Line([snapshot.left, snapshot.top, snapshot.x2, snapshot.y2], {
    ...common,
    stroke: snapshot.stroke,
    strokeWidth: snapshot.strokeWidth,
    fill: null,
  });
}

export function createFabricOverlays(scene: readonly SceneObjectSnapshot[]): FabricObject[] {
  const overlays = scene.filter((item): item is TextOverlaySnapshot | ShapeOverlaySnapshot => item.role !== 'source-image');
  if (overlays.length > MAX_OVERLAYS) throw new RangeError('A document cannot contain more than 50 overlays.');
  return overlays.map(createFabricOverlay);
}
