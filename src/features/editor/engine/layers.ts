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

export function deleteOverlayLayer(snapshot: EditorSnapshot, id: string): EditorSnapshot {
  const layer = snapshot.scene.find((item) => item.id === id);
  if (!layer || layer.role === 'source-image') return snapshot;
  return { ...snapshot, scene: snapshot.scene.filter((item) => item.id !== id) };
}
