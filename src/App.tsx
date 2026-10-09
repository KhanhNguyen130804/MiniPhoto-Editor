import { useEffect, useMemo, useRef, useState, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type RefObject } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { FabricImage } from 'fabric';
import EditorCanvas, { type EditorCanvasHandle } from './features/editor/EditorCanvas';
import LayersPanel from './features/editor/LayersPanel';
import PresetControls from './features/editor/PresetControls';
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
  decodeSavedImageAsset,
  ImageImportError,
  MAX_IMAGE_EDGE,
  MAX_IMAGE_PIXELS,
  validateImageFile,
  type ImageImportCandidate,
} from './features/editor/engine/imageImport';
import { createImageBaselineSnapshot, MAX_TEXT_CODE_POINTS, normalizeTextContent, type EditorSnapshot, type PresetId } from './features/editor/engine/snapshot';
import { ensureSnapshotTextFonts, ensureTextFontReady, validateTextPropertiesPatch, type TextProperties, type TextPropertiesPatch } from './features/editor/engine/text';
import { DEFAULT_SHAPE_COLOR, validateShapePropertiesPatch, type SelectedShape, type ShapeKind, type ShapePropertiesPatch } from './features/editor/engine/shapes';
import {
  cropDocument as cropEditorDocument,
  resizeDocument as resizeEditorDocument,
  transformDocument as transformEditorDocument,
  type GeometryCommand,
} from './features/editor/engine/geometry';
import { calculateResize, type ResizeAxis, type ResizeDimensions, type ResizeError } from './features/editor/engine/resize';
import { exportImage, probeExportFormat, type ExportFormat } from './features/editor/engine/exportImage';
import { createUuid } from './features/editor/engine/uuid';
import { saveImageToGallery } from './features/editor/androidGallery';
import { createCompareSnapshot, selectImagePreset, type ImageAdjustments } from './features/editor/engine/adjustmentFilters';
import { createDraftAutosave, type DraftAutosaveController, type DraftSaveStatus } from './features/editor/engine/draftAutosave';
import {
  acquireDraftLease,
  DRAFT_LEASE_HEARTBEAT_MS,
  deleteCurrentDraft,
  DraftLeaseError,
  inspectCurrentDraft,
  readDraftLease,
  releaseDraftLease,
  renewDraftLease,
  saveCurrentDraft,
  type CurrentDraftInspection,
  type DraftLeaseRecord,
  type SavedCurrentDraft,
} from './features/editor/engine/draftStore';
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
type TextNumericField = 'x' | 'y' | 'angle' | 'width' | 'fontSize';
type ShapeNumericField = 'strokeWidth';
type PendingCrop = { ratio: CropRatio; rect: CropRect };
type CropFields = Record<keyof CropRect, string>;
type DraftSaveRequest = { candidate: ImageImportCandidate; leaseId: string; snapshot: EditorSnapshot; revision: number };
type PendingResize = {
  base: ResizeDimensions;
  fields: Record<ResizeAxis, string>;
  dimensions: ResizeDimensions;
  scale: number;
  error: { field: ResizeAxis; code: ResizeError } | null;
  applyError: string | null;
};
type AdjustmentField = keyof ImageAdjustments;
type DraftViewState = CurrentDraftInspection | { kind: 'checking' } | { kind: 'error'; reason: string };
type DraftConfirmation = 'replace' | 'discard' | 'source-only' | 'takeover' | null;
type DraftLeaseView =
  | { kind: 'inactive' | 'checking' }
  | { kind: 'owner'; lease: DraftLeaseRecord }
  | { kind: 'held' | 'lost' | 'error'; lease: DraftLeaseRecord | null };

const ANDROID_BACK_EVENT = 'miniphoto:android-back';

function observedLeaseView(lease: DraftLeaseRecord | null): DraftLeaseView {
  return lease && lease.leaseExpiresAt > Date.now()
    ? { kind: 'held', lease }
    : { kind: 'lost', lease };
}

const ADJUSTMENT_FIELDS: readonly AdjustmentField[] = ['brightness', 'contrast', 'saturation'];
const ADJUSTMENT_LABELS: Record<AdjustmentField, string> = {
  brightness: 'Độ sáng',
  contrast: 'Tương phản',
  saturation: 'Bão hòa',
};

function snapshotAdjustments(snapshot: EditorSnapshot): ImageAdjustments {
  const { brightness, contrast, saturation } = snapshot.imageAppearance;
  return { brightness, contrast, saturation };
}

function sameAdjustments(left: ImageAdjustments, right: ImageAdjustments): boolean {
  return ADJUSTMENT_FIELDS.every((field) => left[field] === right[field]);
}

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
    .replace(/\.(?:png|jpe?g|webp)$/i, '')
    .trim()
    .slice(0, 100) || 'miniphoto-edited';
  return `${safe}.${format === 'jpeg' ? 'jpg' : format}`;
}

function defaultExportFormat(
  candidate: ImageImportCandidate,
  snapshot: EditorSnapshot,
  supported: Record<ExportFormat, boolean>,
): ExportFormat {
  const source = snapshot.scene.find((item) => item.role === 'source-image');
  const alphaRisk = (candidate.mimeType ?? candidate.source.type) !== 'image/jpeg' || !source?.visible;
  const preferred: ExportFormat = alphaRisk ? 'png' : 'jpeg';
  return supported[preferred] ? preferred : supported.png ? 'png' : supported.jpeg ? 'jpeg' : 'webp';
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
          Bạn có thể mở ảnh JPG, PNG hoặc WebP tĩnh, cắt, đổi kích thước, xoay/lật, chọn bộ lọc, tinh chỉnh màu, thêm chú thích tiếng Việt, tạo hình khối và tải ảnh xuống. Bản nháp được lưu trên thiết bị; khi mở lại, bạn có thể chọn tiếp tục hoặc bỏ bản nháp.
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
  disabled = false,
}: {
  state: PreviewState;
  status: ImportStatus;
  hasDocument: boolean;
  fileName?: string;
  onChoose: (event: MouseEvent<HTMLButtonElement>) => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
  disabled?: boolean;
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
        <button className="text-action" type="button" onClick={onChoose} disabled={disabled}>Chọn ảnh khác</button>
      </div>
    );
  }

  return (
    <div className="import-empty">
      <span className="upload-glyph"><UploadGlyph /></span>
      <strong>{hasDocument ? 'Ảnh hiện tại vẫn được giữ trong phiên này' : 'Kéo ảnh vào đây'}</strong>
      {hasDocument && fileName && <span className="import-current-name" title={fileName}>{fileName}</span>}
      <span className="import-or">hoặc</span>
      <button className="button button-primary" type="button" onClick={onChoose} ref={buttonRef} disabled={disabled}>
        {hasDocument ? 'Thay ảnh' : 'Chọn ảnh'}
      </button>
      <span className="format-hint">JPG · PNG · WebP tĩnh</span>
    </div>
  );
}

function DraftCard({
  state,
  busy,
  onResume,
  onSourceOnly,
  onDiscard,
  onRetry,
}: {
  state: DraftViewState;
  busy: boolean;
  onResume: () => void;
  onSourceOnly: (event: MouseEvent<HTMLButtonElement>) => void;
  onDiscard: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry: () => void;
}) {
  const saved = state.kind === 'ready' || state.kind === 'source-only' ? state.saved : null;
  const thumbnail = saved?.draft.thumbnail instanceof Blob ? saved.draft.thumbnail : null;
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailUnavailable, setThumbnailUnavailable] = useState(false);

  useEffect(() => {
    if (!thumbnail || !thumbnail.size) {
      setThumbnailUrl(null);
      setThumbnailUnavailable(false);
      return;
    }
    const url = URL.createObjectURL(thumbnail);
    setThumbnailUrl(url);
    setThumbnailUnavailable(false);
    return () => URL.revokeObjectURL(url);
  }, [thumbnail]);

  if (state.kind === 'none') return null;
  if (state.kind === 'checking') {
    return <section className="draft-card draft-card--checking" role="status" aria-live="polite">Đang kiểm tra bản nháp đã lưu trên thiết bị…</section>;
  }
  if (state.kind === 'error') {
    return (
      <section className="draft-card draft-card--warning" aria-labelledby="draft-error-title">
        <div><p className="eyebrow">BẢN NHÁP</p><h2 id="draft-error-title">Chưa kiểm tra được dữ liệu đã lưu</h2><p>{state.reason}</p></div>
        <button className="button button-secondary" type="button" onClick={onRetry}>Thử lại</button>
      </section>
    );
  }

  const recoverable = state.kind === 'ready' || state.kind === 'source-only';
  const title = state.kind === 'ready' ? 'Có bản nháp đã lưu' : state.kind === 'source-only' ? 'Bản nháp cần khôi phục ảnh nguồn' : 'Không thể khôi phục bản nháp';
  const dimensions = state.kind === 'ready' ? state.saved.draft.snapshot.document : saved?.asset;
  const updatedAt = saved && Number.isSafeInteger(saved.draft.updatedAt) && Number.isFinite(new Date(saved.draft.updatedAt).getTime())
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(saved.draft.updatedAt)
    : 'Không rõ thời điểm lưu';

  return (
    <section className={`draft-card${recoverable ? '' : ' draft-card--warning'}`} aria-labelledby="saved-draft-title">
      {saved && thumbnailUrl && !thumbnailUnavailable ? <img className="draft-card__thumbnail" src={thumbnailUrl} alt="Ảnh thu nhỏ của bản nháp" onError={() => setThumbnailUnavailable(true)} />
        : <span className="draft-card__placeholder" aria-hidden="true">◈</span>}
      <div className="draft-card__details">
        <p className="eyebrow">BẢN NHÁP TRÊN THIẾT BỊ</p>
        <h2 id="saved-draft-title">{title}</h2>
        {saved && dimensions && <p className="draft-card__meta">{saved.asset.originalFileName} · {dimensions.width} × {dimensions.height} px · {updatedAt}</p>}
        {state.kind === 'source-only' && <p className="draft-card__warning" role="status">{state.reason} Các chỉnh sửa sẽ không được khôi phục nếu mở ảnh nguồn.</p>}
        {state.kind === 'unrecoverable' && <p className="draft-card__warning" role="alert">{state.reason} Bản nháp được giữ lại cho tới khi bạn xác nhận bỏ.</p>}
        {busy && <p className="draft-card__warning" role="status" aria-live="polite">Đang xác minh ảnh và mở bản nháp…</p>}
        <div className="draft-card__actions">
          {state.kind === 'ready' && <button className="button button-primary" type="button" onClick={onResume} disabled={busy}>Tiếp tục chỉnh</button>}
          {state.kind === 'source-only' && <button className="button button-primary" type="button" onClick={onSourceOnly} disabled={busy}>Mở lại ảnh nguồn</button>}
          <button className="button button-secondary" type="button" onClick={onDiscard} disabled={busy}>Bỏ bản nháp</button>
        </div>
      </div>
    </section>
  );
}

function HomePage({
  state,
  status,
  hasDocument,
  fileName,
  draft,
  draftBusy,
  canImport,
  onChoose,
  onImportFiles,
  onResumeDraft,
  onOpenSource,
  onDiscardDraft,
  onRetryDraft,
}: {
  state: PreviewState;
  status: ImportStatus;
  hasDocument: boolean;
  fileName?: string;
  draft: DraftViewState;
  draftBusy: boolean;
  canImport: boolean;
  onChoose: (event: MouseEvent<HTMLButtonElement>) => void;
  onImportFiles: (files: File[], focusTarget: HTMLButtonElement | null) => void;
  onResumeDraft: () => void;
  onOpenSource: (event: MouseEvent<HTMLButtonElement>) => void;
  onDiscardDraft: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetryDraft: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const chooseButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="home-page">
      <HomeHeader />
      <main className="home-main">
        <DraftCard state={draft} busy={draftBusy} onResume={onResumeDraft} onSourceOnly={onOpenSource} onDiscard={onDiscardDraft} onRetry={onRetryDraft} />
        <section className="home-hero" aria-labelledby="home-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> BỘ CÔNG CỤ ẢNH GỌN NHẸ</p>
            <h1 id="home-title">Chỉnh ảnh đẹp,<br /><span>theo cách của bạn.</span></h1>
            <p className="hero-lede">Cắt ảnh, tinh chỉnh màu sắc, thêm chú thích tiếng Việt, tạo hình khối và tải kết quả xuống — trong một không gian đơn giản, dễ dùng.</p>
            <ul className="feature-list" aria-label="Công cụ hiện có">
              <li><span aria-hidden="true">✓</span> Cắt &amp; đổi kích thước</li>
              <li><span aria-hidden="true">✓</span> Chỉnh màu</li>
              <li><span aria-hidden="true">✓</span> Xoay &amp; lật</li>
              <li><span aria-hidden="true">✓</span> Bộ lọc, chữ &amp; hình khối</li>
            </ul>
            <p className="build-note">Ảnh được đọc trong trình duyệt. Bản nháp tự động lưu trên thiết bị; khi mở lại, bạn có thể chọn tiếp tục hoặc bỏ bản nháp.</p>
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
                if (!canImport || !Array.from(event.dataTransfer.types).includes('Files')) return;
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                if (canImport) onImportFiles(Array.from(event.dataTransfer.files), chooseButtonRef.current);
              }}
            >
              <HomeImportState
                state={state}
                status={status}
                hasDocument={hasDocument}
                fileName={fileName}
                onChoose={onChoose}
                buttonRef={chooseButtonRef}
                disabled={!canImport}
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
  onApplyResize,
  onApplyAdjustments,
  onApplyText,
  onApplyShape,
  onApplyLayer,
  onChoose,
  replaceButtonRef,
  detachImageRef,
  draftSaveStatus,
  draftLease,
  onTakeOverDraft,
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
  onApplyResize: (snapshot: EditorSnapshot) => void;
  onApplyAdjustments: (snapshot: EditorSnapshot) => void;
  onApplyText: (snapshot: EditorSnapshot) => void;
  onApplyShape: (snapshot: EditorSnapshot) => void;
  onApplyLayer: (snapshot: EditorSnapshot) => void;
  onChoose: (event: MouseEvent<HTMLButtonElement>) => void;
  replaceButtonRef: RefObject<HTMLButtonElement | null>;
  detachImageRef: { current: ((image: FabricImage) => void) | null };
  draftSaveStatus: DraftSaveStatus;
  draftLease: DraftLeaseView;
  onTakeOverDraft: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const tools = ['Cắt', 'Kích thước', 'Điều chỉnh', 'Bộ lọc', 'Chữ', 'Hình khối'];
  const canvasActionsRef = useRef<EditorCanvasHandle>(null);
  const finishTextEdit = () => canvasActionsRef.current?.finishEditorEdit() !== false;
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const propertiesPanelRef = useRef<HTMLElement>(null);
  const propertiesToggleRef = useRef<HTMLButtonElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [compareActive, setCompareActive] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState<'properties' | 'layers'>('properties');
  const exportDialogRef = useRef<HTMLDialogElement>(null);
  const exportUrlRef = useRef<string | null>(null);
  const exportBlobRef = useRef<Blob | null>(null);
  const exportGenerationRef = useRef(0);
  const exportOperationRef = useRef(0);
  const [exportSupport, setExportSupport] = useState<Record<ExportFormat, boolean> | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportQuality, setExportQuality] = useState(90);
  const [exportBackground, setExportBackground] = useState('#ffffff');
  const [exportNameBase, setExportNameBase] = useState(() => makeExportBasename(candidate.source.name));
  const [exportBytes, setExportBytes] = useState(0);
  const [exportBusy, setExportBusy] = useState(false);
  const [gallerySaving, setGallerySaving] = useState(false);
  const [galleryStatus, setGalleryStatus] = useState('');
  const [exportError, setExportError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [cropPending, setCropPending] = useState<PendingCrop | null>(null);
  const [cropInput, setCropInput] = useState<CropFields | null>(null);
  const [cropError, setCropError] = useState('');
  const [resizePending, setResizePending] = useState<PendingResize | null>(null);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [textToolOpen, setTextToolOpen] = useState(false);
  const [selectedText, setSelectedText] = useState<{ id: string; text: string; isNew: boolean; properties: TextProperties } | null>(null);
  const [shapeToolOpen, setShapeToolOpen] = useState(false);
  const [selectedShape, setSelectedShape] = useState<SelectedShape | null>(null);
  const [shapeError, setShapeError] = useState('');
  const [shapePropertyInputs, setShapePropertyInputs] = useState<Partial<Record<ShapeNumericField, string>>>({});
  const shapePropertyErrorRef = useRef('');
  const [textError, setTextError] = useState('');
  const [textFontError, setTextFontError] = useState('');
  const [textFontLoading, setTextFontLoading] = useState(false);
  const [textPropertyInputs, setTextPropertyInputs] = useState<Partial<Record<TextNumericField, string>>>({});
  const textPropertyErrorRef = useRef('');
  const textFontRetryRef = useRef<TextPropertiesPatch | 'add' | null>(null);
  const [adjustmentPreview, setAdjustmentPreview] = useState<ImageAdjustments | null>(null);
  const [adjustmentOperationActive, setAdjustmentOperationActive] = useState(false);
  const [adjustmentInputs, setAdjustmentInputs] = useState<Partial<Record<AdjustmentField, string>>>({});
  const [adjustmentErrors, setAdjustmentErrors] = useState<Partial<Record<AdjustmentField, string>>>({});
  const adjustmentOperationRef = useRef<{ base: EditorSnapshot; values: ImageAdjustments } | null>(null);
  const adjustmentErrorsRef = useRef<Partial<Record<AdjustmentField, string>>>({});
  const latestSnapshotRef = useRef(snapshot);
  latestSnapshotRef.current = snapshot;

  const handleTextSelected = (id: string | null, text = '', isNew = false, properties?: TextProperties, cancelled = false, openProperties = true) => {
    if (cancelled || !id) {
      setTextPropertyInputs({});
      textPropertyErrorRef.current = '';
      setTextError('');
    }
    if (!id) {
      setSelectedText(null);
      return;
    }
    setShapeToolOpen(false);
    setSelectedShape(null);
    setSelectedText((current) => ({
      id,
      text,
      isNew,
      properties: properties ?? (current?.id === id ? current.properties : {
        x: 0, y: 0, angle: 0, width: 1, fontFamily: 'Noto Sans', fontSize: 8,
        fontWeight: 400, fontStyle: 'normal', textAlign: 'left', fill: '#111827', opacity: 1,
      }),
    }));
    setTextToolOpen(true);
    if (openProperties) setActivePanelTab('properties');
    setAdjustmentOpen(false);
    setFilterOpen(false);
    setPanelOpen(true);
  };

  const handleShapeSelected = (shape: SelectedShape | null, openProperties = true) => {
    if (!shape) {
      setSelectedShape(null);
      setShapePropertyInputs({});
      return;
    }
    setShapeError('');
    shapePropertyErrorRef.current = '';
    setShapePropertyInputs({});
    setSelectedText(null);
    setSelectedShape(shape);
    setShapeToolOpen(true);
    if (openProperties) setActivePanelTab('properties');
    setTextToolOpen(false);
    setAdjustmentOpen(false);
    setFilterOpen(false);
    setPanelOpen(true);
  };

  const beginShapePropertyOperation = (id = selectedShape?.id): boolean => {
    if (!id) return false;
    const began = canvasActionsRef.current?.beginShapePropertiesEdit(id) ?? false;
    if (began) {
      shapePropertyErrorRef.current = '';
      setShapeError('');
    }
    return began;
  };

  const finishShapePropertyOperation = () => {
    if (shapePropertyErrorRef.current) {
      canvasActionsRef.current?.cancelShapePropertiesEdit();
      shapePropertyErrorRef.current = '';
      setShapePropertyInputs({});
      setShapeError('');
      return false;
    }
    const finished = canvasActionsRef.current?.finishShapePropertiesEdit() ?? true;
    setShapePropertyInputs({});
    return finished;
  };

  const changeShapeProperties = (patch: ShapePropertiesPatch) => {
    const selected = selectedShape;
    if (!selected || !beginShapePropertyOperation(selected.id)) return;
    try {
      canvasActionsRef.current?.setShapeProperties(selected.id, patch);
      canvasActionsRef.current?.finishShapePropertiesEdit();
      shapePropertyErrorRef.current = '';
      setShapeError('');
    } catch (error) {
      canvasActionsRef.current?.cancelShapePropertiesEdit();
      const message = error instanceof Error ? error.message : 'Không thể áp dụng thuộc tính hình.';
      setShapeError(message);
    }
  };

  const changeContinuousShapeProperty = (field: ShapeNumericField, rawValue: string) => {
    setShapePropertyInputs((current) => ({ ...current, [field]: rawValue }));
    const selected = selectedShape;
    const value = Number(rawValue);
    const patch: ShapePropertiesPatch = {
      [field]: value,
      ...(field === 'strokeWidth' && value > 0 && selected?.properties.stroke === null
        ? { stroke: DEFAULT_SHAPE_COLOR }
        : {}),
    };
    try {
      if (!rawValue.trim() || !selected) throw new RangeError('Nhập một giá trị hợp lệ.');
      validateShapePropertiesPatch(selected.shape, patch);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Giá trị thuộc tính hình không hợp lệ.';
      shapePropertyErrorRef.current = message;
      setShapeError(message);
      return;
    }
    shapePropertyErrorRef.current = '';
    setShapeError('');
    if (!beginShapePropertyOperation(selected.id)) return;
    try {
      canvasActionsRef.current?.setShapeProperties(selected.id, patch);
    } catch (error) {
      shapePropertyErrorRef.current = error instanceof Error ? error.message : 'Giá trị thuộc tính hình không hợp lệ.';
      setShapeError(shapePropertyErrorRef.current);
    }
  };

  const addShape = (shape: ShapeKind) => {
    if (cropPending || resizePending || exportBusy || adjustmentOperationActive || status.phase === 'loading') return;
    if (!finishTextEdit()) return;
    setShapeError('');
    try {
      canvasActionsRef.current?.addShape(shape);
    } catch (error) {
      setShapeError(error instanceof Error ? error.message : 'Không thể thêm hình. Hãy thử lại.');
    }
  };

  const handleTextDraftChange = (id: string, text: string) => {
    setSelectedText((current) => current?.id === id ? { ...current, text } : current);
  };

  const beginTextPropertyOperation = (id = selectedText?.id): boolean => {
    if (!id || textFontLoading) return false;
    const began = canvasActionsRef.current?.beginTextPropertiesEdit(id) ?? false;
    if (began) {
      textPropertyErrorRef.current = '';
      setTextError('');
    }
    return began;
  };

  const finishTextPropertyOperation = () => {
    if (textPropertyErrorRef.current) {
      canvasActionsRef.current?.cancelTextEdit();
      textPropertyErrorRef.current = '';
      setTextPropertyInputs({});
      setTextError('');
      return false;
    }
    const finished = canvasActionsRef.current?.finishTextEdit() ?? true;
    setTextPropertyInputs({});
    return finished;
  };

  const changeTextProperties = (patch: TextPropertiesPatch, retryFont = false) => {
    const selected = selectedText;
    if (!selected || !beginTextPropertyOperation(selected.id)) return;
    const fontChange = patch.fontFamily !== undefined || patch.fontStyle !== undefined || patch.fontWeight !== undefined;
    if (!retryFont) textFontRetryRef.current = null;
    setTextFontError('');
    if (fontChange) setTextFontLoading(true);
    void canvasActionsRef.current?.setTextProperties(selected.id, patch, retryFont).then((applied) => {
      if (applied) {
        canvasActionsRef.current?.finishTextEdit();
        textFontRetryRef.current = null;
      }
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Không thể áp dụng thuộc tính chữ.';
      if (fontChange) {
        canvasActionsRef.current?.finishTextEdit();
        setSelectedText({ ...selected, isNew: false });
        textFontRetryRef.current = patch;
        setTextFontError(`${message} Kiểu chữ cũ vẫn được giữ; hãy thử lại hoặc chọn kiểu khác.`);
      } else {
        canvasActionsRef.current?.cancelTextEdit();
        setTextError(message);
      }
    }).finally(() => {
      if (fontChange) setTextFontLoading(false);
    });
  };

  const changeContinuousTextProperty = (field: TextNumericField, rawValue: string) => {
    setTextPropertyInputs((current) => ({ ...current, [field]: rawValue }));
    const patch = { [field]: Number(rawValue) } as TextPropertiesPatch;
    try {
      if (!rawValue.trim()) throw new RangeError('Nhập một giá trị số hợp lệ.');
      validateTextPropertiesPatch(patch);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Giá trị thuộc tính chữ không hợp lệ.';
      textPropertyErrorRef.current = message;
      setTextError(message);
      return;
    }
    textPropertyErrorRef.current = '';
    setTextError('');
    const selected = selectedText;
    if (!selected || !beginTextPropertyOperation(selected.id)) return;
    void canvasActionsRef.current?.setTextProperties(selected.id, patch).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Giá trị thuộc tính chữ không hợp lệ.';
      textPropertyErrorRef.current = message;
      setTextError(message);
    });
  };

  const addText = async (retryFont = false) => {
    if (cropPending || resizePending || exportBusy || adjustmentOperationActive || status.phase === 'loading') return;
    if (!finishTextEdit()) return;
    setTextError('');
    setTextFontError('');
    let fontReady = false;
    try {
      await ensureTextFontReady(undefined, undefined, undefined, retryFont || textFontRetryRef.current === 'add');
      fontReady = true;
      canvasActionsRef.current?.addText();
      textFontRetryRef.current = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể thêm chữ. Hãy thử lại.';
      if (!fontReady) {
        textFontRetryRef.current = 'add';
        setTextFontError(message);
      }
      else setTextError(message);
    }
  };

  const toggleTextTool = () => {
    if (cropPending || resizePending || exportBusy || status.phase === 'loading') return;
    if (!finishTextEdit()) return;
    if (textToolOpen) {
      setActivePanelTab('properties');
      setTextToolOpen(false);
      setPanelOpen(false);
    } else {
      setActivePanelTab('properties');
      setAdjustmentOpen(false);
      setFilterOpen(false);
      setShapeToolOpen(false);
      setTextToolOpen(true);
      setPanelOpen(true);
    }
  };

  const toggleShapeTool = () => {
    if (cropPending || resizePending || exportBusy || status.phase === 'loading') return;
    if (!finishTextEdit()) return;
    if (shapeToolOpen) {
      setActivePanelTab('properties');
      setShapeToolOpen(false);
      setPanelOpen(false);
    } else {
      setActivePanelTab('properties');
      setAdjustmentOpen(false);
      setFilterOpen(false);
      setTextToolOpen(false);
      setShapeToolOpen(true);
      setPanelOpen(true);
    }
  };

  useEffect(() => {
    if (!selectedText) return;
    if (selectedText.isNew && !window.matchMedia('(max-width: 767px)').matches) {
      setSelectedText((current) => current?.id === selectedText.id ? { ...current, isNew: false } : current);
      return;
    }
    if (window.matchMedia('(max-width: 767px)').matches) {
      textAreaRef.current?.focus();
      if (selectedText.isNew) textAreaRef.current?.select();
    }
    if (selectedText.isNew) {
      setSelectedText((current) => current?.id === selectedText.id ? { ...current, isNew: false } : current);
    }
  }, [selectedText?.id, selectedText?.isNew]);

  const clearAdjustmentDraft = () => {
    adjustmentOperationRef.current = null;
    adjustmentErrorsRef.current = {};
    setAdjustmentOperationActive(false);
    setAdjustmentPreview(null);
    setAdjustmentInputs({});
    setAdjustmentErrors({});
  };

  const beginAdjustmentOperation = () => {
    if (adjustmentOperationRef.current) return;
    const base = latestSnapshotRef.current;
    const values = snapshotAdjustments(base);
    adjustmentOperationRef.current = { base, values };
    adjustmentErrorsRef.current = {};
    setAdjustmentPreview(values);
    setAdjustmentErrors({});
  };

  const cancelAdjustmentOperation = () => clearAdjustmentDraft();

  const finishAdjustmentOperation = () => {
    const operation = adjustmentOperationRef.current;
    if (!operation) return;
    if (Object.keys(adjustmentErrorsRef.current).length) {
      clearAdjustmentDraft();
      return;
    }
    if (!sameAdjustments(snapshotAdjustments(operation.base), operation.values)) {
      const next = {
        ...operation.base,
        imageAppearance: { ...operation.base.imageAppearance, ...operation.values },
      };
      latestSnapshotRef.current = next;
      onApplyAdjustments(next);
    }
    clearAdjustmentDraft();
  };

  const changeAdjustment = (field: AdjustmentField, rawValue: string) => {
    setAdjustmentInputs((current) => ({ ...current, [field]: rawValue }));
    const value = Number(rawValue);
    if (rawValue.trim() === '' || !Number.isInteger(value) || value < -100 || value > 100) {
      const message = 'Nhập số nguyên từ -100 đến 100.';
      adjustmentErrorsRef.current = { ...adjustmentErrorsRef.current, [field]: message };
      setAdjustmentErrors(adjustmentErrorsRef.current);
      return;
    }
    const { [field]: _removed, ...otherErrors } = adjustmentErrorsRef.current;
    adjustmentErrorsRef.current = otherErrors;
    setAdjustmentErrors(otherErrors);
    if (!adjustmentOperationRef.current) beginAdjustmentOperation();
    const operation = adjustmentOperationRef.current;
    if (!operation) return;
    const values = { ...operation.values, [field]: value };
    adjustmentOperationRef.current = { ...operation, values };
    setAdjustmentOperationActive(!sameAdjustments(snapshotAdjustments(operation.base), values));
    setAdjustmentPreview(values);
  };

  const resetAdjustments = (field?: AdjustmentField) => {
    if (adjustmentOperationRef.current) cancelAdjustmentOperation();
    const base = latestSnapshotRef.current;
    const values = snapshotAdjustments(base);
    const next = field ? { ...values, [field]: 0 } : { brightness: 0, contrast: 0, saturation: 0 };
    if (sameAdjustments(values, next)) return;
    const nextSnapshot = { ...base, imageAppearance: { ...base.imageAppearance, ...next } };
    latestSnapshotRef.current = nextSnapshot;
    onApplyAdjustments(nextSnapshot);
    setAdjustmentInputs({});
    setAdjustmentErrors({});
  };

  const previewSnapshot = useMemo(() => adjustmentPreview
    ? { ...snapshot, imageAppearance: { ...snapshot.imageAppearance, ...adjustmentPreview } }
    : snapshot, [snapshot, adjustmentPreview]);
  const compareSnapshot = useMemo(() => createCompareSnapshot(snapshot), [snapshot]);

  const scrollFocusedPanelControl = () => {
    const panel = propertiesPanelRef.current;
    const control = document.activeElement;
    if (!window.matchMedia('(max-width: 767px)').matches) {
      if (control === textAreaRef.current) textAreaRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }
    if (!panel || !(control instanceof HTMLElement) || !panel.contains(control)) return;
    const panelBounds = panel.getBoundingClientRect();
    const controlBounds = control.getBoundingClientRect();
    const top = panelBounds.top + 8;
    const bottom = panelBounds.bottom - 8;
    if (controlBounds.top < top || controlBounds.height > bottom - top) {
      panel.scrollTop += controlBounds.top - top;
    } else if (controlBounds.bottom > bottom) {
      panel.scrollTop += controlBounds.bottom - bottom;
    }
  };

  useEffect(() => {
    const viewport = window.visualViewport;
    const syncViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--visual-viewport-height', `${height}px`);
      requestAnimationFrame(scrollFocusedPanelControl);
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      document.documentElement.style.removeProperty('--visual-viewport-height');
    };
  }, []);

  useEffect(() => {
    const stopCompare = () => setCompareActive(false);
    const stopCompareWhenHidden = () => {
      if (document.visibilityState !== 'visible') stopCompare();
    };
    window.addEventListener('blur', stopCompare);
    document.addEventListener('visibilitychange', stopCompareWhenHidden);
    return () => {
      window.removeEventListener('blur', stopCompare);
      document.removeEventListener('visibilitychange', stopCompareWhenHidden);
    };
  }, []);

  useEffect(() => {
    clearAdjustmentDraft();
  }, [candidate.assetId, snapshot.imageAppearance.brightness, snapshot.imageAppearance.contrast, snapshot.imageAppearance.saturation]);

  const startCrop = () => {
    if (cropPending || resizePending || exportBusy || status.phase === 'loading') return;
    if (!finishTextEdit()) return;
    setActivePanelTab('properties');
    setAdjustmentOpen(false);
    setFilterOpen(false);
    setTextToolOpen(false);
    setShapeToolOpen(false);
    setPanelOpen(true);
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
    if (!finishTextEdit()) return;
    setActivePanelTab('properties');
    setAdjustmentOpen(false);
    setFilterOpen(false);
    setTextToolOpen(false);
    setShapeToolOpen(false);
    const base = { width: snapshot.document.width, height: snapshot.document.height };
    setResizePending({
      base,
      fields: { width: String(base.width), height: String(base.height) },
      dimensions: base,
      scale: 1,
      error: null,
      applyError: null,
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
        applyError: null,
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
      applyError: null,
    });
  };

  const applyResize = () => {
    if (!resizePending || resizePending.error) return;
    try {
      onApplyResize(resizeEditorDocument(snapshot, resizePending.dimensions, resizePending.scale));
      setResizePending(null);
    } catch {
      setResizePending({
        ...resizePending,
        applyError: 'Không thể áp dụng kích thước này. Hãy kiểm tra lại các giá trị.',
      });
    }
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
    exportBlobRef.current = null;
    setDownloadUrl(null);
    setExportBytes(0);
    setGalleryStatus('');
  };

  useEffect(() => {
    setExportNameBase(makeExportBasename(candidate.source.name));
    setExportError('');
    clearDownload();
  }, [candidate.assetId]);

  useEffect(() => {
    let active = true;
    void Promise.all((['png', 'jpeg', 'webp'] as const).map(probeExportFormat)).then(([png, jpeg, webp]) => {
      if (!active) return;
      const supported = { png, jpeg, webp };
      setExportSupport(supported);
      setExportFormat(defaultExportFormat(candidate, latestSnapshotRef.current, supported));
    });
    return () => { active = false; };
  }, [candidate.assetId]);

  useEffect(() => () => {
    exportGenerationRef.current += 1;
    exportOperationRef.current += 1;
    if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
    exportUrlRef.current = null;
  }, []);

  const generateExport = async () => {
    if (exportBusy || gallerySaving || cropPending || resizePending) return;
    clearDownload();
    setExportError('');
    setExportBusy(true);
    const generation = ++exportGenerationRef.current;
    const operation = ++exportOperationRef.current;
    try {
      const blob = await exportImage(candidate, snapshot, {
        format: exportFormat,
        quality: exportQuality,
        backgroundColor: exportBackground,
      });
      if (generation !== exportGenerationRef.current) return;
      const url = URL.createObjectURL(blob);
      exportUrlRef.current = url;
      exportBlobRef.current = blob;
      setDownloadUrl(url);
      setExportBytes(blob.size);
    } catch (error) {
      if (generation === exportGenerationRef.current) {
        setExportError(error instanceof Error ? error.message : 'Không thể tạo file ảnh. Hãy thử lại.');
      }
    } finally {
      if (operation === exportOperationRef.current) setExportBusy(false);
    }
  };

  const saveExportToGallery = async () => {
    const blob = exportBlobRef.current;
    if (!blob || gallerySaving) return;
    setGallerySaving(true);
    setGalleryStatus('');
    setExportError('');
    try {
      await saveImageToGallery(blob, exportFilename(exportNameBase, exportFormat));
      setGalleryStatus('Đã lưu ảnh vào thư viện.');
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Không thể lưu ảnh vào thư viện. Hãy thử lại.');
    } finally {
      setGallerySaving(false);
    }
  };

  const closeExportDialog = () => {
    exportGenerationRef.current += 1;
    clearDownload();
    setExportError('');
  };

  const openExportDialog = () => {
    if (!finishTextEdit()) return;
    setExportError('');
    clearDownload();
    if (exportSupport) setExportFormat(defaultExportFormat(candidate, latestSnapshotRef.current, exportSupport));
    exportDialogRef.current?.showModal();
  };

  const toggleAdjustments = () => {
    if (cropPending || resizePending || exportBusy || status.phase === 'loading') return;
    if (!finishTextEdit()) return;
    setActivePanelTab('properties');
    setTextToolOpen(false);
    setShapeToolOpen(false);
    if (adjustmentOpen) {
      setAdjustmentOpen(false);
      setPanelOpen(false);
    } else {
      setFilterOpen(false);
      setAdjustmentOpen(true);
      setPanelOpen(true);
    }
  };
  const toggleFilters = () => {
    if (cropPending || resizePending || exportBusy || status.phase === 'loading') return;
    if (!finishTextEdit()) return;
    setActivePanelTab('properties');
    setTextToolOpen(false);
    setShapeToolOpen(false);
    if (filterOpen) {
      setFilterOpen(false);
      setPanelOpen(false);
    } else {
      finishAdjustmentOperation();
      setAdjustmentOpen(false);
      setFilterOpen(true);
      setPanelOpen(true);
    }
  };
  const choosePreset = (presetId: PresetId) => {
    const base = latestSnapshotRef.current;
    const next = selectImagePreset(base, presetId);
    if (next === base) return;
    latestSnapshotRef.current = next;
    onApplyAdjustments(next);
  };
  const activeTool = cropPending ? 'Cắt' : resizePending ? 'Kích thước'
    : filterOpen ? 'Bộ lọc' : adjustmentOpen ? 'Điều chỉnh' : textToolOpen ? 'Chữ' : shapeToolOpen ? 'Hình khối' : null;
  const documentActionLocked = exportBusy || textFontLoading || Boolean(cropPending || resizePending || adjustmentOperationActive);
  const displayedAdjustments = adjustmentPreview ?? snapshotAdjustments(snapshot);
  const previewCanvasSnapshot = compareActive ? compareSnapshot : previewSnapshot;
  const hasVisibleContent = snapshot.scene.some((item) => item.visible);
  const compareDisabled = documentActionLocked || status.phase === 'loading';
  const startCompare = () => {
    if (compareDisabled || !finishTextEdit()) return;
    setCompareActive(true);
  };
  const stopCompare = () => setCompareActive(false);

  useEffect(() => {
    const onAndroidBack = (event: Event) => {
      if (event.defaultPrevented) return;
      if (compareActive) {
        stopCompare();
        event.preventDefault();
        return;
      }
      if (cropPending) {
        cancelCrop();
        event.preventDefault();
        return;
      }
      if (resizePending) {
        cancelResize();
        event.preventDefault();
        return;
      }
      if (panelOpen || adjustmentOpen || filterOpen || textToolOpen || shapeToolOpen) {
        if (!finishTextEdit()) {
          event.preventDefault();
          return;
        }
        finishAdjustmentOperation();
        setAdjustmentOpen(false);
        setFilterOpen(false);
        setTextToolOpen(false);
        setShapeToolOpen(false);
        setPanelOpen(false);
        propertiesToggleRef.current?.focus({ preventScroll: true });
        event.preventDefault();
      }
    };
    window.addEventListener(ANDROID_BACK_EVENT, onAndroidBack);
    return () => window.removeEventListener(ANDROID_BACK_EVENT, onAndroidBack);
  }, [compareActive, cropPending, resizePending, panelOpen, adjustmentOpen, filterOpen, textToolOpen, shapeToolOpen]);

  useEffect(() => {
    const finishNudge = () => canvasActionsRef.current?.finishNudge();
    window.addEventListener('blur', finishNudge);
    return () => window.removeEventListener('blur', finishNudge);
  }, []);

  const handleEditorKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const native = event.nativeEvent;
    if (native.isComposing || native.keyCode === 229 || target?.isContentEditable
      || Boolean(target?.closest('[contenteditable="true"]'))
      || Boolean(target?.closest('dialog[open]'))
      || Boolean(target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
    if (event.altKey) return;

    const key = event.key.toLowerCase();
    const hasModifier = event.ctrlKey || event.metaKey;
    if (hasModifier && (key === 'z' || (key === 'y' && event.ctrlKey))) {
      if (documentActionLocked || !finishTextEdit()) return;
      event.preventDefault();
      if ((key === 'z' && event.shiftKey) || key === 'y') onRedo();
      else onUndo();
      return;
    }
    if (hasModifier || !target) return;

    const inScene = target.closest('.canvas-stage, .layers-panel');
    if ((key === 'delete' || key === 'backspace') && !event.shiftKey && inScene) {
      if (canvasActionsRef.current?.deleteSelectedOverlay()) event.preventDefault();
      return;
    }

    const inNudgeArea = target.closest('.canvas-stage')
      || Boolean(target.closest('.layer-row')?.querySelector('.layer-row__select[aria-pressed="true"]'));
    if (inNudgeArea && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      const handled = canvasActionsRef.current?.nudgeSelected(event.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight', event.shiftKey ? 10 : 1);
      if (handled) event.preventDefault();
      return;
    }
    canvasActionsRef.current?.finishNudge();
  };

  const handleEditorKeyUp = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      canvasActionsRef.current?.releaseNudgeKey(event.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight');
    }
  };

  const isNudgeFocus = (target: EventTarget | null): boolean => target instanceof Element
    && (Boolean(target.closest('.canvas-stage'))
      || Boolean(target.closest('.layer-row')?.querySelector('.layer-row__select[aria-pressed="true"]')));
  const finishNudgeOnBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    if (isNudgeFocus(event.target) && !isNudgeFocus(event.relatedTarget)) canvasActionsRef.current?.finishNudge();
  };

  return (
    <div
      className="editor-shell"
      onKeyDownCapture={handleEditorKeyDown}
      onKeyUpCapture={handleEditorKeyUp}
      onBlurCapture={finishNudgeOnBlur}
    >
      <header className="editor-topbar">
        <div className="editor-topbar__start">
          <a className="back-link" href="/" aria-label="Về trang chủ">←</a>
          <Brand dark />
          <span className="editor-divider" aria-hidden="true" />
          <span className="document-name" title={candidate.source.name}>{candidate.source.name}</span>
        </div>
        <div className="editor-topbar__actions">
          <button className="editor-quiet-button" type="button" onClick={() => { if (finishTextEdit()) onUndo(); }} disabled={!undoEnabled || documentActionLocked || compareActive}>Hoàn tác</button>
          <button className="editor-quiet-button" type="button" onClick={() => { if (finishTextEdit()) onRedo(); }} disabled={!redoEnabled || documentActionLocked || compareActive}>Làm lại</button>
          <button className="editor-quiet-button" type="button" onClick={(event) => { if (finishTextEdit()) onChoose(event); }} ref={replaceButtonRef} disabled={status.phase === 'loading' || documentActionLocked || compareActive}>
            Thay ảnh
          </button>
          <button
            className="button button-primary editor-export"
            type="button"
            disabled={documentActionLocked || compareActive}
            onClick={openExportDialog}
          >
            Xuất ảnh
          </button>
          <button
            className="editor-properties-toggle"
            ref={propertiesToggleRef}
            type="button"
            aria-expanded={panelOpen}
            aria-controls="editor-properties-panel"
            disabled={compareActive}
            onClick={() => {
              if (!finishTextEdit()) return;
              setPanelOpen((open) => !open);
            }}
          >
            Thuộc tính
          </button>
          <HelpDialogTrigger dark />
        </div>
      </header>

      <div className={`editor-layout${panelOpen ? ' editor-layout--panel-open' : ''}`}>
        <aside className="tool-rail" aria-label="Công cụ chỉnh sửa">
          {tools.map((tool, index) => (
            <button
              className={`tool-item${activeTool === tool ? ' tool-item--active' : ''}`}
              type="button"
              key={tool}
              disabled={compareActive || (!['Cắt', 'Kích thước', 'Điều chỉnh', 'Bộ lọc', 'Chữ', 'Hình khối'].includes(tool)) || exportBusy || status.phase === 'loading'
                || Boolean((cropPending || resizePending) && activeTool !== tool)}
              aria-pressed={['Cắt', 'Kích thước', 'Điều chỉnh', 'Bộ lọc', 'Chữ', 'Hình khối'].includes(tool) ? activeTool === tool : undefined}
              onClick={tool === 'Cắt'
                ? (cropPending ? cancelCrop : startCrop)
                : tool === 'Kích thước' ? (resizePending ? cancelResize : startResize)
                    : tool === 'Điều chỉnh' ? toggleAdjustments
                    : tool === 'Bộ lọc' ? toggleFilters
                      : tool === 'Chữ' ? toggleTextTool
                        : tool === 'Hình khối' ? toggleShapeTool : undefined}
            >
              <span className="tool-item__icon" aria-hidden="true">{['⌗', '↔', '◐', '✧', 'T', '◇'][index]}</span>
              <span>{tool}</span>
            </button>
          ))}
          <button
            className={`tool-item${compareActive ? ' tool-item--active tool-item--compare-active' : ''}`}
            type="button"
            aria-pressed={compareActive}
            aria-label={compareActive ? 'Đang so sánh; giữ để xem trước chỉnh sửa' : 'Giữ để so sánh ảnh trước chỉnh sửa'}
            title="Giữ để bỏ màu và ẩn chữ/hình; thả để quay lại"
            disabled={compareDisabled || Boolean(cropPending || resizePending)}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              startCompare();
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={stopCompare}
            onPointerCancel={stopCompare}
            onLostPointerCapture={stopCompare}
            onKeyDown={(event) => {
              if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
                event.preventDefault();
                event.stopPropagation();
                startCompare();
              }
            }}
            onKeyUp={(event) => {
              if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                stopCompare();
              }
            }}
            onBlur={stopCompare}
          >
            <span className="tool-item__icon" aria-hidden="true">◉</span>
            <span>{compareActive ? 'Đang so sánh' : 'So sánh'}</span>
          </button>
        </aside>

        <main className="workspace" aria-label="Vùng làm việc">
          <EditorCanvas
            ref={canvasActionsRef}
            image={candidate.image}
            snapshot={previewCanvasSnapshot}
            detachImageRef={detachImageRef}
            onTransform={onTransform}
            documentActionsDisabled={documentActionLocked || compareActive}
            crop={cropPending}
            onCropChange={updateCropRect}
            selectedTextId={selectedText?.id ?? null}
            selectedShapeId={selectedShape?.id ?? null}
            onTextSelected={handleTextSelected}
            onTextDraftChange={handleTextDraftChange}
            onTextCommitted={onApplyText}
            onShapeSelected={handleShapeSelected}
            onShapeCommitted={onApplyShape}
            onLayerCommitted={onApplyLayer}
          >
            <EditorStatus status={status} />
          </EditorCanvas>
        </main>

        <aside
          id="editor-properties-panel"
          ref={propertiesPanelRef}
          className={`properties-panel${panelOpen ? ' properties-panel--open' : ''}${activePanelTab === 'layers' ? ' properties-panel--layers' : ''}`}
          aria-labelledby="properties-title"
          inert={compareActive}
          onFocusCapture={() => requestAnimationFrame(scrollFocusedPanelControl)}
        >
          <div className="properties-panel__heading">
            <h2 id="properties-title">Thuộc tính</h2>
            <span>{activeTool ?? '—'}</span>
            <button className="properties-panel__close" type="button" onClick={() => {
              setPanelOpen(false);
              propertiesToggleRef.current?.focus({ preventScroll: true });
            }} aria-label="Đóng bảng công cụ">
              Đóng
            </button>
          </div>
          <div className="properties-panel__tabs" aria-label="Chọn bảng chỉnh sửa">
            <button
              className="properties-panel__tab"
              type="button"
              aria-pressed={activePanelTab === 'properties'}
              disabled={documentActionLocked || status.phase === 'loading'}
              onClick={() => {
                if (!finishTextEdit()) return;
                setActivePanelTab('properties');
                setPanelOpen(true);
              }}
            >Thuộc tính</button>
            <button
              className="properties-panel__tab"
              type="button"
              aria-pressed={activePanelTab === 'layers'}
              disabled={documentActionLocked || status.phase === 'loading'}
              onClick={() => {
                if (!finishTextEdit()) return;
                setActivePanelTab('layers');
                setPanelOpen(true);
              }}
            >Lớp</button>
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
              {resizePending.applyError && (
                <p className="crop-validation-error" role="alert">{resizePending.applyError}</p>
              )}
              <div className="crop-actions">
                <button className="button button-primary" type="button" onClick={applyResize} disabled={Boolean(resizePending.error)}>
                  Áp dụng
                </button>
                <button className="button button-secondary" type="button" onClick={cancelResize}>Hủy resize</button>
              </div>
            </section>
          ) : activePanelTab === 'layers' ? (
            <LayersPanel
              snapshot={snapshot}
              selectedId={selectedText?.id ?? selectedShape?.id ?? null}
              disabled={documentActionLocked || status.phase === 'loading'}
              onSelect={(id) => { canvasActionsRef.current?.selectOverlay(id); }}
              onVisibilityChange={(id, visible) => {
                canvasActionsRef.current?.setOverlayVisibility(id, visible);
                setActivePanelTab('layers');
              }}
              onMove={(id, direction) => {
                canvasActionsRef.current?.moveOverlay(id, direction);
                setActivePanelTab('layers');
              }}
              onDelete={(id) => {
                canvasActionsRef.current?.deleteOverlay(id);
                setActivePanelTab('layers');
              }}
            />
          ) : filterOpen ? (
            <PresetControls
              candidate={candidate}
              snapshot={snapshot}
              disabled={exportBusy || status.phase === 'loading'}
              onSelect={choosePreset}
            />
          ) : adjustmentOpen ? (
            <section className="adjustment-controls" aria-labelledby="adjustment-controls-title">
              <div className="adjustment-controls__intro">
                <strong id="adjustment-controls-title">Tinh chỉnh màu</strong>
                <p>Điều chỉnh ảnh nền từ -100 đến 100. Kết thúc thao tác để lưu một bước vào lịch sử.</p>
              </div>
              {ADJUSTMENT_FIELDS.map((field) => {
                const label = ADJUSTMENT_LABELS[field];
                const inputId = `adjustment-${field}`;
                const errorId = `${inputId}-error`;
                return (
                  <div className="adjustment-control" key={field}>
                    <div className="adjustment-control__heading">
                      <label htmlFor={inputId}>{label}</label>
                      <input
                        id={inputId}
                        type="number"
                        min="-100"
                        max="100"
                        step="1"
                        value={adjustmentInputs[field] ?? String(displayedAdjustments[field])}
                        aria-invalid={adjustmentErrors[field] ? true : undefined}
                        aria-describedby={adjustmentErrors[field] ? errorId : undefined}
                        onFocus={beginAdjustmentOperation}
                        onChange={(event) => changeAdjustment(field, event.currentTarget.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelAdjustmentOperation();
                          } else if (event.key === 'Enter') {
                            event.preventDefault();
                            finishAdjustmentOperation();
                          }
                        }}
                        onBlur={finishAdjustmentOperation}
                      />
                      <button type="button" onClick={() => resetAdjustments(field)} aria-label={`Đặt lại ${label}`}>
                        Đặt lại
                      </button>
                    </div>
                    <input
                      aria-label={`${label} -100 đến 100`}
                      aria-describedby={adjustmentErrors[field] ? errorId : undefined}
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={displayedAdjustments[field]}
                      onPointerDown={beginAdjustmentOperation}
                      onPointerUp={finishAdjustmentOperation}
                      onPointerCancel={cancelAdjustmentOperation}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          cancelAdjustmentOperation();
                        } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
                          beginAdjustmentOperation();
                        }
                      }}
                      onKeyUp={finishAdjustmentOperation}
                      onBlur={finishAdjustmentOperation}
                      onChange={(event) => changeAdjustment(field, event.currentTarget.value)}
                    />
                    {adjustmentErrors[field] && (
                      <span id={errorId} className="adjustment-validation-error" role="alert">{adjustmentErrors[field]}</span>
                    )}
                  </div>
                );
              })}
              <button className="adjustment-reset-all" type="button" onClick={() => resetAdjustments()}>
                Đặt lại tất cả
              </button>
            </section>
          ) : textToolOpen ? (
            <section className="text-controls" aria-labelledby="text-controls-title">
              <div className="text-controls__intro">
                <strong id="text-controls-title">Chú thích trên ảnh</strong>
                <p>Chữ tiếng Việt nhiều dòng; kéo, scale đồng đều hoặc xoay textbox đã chọn.</p>
              </div>
              <div className="text-controls__actions">
                <button type="button" onClick={() => { void addText(); }} disabled={documentActionLocked}>
                  Thêm chữ
                </button>
                <button
                  type="button"
                  onClick={() => canvasActionsRef.current?.deleteSelectedText()}
                  disabled={!selectedText || documentActionLocked}
                >
                  Xóa chữ
                </button>
              </div>
              {selectedText ? (
                <>
                  <label className="text-controls__field" htmlFor="selected-text-content">
                    Nội dung
                    <textarea
                      id="selected-text-content"
                      ref={textAreaRef}
                      rows={3}
                      value={selectedText.text}
                      aria-describedby="selected-text-count"
                      onFocus={() => {
                        canvasActionsRef.current?.beginTextareaEdit(selectedText.id);
                      }}
                      onBlur={() => canvasActionsRef.current?.finishTextEdit()}
                      onChange={(event) => {
                        const text = normalizeTextContent(event.currentTarget.value);
                        setSelectedText((current) => current?.id === selectedText.id ? { ...current, text } : current);
                        canvasActionsRef.current?.setTextDraft(selectedText.id, text);
                      }}
                    />
                  </label>
                  <div className="text-controls__grid">
                    <label className="text-controls__field" htmlFor="selected-text-font">
                      Font
                      <select id="selected-text-font" value={selectedText.properties.fontFamily} disabled={documentActionLocked}
                        onChange={(event) => changeTextProperties({ fontFamily: event.currentTarget.value as TextProperties['fontFamily'] })}>
                        <option value="Noto Sans">Noto Sans</option>
                        <option value="Noto Serif">Noto Serif</option>
                      </select>
                    </label>
                    <label className="text-controls__field" htmlFor="selected-text-size">
                      Cỡ chữ (px)
                      <input id="selected-text-size" type="number" min="8" max="512" step="1"
                        value={textPropertyInputs.fontSize ?? String(selectedText.properties.fontSize)} disabled={documentActionLocked}
                        onFocus={() => beginTextPropertyOperation(selectedText.id)}
                        onChange={(event) => changeContinuousTextProperty('fontSize', event.currentTarget.value)}
                        onBlur={finishTextPropertyOperation}
                        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
                    </label>
                  </div>
                  <div className="text-controls__actions" aria-label="Kiểu chữ">
                    <button type="button" aria-pressed={selectedText.properties.fontWeight === 700} disabled={documentActionLocked}
                      onClick={() => changeTextProperties({ fontWeight: selectedText.properties.fontWeight === 700 ? 400 : 700 })}>Đậm</button>
                    <button type="button" aria-pressed={selectedText.properties.fontStyle === 'italic'} disabled={documentActionLocked}
                      onClick={() => changeTextProperties({ fontStyle: selectedText.properties.fontStyle === 'italic' ? 'normal' : 'italic' })}>Nghiêng</button>
                    {(['left', 'center', 'right'] as const).map((alignment) => (
                      <button key={alignment} type="button" aria-pressed={selectedText.properties.textAlign === alignment}
                        aria-label={`Căn ${alignment === 'left' ? 'trái' : alignment === 'center' ? 'giữa' : 'phải'}`}
                        disabled={documentActionLocked} onClick={() => changeTextProperties({ textAlign: alignment })}>
                        {alignment === 'left' ? 'Trái' : alignment === 'center' ? 'Giữa' : 'Phải'}
                      </button>
                    ))}
                  </div>
                  <div className="text-controls__grid">
                    <label className="text-controls__field" htmlFor="selected-text-color">
                      Màu chữ
                      <input id="selected-text-color" type="color" value={selectedText.properties.fill}
                        disabled={documentActionLocked} onFocus={() => beginTextPropertyOperation(selectedText.id)}
                        onChange={(event) => {
                          try { validateTextPropertiesPatch({ fill: event.currentTarget.value }); }
                          catch (error) { setTextError(error instanceof Error ? error.message : 'Màu chữ không hợp lệ.'); return; }
                          textPropertyErrorRef.current = '';
                          setTextError('');
                          void canvasActionsRef.current?.setTextProperties(selectedText.id, { fill: event.currentTarget.value });
                        }} onBlur={finishTextPropertyOperation} />
                    </label>
                    <label className="text-controls__field" htmlFor="selected-text-opacity">
                      Độ mờ ({Math.round(selectedText.properties.opacity * 100)}%)
                      <input id="selected-text-opacity" type="range" min="0" max="100" step="1"
                        value={Math.round(selectedText.properties.opacity * 100)} disabled={documentActionLocked}
                        onPointerDown={() => beginTextPropertyOperation(selectedText.id)}
                        onKeyDown={() => beginTextPropertyOperation(selectedText.id)}
                        onChange={(event) => {
                          const opacity = Number(event.currentTarget.value) / 100;
                          void canvasActionsRef.current?.setTextProperties(selectedText.id, { opacity });
                        }} onPointerUp={finishTextPropertyOperation}
                        onBlur={finishTextPropertyOperation} />
                    </label>
                  </div>
                  <div className="text-controls__grid text-controls__grid--four">
                    {([
                      ['x', 'X (px)'], ['y', 'Y (px)'], ['angle', 'Góc (°)'], ['width', 'Rộng (px)'],
                    ] as const).map(([field, label]) => (
                      <label className="text-controls__field" htmlFor={`selected-text-${field}`} key={field}>
                        {label}
                        <input id={`selected-text-${field}`} type="number"
                          min={field === 'width' ? 1 : undefined} max={field === 'width' ? 8192 : undefined}
                          step={1}
                          value={textPropertyInputs[field] ?? String(selectedText.properties[field])} disabled={documentActionLocked}
                          onFocus={() => beginTextPropertyOperation(selectedText.id)}
                          onChange={(event) => changeContinuousTextProperty(field, event.currentTarget.value)}
                          onBlur={finishTextPropertyOperation}
                          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-controls__count">Chọn một textbox trên ảnh hoặc thêm chữ mới.</p>
              )}
              {selectedText && (
                <p className="text-controls__count" id="selected-text-count">
                  {Array.from(selectedText.text).length.toLocaleString('vi-VN')} / {MAX_TEXT_CODE_POINTS} ký tự
                </p>
              )}
              {textFontError && (
                <div className="text-controls__error" role="alert">
                  {textFontError}
                  {textFontRetryRef.current && (
                    <button type="button" disabled={documentActionLocked}
                      onClick={() => {
                        const retry = textFontRetryRef.current;
                        if (retry === 'add') void addText(true);
                        else if (retry) changeTextProperties(retry, true);
                      }}>
                      Thử lại font
                    </button>
                  )}
                </div>
              )}
              {textError && <p className="text-controls__error" role="alert">{textError}</p>}
            </section>
          ) : shapeToolOpen ? (
            <section className="text-controls" aria-labelledby="shape-controls-title">
              <div className="text-controls__intro">
                <strong id="shape-controls-title">Hình khối</strong>
                <p>Thêm hình, chọn trên ảnh rồi kéo hoặc dùng handle để chỉnh hình học.</p>
              </div>
              <div className="text-controls__actions" aria-label="Thêm hình">
                <button type="button" onClick={() => addShape('rectangle')} disabled={documentActionLocked || snapshot.scene.filter((item) => item.role !== 'source-image').length >= 50}>
                  Chữ nhật
                </button>
                <button type="button" onClick={() => addShape('circle')} disabled={documentActionLocked || snapshot.scene.filter((item) => item.role !== 'source-image').length >= 50}>
                  Hình tròn
                </button>
                <button type="button" onClick={() => addShape('line')} disabled={documentActionLocked || snapshot.scene.filter((item) => item.role !== 'source-image').length >= 50}>
                  Đường thẳng
                </button>
              </div>
              {selectedShape ? (
                <>
                  {selectedShape.shape !== 'line' && (
                    <div className="text-controls__grid">
                      <label className="text-controls__field" htmlFor="selected-shape-fill">
                        Màu tô
                        <input id="selected-shape-fill" type="color"
                          value={selectedShape.properties.fill ?? DEFAULT_SHAPE_COLOR}
                          disabled={documentActionLocked || selectedShape.properties.fill === null}
                          onFocus={() => beginShapePropertyOperation(selectedShape.id)}
                          onChange={(event) => changeShapeProperties({ fill: event.currentTarget.value })} />
                      </label>
                      <label className="text-controls__field" htmlFor="selected-shape-transparent">
                        Tô hình
                        <span>
                          <input id="selected-shape-transparent" type="checkbox"
                            checked={selectedShape.properties.fill === null}
                            disabled={documentActionLocked}
                            onChange={(event) => changeShapeProperties({
                              fill: event.currentTarget.checked ? null : DEFAULT_SHAPE_COLOR,
                            })} />
                          Trong suốt
                        </span>
                      </label>
                    </div>
                  )}
                  <div className="text-controls__grid">
                    <label className="text-controls__field" htmlFor="selected-shape-stroke">
                      Màu viền
                      <input id="selected-shape-stroke" type="color"
                        value={selectedShape.properties.stroke ?? DEFAULT_SHAPE_COLOR}
                        disabled={documentActionLocked}
                        onFocus={() => beginShapePropertyOperation(selectedShape.id)}
                        onChange={(event) => changeShapeProperties({ stroke: event.currentTarget.value })} />
                    </label>
                    <label className="text-controls__field" htmlFor="selected-shape-stroke-width">
                      Độ rộng viền (px)
                      <input id="selected-shape-stroke-width" type="number"
                        min={selectedShape.shape === 'line' ? 0.01 : 0} max="50" step="any"
                        value={shapePropertyInputs.strokeWidth ?? String(selectedShape.properties.strokeWidth)}
                        disabled={documentActionLocked}
                        onFocus={() => beginShapePropertyOperation(selectedShape.id)}
                        onChange={(event) => changeContinuousShapeProperty('strokeWidth', event.currentTarget.value)}
                        onBlur={finishShapePropertyOperation}
                        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
                    </label>
                  </div>
                  <label className="text-controls__field" htmlFor="selected-shape-opacity">
                    Độ mờ ({Math.round(selectedShape.properties.opacity * 100)}%)
                    <input id="selected-shape-opacity" type="range" min="0" max="100" step="1"
                      value={Math.round(selectedShape.properties.opacity * 100)} disabled={documentActionLocked}
                      onPointerDown={() => beginShapePropertyOperation(selectedShape.id)}
                      onKeyDown={() => beginShapePropertyOperation(selectedShape.id)}
                      onChange={(event) => {
                        try {
                          canvasActionsRef.current?.setShapeProperties(selectedShape.id, {
                            opacity: Number(event.currentTarget.value) / 100,
                          });
                        } catch (error) {
                          shapePropertyErrorRef.current = error instanceof Error ? error.message : 'Độ mờ không hợp lệ.';
                          setShapeError(shapePropertyErrorRef.current);
                        }
                      }}
                      onPointerUp={finishShapePropertyOperation} onBlur={finishShapePropertyOperation} />
                  </label>
                </>
              ) : (
                <p className="text-controls__count">Chọn một hình trên ảnh hoặc thêm hình mới.</p>
              )}
              {shapeError && <p className="text-controls__error" role="alert">{shapeError}</p>}
            </section>
          ) : (
            <div className="properties-empty">
              <span className="properties-empty__icon" aria-hidden="true">◇</span>
              <strong>Công cụ chưa khả dụng</strong>
              <p>Chọn Cắt, Kích thước, Điều chỉnh, Bộ lọc, Chữ hoặc Hình khối để thao tác với ảnh.</p>
            </div>
          )}
          <div className={`properties-note${activePanelTab === 'layers' ? ' properties-note--layers' : ''}`}>
            <span className="properties-note__dot" aria-hidden="true" />
            <p>{cropPending
              ? 'Khung cắt chỉ tồn tại trong phiên đang mở và không làm thay đổi lịch sử.'
            : resizePending ? 'Áp dụng sẽ scale toàn bộ nội dung và có thể hoàn tác bằng Undo.'
                : activePanelTab === 'layers' ? 'Thay đổi hiển thị và xóa lớp được lưu trong lịch sử.'
                : adjustmentOpen || filterOpen ? 'Màu chỉ tác động ảnh nền; hình học và lớp phủ được giữ nguyên.'
                  : textToolOpen ? 'Hoàn tất mỗi phiên sửa chữ thành một bước trong lịch sử; Escape hủy phiên hiện tại.'
                    : shapeToolOpen ? 'Thêm hình, thao tác hình học hoặc đổi thuộc tính được lưu trong lịch sử.'
                  : 'Các thay đổi được lưu trong lịch sử của phiên chỉnh sửa.'}</p>
          </div>
        </aside>
      </div>

      <footer className="editor-statusbar">
        <span>{snapshot.document.width} × {snapshot.document.height} px</span>
        <span className="editor-statusbar__save" role="status" aria-live="polite" aria-atomic="true">
          {draftSaveStatus === 'NOT_SAVED' ? 'Chưa lưu'
            : draftSaveStatus === 'DIRTY' ? 'Có thay đổi chưa lưu'
                : draftSaveStatus === 'SAVING' ? 'Đang lưu…'
                  : draftSaveStatus === 'SAVED' ? 'Đã lưu trên thiết bị'
                  : 'Chưa lưu được bản nháp'}
        </span>
        {draftLease.kind !== 'owner' && (
          <span className="editor-statusbar__lease" role="status" aria-live="polite">
            {draftLease.kind === 'checking' ? 'Đang kiểm tra quyền lưu…'
              : draftLease.kind === 'held' ? 'Tab khác đang giữ quyền lưu; thay đổi ở đây chưa được tự lưu.'
                : draftLease.kind === 'error' ? 'Không kiểm tra được quyền lưu; thay đổi ở đây chưa được tự lưu.'
                  : 'Tab này không còn quyền lưu; thay đổi ở đây chưa được tự lưu.'}
            {(draftLease.kind === 'held' || draftLease.kind === 'lost' || draftLease.kind === 'error') && (
              <button type="button" className="editor-statusbar__takeover" onClick={onTakeOverDraft}>
                Lưu phiên này thay bản nháp
              </button>
            )}
          </span>
        )}
        <a href="/privacy">Quyền riêng tư</a>
      </footer>

      <dialog
        ref={exportDialogRef}
        className="export-dialog"
        aria-labelledby="export-dialog-title"
        onClose={closeExportDialog}
        onCancel={(event) => {
          if (gallerySaving) event.preventDefault();
        }}
      >
        <form method="dialog" className="dialog-close-row">
          <button className="dialog-close" type="submit" aria-label="Đóng hộp thoại xuất ảnh" disabled={gallerySaving}>×</button>
        </form>
        <p className="eyebrow">{Capacitor.getPlatform() === 'android' ? 'LƯU ẢNH VÀO THƯ VIỆN' : 'TẢI ẢNH VỀ THIẾT BỊ'}</p>
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
                disabled={exportBusy || gallerySaving}
                onChange={(event) => {
                  setExportNameBase(event.currentTarget.value);
                  clearDownload();
                }}
              />
              <span>.{exportFormat === 'jpeg' ? 'jpg' : exportFormat}</span>
            </span>
          </label>
          <label>
            Định dạng
            <select
              value={exportFormat}
              disabled={exportBusy || gallerySaving || exportSupport === null}
              onChange={(event) => {
                setExportFormat(event.currentTarget.value as ExportFormat);
                clearDownload();
              }}
            >
              <option value="png" disabled={exportSupport !== null && !exportSupport.png}>PNG{exportSupport && !exportSupport.png ? ' (không hỗ trợ)' : ''}</option>
              <option value="jpeg" disabled={exportSupport !== null && !exportSupport.jpeg}>JPG{exportSupport && !exportSupport.jpeg ? ' (không hỗ trợ)' : ''}</option>
              <option value="webp" disabled={exportSupport !== null && !exportSupport.webp}>WebP{exportSupport && !exportSupport.webp ? ' (không hỗ trợ)' : ''}</option>
            </select>
          </label>
          {exportSupport && !Object.values(exportSupport).some(Boolean) && (
            <p className="export-error" role="alert">Trình duyệt không hỗ trợ xuất PNG, JPG hoặc WebP.</p>
          )}
          {exportFormat !== 'png' && (
            <label>
              Chất lượng {exportFormat === 'jpeg' ? 'JPG' : 'WebP'}: {exportQuality}
              <input
                type="range"
                min="1"
                max="100"
                value={exportQuality}
                disabled={exportBusy || gallerySaving}
                onChange={(event) => {
                  setExportQuality(Number(event.currentTarget.value));
                  clearDownload();
                }}
              />
            </label>
          )}
          {exportFormat === 'jpeg' && (
              <label className="export-color-field">
                Nền JPG
                <input
                  type="color"
                  value={exportBackground}
                  disabled={exportBusy || gallerySaving}
                  onChange={(event) => {
                    setExportBackground(event.currentTarget.value);
                    clearDownload();
                  }}
                />
              </label>
          )}
          <p className="export-resolution">Kích thước: {snapshot.document.width} × {snapshot.document.height} px</p>
          <button className="button button-primary" type="submit" disabled={exportBusy || gallerySaving || exportSupport === null || !Object.values(exportSupport).some(Boolean)}>
            {exportBusy ? 'Đang tạo file…' : 'Tạo file'}
          </button>
        </form>
        {exportBusy && <p className="export-status" role="status" aria-live="polite">Đang render ảnh ở kích thước tài liệu… Có thể đóng hộp thoại; kết quả sẽ bị bỏ khi hoàn tất.</p>}
        {gallerySaving && <p className="export-status" role="status" aria-live="polite">Đang lưu ảnh vào thư viện…</p>}
        {galleryStatus && <p className="export-status" role="status" aria-live="polite">{galleryStatus}</p>}
        {!hasVisibleContent && (
          <p className="export-empty-warning" role="status">
            Tài liệu hiện không có nội dung hiển thị. PNG sẽ trong suốt; JPG dùng màu nền đã chọn.
          </p>
        )}
        {exportError && <p className="export-error" role="alert">{exportError}</p>}
        {downloadUrl && (
          <div className="export-ready" role="status">
            <img className="export-preview" src={downloadUrl} alt="Xem trước file ảnh đã tạo" />
            <span>{Capacitor.getPlatform() === 'android'
              ? `Ảnh đã sẵn sàng (${exportBytes.toLocaleString('vi-VN')} byte). Lưu bản xuất vào thư viện ảnh.`
              : `File đã sẵn sàng (${exportBytes.toLocaleString('vi-VN')} byte). Bấm liên kết để tải xuống.`}</span>
            {Capacitor.getPlatform() === 'android'
              ? <button className="button button-primary" type="button" onClick={() => { void saveExportToGallery(); }} disabled={gallerySaving}>Lưu vào thư viện</button>
              : <a className="button button-primary" href={downloadUrl} download={exportFilename(exportNameBase, exportFormat)}>Tải ảnh xuống</a>}
          </div>
        )}
      </dialog>
    </div>
  );
}

function PrivacyPage() {
  const android = Capacitor.getPlatform() === 'android';
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
          <p>{android
            ? 'Ảnh được đọc, giải mã và xuất ngay trên thiết bị; bản dựng không tải ảnh hay bản nháp lên máy chủ. Ứng dụng tự động lưu source ảnh, snapshot chỉnh sửa và thumbnail trong IndexedDB của ứng dụng. Ảnh chỉ được ghi vào thư viện khi bạn chủ động bấm “Lưu vào thư viện”; Android 7–9 sẽ hỏi quyền lưu trữ tại thời điểm đó. Khi mở lại, bạn có thể chọn tiếp tục chỉnh sửa, mở ảnh nguồn trong trường hợp snapshot không dùng được, hoặc xác nhận bỏ bản nháp.'
            : 'Ảnh được đọc, giải mã và xuất ngay trong trình duyệt; bản dựng không tải ảnh hay bản nháp lên máy chủ. Ứng dụng tự động lưu source ảnh, snapshot chỉnh sửa và thumbnail trong IndexedDB của origin này. Khi mở lại, bạn có thể chọn tiếp tục chỉnh sửa, mở ảnh nguồn trong trường hợp snapshot không dùng được, hoặc xác nhận bỏ bản nháp.'}</p>
        </section>
        <section className="content-card" aria-labelledby="privacy-later-title">
          <h2 id="privacy-later-title">Giới hạn bản nháp</h2>
          <p>{android
            ? 'Ứng dụng chỉ giữ một bản nháp cục bộ; dữ liệu không đồng bộ và sẽ mất khi gỡ ứng dụng hoặc xóa dữ liệu ứng dụng. Quota hệ thống có thể làm lưu thất bại. File trong thư viện chỉ được tạo khi bạn chủ động lưu bản xuất.'
            : 'Mỗi origin chỉ giữ một bản nháp trong bộ nhớ trình duyệt trên thiết bị này; dữ liệu không đồng bộ. Quota, chế độ riêng tư hoặc việc xóa dữ liệu trang có thể làm lưu thất bại hay mất dữ liệu. File tải xuống chỉ được tạo khi bạn chủ động xuất.'}</p>
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
  const [draftSessionId] = useState(createUuid);
  const state = previewState();
  const [candidate, setCandidate] = useState<ImageImportCandidate | null>(null);
  const [editorHistory, setEditorHistory] = useState<HistoryState<EditorSnapshot> | null>(null);
  const [pendingCandidate, setPendingCandidate] = useState<ImageImportCandidate | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>(idleImportStatus);
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>('NOT_SAVED');
  const [draftLease, setDraftLease] = useState<DraftLeaseView>({ kind: 'inactive' });
  const [draftInspection, setDraftInspection] = useState<DraftViewState>({ kind: 'checking' });
  const [draftBusy, setDraftBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<DraftConfirmation>(null);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [confirmationError, setConfirmationError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const editorReplaceButtonRef = useRef<HTMLButtonElement>(null);
  const activeCandidateRef = useRef<ImageImportCandidate | null>(null);
  const pendingCandidateRef = useRef<ImageImportCandidate | null>(null);
  const importControllerRef = useRef<AbortController | null>(null);
  const importGenerationRef = useRef(0);
  const restoreControllerRef = useRef<AbortController | null>(null);
  const restoreGenerationRef = useRef(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const detachImageRef = useRef<((image: FabricImage) => void) | null>(null);
  const draftAutosaveRef = useRef<DraftAutosaveController<DraftSaveRequest> | null>(null);
  const autosaveSnapshotRef = useRef<{ candidate: ImageImportCandidate | null; revision: number | null }>({ candidate: null, revision: null });
  const draftLeaseRef = useRef<DraftLeaseView>(draftLease);
  const draftLeaseChannelRef = useRef<BroadcastChannel | null>(null);
  const confirmedLeaseRef = useRef<DraftLeaseRecord | null>(null);
  const skipNextAutosaveRef = useRef(false);
  const routeRef = useRef(route);
  routeRef.current = route;
  draftLeaseRef.current = draftLease;
  const editorSnapshot = useMemo(
    () => editorHistory ? currentSnapshot(editorHistory) : null,
    [editorHistory],
  );

  const updateDraftLease = (next: DraftLeaseView) => {
    draftLeaseRef.current = next;
    setDraftLease(next);
  };

  const announceDraftLeaseChange = () => {
    draftLeaseChannelRef.current?.postMessage({ type: 'draft-lease-change' });
  };

  const checkDraftLease = async () => {
    const current = draftLeaseRef.current;
    if (!activeCandidateRef.current || current.kind === 'inactive' || current.kind === 'checking') return;
    try {
      if (current.kind === 'owner') {
        const renewed = await renewDraftLease(draftSessionId, current.lease.leaseId);
        if (renewed) {
          updateDraftLease({ kind: 'owner', lease: renewed });
          return;
        }
      }
      updateDraftLease(observedLeaseView(await readDraftLease()));
    } catch {
      updateDraftLease({
        kind: 'error',
        lease: current.kind === 'owner' || current.kind === 'held' || current.kind === 'lost' || current.kind === 'error'
          ? current.lease
          : null,
      });
    }
  };

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

  const applyResize = (snapshot: EditorSnapshot) => {
    setEditorHistory((current) => current ? commitHistory(current, snapshot) : current);
  };

  const applyAdjustments = (snapshot: EditorSnapshot) => {
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

  const cancelInFlightRestore = () => {
    const controller = restoreControllerRef.current;
    if (!controller) return;
    restoreControllerRef.current = null;
    restoreGenerationRef.current += 1;
    controller.abort();
    setDraftBusy(false);
  };

  const focusAfterDialog = () => {
    const target = returnFocusRef.current;
    if (target?.isConnected) target.focus();
    else document.querySelector<HTMLButtonElement>('.import-empty .button-primary')?.focus();
    returnFocusRef.current = null;
  };

  const cancelPendingReplacement = () => {
    const pending = pendingCandidateRef.current;
    pendingCandidateRef.current = null;
    pending?.dispose();
    setPendingCandidate(null);
    setConfirmation(null);
    setConfirmationError('');
    if (dialogRef.current?.open) dialogRef.current.close();
    focusAfterDialog();
  };

  const activateCandidate = (
    next: ImageImportCandidate,
    restored?: { snapshot: EditorSnapshot; revision: number; saved: boolean },
  ) => {
    draftAutosaveRef.current?.cancel();
    skipNextAutosaveRef.current = restored?.saved ?? false;
    setDraftSaveStatus(restored?.saved ? 'SAVED' : 'DIRTY');
    const nextHistory = createHistory(
      restored?.snapshot ?? createImageBaselineSnapshot(next.assetId, next.width, next.height),
      restored?.revision ?? 0,
    );
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
    if (importControllerRef.current || pendingCandidateRef.current || draftInspection.kind === 'checking' || draftInspection.kind === 'error') return;
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
      const metadata = await validateImageFile(file, controller.signal);
      decoded = await decodeWithFabricUrl(file, controller.signal);
      decoded.mimeType = metadata.mimeType;
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
      const savedDraftExists = ['ready', 'source-only', 'unrecoverable'].includes(draftInspection.kind);
      if (activeCandidateRef.current || savedDraftExists) {
        pendingCandidateRef.current = next;
        setPendingCandidate(next);
        setConfirmation('replace');
        setConfirmationError('');
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
    if (importControllerRef.current || pendingCandidateRef.current || draftInspection.kind === 'checking' || draftInspection.kind === 'error') return;
    returnFocusRef.current = event.currentTarget;
    setImportStatus(idleImportStatus);
    fileInputRef.current?.click();
  };

  const confirmReplacement = () => {
    const next = pendingCandidateRef.current;
    if (!next) return;
    pendingCandidateRef.current = null;
    setPendingCandidate(null);
    setConfirmation(null);
    setConfirmationError('');
    activateCandidate(next);
    setImportStatus(idleImportStatus);
    if (routeRef.current !== 'editor') navigateTo('/editor');
    if (dialogRef.current?.open) dialogRef.current.close();
    focusAfterDialog();
  };

  const refreshDraftInspection = async () => {
    setDraftInspection({ kind: 'checking' });
    try {
      setDraftInspection(await inspectCurrentDraft());
    } catch (error) {
      setDraftInspection({ kind: 'error', reason: error instanceof Error ? error.message : 'Không đọc được bản nháp đã lưu.' });
    }
  };

  const restoreSavedDraft = async (useSnapshot: boolean) => {
    if ((draftInspection.kind !== 'ready' && draftInspection.kind !== 'source-only') || restoreControllerRef.current) return false;
    const controller = new AbortController();
    const generation = ++restoreGenerationRef.current;
    restoreControllerRef.current = controller;
    setDraftBusy(true);
    let restored: ImageImportCandidate | undefined;
    let saved: SavedCurrentDraft | undefined;
    let unusedLeaseId: string | null = null;
    try {
      try {
        const claim = await acquireDraftLease(draftSessionId);
        if (claim.kind === 'acquired') {
          updateDraftLease({ kind: 'owner', lease: claim.lease });
          announceDraftLeaseChange();
          unusedLeaseId = claim.lease.leaseId;
        } else if (claim.kind === 'held') {
          updateDraftLease({ kind: 'held', lease: claim.lease });
        } else {
          updateDraftLease({ kind: 'lost', lease: claim.lease ?? null });
        }
      } catch {
        updateDraftLease({ kind: 'error', lease: null });
      }
      const latest = await inspectCurrentDraft();
      if (latest.kind !== 'ready' && latest.kind !== 'source-only') {
        setDraftInspection(latest);
        return false;
      }
      saved = latest.saved;
      restored = await decodeSavedImageAsset(saved.asset, controller.signal);
      if (controller.signal.aborted || generation !== restoreGenerationRef.current) return false;
      let snapshot: EditorSnapshot;
      if (useSnapshot) {
        snapshot = saved.draft.snapshot;
        await ensureSnapshotTextFonts(snapshot);
      } else {
        snapshot = createImageBaselineSnapshot(restored.assetId, restored.width, restored.height);
      }
      if (controller.signal.aborted || generation !== restoreGenerationRef.current) return false;
      const revision = Number.isSafeInteger(saved.draft.revision) && saved.draft.revision >= 0 ? saved.draft.revision : 0;
      activateCandidate(restored, { snapshot, revision, saved: useSnapshot });
      restored = undefined;
      unusedLeaseId = null;
      setImportStatus(idleImportStatus);
      navigateTo('/editor');
      if (confirmation) {
        setConfirmation(null);
        setConfirmationError('');
        if (dialogRef.current?.open) dialogRef.current.close();
        focusAfterDialog();
      }
      return true;
    } catch (error) {
      restored?.dispose();
      restored = undefined;
      if (controller.signal.aborted || generation !== restoreGenerationRef.current) return false;
      const reason = error instanceof Error ? error.message : 'Không thể khôi phục bản nháp.';
      if (error instanceof ImageImportError && saved) {
        setDraftInspection({ kind: 'unrecoverable', assetId: saved.asset.id, reason: `Không thể đọc ảnh nguồn: ${reason}` });
      } else if (saved) {
        setDraftInspection({ kind: 'source-only', saved, reason: `Không thể khôi phục các chỉnh sửa: ${reason}` });
      } else {
        setDraftInspection({ kind: 'error', reason });
      }
      if (confirmation) setConfirmationError(reason);
      return false;
    } finally {
      restored?.dispose();
      if (unusedLeaseId) {
        await releaseDraftLease(draftSessionId, unusedLeaseId).catch(() => undefined);
        if (draftLeaseRef.current.kind === 'owner') updateDraftLease({ kind: 'inactive' });
        announceDraftLeaseChange();
      }
      if (restoreControllerRef.current === controller) {
        restoreControllerRef.current = null;
        setDraftBusy(false);
      }
    }
  };

  const resumeSavedDraft = () => { void restoreSavedDraft(true); };
  const askOpenSource = (event: MouseEvent<HTMLButtonElement>) => {
    returnFocusRef.current = event.currentTarget;
    setConfirmationError('');
    setConfirmation('source-only');
  };
  const askDiscardDraft = (event: MouseEvent<HTMLButtonElement>) => {
    returnFocusRef.current = event.currentTarget;
    setConfirmationError('');
    setConfirmation('discard');
  };
  const askTakeOverDraft = (event: MouseEvent<HTMLButtonElement>) => {
    const current = draftLeaseRef.current;
    if (current.kind !== 'held' && current.kind !== 'lost' && current.kind !== 'error') return;
    returnFocusRef.current = event.currentTarget;
    confirmedLeaseRef.current = current.lease;
    setConfirmationError('');
    setConfirmation('takeover');
  };

  const finishConfirmation = () => {
    setConfirmation(null);
    setConfirmationError('');
    if (dialogRef.current?.open) dialogRef.current.close();
    focusAfterDialog();
  };

  const confirmDiscardDraft = async () => {
    setConfirmationBusy(true);
    setConfirmationError('');
    try {
      const observed = await readDraftLease();
      const claim = await acquireDraftLease(draftSessionId, observed);
      if (claim.kind !== 'acquired') {
        updateDraftLease(claim.kind === 'held'
          ? { kind: 'held', lease: claim.lease }
          : { kind: 'lost', lease: claim.lease ?? null });
        throw new Error('Quyền lưu đã thay đổi. Hãy kiểm tra lại rồi xác nhận bỏ bản nháp lần nữa.');
      }
      updateDraftLease({ kind: 'owner', lease: claim.lease });
      announceDraftLeaseChange();
      await deleteCurrentDraft(draftSessionId, claim.lease.leaseId);
      await releaseDraftLease(draftSessionId, claim.lease.leaseId);
      updateDraftLease({ kind: 'inactive' });
      announceDraftLeaseChange();
      setDraftInspection({ kind: 'none' });
      returnFocusRef.current = null;
      finishConfirmation();
    } catch (error) {
      setConfirmationError(error instanceof Error ? error.message : 'Không thể bỏ bản nháp.');
    } finally {
      setConfirmationBusy(false);
    }
  };

  const confirmTakeOverDraft = async () => {
    const currentCandidate = activeCandidateRef.current;
    if (!currentCandidate || !editorHistory) return;
    setConfirmationBusy(true);
    setConfirmationError('');
    draftAutosaveRef.current?.cancel();
    try {
      const claim = await acquireDraftLease(draftSessionId, confirmedLeaseRef.current);
      if (claim.kind !== 'acquired') {
        updateDraftLease(claim.kind === 'held'
          ? { kind: 'held', lease: claim.lease }
          : { kind: 'lost', lease: claim.lease ?? null });
        confirmedLeaseRef.current = claim.kind === 'held' ? claim.lease : claim.lease ?? null;
        throw new Error('Quyền lưu đã thay đổi. Hãy kiểm tra thông báo rồi xác nhận lại.');
      }
      skipNextAutosaveRef.current = true;
      updateDraftLease({ kind: 'owner', lease: claim.lease });
      announceDraftLeaseChange();
      await saveCurrentDraft(draftSessionId, claim.lease.leaseId, currentCandidate, currentSnapshot(editorHistory), editorHistory.revision);
      if (activeCandidateRef.current === currentCandidate) setDraftInspection({ kind: 'none' });
      setDraftSaveStatus('SAVED');
      finishConfirmation();
    } catch (error) {
      setDraftSaveStatus('SAVE_ERROR');
      if (error instanceof DraftLeaseError) await checkDraftLease();
      setConfirmationError(error instanceof Error ? error.message : 'Không thể lưu phiên hiện tại.');
    } finally {
      setConfirmationBusy(false);
    }
  };

  useEffect(() => {
    void refreshDraftInspection();
  }, []);

  useEffect(() => {
    if (!candidate || draftLeaseRef.current.kind !== 'inactive') return;
    updateDraftLease({ kind: 'checking' });
    void acquireDraftLease(draftSessionId).then((claim) => {
      if (claim.kind === 'acquired') {
        updateDraftLease({ kind: 'owner', lease: claim.lease });
        announceDraftLeaseChange();
      } else if (claim.kind === 'held') {
        updateDraftLease({ kind: 'held', lease: claim.lease });
      } else {
        updateDraftLease({ kind: 'lost', lease: claim.lease ?? null });
      }
    }).catch(() => updateDraftLease({ kind: 'error', lease: null }));
  }, [candidate]);

  useEffect(() => {
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('miniphoto-draft-lease');
    draftLeaseChannelRef.current = channel;
    if (channel) {
      channel.onmessage = (event: MessageEvent<unknown>) => {
        if (typeof event.data === 'object' && event.data !== null
          && (event.data as { type?: unknown }).type === 'draft-lease-change') void checkDraftLease();
      };
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkDraftLease();
    };
    const onPageHide = () => {
      const current = draftLeaseRef.current;
      if (current.kind !== 'owner') return;
      void (async () => {
        await draftAutosaveRef.current?.flush();
        await releaseDraftLease(draftSessionId, current.lease.leaseId);
        announceDraftLeaseChange();
      })().catch(() => undefined);
    };
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') void checkDraftLease();
    }, DRAFT_LEASE_HEARTBEAT_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      channel?.close();
      if (draftLeaseChannelRef.current === channel) draftLeaseChannelRef.current = null;
    };
  }, [draftSessionId]);

  useEffect(() => {
    const autosave = createDraftAutosave<DraftSaveRequest>(
      async ({ candidate: currentCandidate, leaseId, snapshot, revision }) => {
        try {
          await saveCurrentDraft(draftSessionId, leaseId, currentCandidate, snapshot, revision);
        } catch (error) {
          if (error instanceof DraftLeaseError) void checkDraftLease();
          throw error;
        }
        if (activeCandidateRef.current === currentCandidate) setDraftInspection({ kind: 'none' });
      },
      setDraftSaveStatus,
    );
    draftAutosaveRef.current = autosave;
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') void autosave.flush();
    };
    document.addEventListener('visibilitychange', flushWhenHidden);
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden);
      autosave.dispose();
      if (draftAutosaveRef.current === autosave) draftAutosaveRef.current = null;
    };
  }, []);

  useEffect(() => {
    const snapshotChanged = autosaveSnapshotRef.current.candidate !== candidate
      || autosaveSnapshotRef.current.revision !== (editorHistory?.revision ?? null);
    autosaveSnapshotRef.current = { candidate, revision: editorHistory?.revision ?? null };
    if (!candidate || !editorSnapshot || !editorHistory) {
      draftAutosaveRef.current?.cancel();
      setDraftSaveStatus('NOT_SAVED');
      return;
    }
    if (draftLease.kind !== 'owner') {
      draftAutosaveRef.current?.cancel();
      if (skipNextAutosaveRef.current) skipNextAutosaveRef.current = false;
      else if (snapshotChanged) setDraftSaveStatus('DIRTY');
      return;
    }
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    draftAutosaveRef.current?.schedule({ candidate, leaseId: draftLease.lease.leaseId, snapshot: editorSnapshot, revision: editorHistory.revision });
  }, [candidate, draftLease.kind, editorHistory, editorSnapshot]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let disposed = false;
    let listener: { remove: () => Promise<void> } | null = null;
    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
      const topDialog = dialogs.item(dialogs.length - 1);
      if (topDialog) {
        const cancel = new Event('cancel', { cancelable: true });
        topDialog.dispatchEvent(cancel);
        if (!cancel.defaultPrevented && topDialog.open) topDialog.close();
        return;
      }

      const back = new Event(ANDROID_BACK_EVENT, { cancelable: true });
      window.dispatchEvent(back);
      if (back.defaultPrevented) return;
      if (canGoBack) window.history.back();
      else void CapacitorApp.exitApp();
    }).then((registered) => {
      if (disposed) void registered.remove();
      else listener = registered;
    });
    return () => {
      disposed = true;
      if (listener) void listener.remove();
    };
  }, []);

  useEffect(() => {
    if (route === 'editor' && !candidate && draftInspection.kind === 'none') {
      window.history.replaceState({}, '', '/');
      setRoute('home');
    }
  }, [route, candidate, draftInspection]);

  const displayRoute = route === 'editor' && !candidate ? 'home' : route;

  useEffect(() => {
    if (displayRoute === 'editor') editorReplaceButtonRef.current?.focus();
  }, [displayRoute]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (confirmation && dialog && !dialog.open) dialog.showModal();
    if (!confirmation && dialog?.open) dialog.close();
  }, [confirmation]);

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
      cancelInFlightRestore();
      cancelPendingReplacement();
      document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((dialog) => dialog.close());
      window.history.pushState({}, '', destination);
      setRoute(currentRoute());
    };
    const onPopState = () => {
      cancelInFlightImport();
      cancelInFlightRestore();
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
    restoreGenerationRef.current += 1;
    restoreControllerRef.current?.abort();
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
          draft={candidate ? { kind: 'none' } : draftInspection}
          draftBusy={draftBusy}
          canImport={draftInspection.kind !== 'checking' && draftInspection.kind !== 'error' && !draftBusy}
          onChoose={openFilePicker}
          onImportFiles={(files, focusTarget) => { void importFiles(files, focusTarget); }}
          onResumeDraft={resumeSavedDraft}
          onOpenSource={askOpenSource}
          onDiscardDraft={askDiscardDraft}
          onRetryDraft={() => { void refreshDraftInspection(); }}
        />
      )}
      {displayRoute === 'editor' && candidate && editorSnapshot && (
        <EditorPage
          candidate={candidate}
          snapshot={editorSnapshot}
          status={importStatus}
          draftSaveStatus={draftSaveStatus}
          undoEnabled={editorHistory ? canUndo(editorHistory) : false}
          redoEnabled={editorHistory ? canRedo(editorHistory) : false}
          onUndo={() => setEditorHistory((current) => current ? undoHistory(current) : current)}
          onRedo={() => setEditorHistory((current) => current ? redoHistory(current) : current)}
          onTransform={transformDocument}
          onApplyCrop={applyCrop}
          onApplyResize={applyResize}
          onApplyAdjustments={applyAdjustments}
          onApplyText={applyAdjustments}
          onApplyShape={applyAdjustments}
          onApplyLayer={applyAdjustments}
          onChoose={openFilePicker}
          replaceButtonRef={editorReplaceButtonRef}
          detachImageRef={detachImageRef}
          draftLease={draftLease}
          onTakeOverDraft={askTakeOverDraft}
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
        <p className="eyebrow">{confirmation === 'discard' ? 'BỎ BẢN NHÁP' : confirmation === 'source-only' ? 'KHÔI PHỤC ẢNH NGUỒN' : confirmation === 'takeover' ? 'LƯU PHIÊN NÀY' : 'THAY ẢNH'}</p>
        <h2 id="replace-dialog-title">
          {confirmation === 'discard' ? 'Bỏ bản nháp đã lưu?'
            : confirmation === 'source-only' ? 'Mở ảnh nguồn, bỏ các chỉnh sửa?'
              : confirmation === 'takeover' ? 'Thay bản nháp bằng phiên này?'
                : candidate ? 'Thay ảnh đang mở?' : 'Thay bản nháp đã lưu?'}
        </h2>
        <p id="replace-dialog-copy">
          {confirmation === 'discard'
            ? 'Ảnh nguồn và snapshot chỉnh sửa sẽ bị xóa khỏi bộ nhớ cục bộ của ứng dụng.'
            : confirmation === 'source-only'
              ? 'Ảnh nguồn sẽ được mở với trạng thái ban đầu. Các chỉnh sửa không thể khôi phục; bản nháp cũ được giữ cho tới khi trạng thái mới lưu thành công.'
              : confirmation === 'takeover'
                ? 'Ảnh nguồn và snapshot đang mở trong tab này sẽ thay bản nháp hiện tại trên thiết bị. Tab khác sẽ mất quyền tự lưu; các thay đổi trong phiên này sẽ được ghi ngay sau khi giành quyền lưu.'
                : candidate
                  ? `Ảnh hiện tại “${candidate.source.name}” sẽ được thay bằng “${pendingCandidate?.source.name}”.`
                  : `Ảnh mới “${pendingCandidate?.source.name}” sẽ thay bản nháp “${draftInspection.kind === 'ready' || draftInspection.kind === 'source-only' ? draftInspection.saved.asset.originalFileName : 'không thể khôi phục'}”. Bản nháp cũ chỉ bị thay khi trạng thái mới lưu thành công.`}
        </p>
        {confirmationError && <p className="replace-dialog__error" role="alert">{confirmationError}</p>}
        <div className="replace-dialog__actions">
          <button className="button button-secondary" type="button" onClick={cancelPendingReplacement} autoFocus disabled={confirmationBusy || draftBusy}>
            {confirmation === 'replace' && candidate ? 'Giữ ảnh hiện tại' : 'Giữ bản nháp'}
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={confirmationBusy || draftBusy}
            onClick={() => {
              if (confirmation === 'replace') confirmReplacement();
              else if (confirmation === 'discard') void confirmDiscardDraft();
              else if (confirmation === 'source-only') void restoreSavedDraft(false);
              else if (confirmation === 'takeover') void confirmTakeOverDraft();
            }}
          >
            {confirmation === 'replace' ? 'Thay ảnh' : confirmation === 'discard' ? 'Bỏ bản nháp' : confirmation === 'source-only' ? 'Mở ảnh nguồn' : 'Lưu phiên này'}
          </button>
        </div>
      </dialog>
    </>
  );
}
