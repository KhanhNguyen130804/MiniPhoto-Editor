import type { ColorTransferController } from './useColorTransfer';

export default function ColorTransferControls({ color, disabled, blackAndWhite, onOriginal }: {
  color: ColorTransferController;
  disabled: boolean;
  blackAndWhite: boolean;
  onOriginal: () => void;
}) {
  return (
    <section className="color-transfer-controls" aria-labelledby="color-transfer-title">
      <h3 id="color-transfer-title">Màu từ ảnh mẫu</h3>
      <p>Lấy tông màu tổng thể của ảnh mẫu, sau đó tinh chỉnh bằng preset và các thanh màu.</p>
      <input ref={color.inputRef} type="file" hidden multiple={false}
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" aria-label="Chọn ảnh mẫu màu"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          void color.loadFiles(files);
        }} />
      {color.reference && <figure className="color-transfer-reference">
        <img src={color.reference.url} alt="Ảnh mẫu tông màu" />
        <figcaption title={color.reference.filename}>{color.reference.filename}</figcaption>
      </figure>}
      {!color.reference && color.displayed && <p>Đang áp dụng màu từ ảnh mẫu.</p>}
      <button className="button button-secondary" type="button" disabled={disabled} onClick={color.choose}>
        {color.displayed || color.reference ? 'Thay ảnh mẫu' : 'Chọn ảnh mẫu'}
      </button>
      <div className="color-transfer-strength">
        <label htmlFor="color-transfer-strength">Độ mạnh (%)</label>
        <input id="color-transfer-strength" type="number" min="0" max="100" step="1"
          value={color.strengthInput} disabled={disabled || color.analyzing || !color.displayed}
          aria-invalid={Boolean(color.strengthError)} aria-describedby={color.strengthError ? 'color-transfer-strength-error' : undefined}
          onChange={(event) => color.changeStrength(event.currentTarget.value)} />
        <input type="range" min="0" max="100" step="1" aria-label="Độ mạnh màu mẫu"
          value={color.displayed?.strength ?? 70} disabled={disabled || color.analyzing || !color.displayed}
          onChange={(event) => color.changeStrength(event.currentTarget.value)} />
      </div>
      {color.strengthError && <p id="color-transfer-strength-error" role="alert">{color.strengthError}</p>}
      {color.analyzing && <p role="status">Đang phân tích ảnh mẫu…</p>}
      {color.pending && <p role="status">{color.strengthError ? 'Sửa Độ mạnh để tiếp tục.'
        : color.canApply ? 'Đang xem thử, chưa áp dụng.' : 'Đang chuẩn bị bản xem thử…'} Rời Editor sẽ bỏ phần xem thử.</p>}
      {color.error && <p className="color-transfer-error" role="alert">{color.error}</p>}
      {blackAndWhite && color.displayed && <p>Preset B&amp;W đang làm ảnh đơn sắc. <button type="button" className="text-action"
        disabled={disabled || color.active} onClick={onOriginal}>Chọn Original</button> để xem tông màu mẫu.</p>}
      <div className="color-transfer-actions">
        <button className="button button-primary" type="button" onClick={() => color.apply()} disabled={disabled || !color.canApply}>Áp dụng</button>
        <button className="button button-secondary" type="button" onClick={color.cancel} disabled={disabled || !color.active}>Hủy xem thử</button>
        <button className="text-action" type="button" onClick={color.clear} disabled={disabled || color.active || !color.displayed}>Xóa màu mẫu</button>
      </div>
    </section>
  );
}

export function ColorTransferDecisionDialog({ color }: { color: ColorTransferController }) {
  return <dialog ref={color.dialogRef} className="replace-dialog" aria-labelledby="color-transfer-decision-title"
    onCancel={(event) => { event.preventDefault(); color.resolveAction('stay'); }}>
    <h2 id="color-transfer-decision-title">Áp dụng màu mẫu trước khi tiếp tục?</h2>
    <p>Phần xem thử chưa được lưu vào ảnh đang chỉnh.</p>
    <div className="color-transfer-actions">
      <button className="button button-primary" type="button" disabled={!color.canApply} onClick={() => color.resolveAction('apply')}>Áp dụng</button>
      <button className="button button-secondary" type="button" onClick={() => color.resolveAction('discard')}>Bỏ xem thử</button>
      <button className="text-action" type="button" autoFocus onClick={() => color.resolveAction('stay')}>Tiếp tục chỉnh</button>
    </div>
  </dialog>;
}
