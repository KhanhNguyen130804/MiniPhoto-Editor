import { util, type FabricObject, type TMat2D } from 'fabric';
import { validateCropRect, type CropRatio, type CropRect } from './crop';
import type { EditorSnapshot } from './snapshot';

export type GeometryCommand = 'rotate-left' | 'rotate-right' | 'flip-horizontal' | 'flip-vertical';

export function cropDocument(snapshot: EditorSnapshot, rect: CropRect, ratio: CropRatio): EditorSnapshot {
  const validation = validateCropRect(rect, snapshot.document, ratio);
  if (validation) throw new RangeError(`Invalid crop: ${validation}.`);
  if (rect.x === 0 && rect.y === 0
    && rect.width === snapshot.document.width && rect.height === snapshot.document.height) return snapshot;

  return {
    ...snapshot,
    document: { ...snapshot.document, width: rect.width, height: rect.height },
    documentTransform: util.multiplyTransformMatrices(
      [1, 0, 0, 1, -rect.x, -rect.y],
      snapshot.documentTransform,
    ),
  };
}

export function transformDocument(snapshot: EditorSnapshot, command: GeometryCommand): EditorSnapshot {
  const { width, height } = snapshot.document;
  let transform: TMat2D;
  let nextWidth = width;
  let nextHeight = height;

  switch (command) {
    case 'rotate-left':
      transform = [0, -1, 1, 0, 0, width];
      nextWidth = height;
      nextHeight = width;
      break;
    case 'rotate-right':
      transform = [0, 1, -1, 0, height, 0];
      nextWidth = height;
      nextHeight = width;
      break;
    case 'flip-horizontal':
      transform = [-1, 0, 0, 1, width, 0];
      break;
    case 'flip-vertical':
      transform = [1, 0, 0, -1, 0, height];
      break;
  }

  return {
    ...snapshot,
    document: { ...snapshot.document, width: nextWidth, height: nextHeight },
    documentTransform: util.multiplyTransformMatrices(transform, snapshot.documentTransform),
  };
}

export function transformDocumentPoint(matrix: TMat2D, x: number, y: number): [number, number] {
  const [a, b, c, d, e, f] = matrix;
  return [a * x + c * y + e, b * x + d * y + f];
}

export function applyDocumentTransform(object: FabricObject, matrix: TMat2D): void {
  util.applyTransformToObject(object, util.multiplyTransformMatrices(matrix, object.calcTransformMatrix()));
}
