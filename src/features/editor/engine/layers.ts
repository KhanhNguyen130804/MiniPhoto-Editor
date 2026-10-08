import type { EditorSnapshot, SceneObjectSnapshot } from './snapshot';

export type LayerListItem = {
  id: string;
  role: SceneObjectSnapshot['role'];
  name: string;
  visible: boolean;
};

const shapeNames = {
  rectangle: 'Hình chữ nhật',
  circle: 'Hình tròn',
  line: 'Đường thẳng',
} as const;

export function getLayerList(snapshot: EditorSnapshot): LayerListItem[] {
  const counts = new Map<string, number>();
  const overlays = snapshot.scene.filter((item) => item.role !== 'source-image').map((item) => {
    if (item.role === 'text') {
      const content = Array.from(item.text.replace(/\s+/g, ' ').trim()).slice(0, 32).join('');
      return { id: item.id, role: item.role, name: content || 'Chữ trống', visible: item.visible };
    }

    const prefix = shapeNames[item.shape];
    const number = (counts.get(prefix) ?? 0) + 1;
    counts.set(prefix, number);
    return { id: item.id, role: item.role, name: `${prefix} ${number}`, visible: item.visible };
  }).reverse();
  const source = snapshot.scene.find((item) => item.role === 'source-image');
  return source
    ? [...overlays, { id: source.id, role: source.role, name: 'Ảnh nền', visible: source.visible }]
    : overlays;
}

export function setLayerVisibility(snapshot: EditorSnapshot, id: string, visible: boolean): EditorSnapshot {
  const layer = snapshot.scene.find((item) => item.id === id);
  if (!layer || layer.visible === visible) return snapshot;
  return {
    ...snapshot,
    scene: snapshot.scene.map((item) => item.id === id ? { ...item, visible } : item),
  };
}

export function reorderOverlayLayer(snapshot: EditorSnapshot, id: string, direction: 'up' | 'down'): EditorSnapshot {
  const index = snapshot.scene.findIndex((item) => item.id === id);
  if (index < 1 || snapshot.scene[index]?.role === 'source-image') return snapshot;
  const target = direction === 'up' ? index + 1 : index - 1;
  if (target < 1 || target >= snapshot.scene.length || snapshot.scene[target]?.role === 'source-image') return snapshot;
  const scene = [...snapshot.scene];
  [scene[index], scene[target]] = [scene[target]!, scene[index]!];
  return { ...snapshot, scene };
}

export function nudgeOverlayLayer(snapshot: EditorSnapshot, id: string, x: number, y: number): EditorSnapshot {
  if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) return snapshot;
  const index = snapshot.scene.findIndex((item) => item.id === id && item.role !== 'source-image');
  const layer = snapshot.scene[index];
  if (index < 1 || !layer) return snapshot;

  const [a, b, c, d] = snapshot.documentTransform;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || determinant === 0) return snapshot;
  const left = layer.left + (d * x - c * y) / determinant;
  const top = layer.top + (-b * x + a * y) / determinant;
  if (!Number.isFinite(left) || !Number.isFinite(top)) return snapshot;

  return {
    ...snapshot,
    scene: snapshot.scene.map((item, sceneIndex) => sceneIndex === index ? { ...layer, left, top } : item),
  };
}

export function deleteOverlayLayer(snapshot: EditorSnapshot, id: string): EditorSnapshot {
  const layer = snapshot.scene.find((item) => item.id === id);
  if (!layer || layer.role === 'source-image') return snapshot;
  return { ...snapshot, scene: snapshot.scene.filter((item) => item.id !== id) };
}
