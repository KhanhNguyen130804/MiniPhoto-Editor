import type { TMat2D } from 'fabric';

export const MAX_TEXT_CODE_POINTS = 2000;

export function normalizeTextContent(value: string): string {
  return Array.from(value.replace(/\r\n?/g, '\n'))
    .slice(0, MAX_TEXT_CODE_POINTS)
    .join('');
}

export type SourceImageSnapshot = {
  readonly id: string;
  readonly role: 'source-image';
  readonly assetId: string;
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly angle: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
  readonly visible: boolean;
  readonly opacity: number;
};

type OverlayTransformSnapshot = {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly angle: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
  readonly visible: boolean;
  readonly opacity: number;
};

export type TextOverlaySnapshot = OverlayTransformSnapshot & {
  readonly role: 'text';
  readonly text: string;
  readonly width: number;
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fill: string;
};

export type ShapeOverlaySnapshot = OverlayTransformSnapshot & (
  | {
    readonly role: 'shape';
    readonly shape: 'rectangle';
    readonly width: number;
    readonly height: number;
    readonly fill: string | null;
    readonly stroke: string | null;
    readonly strokeWidth: number;
  }
  | {
    readonly role: 'shape';
    readonly shape: 'circle';
    readonly radius: number;
    readonly fill: string | null;
    readonly stroke: string | null;
    readonly strokeWidth: number;
  }
  | {
    readonly role: 'shape';
    readonly shape: 'line';
    readonly x2: number;
    readonly y2: number;
    readonly stroke: string;
    readonly strokeWidth: number;
  }
);

export type SceneObjectSnapshot = SourceImageSnapshot | TextOverlaySnapshot | ShapeOverlaySnapshot;

export type PresetId = 'original' | 'warm' | 'cool' | 'vintage' | 'bw' | 'fade' | 'vivid' | 'film' | 'sepia' | 'dramatic';

export type ImageAppearanceSnapshot = {
  readonly presetId: PresetId;
  readonly presetVersion: number;
  readonly brightness: number;
  readonly contrast: number;
  readonly saturation: number;
};

export type EditorSnapshot = {
  readonly schemaVersion: 1;
  readonly document: {
    readonly width: number;
    readonly height: number;
    readonly sourceAssetId: string;
  };
  /** Maps baseline scene coordinates into the current document coordinates. */
  readonly documentTransform: TMat2D;
  readonly imageAppearance: ImageAppearanceSnapshot;
  readonly scene: readonly SceneObjectSnapshot[];
};

export function createImageBaselineSnapshot(
  sourceAssetId: string,
  width: number,
  height: number,
): EditorSnapshot {
  if (typeof sourceAssetId !== 'string' || !sourceAssetId
    || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new TypeError('Invalid source image baseline.');
  }

  return {
    schemaVersion: 1,
    document: { width, height, sourceAssetId },
    documentTransform: [1, 0, 0, 1, 0, 0],
    imageAppearance: {
      presetId: 'original',
      presetVersion: 1,
      brightness: 0,
      contrast: 0,
      saturation: 0,
    },
    scene: [{
      id: sourceAssetId,
      role: 'source-image',
      assetId: sourceAssetId,
      width,
      height,
      left: 0,
      top: 0,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      flipX: false,
      flipY: false,
      visible: true,
      opacity: 1,
    }],
  };
}
