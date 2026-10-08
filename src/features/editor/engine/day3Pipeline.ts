import {
  FabricImage,
  FabricText,
  StaticCanvas,
  util,
  type ImageSource,
  type TMat2D,
} from 'fabric';
import { decodeWithFabricUrl } from './imageImport';

export const DAY3_MAX_PROXY_EDGE = 2048;

const MAX_DOCUMENT_EDGE = 8192;
const MAX_DOCUMENT_PIXELS = 12_000_000;
const IDENTITY: TMat2D = [1, 0, 0, 1, 0, 0];

export type Day3Asset = {
  id: string;
  blob: Blob;
  mime: string;
  width: number;
  height: number;
};

export type Day3Snapshot = {
  schemaVersion: 1;
  document: { width: number; height: number; sourceAssetId: string };
  // Maps source-image document coordinates to the current document coordinates.
  documentTransform: TMat2D;
  overlay: {
    id: string;
    text: string;
    left: number;
    top: number;
    fontSize: number;
  };
};

export type Day3Preview = {
  canvas: HTMLCanvasElement;
  proxyWidth: number;
  proxyHeight: number;
  dispose(): Promise<void>;
};

export function createDay3Snapshot(sourceAssetId: string, width: number, height: number): Day3Snapshot {
  return {
    schemaVersion: 1,
    document: { width, height, sourceAssetId },
    documentTransform: [...IDENTITY],
    overlay: { id: 'day3-label', text: 'Day 3 spike', left: 2000, top: 700, fontSize: 64 },
  };
}

export function cropDay3Document(
  snapshot: Day3Snapshot,
  crop: { x: number; y: number; width: number; height: number },
): Day3Snapshot {
  const { x, y, width, height } = crop;
  if (![x, y, width, height].every(Number.isSafeInteger)
    || x < 0 || y < 0 || width < 1 || height < 1
    || x + width > snapshot.document.width || y + height > snapshot.document.height) {
    throw new RangeError('Crop must be an integer rectangle inside the current document.');
  }

  return {
    ...snapshot,
    document: { ...snapshot.document, width, height },
    documentTransform: util.multiplyTransformMatrices(
      [1, 0, 0, 1, -x, -y],
      snapshot.documentTransform,
    ),
  };
}

export function resizeDay3Document(snapshot: Day3Snapshot, width: number): Day3Snapshot {
  if (!Number.isSafeInteger(width) || width < 1) {
    throw new RangeError('Resize width must be a positive integer.');
  }
  if (width === snapshot.document.width) return snapshot;

  const scale = width / snapshot.document.width;
  const height = Math.round(snapshot.document.height * scale);
  assertDocumentSize(width, height);

  return {
    ...snapshot,
    document: { ...snapshot.document, width, height },
    documentTransform: util.multiplyTransformMatrices(
      [scale, 0, 0, scale, 0, 0],
      snapshot.documentTransform,
    ),
  };
}

export function rotateDay3DocumentClockwise(snapshot: Day3Snapshot): Day3Snapshot {
  const { width, height } = snapshot.document;
  return {
    ...snapshot,
    document: { ...snapshot.document, width: height, height: width },
    // x' = height - y, y' = x
    documentTransform: util.multiplyTransformMatrices(
      [0, 1, -1, 0, height, 0],
      snapshot.documentTransform,
    ),
  };
}

export function transformDay3Point(snapshot: Day3Snapshot, x: number, y: number): [number, number] {
  const [a, b, c, d, e, f] = snapshot.documentTransform;
  return [a * x + c * y + e, b * x + d * y + f];
}

function assertDocumentSize(width: number, height: number): void {
  if (width < 1 || height < 1 || width > MAX_DOCUMENT_EDGE || height > MAX_DOCUMENT_EDGE
    || width * height > MAX_DOCUMENT_PIXELS) {
    throw new RangeError('Document dimensions exceed the Day 3 spike limits.');
  }
}

function validateSnapshot(asset: Day3Asset, snapshot: Day3Snapshot): void {
  if (snapshot.schemaVersion !== 1 || snapshot.document.sourceAssetId !== asset.id
    || snapshot.document.width < 1 || snapshot.document.height < 1
    || snapshot.document.width > MAX_DOCUMENT_EDGE || snapshot.document.height > MAX_DOCUMENT_EDGE
    || snapshot.document.width * snapshot.document.height > MAX_DOCUMENT_PIXELS
    || snapshot.documentTransform.length !== 6
    || !snapshot.documentTransform.every(Number.isFinite)
    || !Number.isFinite(snapshot.overlay.left) || !Number.isFinite(snapshot.overlay.top)
    || !Number.isFinite(snapshot.overlay.fontSize) || snapshot.overlay.fontSize < 1) {
    throw new Error('The Day 3 snapshot is invalid or refers to a different source asset.');
  }
}

async function decodeAsset(asset: Day3Asset) {
  const file = new File([asset.blob], 'day3-source.png', { type: asset.mime });
  const decoded = await decodeWithFabricUrl(file);
  if (decoded.width !== asset.width || decoded.height !== asset.height) {
    decoded.dispose();
    throw new Error('Decoded source dimensions do not match the saved asset metadata.');
  }
  return decoded;
}

function makeProxy(source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, DAY3_MAX_PROXY_EDGE / Math.max(width, height));
  const proxy = document.createElement('canvas');
  proxy.width = Math.max(1, Math.round(width * scale));
  proxy.height = Math.max(1, Math.round(height * scale));
  const context = proxy.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable.');
  context.drawImage(source, 0, 0, proxy.width, proxy.height);
  return proxy;
}

function createSceneCanvas(snapshot: Day3Snapshot): StaticCanvas {
  assertDocumentSize(snapshot.document.width, snapshot.document.height);
  return new StaticCanvas(document.createElement('canvas'), {
    width: snapshot.document.width,
    height: snapshot.document.height,
    backgroundColor: 'transparent',
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
}

function addScene(
  canvas: StaticCanvas,
  imageSource: ImageSource,
  sourceWidth: number,
  sourceHeight: number,
  snapshot: Day3Snapshot,
): void {
  const image = new FabricImage(imageSource, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: sourceWidth / (imageSource as HTMLCanvasElement).width,
    scaleY: sourceHeight / (imageSource as HTMLCanvasElement).height,
  });
  const text = new FabricText(snapshot.overlay.text, {
    left: snapshot.overlay.left,
    top: snapshot.overlay.top,
    originX: 'center',
    originY: 'center',
    fontFamily: 'Arial',
    fontSize: snapshot.overlay.fontSize,
    fill: '#ffffff',
    stroke: '#111827',
    strokeWidth: 2,
  });

  for (const object of [image, text]) {
    util.applyTransformToObject(
      object,
      util.multiplyTransformMatrices(snapshot.documentTransform, object.calcTransformMatrix()),
    );
  }
  canvas.add(image, text);
}

export async function renderDay3Preview(asset: Day3Asset, snapshot: Day3Snapshot): Promise<Day3Preview> {
  validateSnapshot(asset, snapshot);
  const decoded = await decodeAsset(asset);
  let proxy: HTMLCanvasElement | undefined;
  let renderer: StaticCanvas | undefined;
  try {
    proxy = makeProxy(decoded.image.getElement(), decoded.width, decoded.height);
    renderer = createSceneCanvas(snapshot);
    addScene(renderer, proxy, decoded.width, decoded.height, snapshot);
    renderer.renderAll();
    const activeRenderer = renderer;
    const activeProxy = proxy;
    let disposed = false;
    return {
      canvas: activeRenderer.lowerCanvasEl,
      proxyWidth: activeProxy.width,
      proxyHeight: activeProxy.height,
      async dispose() {
        if (disposed) return;
        disposed = true;
        await activeRenderer.dispose();
        activeProxy.width = 0;
        activeProxy.height = 0;
      },
    };
  } catch (error) {
    if (renderer) await renderer.dispose();
    if (proxy) {
      proxy.width = 0;
      proxy.height = 0;
    }
    throw error;
  } finally {
    decoded.dispose();
  }
}

export async function exportDay3Png(asset: Day3Asset, snapshot: Day3Snapshot): Promise<Blob> {
  validateSnapshot(asset, snapshot);
  const decoded = await decodeAsset(asset);
  const renderer = createSceneCanvas(snapshot);
  try {
    addScene(renderer, decoded.image.getElement(), decoded.width, decoded.height, snapshot);
    renderer.renderAll();
    const blob = await renderer.toBlob({ format: 'png', multiplier: 1 });
    if (!blob || blob.type !== 'image/png') throw new Error('PNG export did not return an image/png Blob.');
    return blob;
  } finally {
    await renderer.dispose();
    decoded.dispose();
  }
}
