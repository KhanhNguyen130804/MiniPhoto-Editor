import { useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from 'react';
import type { FabricImage } from 'fabric';
import EditorCanvas from './features/editor/EditorCanvas';
import {
  canRedo,
  canUndo,
  commitHistory,
  createHistory,
  currentSnapshot,
  redoHistory,
  undoHistory,
  type HistoryState,
} from './features/editor/engine/history';
import {
  decodeWithFabricUrl,
  ImageImportError,
  MAX_IMAGE_EDGE,
  MAX_IMAGE_PIXELS,
  validateImageFile,
  type ImageImportCandidate,
} from './features/editor/engine/imageImport';
import { createImageBaselineSnapshot, type EditorSnapshot } from './features/editor/engine/snapshot';
import { cropDocument as cropEditorDocument, transformDocument as transformEditorDocument, type GeometryCommand } from './features/editor/engine/geometry';
import { calculateResize, type ResizeAxis, type ResizeDimensions, type ResizeError } from './features/editor/engine/resize';
import { exportImage, type ExportFormat } from './features/editor/engine/exportImage';
import {
  createCropRect,
  CROP_RATIOS,
  validateCropRect,
  type CropRatio,
  type CropRect,
  type CropValidationError,
} from './features/editor/engine/crop';

type PreviewState = 'empty' | 'loading' | 'error';
type Route = 'home' | 'editor' | 'privacy' | 'not-found';
type ImportStatus = { phase: 'idle' | 'loading' } | { phase: 'error'; message: string };
type PendingCrop = { ratio: CropRatio; rect: CropRect };
type CropFields = Record<keyof CropRect, string>;
type PendingResize = {
  base: ResizeDimensions;
  fields: Record<ResizeAxis, string>;
  dimensions: ResizeDimensions;
  scale: number;
  error: { field: ResizeAxis; code: ResizeError } | null;
  prepared: ResizeDimensions | null;
};

const idleImportStatus: ImportStatus = { phase: 'idle' };

function cropFields(rect: CropRect): CropFields {
  return {
    x: String(rect.x),
    y: String(rect.y),
    width: String(rect.width),
    height: String(rect.height),
  };
}

function cropValidationMessage(error: CropValidationError): string {
  switch (error) {
    case 'invalid-document': return 'Kích thước tài liệu không hợp lệ.';
    case 'invalid-number': return 'X, Y, Rộng và Cao phải là số nguyên.';
    case 'outside-bounds': return 'Khung cắt phải nằm trong tài liệu và rộng/cao ít nhất 1 px.';
    case 'invalid-ratio': return 'Rộng và Cao phải giữ đúng tỷ lệ đã chọn.';
  }
}

function resizeValidationMessage(error: ResizeError): string {
  switch (error) {
    case 'invalid-document': return 'Kích thước tài liệu hiện tại không hợp lệ.';
    case 'required': return 'Trường này không được để trống.';
    case 'integer': return 'Nhập số nguyên hữu hạn.';
    case 'positive': return 'Kích thước phải ít nhất 1 px.';
    case 'edge-limit': return `Mỗi cạnh phải từ 1 đến ${MAX_IMAGE_EDGE.toLocaleString('vi-VN')} px.`;
    case 'pixel-limit': return `Tổng kích thước không được vượt ${MAX_IMAGE_PIXELS / 1_000_000} MP.`;
  }
}

function makeExportBasename(sourceName: string): string {
  const basename = sourceName.replace(/\.[^./\\]+$/, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim();
  return `${basename || 'miniphoto'}-edited`.slice(0, 100);
}

function exportFilename(basename: string, format: ExportFormat): string {
  const safe = basename
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\.(?:png|jpe?g)$/i, '')
    .trim()
    .slice(0, 100) || 'miniphoto-edited';
  return `${safe}.${format === 'jpeg' ? 'jpg' : 'png'}`;
}

function importErrorMessage(error: unknown): string {
  if (!(error instanceof ImageImportError)) return 'Không đọc được ảnh này. Hãy chọn ảnh khác hoặc chuyển định dạng.';
  switch (error.code) {
    case 'EMPTY_FILE': return 'Tệp ảnh đang rỗng. Hãy chọn một tệp khác.';
    case 'FILE_TOO_LARGE': return 'Ảnh vượt giới hạn 20 MiB. Hãy giảm dung lượng trước khi mở.';
    case 'UNSUPPORTED_FORMAT': return 'Hỗ trợ JPG, PNG và WebP tĩnh. Hãy chọn đúng định dạng ảnh.';
    case 'ANIMATED_IMAGE': return 'Phiên bản này chưa hỗ trợ ảnh động. Hãy chọn hoặc chuyển sang ảnh tĩnh.';
    case 'IMAGE_TOO_LARGE': return 'Ảnh vượt giới hạn 12 MP hoặc cạnh 8192 px. Hãy giảm kích thước trước.';
    case 'DECODE_FAILED': return 'Không đọc được ảnh này. Hãy chọn ảnh khác hoặc chuyển định dạng.';
  }
}

function currentRoute(): Route {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/') return 'home';
  if (pathname === '/editor') return 'editor';
  if (pathname === '/privacy') return 'privacy';
  return 'not-found';
}

function previewState(): PreviewState {
  if (!import.meta.env.DEV) return 'empty';
  const state = new URLSearchParams(window.location.search).get('preview');
  return state === 'loading' || state === 'error' ? state : 'empty';
}

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <a className={`brand${dark ? ' brand--dark' : ''}`} href="/" aria-label="MiniPhoto Editor — trang chủ">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      <span>MiniPhoto<span className="brand-light"> Editor</span></span>
    </a>
  );
}

function HelpDialogTrigger({ dark = false }: { dark?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        className={`text-action${dark ? ' text-action--dark' : ''}`}
        type="button"
        onClick={() => dialog.current?.showModal()}
      >
        Trợ giúp
      </button>
      <dialog className="help-dialog" ref={dialog} aria-labelledby="help-dialog-title" aria-describedby="help-dialog-copy">
        <form method="dialog" className="dialog-close-row">
          <button className="dialog-close" type="submit" aria-label="Đóng hộp thoại">×</button>
        </form>
        <p className="eyebrow">MINIPHOTO EDITOR</p>
        <h2 id="help-dialog-title">Bắt đầu thật đơn giản</h2>
        <p id="help-dialog-copy">
          Bạn có thể mở một ảnh JPG, PNG hoặc WebP tĩnh, xoay/lật và tải ảnh xuống. Các công cụ chỉnh sửa khác và lưu bản nháp sẽ được bổ sung sau.
        </p>
        <div className="dialog-note">
          <strong>Cần trợ giúp ngay?</strong>
          <span>Hãy quay lại trang chủ hoặc xem thông tin quyền riêng tư.</span>
        </div>
        <a className="button button-secondary dialog-link" href="/privacy">Xem quyền riêng tư</a>
      </dialog>
    </>
  );
}

function HomeHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Brand />
        <nav className="site-nav" aria-label="Điều hướng chính">
          <HelpDialogTrigger />
          <a className="text-action" href="/privacy">Quyền riêng tư</a>
        </nav>
      </div>
    </header>
  );
}

function UploadGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" fill="none">
      <path d="M24 31V8m0 0-8 8m8-8 8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 28v9a3 3 0 0 0 3 3h22a3 3 0 0 0 3-3v-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function HomeImportState({
  state,
  status,
  hasDocument,
  fileName,
  onChoose,
  buttonRef,
}: {
  state: PreviewState;
  status: ImportStatus;
  hasDocument: boolean;
  fileName?: string;
  onChoose: (event: MouseEvent<HTMLButtonElement>) => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  if (status.phase === 'loading' || state === 'loading') {
    return (
      <div className="import-state" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <strong>Đang chuẩn bị ảnh</strong>
        <span>Đang đọc ảnh trên thiết bị…</span>
      </div>
    );
  }

  if (status.phase === 'error' || state === 'error') {
    return (
      <div className="import-state import-state--error" role="alert">
        <span className="state-icon state-icon--error" aria-hidden="true">!</span>
        <strong>Không thể mở ảnh này</strong>
        <span>
          {status.phase === 'error' ? status.message : 'Hãy thử JPG, PNG hoặc WebP tĩnh.'}
          {hasDocument && ' Ảnh hiện tại vẫn được giữ.'}
        </span>
        <button className="text-action" type="button" onClick={onChoose}>Chọn ảnh khác</button>
      </div>
    );
  }

  return (
    <div className="import-empty">
      <span className="upload-glyph"><UploadGlyph /></span>
      <strong>{hasDocument ? 'Ảnh hiện tại vẫn được giữ trong phiên này' : 'Kéo ảnh vào đây'}</strong>
      {hasDocument && fileName && <span className="import-current-name" title={fileName}>{fileName}</span>}
      <span className="import-or">hoặc</span>
      <button className="button button-primary" type="button" onClick={onChoose} ref={buttonRef}>
        {hasDocument ? 'Thay ảnh' : 'Chọn ảnh'}
      </button>
      <span className="format-hint">JPG · PNG · WebP tĩnh</span>
    </div>
  );
}

function HomePage({
  state,
  status,
  hasDocument,
  fileName,
  onChoose,
  onImportFiles,
}: {
  state: PreviewState;
  status: ImportStatus;
  hasDocument: boolean;
  fileName?: string;
  onChoose: (event: MouseEvent<HTMLButtonElement>) => void;
  onImportFiles: (files: File[], focusTarget: HTMLButtonElement | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const chooseButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="home-page">
      <HomeHeader />
      <main className="home-main">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> BỘ CÔNG CỤ ẢNH GỌN NHẸ</p>
            <h1 id="home-title">Chỉnh ảnh đẹp,<br /><span>theo cách của bạn.</span></h1>
            <p className="hero-lede">Cắt ảnh, tinh chỉnh màu sắc và thêm dấu ấn riêng — trong một không gian đơn giản, dễ dùng.</p>
            <ul className="feature-list" aria-label="Công cụ dự kiến">
              <li><span aria-hidden="true">✓</span> Cắt &amp; đổi kích thước</li>
              <li><span aria-hidden="true">✓</span> Chỉnh màu</li>
              <li><span aria-hidden="true">✓</span> Thêm chữ</li>
            </ul>
            <p className="build-note">Ảnh được đọc trong trình duyệt. Bạn có thể xoay/lật và tải ảnh; các công cụ khác và lưu bản nháp sẽ được bổ sung sau.</p>
          </div>

          <section className={`import-card${state === 'error' || status.phase === 'error' ? ' import-card--error' : ''}`} aria-labelledby="import-title">
            <div className="import-card__heading">
              <span className="card-step">01</span>
              <div>
                <p className="eyebrow">BẮT ĐẦU TẠI ĐÂY</p>
                <h2 id="import-title">Một bức ảnh là đủ</h2>
              </div>
            </div>
            <div
              className={`import-dropzone${dragOver ? ' import-dropzone--active' : ''}`}
              onDragOver={(event) => {
                if (!Array.from(event.dataTransfer.types).includes('Files')) return;
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                onImportFiles(Array.from(event.dataTransfer.files), chooseButtonRef.current);
              }}
            >
              <HomeImportState
                state={state}
                status={status}
                hasDocument={hasDocument}
                fileName={fileName}
                onChoose={onChoose}
                buttonRef={chooseButtonRef}
              />
            </div>
            <div className="import-card__footer">
              <span className="privacy-mark" aria-hidden="true">◈</span>
              <p>Ảnh không được tải lên máy chủ để mở. <a href="/privacy">Tìm hiểu về quyền riêng tư</a>.</p>
            </div>
          </section>
        </section>

        <section className="home-bottom" aria-label="Thông tin ứng dụng">
          <span>Không cần tài khoản</span>
          <span className="bottom-divider" aria-hidden="true" />
          <span>Giao diện dành cho máy tính và điện thoại</span>
        </section>
      </main>
    </div>
  );
}

function EditorStatus({ status }: { status: ImportStatus }) {
  if (status.phase === 'loading') {
    return <div className="canvas-feedback" role="status" aria-live="polite">Đang mở ảnh mới… Ảnh hiện tại vẫn được giữ.</div>;
  }
  if (status.phase === 'error') {
    return <div className="canvas-feedback canvas-feedback--error" role="alert">{status.message} Ảnh hiện tại vẫn được giữ.</div>;
  }
  return null;
}

function EditorPage({
  candidate,
  snapshot,
  status,
  undoEnabled,
  redoEnabled,
  onUndo,
  onRedo,
  onTransform,
  onApplyCrop,
  onChoose,
  replaceButtonRef,
  detachImageRef,
}: {
  candidate: ImageImportCandidate;
  snapshot: EditorSnapshot;
  status: ImportStatus;
  undoEnabled: boolean;
  redoEnabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onTransform: (command: GeometryCommand) => void;
  onApplyCrop: (snapshot: EditorSnapshot) => void;
  onChoose: (event: MouseEvent<HTMLButtonElement>) => void;
  replaceButtonRef: RefObject<HTMLButtonElement | null>;
  detachImageRef: { current: ((image: FabricImage) => void) | null };
}) {
  const tools = ['Cắt', 'Kích thước', 'Điều chỉnh', 'Bộ lọc', 'Chữ', 'Hình khối'];
  const [panelOpen, setPanelOpen] = useState(false);
  const exportDialogRef = useRef<HTMLDialogElement>(null);
  const exportUrlRef = useRef<string | null>(null);
  const exportGenerationRef = useRef(0);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportQuality, setExportQuality] = useState(90);
  const [exportBackground, setExportBackground] = useState('#ffffff');
  const [exportNameBase, setExportNameBase] = useState(() => makeExportBasename(candidate.source.name));
  const [exportBytes, setExportBytes] = useState(0);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [cropPending, setCropPending] = useState<PendingCrop | null>(null);
  const [cropInput, setCropInput] = useState<CropFields | null>(null);
  const [cropError, setCropError] = useState('');
  const [resizePending, setResizePending] = useState<PendingResize | null>(null);

  const startCrop = () => {
    if (cropPending || resizePending || exportBusy || status.phase === 'loading') return;
    const rect = createCropRect(snapshot.document, 'free');
    if (!rect) return;
    setCropPending({ ratio: 'free', rect });
    setCropInput(cropFields(rect));
    setCropError('');
  };

  const cancelCrop = () => {
    setCropPending(null);
    setCropInput(null);
    setCropError('');
  };

  const startResize = () => {
    if (cropPending || resizePending || exportBusy || status.phase === 'loading') return;
    const base = { width: snapshot.document.width, height: snapshot.document.height };
    setResizePending({
      base,
      fields: { width: String(base.width), height: String(base.height) },
      dimensions: base,
      scale: 1,
      error: null,
      prepared: null,
    });
    setPanelOpen(true);
  };

  const cancelResize = () => setResizePending(null);

  const updateResizeField = (field: ResizeAxis, value: string) => {
    if (!resizePending) return;
    const result = calculateResize(resizePending.base, field, value);
    if (!result.valid) {
      setResizePending({
        ...resizePending,
        fields: { ...resizePending.fields, [field]: value },
        error: { field, code: result.error },
        prepared: null,
      });
      return;
    }
    setResizePending({
      ...resizePending,
      fields: {
        width: String(result.dimensions.width),
        height: String(result.dimensions.height),
      },
      dimensions: result.dimensions,
      scale: result.scale,
      error: null,
      prepared: null,
    });
  };

  const applyResize = () => {
    if (!resizePending || resizePending.error) return;
    setResizePending({ ...resizePending, prepared: resizePending.dimensions });
  };

  const chooseCropRatio = (ratio: CropRatio) => {
    const rect = createCropRect(snapshot.document, ratio);
    if (!rect) return;
    setCropPending({ ratio, rect });
    setCropInput(cropFields(rect));
    setCropError('');
  };

  const updateCropRect = (rect: CropRect) => {
    setCropPending((current) => current ? { ...current, rect } : current);
    setCropInput(cropFields(rect));
    setCropError('');
  };

  const updateCropField = (field: keyof CropRect, value: string) => {
    if (!cropPending) return;
    const fields = { ...(cropInput ?? cropFields(cropPending.rect)), [field]: value };
    setCropInput(fields);
    if (Object.values(fields).some((part) => part.trim() === '')) {
      setCropError('X, Y, Rộng và Cao phải là số nguyên.');
      return;
    }
    const rect = {
      x: Number(fields.x),
      y: Number(fields.y),
      width: Number(fields.width),
      height: Number(fields.height),
    };
    const validation = validateCropRect(rect, snapshot.document, cropPending.ratio);
    if (validation) {
      setCropError(cropValidationMessage(validation));
      return;
    }
    setCropPending({ ...cropPending, rect });
    setCropInput(cropFields(rect));
    setCropError('');
  };

  const applyCrop = () => {
    if (!cropPending || cropError) return;
    const validation = validateCropRect(cropPending.rect, snapshot.document, cropPending.ratio);
    if (validation) {
      setCropError(cropValidationMessage(validation));
      return;
    }
    try {
      onApplyCrop(cropEditorDocument(snapshot, cropPending.rect, cropPending.ratio));
      cancelCrop();
    } catch {
      setCropError('Không thể áp dụng khung cắt. Hãy kiểm tra lại các giá trị.');
    }
  };

  useEffect(() => {
    if (!cropPending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      cancelCrop();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cropPending]);

  useEffect(() => {
    if (!resizePending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      cancelResize();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resizePending]);

  const clearDownload = () => {
    if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
    exportUrlRef.current = null;
    setDownloadUrl(null);
    setExportBytes(0);
  };

  useEffect(() => {
    setExportNameBase(makeExportBasename(candidate.source.name));
    setExportError('');
    clearDownload();
  }, [candidate.assetId]);

  useEffect(() => () => {
    exportGenerationRef.current += 1;
    if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
    exportUrlRef.current = null;
  }, []);

  const generateExport = async () => {
    if (exportBusy || cropPending || resizePending) return;
    clearDownload();
    setExportError('');
    setExportBusy(true);
    const generation = ++exportGenerationRef.current;
    try {
      const blob = await exportImage(candidate, snapshot, {
        format: exportFormat,
        quality: exportQuality,
        backgroundColor: exportBackground,
      });
      if (generation !== exportGenerationRef.current) return;
      const url = URL.createObjectURL(blob);
      exportUrlRef.current = url;
      setDownloadUrl(url);
      setExportBytes(blob.size);
    } catch (error) {
      if (generation === exportGenerationRef.current) {
        setExportError(error instanceof Error ? error.message : 'Không thể tạo file ảnh. Hãy thử lại.');
      }
    } finally {
      if (generation === exportGenerationRef.current) setExportBusy(false);
    }
  };

  const closeExportDialog = () => {
    if (exportBusy) return;
    clearDownload();
    setExportError('');
  };

  const activeTool = cropPending ? 'Cắt' : resizePending ? 'Kích thước' : null;
  const documentActionLocked = exportBusy || Boolean(cropPending || resizePending);

  return (
    <div className="editor-shell">
      <header className="editor-topbar">
        <div className="editor-topbar__start">
          <a className="back-link" href="/" aria-label="Về trang chủ">←</a>
          <Brand dark />
          <span className="editor-divider" aria-hidden="true" />
          <span className="document-name" title={candidate.source.name}>{candidate.source.name}</span>
        </div>
        <div className="editor-topbar__actions">
          <button className="editor-quiet-button" type="button" onClick={onUndo} disabled={!undoEnabled || documentActionLocked}>Hoàn tác</button>
          <button className="editor-quiet-button" type="button" onClick={onRedo} disabled={!redoEnabled || documentActionLocked}>Làm lại</button>
          <button className="editor-quiet-button" type="button" onClick={onChoose} ref={replaceButtonRef} disabled={status.phase === 'loading' || documentActionLocked}>
            Thay ảnh
          </button>
          <button
            className="button button-primary editor-export"
            type="button"
            disabled={documentActionLocked}
            onClick={() => {
              setExportError('');
              exportDialogRef.current?.showModal();
            }}
          >
            Xuất ảnh
          </button>
          <button
            className="editor-properties-toggle"
            type="button"
            aria-expanded={panelOpen}
            aria-controls="editor-properties-panel"
            onClick={() => setPanelOpen((open) => !open)}
          >
            Thuộc tính
          </button>
          <HelpDialogTrigger dark />
        </div>
      </header>

      <div className="editor-layout">
        <aside className="tool-rail" aria-label="Công cụ chỉnh sửa">
          {tools.map((tool, index) => (
            <button
              className={`tool-item${activeTool === tool ? ' tool-item--active' : ''}`}
              type="button"
              key={tool}
              disabled={(!['Cắt', 'Kích thước'].includes(tool)) || exportBusy || status.phase === 'loading' || Boolean(activeTool && activeTool !== tool)}
              aria-pressed={['Cắt', 'Kích thước'].includes(tool) ? activeTool === tool : undefined}
              onClick={tool === 'Cắt'
                ? (cropPending ? cancelCrop : startCrop)
                : tool === 'Kích thước' ? (resizePending ? cancelResize : startResize) : undefined}
            >
              <span className="tool-item__icon" aria-hidden="true">{['⌗', '↔', '◐', '✧', 'T', '◇'][index]}</span>
              <span>{tool}</span>
            </button>
          ))}
        </aside>

        <main className="workspace" aria-label="Vùng làm việc">
          <EditorCanvas
            image={candidate.image}
            snapshot={snapshot}
            detachImageRef={detachImageRef}
            onTransform={onTransform}
            documentActionsDisabled={documentActionLocked}
            crop={cropPending}
            onCropChange={updateCropRect}
          >
            <EditorStatus status={status} />
          </EditorCanvas>
        </main>

        <aside
          id="editor-properties-panel"
          className={`properties-panel${panelOpen ? ' properties-panel--open' : ''}`}
          aria-labelledby="properties-title"
        >
          <div className="properties-panel__heading">
            <h2 id="properties-title">Thuộc tính</h2>
            <span>{activeTool ?? '—'}</span>
          </div>
          {cropPending ? (
            <section className="crop-controls" aria-labelledby="crop-controls-title">
              <div>
                <strong id="crop-controls-title">Khung cắt đang chờ</strong>
                <p>Nhấn Áp dụng để crop tài liệu, hoặc Escape/Hủy cắt để bỏ khung đang chờ.</p>
              </div>
              <label className="crop-ratio-field">
                Tỷ lệ
                <select
                  value={cropPending.ratio}
                  onChange={(event) => chooseCropRatio(event.currentTarget.value as CropRatio)}
                >
                  {CROP_RATIOS.map((option) => {
                    const available = createCropRect(snapshot.document, option.id) !== null;
                    return (
                      <option key={option.id} value={option.id} disabled={!available}>
                        {option.label}{available ? '' : ' — ảnh không đủ kích thước'}
                      </option>
                    );
                  })}
                </select>
              </label>
              <div className="crop-number-grid" aria-label="Vị trí và kích thước khung cắt">
                {([
                  ['x', 'X (px)'], ['y', 'Y (px)'],
                  ['width', 'Rộng (px)'], ['height', 'Cao (px)'],
                ] as const).map(([field, label]) => (
                  <label className="crop-number-field" key={field}>
                    {label}
                    <input
                      type="number"
                      step="1"
                      min={field === 'x' || field === 'y' ? 0 : 1}
                      max={field === 'x' || field === 'width' ? snapshot.document.width : snapshot.document.height}
                      value={(cropInput ?? cropFields(cropPending.rect))[field]}
                      aria-invalid={cropError ? true : undefined}
                      aria-describedby={cropError ? 'crop-validation-error' : undefined}
                      onChange={(event) => updateCropField(field, event.currentTarget.value)}
                    />
                  </label>
                ))}
              </div>
              {cropError && <p id="crop-validation-error" className="crop-validation-error" role="alert">{cropError}</p>}
              <div className="crop-actions">
                <button className="button button-primary" type="button" onClick={applyCrop} disabled={Boolean(cropError)}>
                  Áp dụng
                </button>
                <button className="button button-secondary" type="button" onClick={cancelCrop}>Hủy cắt</button>
              </div>
            </section>
          ) : resizePending ? (
            <section className="crop-controls" aria-labelledby="resize-controls-title">
              <div>
                <strong id="resize-controls-title">Đổi kích thước</strong>
                <p>Tỷ lệ đang khóa theo tài liệu khi mở công cụ. Sửa một cạnh để tự tính cạnh còn lại.</p>
              </div>
              <div className="crop-number-grid" aria-label="Kích thước tài liệu mới">
                {([
                  ['width', 'Rộng (px)'], ['height', 'Cao (px)'],
                ] as const).map(([field, label]) => (
                  <label className="crop-number-field" key={field}>
                    {label}
                    <input
                      type="text"
                      inputMode="decimal"
                      value={resizePending.fields[field]}
                      aria-invalid={resizePending.error?.field === field || undefined}
                      aria-describedby={resizePending.error?.field === field ? `resize-${field}-error` : undefined}
                      onChange={(event) => updateResizeField(field, event.currentTarget.value)}
                    />
                    {resizePending.error?.field === field && (
                      <span id={`resize-${field}-error`} className="crop-validation-error" role="alert">
                        {resizeValidationMessage(resizePending.error.code)}
                      </span>
                    )}
                  </label>
                ))}
              </div>
              {!resizePending.error && resizePending.scale > 1 && (
                <p className="resize-upscale-warning" role="status">Phóng lớn không tạo thêm chi tiết ảnh.</p>
              )}
              {resizePending.prepared && (
                <p className="resize-prepared" role="status" aria-live="polite">
                  {resizePending.prepared.width === resizePending.base.width
                    && resizePending.prepared.height === resizePending.base.height
                    ? 'Kích thước không đổi; tài liệu và lịch sử được giữ nguyên.'
                    : `Đã chuẩn bị ${resizePending.prepared.width} × ${resizePending.prepared.height} px. Canvas, tài liệu và lịch sử chưa thay đổi; áp dụng resize sẽ nối ở Day 12.`}
                </p>
              )}
              <div className="crop-actions">
                <button className="button button-primary" type="button" onClick={applyResize} disabled={Boolean(resizePending.error)}>
                  Áp dụng
                </button>
                <button className="button button-secondary" type="button" onClick={cancelResize}>Hủy resize</button>
              </div>
            </section>
          ) : (
            <div className="properties-empty">
              <span className="properties-empty__icon" aria-hidden="true">◇</span>
              <strong>Công cụ chưa khả dụng</strong>
              <p>Ảnh đã mở; các thao tác chỉnh sửa sẽ được bổ sung ở những ngày tiếp theo.</p>
            </div>
          )}
          <div className="properties-note">
            <span className="properties-note__dot" aria-hidden="true" />
            <p>{cropPending
              ? 'Khung cắt chỉ tồn tại trong phiên đang mở và không làm thay đổi lịch sử.'
              : resizePending ? 'Kích thước chỉ được ghi nhận tạm; tài liệu và lịch sử chưa đổi.'
                : 'Ảnh gốc và các bước chỉnh sửa sẽ được quản lý riêng biệt.'}</p>
          </div>
        </aside>
      </div>

      <footer className="editor-statusbar">
        <span>{snapshot.document.width} × {snapshot.document.height} px</span>
        <a href="/privacy">Quyền riêng tư</a>
      </footer>

      <dialog
        ref={exportDialogRef}
        className="export-dialog"
        aria-labelledby="export-dialog-title"
        onCancel={(event) => {
          if (exportBusy) event.preventDefault();
        }}
        onClose={closeExportDialog}
      >
        <form method="dialog" className="dialog-close-row">
          <button className="dialog-close" type="submit" aria-label="Đóng hộp thoại xuất ảnh" disabled={exportBusy}>×</button>
        </form>
        <p className="eyebrow">TẢI ẢNH VỀ THIẾT BỊ</p>
        <h2 id="export-dialog-title">Xuất ảnh</h2>
        <form
          className="export-form"
          onSubmit={(event) => {
            event.preventDefault();
            void generateExport();
          }}
        >
          <label>
            Tên file
            <span className="export-filename-field">
              <input
                value={exportNameBase}
                maxLength={100}
                disabled={exportBusy}
                onChange={(event) => {
                  setExportNameBase(event.currentTarget.value);
                  clearDownload();
                }}
              />
              <span>.{exportFormat === 'jpeg' ? 'jpg' : 'png'}</span>
            </span>
          </label>
          <label>
            Định dạng
            <select
              value={exportFormat}
              disabled={exportBusy}
              onChange={(event) => {
                setExportFormat(event.currentTarget.value as ExportFormat);
                clearDownload();
              }}
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPG</option>
            </select>
          </label>
          {exportFormat === 'jpeg' && (
            <>
              <label>
                Chất lượng JPG: {exportQuality}
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={exportQuality}
                  disabled={exportBusy}
                  onChange={(event) => {
                    setExportQuality(Number(event.currentTarget.value));
                    clearDownload();
                  }}
                />
              </label>
              <label className="export-color-field">
                Nền JPG
                <input
                  type="color"
                  value={exportBackground}
                  disabled={exportBusy}
                  onChange={(event) => {
                    setExportBackground(event.currentTarget.value);
                    clearDownload();
                  }}
                />
              </label>
            </>
          )}
          <p className="export-resolution">Kích thước: {snapshot.document.width} × {snapshot.document.height} px</p>
          <button className="button button-primary" type="submit" disabled={exportBusy}>
            {exportBusy ? 'Đang tạo file…' : 'Tạo file'}
          </button>
        </form>
        {exportBusy && <p className="export-status" role="status" aria-live="polite">Đang render ảnh ở kích thước tài liệu…</p>}
        {exportError && <p className="export-error" role="alert">{exportError}</p>}
        {downloadUrl && (
          <div className="export-ready" role="status">
            <span>File đã sẵn sàng ({exportBytes.toLocaleString('vi-VN')} byte)</span>
            <a className="button button-primary" href={downloadUrl} download={exportFilename(exportNameBase, exportFormat)}>
              Tải ảnh xuống
            </a>
          </div>
        )}
      </dialog>
    </div>
  );
}

function PrivacyPage() {
  return (
    <div className="content-page">
      <header className="site-header">
        <div className="site-header__inner">
          <Brand />
          <a className="text-action" href="/">← Trang chủ</a>
        </div>
      </header>
      <main className="content-main">
        <p className="eyebrow"><span className="eyebrow-dot" /> THÔNG TIN ỨNG DỤNG</p>
        <h1>Quyền riêng tư</h1>
        <p className="content-lede">Thông tin dưới đây phản ánh đúng cách bản dựng hiện tại xử lý ảnh.</p>

        <section className="content-card" aria-labelledby="privacy-now-title">
          <h2 id="privacy-now-title">Hiện trạng bản dựng</h2>
          <p>Ảnh được đọc, giải mã và xuất ngay trong trình duyệt trên thiết bị; bản dựng không tải ảnh lên máy chủ và chưa lưu bản nháp. Khi tải lại hoặc đóng trang, ảnh đang mở sẽ không được giữ lại.</p>
        </section>
        <section className="content-card" aria-labelledby="privacy-later-title">
          <h2 id="privacy-later-title">Các tính năng chưa có</h2>
          <p>Lưu bản nháp chưa được triển khai. File chỉ được tạo khi bạn chủ động xuất; có thể xóa file đã tải xuống bằng công cụ quản lý tệp của thiết bị.</p>
        </section>
        <a className="button button-secondary" href="/">Quay lại trang chủ</a>
      </main>
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className="not-found-page">
      <p className="eyebrow">404 · KHÔNG TÌM THẤY</p>
      <h1>Trang này chưa tồn tại.</h1>
      <p>Kiểm tra lại địa chỉ hoặc quay về trang chủ.</p>
      <a className="button button-primary" href="/">Về trang chủ</a>
    </main>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute);
  const state = previewState();
  const [candidate, setCandidate] = useState<ImageImportCandidate | null>(null);
  const [editorHistory, setEditorHistory] = useState<HistoryState<EditorSnapshot> | null>(null);
  const [pendingCandidate, setPendingCandidate] = useState<ImageImportCandidate | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>(idleImportStatus);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const editorReplaceButtonRef = useRef<HTMLButtonElement>(null);
  const activeCandidateRef = useRef<ImageImportCandidate | null>(null);
  const pendingCandidateRef = useRef<ImageImportCandidate | null>(null);
  const importControllerRef = useRef<AbortController | null>(null);
  const importGenerationRef = useRef(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const detachImageRef = useRef<((image: FabricImage) => void) | null>(null);
  const routeRef = useRef(route);
  routeRef.current = route;
  const editorSnapshot = useMemo(
    () => editorHistory ? currentSnapshot(editorHistory) : null,
    [editorHistory],
  );

  const navigateTo = (path: string, replace = false) => {
    if (replace) window.history.replaceState({}, '', path);
    else if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setRoute(currentRoute());
  };

  const transformDocument = (command: GeometryCommand) => {
    setEditorHistory((current) => current
      ? commitHistory(current, transformEditorDocument(currentSnapshot(current), command))
      : current);
  };

  const applyCrop = (snapshot: EditorSnapshot) => {
    setEditorHistory((current) => current ? commitHistory(current, snapshot) : current);
  };

  const cancelInFlightImport = () => {
    const controller = importControllerRef.current;
    if (!controller) return;
    importControllerRef.current = null;
    importGenerationRef.current += 1;
    controller.abort();
    setImportStatus(idleImportStatus);
  };

  const focusAfterDialog = () => {
    const target = returnFocusRef.current;
    if (target?.isConnected) target.focus();
    returnFocusRef.current = null;
  };

  const cancelPendingReplacement = () => {
    const pending = pendingCandidateRef.current;
    if (!pending) return;
    pendingCandidateRef.current = null;
    pending.dispose();
    setPendingCandidate(null);
    if (dialogRef.current?.open) dialogRef.current.close();
    focusAfterDialog();
  };

  const activateCandidate = (next: ImageImportCandidate) => {
    const nextHistory = createHistory(createImageBaselineSnapshot(next.assetId, next.width, next.height));
    const previous = activeCandidateRef.current;
    if (previous && previous !== next) {
      detachImageRef.current?.(previous.image);
    }
    activeCandidateRef.current = next;
    setCandidate(next);
    setEditorHistory(nextHistory);
    previous?.dispose();
  };

  const importFiles = async (files: File[], focusTarget?: HTMLElement | null) => {
    if (focusTarget) returnFocusRef.current = focusTarget;
    if (importControllerRef.current || pendingCandidateRef.current) return;
    if (!files.length) return;
    if (files.length !== 1) {
      setImportStatus({ phase: 'error', message: 'Vui lòng chọn hoặc thả đúng một ảnh mỗi lần.' });
      return;
    }

    const file = files[0];
    const controller = new AbortController();
    const generation = ++importGenerationRef.current;
    importControllerRef.current = controller;
    setImportStatus({ phase: 'loading' });
    let decoded: ImageImportCandidate | undefined;

    try {
      await validateImageFile(file, controller.signal);
      decoded = await decodeWithFabricUrl(file, controller.signal);
      if (generation !== importGenerationRef.current || controller.signal.aborted) {
        decoded.dispose();
        return;
      }
      if (decoded.width < 1 || decoded.height < 1) throw new ImageImportError('DECODE_FAILED');
      if (decoded.width > MAX_IMAGE_EDGE || decoded.height > MAX_IMAGE_EDGE
        || decoded.width * decoded.height > MAX_IMAGE_PIXELS) {
        throw new ImageImportError('IMAGE_TOO_LARGE');
      }

      const next = decoded;
      if (activeCandidateRef.current) {
        pendingCandidateRef.current = next;
        setPendingCandidate(next);
        decoded = undefined;
      } else {
        activateCandidate(next);
        decoded = undefined;
        navigateTo('/editor');
      }
      setImportStatus(idleImportStatus);
    } catch (error) {
      decoded?.dispose();
      if (generation !== importGenerationRef.current || controller.signal.aborted) return;
      setImportStatus({ phase: 'error', message: importErrorMessage(error) });
    } finally {
      if (importControllerRef.current === controller) importControllerRef.current = null;
    }
  };

  const openFilePicker = (event: MouseEvent<HTMLButtonElement>) => {
    if (importControllerRef.current || pendingCandidateRef.current) return;
    returnFocusRef.current = event.currentTarget;
    setImportStatus(idleImportStatus);
    fileInputRef.current?.click();
  };

  const confirmReplacement = () => {
    const next = pendingCandidateRef.current;
    if (!next) return;
    pendingCandidateRef.current = null;
    setPendingCandidate(null);
    activateCandidate(next);
    setImportStatus(idleImportStatus);
    if (routeRef.current !== 'editor') navigateTo('/editor');
    if (dialogRef.current?.open) dialogRef.current.close();
    focusAfterDialog();
  };

  useEffect(() => {
    if (route === 'editor' && !candidate) {
      window.history.replaceState({}, '', '/');
      setRoute('home');
    }
  }, [route, candidate]);

  const displayRoute = route === 'editor' && !candidate ? 'home' : route;

  useEffect(() => {
    if (displayRoute === 'editor') editorReplaceButtonRef.current?.focus();
  }, [displayRoute]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (pendingCandidate && dialog && !dialog.open) dialog.showModal();
    if (!pendingCandidate && dialog?.open) dialog.close();
  }, [pendingCandidate]);

  useEffect(() => {
    const onClick = (event: globalThis.MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href);
      if (url.origin !== window.location.origin || url.hash) return;
      event.preventDefault();
      const destination = `${url.pathname}${url.search}`;
      if (destination === `${window.location.pathname}${window.location.search}`) return;
      cancelInFlightImport();
      cancelPendingReplacement();
      document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((dialog) => dialog.close());
      window.history.pushState({}, '', destination);
      setRoute(currentRoute());
    };
    const onPopState = () => {
      cancelInFlightImport();
      cancelPendingReplacement();
      document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((dialog) => dialog.close());
      setRoute(currentRoute());
    };
    document.addEventListener('click', onClick);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useEffect(() => () => {
    importGenerationRef.current += 1;
    importControllerRef.current?.abort();
    const pending = pendingCandidateRef.current;
    pendingCandidateRef.current = null;
    pending?.dispose();
    const active = activeCandidateRef.current;
    if (active) {
      detachImageRef.current?.(active.image);
      activeCandidateRef.current = null;
      active.dispose();
    }
  }, []);

  useEffect(() => {
    const displayRoute = route === 'editor' && !candidate ? 'home' : route;
    document.title = {
      home: 'MiniPhoto Editor',
      editor: 'Chỉnh sửa ảnh — MiniPhoto Editor',
      privacy: 'Quyền riêng tư — MiniPhoto Editor',
      'not-found': 'Không tìm thấy — MiniPhoto Editor',
    }[displayRoute];
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      displayRoute === 'editor' ? '#111827' : '#F8FAFC',
    );
  }, [route, candidate]);

  return (
    <>
      {displayRoute === 'home' && (
        <HomePage
          state={state}
          status={importStatus}
          hasDocument={candidate !== null}
          fileName={candidate?.source.name}
          onChoose={openFilePicker}
          onImportFiles={(files, focusTarget) => { void importFiles(files, focusTarget); }}
        />
      )}
      {displayRoute === 'editor' && candidate && editorSnapshot && (
        <EditorPage
          candidate={candidate}
          snapshot={editorSnapshot}
          status={importStatus}
          undoEnabled={editorHistory ? canUndo(editorHistory) : false}
          redoEnabled={editorHistory ? canRedo(editorHistory) : false}
          onUndo={() => setEditorHistory((current) => current ? undoHistory(current) : current)}
          onRedo={() => setEditorHistory((current) => current ? redoHistory(current) : current)}
          onTransform={transformDocument}
          onApplyCrop={applyCrop}
          onChoose={openFilePicker}
          replaceButtonRef={editorReplaceButtonRef}
          detachImageRef={detachImageRef}
        />
      )}
      {displayRoute === 'privacy' && <PrivacyPage />}
      {displayRoute === 'not-found' && <NotFoundPage />}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        multiple={false}
        hidden
        aria-label="Chọn một ảnh"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          void importFiles(files);
        }}
      />
      <dialog
        ref={dialogRef}
        className="replace-dialog"
        aria-labelledby="replace-dialog-title"
        aria-describedby="replace-dialog-copy"
        onCancel={(event) => {
          event.preventDefault();
          cancelPendingReplacement();
        }}
      >
        <p className="eyebrow">THAY ẢNH</p>
        <h2 id="replace-dialog-title">Thay ảnh đang mở?</h2>
        <p id="replace-dialog-copy">
          Ảnh hiện tại “{candidate?.source.name}” sẽ được thay bằng “{pendingCandidate?.source.name}”.
        </p>
        <div className="replace-dialog__actions">
          <button className="button button-secondary" type="button" onClick={cancelPendingReplacement} autoFocus>
            Giữ ảnh hiện tại
          </button>
          <button className="button button-primary" type="button" onClick={confirmReplacement}>
            Thay ảnh
          </button>
        </div>
      </dialog>
    </>
  );
}
