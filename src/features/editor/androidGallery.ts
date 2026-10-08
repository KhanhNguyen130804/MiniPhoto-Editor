import { registerPlugin } from '@capacitor/core';

type BeginSaveResult = { saveId: string };
type FinishSaveResult = { uri: string };

type GallerySavePlugin = {
  beginSave(options: { filename: string; mimeType: string; size: number }): Promise<BeginSaveResult>;
  writeChunk(options: { saveId: string; data: string }): Promise<void>;
  finishSave(options: { saveId: string }): Promise<FinishSaveResult>;
  abortSave(options: { saveId: string }): Promise<void>;
};

const GallerySave = registerPlugin<GallerySavePlugin>('GallerySave');
const CHUNK_BYTES = 256 * 1024;

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Không đọc được dữ liệu ảnh.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Không mã hóa được dữ liệu ảnh.'));
        return;
      }
      const comma = result.indexOf(',');
      if (comma < 0) {
        reject(new Error('Dữ liệu ảnh không hợp lệ.'));
        return;
      }
      resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export async function saveImageToGallery(blob: Blob, filename: string): Promise<void> {
  if (blob.size === 0) throw new Error('File ảnh rỗng. Hãy tạo lại bản xuất.');

  const { saveId } = await GallerySave.beginSave({
    filename,
    mimeType: blob.type,
    size: blob.size,
  });

  try {
    for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
      const data = await toBase64(blob.slice(offset, Math.min(offset + CHUNK_BYTES, blob.size)));
      await GallerySave.writeChunk({ saveId, data });
    }
    await GallerySave.finishSave({ saveId });
  } catch (error) {
    try {
      await GallerySave.abortSave({ saveId });
    } catch {
      // Preserve the original save error; the native plugin also cleans up active sessions on teardown.
    }
    throw error;
  }
}
