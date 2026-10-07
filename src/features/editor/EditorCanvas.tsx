import { Canvas, FabricImage, type TMat2D } from 'fabric';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { applyDocumentTransform, type GeometryCommand } from './engine/geometry';
import type { EditorSnapshot } from './engine/snapshot';

type Size = { width: number; height: number };

type EditorCanvasProps = {
  snapshot: EditorSnapshot;
  image: FabricImage | null;
  detachImageRef: { current: ((image: FabricImage) => void) | null };
  onTransform: (command: GeometryCommand) => void;
  documentActionsDisabled: boolean;
  children: ReactNode;
};

type PanStart = { pointerId: number; x: number; y: number; transform: TMat2D };

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

export default function EditorCanvas({ snapshot, image, detachImageRef, onTransform, documentActionsDisabled, children }: EditorCanvasProps) {
  const documentSize: Size = snapshot.document;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const documentSizeRef = useRef(documentSize);
  const imageRef = useRef(image);
  const snapshotRef = useRef(snapshot);
  const attachedImageRef = useRef<FabricImage | null>(null);
  const viewportSizeRef = useRef<Size>({ width: 0, height: 0 });
  const disposeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const panStartRef = useRef<PanStart | null>(null);
  const [viewportSize, setViewportSize] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [panMode, setPanMode] = useState(false);
  const [spacePan, setSpacePan] = useState(false);
  const [panning, setPanning] = useState(false);
  const [canvasError, setCanvasError] = useState(false);

  documentSizeRef.current = documentSize;
  imageRef.current = image;
  snapshotRef.current = snapshot;

  const detachImage = (target: FabricImage) => {
    const canvas = canvasRef.current;
    if (canvas && attachedImageRef.current === target) {
      canvas.remove(target);
      attachedImageRef.current = null;
      canvas.requestRenderAll();
    }
  };

  const syncImage = (canvas: Canvas) => {
    const current = attachedImageRef.current;
    const next = imageRef.current;
    if (current && current !== next) {
      canvas.remove(current);
      attachedImageRef.current = null;
    }
    if (next) {
      const source = snapshotRef.current.scene.find((item) => item.role === 'source-image');
      if (!source) throw new Error('Snapshot is missing its source image.');
      next.set({
        left: source.left,
        top: source.top,
        scaleX: source.scaleX,
        scaleY: source.scaleY,
        angle: source.angle,
        flipX: source.flipX,
        flipY: source.flipY,
        opacity: source.opacity,
        visible: source.visible,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
      });
      applyDocumentTransform(next, snapshotRef.current.documentTransform);
    }
    if (next && attachedImageRef.current !== next) {
      attachedImageRef.current = next;
      canvas.add(next);
    }
    canvas.requestRenderAll();
  };

  useEffect(() => {
    detachImageRef.current = detachImage;
    const surface = surfaceRef.current;
    if (!surface) return () => { detachImageRef.current = null; };

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
      syncImage(canvas);

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
        const attachedImage = attachedImageRef.current;
        if (attachedImage) {
          currentCanvas.remove(attachedImage);
          attachedImageRef.current = null;
        }
        if (canvasRef.current === currentCanvas) canvasRef.current = null;
        disposeQueueRef.current = disposeQueueRef.current.then(async () => {
          await currentCanvas.dispose();
        });
      }
      detachImageRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      syncImage(canvas);
    } catch {
      setCanvasError(true);
    }
  }, [image, snapshot]);

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
  }, [documentSize?.width, documentSize?.height, image]);

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

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((!panMode && !spacePan) || event.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    panStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      transform: [...canvas.viewportTransform] as TMat2D,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
  };

  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = panStartRef.current;
    const canvas = canvasRef.current;
    if (!start || !canvas || start.pointerId !== event.pointerId) return;
    const [a, b, c, d, e, f] = start.transform;
    canvas.setViewportTransform([
      a, b, c, d,
      e + event.clientX - start.x,
      f + event.clientY - start.y,
    ]);
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panStartRef.current?.pointerId !== event.pointerId) return;
    panStartRef.current = null;
    setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleStageKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    if (event.repeat) return;
    setSpacePan(true);
  };

  const handleStageKeyUp = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.code === 'Space') setSpacePan(false);
  };

  return (
    <>
      <div className="canvas-toolbar" role="toolbar" aria-label="Thao tác tài liệu">
        <button type="button" aria-label="Xoay trái 90 độ" title="Xoay trái 90°" disabled={documentActionsDisabled} onClick={() => onTransform('rotate-left')}>
          Xoay trái
        </button>
        <button type="button" aria-label="Xoay phải 90 độ" title="Xoay phải 90°" disabled={documentActionsDisabled} onClick={() => onTransform('rotate-right')}>
          Xoay phải
        </button>
        <button type="button" aria-label="Lật ngang" title="Lật ngang" disabled={documentActionsDisabled} onClick={() => onTransform('flip-horizontal')}>
          Lật ngang
        </button>
        <button type="button" aria-label="Lật dọc" title="Lật dọc" disabled={documentActionsDisabled} onClick={() => onTransform('flip-vertical')}>
          Lật dọc
        </button>
        <button
          type="button"
          aria-pressed={panMode}
          aria-label="Bật chế độ di chuyển khung nhìn"
          className={panMode ? 'canvas-pan-toggle canvas-pan-toggle--active' : 'canvas-pan-toggle'}
          onClick={() => setPanMode((active) => !active)}
        >
          Di chuyển
        </button>
      </div>
      <div
        className={`canvas-stage${panMode || spacePan ? ' canvas-stage--pan' : ''}${panning ? ' canvas-stage--panning' : ''}`}
        tabIndex={0}
        aria-label="Vùng xem ảnh. Giữ Space và kéo, hoặc bật chế độ Di chuyển."
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onLostPointerCapture={endPan}
        onKeyDown={handleStageKeyDown}
        onKeyUp={handleStageKeyUp}
        onBlur={() => setSpacePan(false)}
      >
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
