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

export type EditorSnapshot = {
  readonly schemaVersion: 1;
  readonly document: {
    readonly width: number;
    readonly height: number;
    readonly sourceAssetId: string;
  };
  readonly imageAppearance: {
    readonly presetId: string;
    readonly presetVersion: number;
    readonly brightness: number;
    readonly contrast: number;
    readonly saturation: number;
  };
  readonly scene: readonly SourceImageSnapshot[];
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
