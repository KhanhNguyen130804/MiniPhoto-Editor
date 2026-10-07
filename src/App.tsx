import { useEffect, useRef, useState } from 'react';
import EditorCanvas from './features/editor/EditorCanvas';

type PreviewState = 'empty' | 'loading' | 'error';
type Route = 'home' | 'editor' | 'privacy' | 'not-found';

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
          Bản dựng này đang hoàn thiện giao diện nền tảng. Luồng nhập ảnh và các công cụ chỉnh sửa sẽ được bổ sung sau.
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

function HomeImportState({ state }: { state: PreviewState }) {
  if (state === 'loading') {
    return (
      <div className="import-state" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <strong>Đang chuẩn bị ảnh</strong>
        <span>Đang đọc ảnh trên thiết bị…</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="import-state import-state--error" role="alert">
        <span className="state-icon state-icon--error" aria-hidden="true">!</span>
        <strong>Không thể mở ảnh này</strong>
        <span>Hãy thử JPG, PNG hoặc WebP tĩnh.</span>
        <a className="text-action" href="/">Quay lại trang chủ</a>
      </div>
    );
  }

  return (
    <div className="import-empty">
      <span className="upload-glyph"><UploadGlyph /></span>
      <strong>Kéo ảnh vào đây</strong>
      <span className="import-or">hoặc</span>
      <button className="button button-primary" type="button" disabled>Chọn ảnh</button>
      <span className="format-hint">JPG · PNG · WebP tĩnh</span>
    </div>
  );
}

function HomePage({ state }: { state: PreviewState }) {
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
            <p className="build-note">Bản dựng hiện tại đang hoàn thiện giao diện; chưa nhận hoặc xử lý ảnh.</p>
          </div>

          <section className={`import-card${state === 'error' ? ' import-card--error' : ''}`} aria-labelledby="import-title">
            <div className="import-card__heading">
              <span className="card-step">01</span>
              <div>
                <p className="eyebrow">BẮT ĐẦU TẠI ĐÂY</p>
                <h2 id="import-title">Một bức ảnh là đủ</h2>
              </div>
            </div>
            <div className="import-dropzone">
              <HomeImportState state={state} />
            </div>
            <div className="import-card__footer">
              <span className="privacy-mark" aria-hidden="true">◈</span>
              <p>Luồng nhập ảnh đang được xây dựng. <a href="/privacy">Tìm hiểu về quyền riêng tư</a>.</p>
            </div>
          </section>
        </section>

        <section className="home-bottom" aria-label="Thông tin ứng dụng">
          <span>Không cần tài khoản</span>
          <span className="bottom-divider" aria-hidden="true" />
          <span>Giao diện dành cho máy tính và điện thoại</span>
          <a href="/editor">Xem không gian chỉnh sửa <span aria-hidden="true">→</span></a>
        </section>
      </main>
    </div>
  );
}

function EditorStatus({ state }: { state: PreviewState }) {
  if (state === 'loading') {
    return (
      <div className="canvas-message" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <h1>Đang chuẩn bị ảnh</h1>
        <p>Đang đọc ảnh trên thiết bị…</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="canvas-message canvas-message--error" role="alert">
        <span className="state-icon state-icon--error" aria-hidden="true">!</span>
        <h1>Không thể mở ảnh này</h1>
        <p>Hãy quay lại trang chủ để chọn một ảnh JPG, PNG hoặc WebP tĩnh.</p>
        <a className="button button-secondary" href="/">Về trang chủ</a>
      </div>
    );
  }

  return (
    <div className="canvas-message">
      <span className="empty-canvas-icon" aria-hidden="true"><UploadGlyph /></span>
      <h1>Không gian chỉnh sửa</h1>
      <p>Khu vực này đang trống; luồng chọn ảnh chưa khả dụng trong bản dựng này.</p>
      <a className="button button-secondary" href="/">Về trang chủ</a>
    </div>
  );
}

function EditorPage({ state }: { state: PreviewState }) {
  const tools = ['Cắt', 'Điều chỉnh', 'Bộ lọc', 'Chữ', 'Hình khối'];
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="editor-shell">
      <header className="editor-topbar">
        <div className="editor-topbar__start">
          <a className="back-link" href="/" aria-label="Về trang chủ">←</a>
          <Brand dark />
          <span className="editor-divider" aria-hidden="true" />
          <span className="document-name">Ảnh mới</span>
        </div>
        <div className="editor-topbar__actions">
          <button className="editor-quiet-button" type="button" disabled>Hoàn tác</button>
          <button className="editor-quiet-button" type="button" disabled>Làm lại</button>
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
          <EditorCanvas documentSize={null}>
            <EditorStatus state={state} />
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
            <strong>Chưa có ảnh</strong>
            <p>Các điều khiển sẽ xuất hiện khi bạn mở một ảnh.</p>
          </div>
          <div className="properties-note">
            <span className="properties-note__dot" aria-hidden="true" />
            <p>Ảnh gốc và các bước chỉnh sửa sẽ được quản lý riêng biệt.</p>
          </div>
        </aside>
      </div>

      <footer className="editor-statusbar">
        <span>Chưa có tài liệu</span>
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
        <p className="content-lede">Chúng tôi sẽ mô tả cách dữ liệu hoạt động theo đúng những gì ứng dụng thực sự làm.</p>

        <section className="content-card" aria-labelledby="privacy-now-title">
          <h2 id="privacy-now-title">Hiện trạng bản dựng</h2>
          <p>Bản dựng hiện tại chỉ có giao diện nền tảng. Ứng dụng chưa nhận, xử lý hoặc lưu ảnh và chưa tạo bản nháp.</p>
        </section>
        <section className="content-card" aria-labelledby="privacy-later-title">
          <h2 id="privacy-later-title">Khi tính năng chỉnh sửa được triển khai</h2>
          <p>Định hướng sản phẩm là xử lý ảnh trên thiết bị và lưu bản nháp trong bộ nhớ của trình duyệt. Nội dung này sẽ được cập nhật khi các luồng nhập, lưu và xóa hoạt động để phản ánh chính xác giới hạn dung lượng, chế độ riêng tư và cách xóa dữ liệu.</p>
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
  const route = currentRoute();
  const state = previewState();

  useEffect(() => {
    document.title = {
      home: 'MiniPhoto Editor',
      editor: 'Chỉnh sửa ảnh — MiniPhoto Editor',
      privacy: 'Quyền riêng tư — MiniPhoto Editor',
      'not-found': 'Không tìm thấy — MiniPhoto Editor',
    }[route];
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      route === 'editor' ? '#111827' : '#F8FAFC',
    );
  }, [route]);

  if (route === 'home') return <HomePage state={state} />;
  if (route === 'editor') return <EditorPage state={state} />;
  if (route === 'privacy') return <PrivacyPage />;
  return <NotFoundPage />;
}
