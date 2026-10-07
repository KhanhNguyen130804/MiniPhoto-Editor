import { FabricImage } from 'fabric';

export type ImageImportCandidate = {
  source: File;
  image: FabricImage;
  width: number;
  height: number;
  dispose(): void;
};

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
  }
}

function candidate(source: File, image: FabricImage, release = () => {}): ImageImportCandidate {
  const { width, height } = image.getOriginalSize();
  let disposed = false;

  return {
    source,
    image,
    width,
    height,
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        image.dispose();
      } finally {
        release();
      }
    },
  };
}

export async function decodeWithFabricUrl(
  file: File,
  signal?: AbortSignal,
): Promise<ImageImportCandidate> {
  throwIfAborted(signal);
  const url = URL.createObjectURL(file);
  let image: FabricImage | undefined;

  try {
    image = await FabricImage.fromURL(url, { signal });
    throwIfAborted(signal);
    return candidate(file, image);
  } catch (error) {
    image?.dispose();
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function decodeWithImageBitmap(
  file: File,
  signal?: AbortSignal,
): Promise<ImageImportCandidate> {
  throwIfAborted(signal);
  // ponytail: createImageBitmap cannot be aborted mid-decode; discard and close its result if cancelled.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  let canvas: HTMLCanvasElement | undefined;

  try {
    throwIfAborted(signal);
    canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context is unavailable.');
    context.drawImage(bitmap, 0, 0);
    return candidate(file, new FabricImage(canvas), () => {
      canvas!.width = 0;
      canvas!.height = 0;
    });
  } catch (error) {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    throw error;
  } finally {
    bitmap.close();
  }
}
