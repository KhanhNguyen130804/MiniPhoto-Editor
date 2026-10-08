import { getLayerList } from './engine/layers';
import type { EditorSnapshot } from './engine/snapshot';

type LayersPanelProps = {
  snapshot: EditorSnapshot;
  selectedId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
  onVisibilityChange: (id: string, visible: boolean) => void;
  onDelete: (id: string) => void;
};

function layerIcon(role: 'source-image' | 'text' | 'shape', name: string): string {
  if (role === 'source-image') return '▧';
  if (role === 'text') return 'T';
  if (name.startsWith('Hình tròn')) return '○';
  if (name.startsWith('Đường thẳng')) return '╱';
  return '□';
}

export default function LayersPanel({
  snapshot,
  selectedId,
  disabled,
  onSelect,
  onVisibilityChange,
  onDelete,
}: LayersPanelProps) {
  const layers = getLayerList(snapshot);
  const overlayCount = layers.filter((layer) => layer.role !== 'source-image').length;

  return (
    <section className="layers-panel" aria-labelledby="layers-panel-title">
      <div className="layers-panel__intro">
        <strong id="layers-panel-title">Các lớp</strong>
        <span>{overlayCount} lớp phủ</span>
      </div>
      <ul className="layers-list">
        {layers.map((layer) => {
          const isBackground = layer.role === 'source-image';
          const isSelected = !isBackground && layer.id === selectedId;
          return (
            <li className={`layer-row${isSelected ? ' layer-row--selected' : ''}${isBackground ? ' layer-row--background' : ''}`} key={layer.id}>
              <button
                className="layer-row__select"
                type="button"
                disabled={disabled || isBackground}
                aria-pressed={isSelected}
                aria-label={isBackground ? 'Ảnh nền, cố định ở dưới cùng' : layer.role === 'text' ? `Chọn chữ: ${layer.name}` : `Chọn ${layer.name}`}
                onClick={() => onSelect(layer.id)}
              >
                <span className="layer-row__icon" aria-hidden="true">{layerIcon(layer.role, layer.name)}</span>
                <span className="layer-row__name" title={layer.name}>{layer.name}</span>
              </button>
              <button
                className="layer-row__action"
                type="button"
                disabled={disabled}
                aria-label={`${layer.visible ? 'Ẩn' : 'Hiện'} ${layer.name}`}
                title={`${layer.visible ? 'Ẩn' : 'Hiện'} ${layer.name}`}
                onClick={() => onVisibilityChange(layer.id, !layer.visible)}
              >
                <span aria-hidden="true">{layer.visible ? '◉' : '○'}</span>
              </button>
              {isBackground ? (
                <span className="layer-row__fixed" title="Ảnh nền luôn nằm dưới cùng" aria-label="Ảnh nền cố định">⌑</span>
              ) : (
                <button
                  className="layer-row__action layer-row__delete"
                  type="button"
                  disabled={disabled}
                  aria-label={`Xóa ${layer.name}`}
                  title={`Xóa ${layer.name}`}
                  onClick={() => onDelete(layer.id)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
