import { Canvas, FabricImage, Rect, type FabricObject, type TMat2D } from 'fabric';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { applyDocumentTransform, type GeometryCommand } from './engine/geometry';
import type { EditorSnapshot } from './engine/snapshot';
import { createFabricOverlays } from './engine/scene';
import { resizeCropRect, type CropHandle, type CropRatio, type CropRect } from './engine/crop';

type Size = { width: number; height: number };

type EditorCanvasProps = {
  snapshot: EditorSnapshot;
  image: FabricImage | null;
  detachImageRef: { current: ((image: FabricImage) => void) | null };
  onTransform: (command: GeometryCommand) => void;
  documentActionsDisabled: boolean;
  crop: { ratio: CropRatio; rect: CropRect } | null;
  onCropChange: (rect: CropRect) => void;
  children: ReactNode;
};

type PanStart = { pointerId: number; x: number; y: number; transform: TMat2D };
type CropDrag = { pointerId: number; handle: CropHandle; start: { x: number; y: number }; rect: CropRect };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.2;
const FREE_CROP_HANDLES: readonly Exclude<CropHandle, 'move'>[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const FIXED_CROP_HANDLES: readonly Exclude<CropHandle, 'move'>[] = ['ne', 'se', 'sw', 'nw'];
const CROP_HANDLE_LABELS: Record<Exclude<CropHandle, 'move'>, string> = {
  n: 'cạnh trên', ne: 'góc trên phải', e: 'cạnh phải', se: 'góc dưới phải',
  s: 'cạnh dưới', sw: 'góc dưới trái', w: 'cạnh trái', nw: 'góc trên trái',
};

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

export default function EditorCanvas({ snapshot, image, detachImageRef, onTransform, documentActionsDisabled, crop, onCropChange, children }: EditorCanvasProps) {
  const documentSize: Size = snapshot.document;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const documentSizeRef = useRef(documentSize);
  const imageRef = useRef(image);
  const snapshotRef = useRef(snapshot);
  const attachedImageRef = useRef<FabricImage | null>(null);
  const attachedOverlaysRef = useRef<FabricObject[]>([]);
  const documentClipRef = useRef<Rect | null>(null);
  const viewportSizeRef = useRef<Size>({ width: 0, height: 0 });
  const disposeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const panStartRef = useRef<PanStart | null>(null);
  const cropDragRef = useRef<CropDrag | null>(null);
  const [viewportSize, setViewportSize] = useState<Size>({ width: 0, height: 0 });
  const [viewportTransform, setViewportTransform] = useState<TMat2D>([1, 0, 0, 1, 0, 0]);
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
      canvas.remove(...attachedOverlaysRef.current);
      attachedOverlaysRef.current = [];
      canvas.requestRenderAll();
    }
  };

  const syncScene = (canvas: Canvas) => {
    const current = attachedImageRef.current;
    const next = imageRef.current;
    const currentOverlays = attachedOverlaysRef.current;
    if (currentOverlays.length) canvas.remove(...currentOverlays);
    attachedOverlaysRef.current = [];
    if (current && current !== next) {
      canvas.remove(current);
      attachedImageRef.current = null;
    }
    if (next) {
      const snapshot = snapshotRef.current;
      const sources = snapshot.scene.filter((item) => item.role === 'source-image');
      const source = sources[0];
      if (sources.length !== 1 || !source || snapshot.scene[0] !== source) {
        throw new Error('Snapshot must have one source image at the bottom of its scene.');
      }
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

    const snapshot = snapshotRef.current;
    const overlays = createFabricOverlays(snapshot.scene);
    overlays.forEach((object) => applyDocumentTransform(object, snapshot.documentTransform));
    if (overlays.length) canvas.add(...overlays);
    attachedOverlaysRef.current = overlays;

    const clip = documentClipRef.current ?? new Rect({
      left: 0,
      top: 0,
      width: snapshot.document.width,
      height: snapshot.document.height,
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false,
    });
    clip.set({ width: snapshot.document.width, height: snapshot.document.height });
    documentClipRef.current = clip;
    canvas.clipPath = clip;
    canvas.requestRenderAll();
  };

  const syncViewportTransform = (canvas = canvasRef.current) => {
    if (canvas) setViewportTransform([...canvas.viewportTransform] as TMat2D);
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
        syncViewportTransform(canvas);
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
      syncScene(canvas);

      const currentDocument = documentSizeRef.current;
      if (validSize(currentDocument)) {
        const initialZoom = fitZoom(currentDocument, initialSize);
        centerDocument(canvas, currentDocument, initialSize, initialZoom);
        syncViewportTransform(canvas);
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
        currentCanvas.remove(...attachedOverlaysRef.current);
        attachedOverlaysRef.current = [];
        currentCanvas.clipPath = undefined;
        documentClipRef.current = null;
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
      syncScene(canvas);
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
    syncViewportTransform(canvas);
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
    syncViewportTransform(canvas);
    setZoom(boundedZoom);
  };

  const fitDocument = () => {
    if (!canControlViewport || !validSize(documentSize)) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fittedZoom = fitZoom(documentSize, viewportSize);
    centerDocument(canvas, documentSize, viewportSize, fittedZoom);
    syncViewportTransform(canvas);
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
    syncViewportTransform(canvas);
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panStartRef.current?.pointerId !== event.pointerId) return;
    panStartRef.current = null;
    setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const startCropDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!crop || panMode || spacePan || event.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-crop-handle]')
      : null;
    const handle = (target?.dataset.cropHandle ?? 'move') as CropHandle;
    event.preventDefault();
    event.stopPropagation();
    cropDragRef.current = {
      pointerId: event.pointerId,
      handle,
      start: canvas.getScenePoint(event.nativeEvent),
      rect: crop.rect,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveCropDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = cropDragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas || drag.pointerId !== event.pointerId || !crop) return;
    event.preventDefault();
    event.stopPropagation();
    onCropChange(resizeCropRect(
      drag.rect,
      drag.handle,
      drag.start,
      canvas.getScenePoint(event.nativeEvent),
      documentSizeRef.current,
      crop.ratio,
    ));
  };

  const endCropDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (cropDragRef.current?.pointerId !== event.pointerId) return;
    cropDragRef.current = null;
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

  const [a, b, c, d, e, f] = viewportTransform;
  const cropFrameStyle: CSSProperties | undefined = crop ? {
    left: a * crop.rect.x + c * crop.rect.y + e,
    top: b * crop.rect.x + d * crop.rect.y + f,
    width: a * crop.rect.width,
    height: d * crop.rect.height,
  } : undefined;
  const cropHandles = crop?.ratio === 'free' ? FREE_CROP_HANDLES : FIXED_CROP_HANDLES;

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
        {crop && cropFrameStyle && (
          <div className="crop-overlay">
            <div
              className="crop-frame"
              role="group"
              aria-label="Khung cắt. Kéo để di chuyển; dùng các trường số để chỉnh chính xác."
              style={cropFrameStyle}
              onPointerDown={startCropDrag}
              onPointerMove={moveCropDrag}
              onPointerUp={endCropDrag}
              onPointerCancel={endCropDrag}
              onLostPointerCapture={endCropDrag}
            >
              {cropHandles.map((handle) => (
                <span
                  key={handle}
                  className={`crop-handle crop-handle--${handle}`}
                  data-crop-handle={handle}
                  aria-hidden="true"
                  title={`Đổi ${CROP_HANDLE_LABELS[handle]}`}
                />
              ))}
            </div>
          </div>
        )}
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
