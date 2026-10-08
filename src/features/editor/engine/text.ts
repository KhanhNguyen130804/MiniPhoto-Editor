import { Point, Textbox, util } from 'fabric';
import { createFabricOverlay, MAX_OVERLAYS } from './scene';
import {
  MAX_TEXT_CODE_POINTS,
  normalizeTextContent,
  type EditorSnapshot,
  type TextOverlaySnapshot,
} from './snapshot';

export const DEFAULT_TEXT_CONTENT = 'Nhập nội dung';
export const DEFAULT_TEXT_FONT_FAMILY = 'Noto Sans';
export const DEFAULT_TEXT_FILL = '#111827';

const TEXT_FONT_SAMPLE = 'Tiếng Việt: Ắ ễ đ ộ a\u0301';
const TEXT_FONT_FAMILIES = new Set([DEFAULT_TEXT_FONT_FAMILY, 'Noto Serif']);

export async function ensureTextFontReady(
  fontFamily = DEFAULT_TEXT_FONT_FAMILY,
  style: 'normal' | 'italic' = 'normal',
  weight: 400 | 700 = 400,
): Promise<void> {
  if (!TEXT_FONT_FAMILIES.has(fontFamily) || !('fonts' in document)) {
    throw new Error('Không thể tải font chữ tiếng Việt. Hãy thử lại.');
  }
  try {
    const description = `${style} ${weight} 16px "${fontFamily}"`;
    const [vietnameseFaces, sampleFaces] = await Promise.all([
      document.fonts.load(description, 'a\u0301'),
      document.fonts.load(description, TEXT_FONT_SAMPLE),
    ]);
    const loadedVietnameseFaces = vietnameseFaces.filter(
      (font) => font.family.replace(/["']/g, '') === fontFamily && font.status === 'loaded',
    );
    if (loadedVietnameseFaces.length < 2
      || !sampleFaces.some((font) => font.family.replace(/["']/g, '') === fontFamily && font.status === 'loaded')) {
      throw new Error('Font chưa sẵn sàng.');
    }
  } catch {
    throw new Error(`Không tải được ${fontFamily}. Hãy thử lại trước khi thêm hoặc xuất chữ.`);
  }
}

export async function ensureSnapshotTextFonts(snapshot: EditorSnapshot): Promise<void> {
  const families = [...new Set(snapshot.scene
    .filter((item): item is TextOverlaySnapshot => item.role === 'text')
    .map((item) => item.fontFamily))];
  await Promise.all(families.map((family) => ensureTextFontReady(family)));
}

function defaultFontSize(snapshot: EditorSnapshot): number {
  return Math.min(512, Math.max(8, Math.round(Math.min(snapshot.document.width, snapshot.document.height) * 0.06)));
}

export function createDefaultTextObject(snapshot: EditorSnapshot, id: string): {
  object: Textbox;
  overlay: TextOverlaySnapshot;
} {
  if (snapshot.scene.filter((item) => item.role !== 'source-image').length >= MAX_OVERLAYS) {
    throw new RangeError('Bạn chỉ có thể thêm tối đa 50 lớp chữ và hình.');
  }
  const overlay: TextOverlaySnapshot = {
    id,
    role: 'text',
    text: DEFAULT_TEXT_CONTENT,
    width: snapshot.document.width * 0.8,
    fontFamily: DEFAULT_TEXT_FONT_FAMILY,
    fontSize: defaultFontSize(snapshot),
    fill: DEFAULT_TEXT_FILL,
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
  const object = createFabricOverlay(overlay, true) as Textbox;
  object.setPositionByOrigin(
    new Point(snapshot.document.width / 2, snapshot.document.height / 2),
    'center',
    'center',
  );
  object.setCoords();
  return { object, overlay: serializeTextObject(snapshot, object, overlay) };
}

export function serializeTextObject(
  snapshot: EditorSnapshot,
  object: Textbox,
  baseline: TextOverlaySnapshot,
): TextOverlaySnapshot {
  const text = normalizeTextContent(object.text);
  const normalized = { ...baseline, text, width: object.width };
  const baseObject = createFabricOverlay(normalized) as Textbox;
  const inverse = util.invertTransform(snapshot.documentTransform);
  util.applyTransformToObject(baseObject, util.multiplyTransformMatrices(inverse, object.calcTransformMatrix()));
  baseObject.setCoords();
  const result: TextOverlaySnapshot = {
    ...normalized,
    left: baseObject.left,
    top: baseObject.top,
    scaleX: baseObject.scaleX,
    scaleY: baseObject.scaleY,
    angle: baseObject.angle,
    flipX: baseObject.flipX,
    flipY: baseObject.flipY,
    visible: object.visible,
    opacity: object.opacity,
  };
  baseObject.dispose();
  return result;
}

export function putTextOverlay(snapshot: EditorSnapshot, overlay: TextOverlaySnapshot): EditorSnapshot {
  const index = snapshot.scene.findIndex((item) => item.id === overlay.id);
  const scene = [...snapshot.scene];
  if (index >= 0) scene[index] = overlay;
  else {
    if (scene.filter((item) => item.role !== 'source-image').length >= MAX_OVERLAYS) {
      throw new RangeError('Bạn chỉ có thể thêm tối đa 50 lớp chữ và hình.');
    }
    scene.push(overlay);
  }
  return { ...snapshot, scene };
}

export function removeTextOverlay(snapshot: EditorSnapshot, id: string): EditorSnapshot {
  const target = snapshot.scene.find((item) => item.id === id);
  if (!target || target.role !== 'text') return snapshot;
  return { ...snapshot, scene: snapshot.scene.filter((item) => item.id !== id) };
}

export { MAX_TEXT_CODE_POINTS, normalizeTextContent };
