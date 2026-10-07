import { useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';
import type { FabricImage } from 'fabric';
import EditorCanvas from './features/editor/EditorCanvas';
import {
  decodeWithFabricUrl,
  ImageImportError,
  MAX_IMAGE_EDGE,
  MAX_IMAGE_PIXELS,
  validateImageFile,
  type ImageImportCandidate,
} from './features/editor/engine/imageImport';

type PreviewState = 'empty' | 'loading' | 'error';
type Route = 'home' | 'editor' | 'privacy' | 'not-found';
type ImportStatus = { phase: 'idle' | 'loading' } | { phase: 'error'; message: string };

const idleImportStatus: ImportStatus = { phase: 'idle' };

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
          Bạn có thể mở một ảnh JPG, PNG hoặc WebP tĩnh. Các công cụ chỉnh sửa và lưu ảnh sẽ được bổ sung sau.
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
            <p className="build-note">Ảnh được đọc trong trình duyệt. Các công cụ chỉnh sửa và lưu bản nháp sẽ được bổ sung sau.</p>
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
  status,
  onChoose,
  replaceButtonRef,
  detachImageRef,
}: {
  candidate: ImageImportCandidate;
  status: ImportStatus;
  onChoose: (event: MouseEvent<HTMLButtonElement>) => void;
  replaceButtonRef: RefObject<HTMLButtonElement | null>;
  detachImageRef: { current: ((image: FabricImage) => void) | null };
}) {
  const tools = ['Cắt', 'Điều chỉnh', 'Bộ lọc', 'Chữ', 'Hình khối'];
  const [panelOpen, setPanelOpen] = useState(false);

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
          <button className="editor-quiet-button" type="button" disabled>Hoàn tác</button>
          <button className="editor-quiet-button" type="button" disabled>Làm lại</button>
          <button className="editor-quiet-button" type="button" onClick={onChoose} ref={replaceButtonRef} disabled={status.phase === 'loading'}>
            Thay ảnh
          </button>
          <button className="button button-primary editor-export" type="button" disabled>Xuất ảnh</button>
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
            <button className="tool-item" type="button" disabled key={tool}>
              <span className="tool-item__icon" aria-hidden="true">{['⌗', '◐', '✧', 'T', '◇'][index]}</span>
              <span>{tool}</span>
            </button>
          ))}
        </aside>

        <main className="workspace" aria-label="Vùng làm việc">
          <EditorCanvas
            image={candidate.image}
            documentSize={{ width: candidate.width, height: candidate.height }}
            detachImageRef={detachImageRef}
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
            <span>—</span>
          </div>
          <div className="properties-empty">
            <span className="properties-empty__icon" aria-hidden="true">◇</span>
            <strong>Công cụ chưa khả dụng</strong>
            <p>Ảnh đã mở; các thao tác chỉnh sửa sẽ được bổ sung ở những ngày tiếp theo.</p>
          </div>
          <div className="properties-note">
            <span className="properties-note__dot" aria-hidden="true" />
            <p>Ảnh gốc và các bước chỉnh sửa sẽ được quản lý riêng biệt.</p>
          </div>
        </aside>
      </div>

      <footer className="editor-statusbar">
        <span>{candidate.width} × {candidate.height} px</span>
        <a href="/privacy">Quyền riêng tư</a>
      </footer>
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
          <p>Ảnh được đọc và giải mã trong trình duyệt trên thiết bị. Bản dựng chưa tải ảnh lên máy chủ, lưu bản nháp hoặc tạo file xuất; khi tải lại hay đóng trang, ảnh đang mở sẽ không được giữ lại.</p>
        </section>
        <section className="content-card" aria-labelledby="privacy-later-title">
          <h2 id="privacy-later-title">Các tính năng chưa có</h2>
          <p>Lưu bản nháp và xuất ảnh chưa được triển khai. Thông tin về dung lượng, chế độ riêng tư và cách xóa dữ liệu sẽ được bổ sung khi các luồng đó hoạt động.</p>
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

  const navigateTo = (path: string, replace = false) => {
    if (replace) window.history.replaceState({}, '', path);
    else if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setRoute(currentRoute());
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
    const previous = activeCandidateRef.current;
    if (previous && previous !== next) {
      detachImageRef.current?.(previous.image);
    }
    activeCandidateRef.current = next;
    setCandidate(next);
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
      decoded = undefined;
      if (activeCandidateRef.current) {
        pendingCandidateRef.current = next;
        setPendingCandidate(next);
      } else {
        activateCandidate(next);
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
      {displayRoute === 'editor' && candidate && (
        <EditorPage
          candidate={candidate}
          status={importStatus}
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
