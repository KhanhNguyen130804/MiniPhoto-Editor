import { useEffect, useState } from 'react';
import type { ImageImportCandidate } from './engine/imageImport';
import { CURRENT_PRESET_VERSION, PRESET_OPTIONS } from './engine/adjustmentFilters';
import { renderPresetThumbnails } from './engine/presetThumbnails';
import type { EditorSnapshot, PresetId } from './engine/snapshot';

type PresetControlsProps = {
  candidate: ImageImportCandidate;
  snapshot: EditorSnapshot;
  disabled: boolean;
  onSelect: (presetId: PresetId) => void;
};

export default function PresetControls({ candidate, snapshot, disabled, onSelect }: PresetControlsProps) {
  const [thumbnails, setThumbnails] = useState<Partial<Record<PresetId, string>>>({});
  const [thumbnailError, setThumbnailError] = useState(false);

  useEffect(() => {
    let active = true;
    const frame = requestAnimationFrame(() => {
      void renderPresetThumbnails(candidate, snapshot).then((next) => {
        if (active) {
          setThumbnails(next);
          setThumbnailError(false);
        }
      }).catch(() => {
        if (active) {
          setThumbnails({});
          setThumbnailError(true);
        }
      });
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [candidate, snapshot]);

  return (
    <section className="filter-controls" aria-labelledby="filter-controls-title">
      <div className="filter-controls__intro">
        <strong id="filter-controls-title">Bộ lọc màu</strong>
        <p>Preset áp dụng trước các thanh tinh chỉnh. Có thể đổi lại bất cứ lúc nào.</p>
      </div>
      <div className="preset-grid" aria-label="Chọn preset màu">
        {PRESET_OPTIONS.map(({ id, label }) => (
          <button
            className={`preset-card${snapshot.imageAppearance.presetId === id
              && snapshot.imageAppearance.presetVersion === CURRENT_PRESET_VERSION ? ' preset-card--selected' : ''}`}
            key={id}
            type="button"
            aria-pressed={snapshot.imageAppearance.presetId === id
              && snapshot.imageAppearance.presetVersion === CURRENT_PRESET_VERSION}
            disabled={disabled}
            onClick={() => onSelect(id)}
          >
            {thumbnails[id]
              ? <img className="preset-card__thumbnail" src={thumbnails[id]} alt="" />
              : <span className="preset-card__thumbnail preset-card__thumbnail--empty" aria-hidden="true" />}
            <span className="preset-card__label">{label}</span>
          </button>
        ))}
      </div>
      {thumbnailError && <p className="filter-controls__error" role="status">Chưa tạo được thumbnail; bạn vẫn có thể chọn preset.</p>}
    </section>
  );
}
