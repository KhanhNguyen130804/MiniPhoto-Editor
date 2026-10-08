import { Point, Textbox, util } from 'fabric';
import { applyDocumentTransform } from './geometry';
import { createFabricOverlay, MAX_OVERLAYS } from './scene';
import {
  MAX_TEXT_CODE_POINTS,
  normalizeTextContent,
  type EditorSnapshot,
  type TextAlignment,
  type TextFontFamily,
  type TextFontStyle,
  type TextFontWeight,
  type TextOverlaySnapshot,
} from './snapshot';

export const DEFAULT_TEXT_CONTENT = 'Nhập nội dung';
export const DEFAULT_TEXT_FONT_FAMILY = 'Noto Sans';
export const DEFAULT_TEXT_FILL = '#111827';

const TEXT_FONT_SAMPLE = 'Tiếng Việt: Ắ ễ đ ộ a\u0301';
const TEXT_FONT_FAMILIES = new Set<string>([DEFAULT_TEXT_FONT_FAMILY, 'Noto Serif']);
let textFontRetryId = 0;

export type TextProperties = {
  x: number;
  y: number;
  angle: number;
  width: number;
  fontFamily: TextFontFamily;
  fontSize: number;
  fontWeight: TextFontWeight;
  fontStyle: TextFontStyle;
  textAlign: TextAlignment;
  fill: string;
  opacity: number;
};

export type TextPropertiesPatch = Partial<TextProperties>;

function reloadTextFontFaces(fontFamily: string, style: string, weight: number): void {
  const retryId = ++textFontRetryId;
  let matches = 0;
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index];
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style.getPropertyValue('font-family').replace(/^['"]|['"]$/g, '');
      const ruleStyle = rule.style.getPropertyValue('font-style') || 'normal';
      const weightRange = (rule.style.getPropertyValue('font-weight') || '400').split(/\s+/).map(Number);
      if (family !== fontFamily || ruleStyle !== style || weight < weightRange[0]! || weight > (weightRange[1] ?? weightRange[0]!)) continue;
      const source = rule.style.getPropertyValue('src').replace(/url\(([^)]+)\)/g, (_match, rawUrl: string) => {
        const unquoted = rawUrl.trim().replace(/^(['"])(.*)\1$/, '$2');
        const url = new URL(unquoted, document.baseURI);
        if (url.origin !== location.origin) throw new Error('Font assets must stay on this origin.');
        url.searchParams.set('fontRetry', String(retryId));
        return `url("${url.href}")`;
      });
      if (source === rule.style.getPropertyValue('src')) continue;
      rule.style.setProperty('src', source);
      matches += 1;
    }
  }
  if (matches === 0) throw new Error('Không tìm thấy font cục bộ để thử lại.');
}

export async function ensureTextFontReady(
  fontFamily = DEFAULT_TEXT_FONT_FAMILY,
  style: 'normal' | 'italic' = 'normal',
  weight: 400 | 700 = 400,
  retry = false,
): Promise<void> {
  if (!TEXT_FONT_FAMILIES.has(fontFamily) || !('fonts' in document)) {
    throw new Error('Không thể tải font chữ tiếng Việt. Hãy thử lại.');
  }
  try {
    if (retry) reloadTextFontFaces(fontFamily, style, weight);
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
  const faces = [...new Map(snapshot.scene
    .filter((item): item is TextOverlaySnapshot => item.role === 'text')
    .map((item) => [`${item.fontFamily}:${item.fontStyle}:${item.fontWeight}`, item] as const))].map(([, item]) => item);
  await Promise.all(faces.map((item) => ensureTextFontReady(item.fontFamily, item.fontStyle, item.fontWeight)));
}

export function textPropertiesFromObject(object: Textbox): TextProperties {
  return {
    x: object.left,
    y: object.top,
    angle: object.angle,
    width: object.width * Math.abs(object.scaleX),
    fontFamily: object.fontFamily as TextFontFamily,
    fontSize: object.fontSize * Math.abs(object.scaleY),
    fontWeight: object.fontWeight as TextFontWeight,
    fontStyle: object.fontStyle as TextFontStyle,
    textAlign: object.textAlign as TextAlignment,
    fill: object.fill as string,
    opacity: object.opacity,
  };
}

export function validateTextPropertiesPatch(patch: TextPropertiesPatch): void {
  for (const field of ['x', 'y', 'angle'] as const) {
    if (patch[field] !== undefined && !Number.isFinite(patch[field])) throw new RangeError(`Invalid text ${field}.`);
  }
  if (patch.width !== undefined && (!Number.isFinite(patch.width) || patch.width < 1 || patch.width > 8192)) {
    throw new RangeError('Textbox width must be between 1 and 8192 px.');
  }
  if (patch.fontSize !== undefined && (!Number.isFinite(patch.fontSize) || patch.fontSize < 8 || patch.fontSize > 512)) {
    throw new RangeError('Font size must be between 8 and 512 px.');
  }
  if (patch.opacity !== undefined && (!Number.isFinite(patch.opacity) || patch.opacity < 0 || patch.opacity > 1)) {
    throw new RangeError('Text opacity must be between 0 and 100%.');
  }
  if (patch.fontFamily !== undefined && !TEXT_FONT_FAMILIES.has(patch.fontFamily)) {
    throw new RangeError('Choose Noto Sans or Noto Serif.');
  }
  if (patch.fontWeight !== undefined && patch.fontWeight !== 400 && patch.fontWeight !== 700) {
    throw new RangeError('Text weight must be regular or bold.');
  }
  if (patch.fontStyle !== undefined && patch.fontStyle !== 'normal' && patch.fontStyle !== 'italic') {
    throw new RangeError('Text style must be normal or italic.');
  }
  if (patch.textAlign !== undefined && !['left', 'center', 'right'].includes(patch.textAlign)) {
    throw new RangeError('Choose left, center, or right alignment.');
  }
  if (patch.fill !== undefined && !/^#[\da-f]{6}$/i.test(patch.fill)) {
    throw new RangeError('Text color must be a six-digit hex color.');
  }
}

export function applyTextPropertiesPatch(object: Textbox, patch: TextPropertiesPatch): void {
  validateTextPropertiesPatch(patch);
  const { x, y, width, fontSize, ...style } = patch;
  object.set({
    ...style,
    ...(width === undefined ? {} : { width: width / Math.abs(object.scaleX) }),
    ...(fontSize === undefined ? {} : { fontSize: fontSize / Math.abs(object.scaleY) }),
    ...(x === undefined ? {} : { left: x }),
    ...(y === undefined ? {} : { top: y }),
  });
  object.initDimensions();
  object.setCoords();
}

export function restoreTextObject(snapshot: EditorSnapshot, object: Textbox, baseline: TextOverlaySnapshot): void {
  const restored = createFabricOverlay(baseline, true) as Textbox;
  applyDocumentTransform(restored, snapshot.documentTransform);
  object.set({
    text: baseline.text,
    width: baseline.width,
    fontFamily: baseline.fontFamily,
    fontSize: baseline.fontSize,
    fontWeight: baseline.fontWeight,
    fontStyle: baseline.fontStyle,
    textAlign: baseline.textAlign,
    fill: baseline.fill,
    opacity: baseline.opacity,
    visible: baseline.visible,
  });
  object.initDimensions();
  object.set({
    left: restored.left,
    top: restored.top,
    scaleX: restored.scaleX,
    scaleY: restored.scaleY,
    angle: restored.angle,
    flipX: restored.flipX,
    flipY: restored.flipY,
  });
  restored.dispose();
  object.setCoords();
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
    fontWeight: 400,
    fontStyle: 'normal',
    textAlign: 'left',
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
  const normalized = {
    ...baseline,
    text,
    width: object.width,
    fontFamily: object.fontFamily as TextFontFamily,
    fontSize: object.fontSize,
    fontWeight: object.fontWeight as TextFontWeight,
    fontStyle: object.fontStyle as TextFontStyle,
    textAlign: object.textAlign as TextAlignment,
    fill: object.fill as string,
  };
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
