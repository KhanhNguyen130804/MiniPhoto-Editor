import { Canvas } from 'fabric';
import { useEffect, useRef, useState, type ReactNode } from 'react';

type Size = { width: number; height: number };

type EditorCanvasProps = {
  documentSize: Size | null;
  children: ReactNode;
};

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.2;

function validSize(size: Size | null): size is Size {
  return size !== null
    && Number.isFinite(size.width)
    && Number.isFinite(size.height)
    && size.width > 0
    && size.height > 0;
}

function measure(element: HTMLElement): Size {
  const bounds = element.getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
  };
}

function centerDocument(canvas: Canvas, documentSize: Size, viewportSize: Size, zoom: number) {
  canvas.setViewportTransform([
    zoom,
    0,
    0,
    zoom,
    (viewportSize.width - documentSize.width * zoom) / 2,
    (viewportSize.height - documentSize.height * zoom) / 2,
  ]);
}

function fitZoom(documentSize: Size, viewportSize: Size) {
  return Math.min(viewportSize.width / documentSize.width, viewportSize.height / documentSize.height, MAX_ZOOM);
}

export default function EditorCanvas({ documentSize, children }: EditorCanvasProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const documentSizeRef = useRef(documentSize);
  const viewportSizeRef = useRef<Size>({ width: 0, height: 0 });
  const disposeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [viewportSize, setViewportSize] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [canvasError, setCanvasError] = useState(false);

  documentSizeRef.current = documentSize;

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    let active = true;
    let canvas: Canvas | undefined;
    let observer: ResizeObserver | undefined;

    const resize = (width: number, height: number) => {
      if (!canvas) return;
      const nextSize = {
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
      };
      const previousSize = viewportSizeRef.current;
      if (nextSize.width === previousSize.width && nextSize.height === previousSize.height) return;

      canvas.setDimensions(nextSize);
      viewportSizeRef.current = nextSize;
      setViewportSize(nextSize);

      const currentDocument = documentSizeRef.current;
      if (validSize(currentDocument)) {
        centerDocument(canvas, currentDocument, nextSize, canvas.getZoom());
      }
    };

    const initialize = async () => {
      await disposeQueueRef.current;
      if (!active) return;

      const initialSize = measure(surface);
      const element = document.createElement('canvas');
      surface.appendChild(element);

      try {
        canvas = new Canvas(element, {
          width: initialSize.width,
          height: initialSize.height,
          selection: false,
        });
      } catch (error) {
        element.closest('.canvas-container')?.remove();
        element.remove();
        throw error;
      }

      canvasRef.current = canvas;
      viewportSizeRef.current = initialSize;
      setViewportSize(initialSize);

      const currentDocument = documentSizeRef.current;
      if (validSize(currentDocument)) {
        const initialZoom = fitZoom(currentDocument, initialSize);
        centerDocument(canvas, currentDocument, initialSize, initialZoom);
        setZoom(initialZoom);
      }

      observer = new ResizeObserver(([entry]) => {
        if (!entry) return;
        try {
          resize(entry.contentRect.width, entry.contentRect.height);
        } catch {
          if (active) setCanvasError(true);
        }
      });
      observer.observe(surface);
    };

    void initialize().catch(() => {
      if (active) setCanvasError(true);
    });

    return () => {
      active = false;
      observer?.disconnect();
      const currentCanvas = canvas;
      if (currentCanvas) {
        if (canvasRef.current === currentCanvas) canvasRef.current = null;
        disposeQueueRef.current = disposeQueueRef.current.then(async () => {
          await currentCanvas.dispose();
        });
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportSizeRef.current;
    if (!validSize(documentSize)) {
      setZoom(1);
      return;
    }
    if (!canvas || viewport.width < 1 || viewport.height < 1) return;

    const nextZoom = fitZoom(documentSize, viewport);
    centerDocument(canvas, documentSize, viewport, nextZoom);
    setZoom(nextZoom);
  }, [documentSize?.width, documentSize?.height]);

  const canControlViewport = !canvasError
    && validSize(documentSize)
    && viewportSize.width > 0
    && viewportSize.height > 0;

  const changeZoom = (nextZoom: number) => {
    if (!canControlViewport || !validSize(documentSize)) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const boundedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    centerDocument(canvas, documentSize, viewportSize, boundedZoom);
    setZoom(boundedZoom);
  };

  const fitDocument = () => {
    if (!canControlViewport || !validSize(documentSize)) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fittedZoom = fitZoom(documentSize, viewportSize);
    centerDocument(canvas, documentSize, viewportSize, fittedZoom);
    setZoom(fittedZoom);
  };

  return (
    <>
      <div className="canvas-stage">
        <div className="canvas-surface" ref={surfaceRef} aria-hidden="true" />
        {canvasError ? (
          <div className="canvas-message canvas-runtime-error" role="alert">
            <span className="state-icon state-icon--error" aria-hidden="true">!</span>
            <h1>Không thể mở vùng chỉnh sửa</h1>
            <p>Hãy tải lại trang để thử khởi tạo canvas lần nữa.</p>
          </div>
        ) : children}
      </div>
      <div className="workspace-controls">
        <span>
          Kích thước tài liệu
          <strong>{validSize(documentSize) ? `${documentSize.width} × ${documentSize.height} px` : '— × — px'}</strong>
        </span>
        <div className="zoom-controls" aria-label="Điều khiển thu phóng">
          <button
            type="button"
            disabled={!canControlViewport || zoom <= MIN_ZOOM}
            aria-label="Thu nhỏ"
            onClick={() => changeZoom(zoom / ZOOM_STEP)}
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            disabled={!canControlViewport || zoom >= MAX_ZOOM}
            aria-label="Phóng to"
            onClick={() => changeZoom(zoom * ZOOM_STEP)}
          >
            +
          </button>
          <button className="fit-button" type="button" disabled={!canControlViewport} onClick={fitDocument}>
            Vừa khung
          </button>
        </div>
      </div>
    </>
  );
}
