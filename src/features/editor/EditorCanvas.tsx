import { Canvas, FabricImage, Rect, Textbox, type FabricObject, type TMat2D } from 'fabric';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { applyDocumentTransform, type GeometryCommand } from './engine/geometry';
import type { EditorSnapshot, TextOverlaySnapshot } from './engine/snapshot';
import { createFabricOverlays } from './engine/scene';
import { resizeCropRect, type CropHandle, type CropRatio, type CropRect } from './engine/crop';
import { applyImageAdjustments } from './engine/adjustmentFilters';
import { applyTextPropertiesPatch, createDefaultTextObject, ensureTextFontReady, normalizeTextContent, putTextOverlay, removeTextOverlay, restoreTextObject, serializeTextObject, textPropertiesFromObject, validateTextPropertiesPatch, type TextProperties, type TextPropertiesPatch } from './engine/text';

type Size = { width: number; height: number };

type EditorCanvasProps = {
  snapshot: EditorSnapshot;
  image: FabricImage | null;
  detachImageRef: { current: ((image: FabricImage) => void) | null };
  onTransform: (command: GeometryCommand) => void;
  documentActionsDisabled: boolean;
  crop: { ratio: CropRatio; rect: CropRect } | null;
  onCropChange: (rect: CropRect) => void;
  selectedTextId: string | null;
  onTextSelected: (id: string | null, text?: string, isNew?: boolean, properties?: TextProperties, cancelled?: boolean) => void;
  onTextDraftChange: (id: string, text: string) => void;
  onTextCommitted: (snapshot: EditorSnapshot) => void;
  children: ReactNode;
};

export type EditorCanvasHandle = {
  addText: () => void;
  beginTextareaEdit: (id: string) => void;
  cancelTextEdit: () => void;
  deleteSelectedText: () => void;
  finishTextEdit: () => boolean;
  beginTextPropertiesEdit: (id: string) => boolean;
  setTextProperties: (id: string, patch: TextPropertiesPatch) => Promise<boolean>;
  setTextDraft: (id: string, text: string) => void;
};

type TextEditSession = {
  id: string;
  object: Textbox;
  baseline: TextOverlaySnapshot;
  baseSnapshot: EditorSnapshot;
  isNew: boolean;
  source: 'fabric' | 'textarea' | 'properties';
  pending?: Promise<void>;
  finishAfterPending?: boolean;
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

const EditorCanvas = forwardRef<EditorCanvasHandle, EditorCanvasProps>(function EditorCanvas({
  snapshot,
  image,
  detachImageRef,
  onTransform,
  documentActionsDisabled,
  crop,
  onCropChange,
  selectedTextId,
  onTextSelected,
  onTextDraftChange,
  onTextCommitted,
  children,
}, ref) {
  const documentSize: Size = snapshot.document;
  const stageRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const documentSizeRef = useRef(documentSize);
  const imageRef = useRef(image);
  const snapshotRef = useRef(snapshot);
  const attachedImageRef = useRef<FabricImage | null>(null);
  const attachedOverlaysRef = useRef<FabricObject[]>([]);
  const textObjectsRef = useRef(new Map<string, Textbox>());
  const textIdsRef = useRef(new WeakMap<FabricObject, string>());
  const textSessionRef = useRef<TextEditSession | null>(null);
  const finishTextEditRef = useRef<() => boolean>(() => true);
  const compositionActiveRef = useRef(false);
  const finishAfterCompositionRef = useRef(false);
  const selectedTextIdRef = useRef(selectedTextId);
  const documentActionsDisabledRef = useRef(documentActionsDisabled);
  const panModeRef = useRef(false);
  const spacePanRef = useRef(false);
  const cropRef = useRef(crop);
  const propsRef = useRef({ onTransform, onTextSelected, onTextDraftChange, onTextCommitted });
  const documentClipRef = useRef<Rect | null>(null);
  const viewportSizeRef = useRef<Size>({ width: 0, height: 0 });
  const disposeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const panStartRef = useRef<PanStart | null>(null);
  const cropDragRef = useRef<CropDrag | null>(null);
  const filterFrameRef = useRef<number | null>(null);
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
  selectedTextIdRef.current = selectedTextId;
  documentActionsDisabledRef.current = documentActionsDisabled;
  panModeRef.current = panMode;
  spacePanRef.current = spacePan;
  cropRef.current = crop;
  propsRef.current = { onTransform, onTextSelected, onTextDraftChange, onTextCommitted };

  const registerTextObject = (id: string, object: Textbox) => {
    textObjectsRef.current.set(id, object);
    textIdsRef.current.set(object, id);
  };

  const notifyTextSelection = (object: FabricObject | undefined) => {
    const id = object ? textIdsRef.current.get(object) : undefined;
    const textbox = id ? textObjectsRef.current.get(id) : undefined;
    if (id && textbox) {
      propsRef.current.onTextSelected(id, normalizeTextContent(textbox.text), false, textPropertiesFromObject(textbox));
      if (!textbox.isEditing && !cropRef.current && !panModeRef.current && !spacePanRef.current) {
        stageRef.current?.focus({ preventScroll: true });
      }
    } else {
      propsRef.current.onTextSelected(null);
    }
  };

  const removePreviewObject = (id: string, object: Textbox) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.remove(object);
      canvas.requestRenderAll();
    }
    attachedOverlaysRef.current = attachedOverlaysRef.current.filter((item) => item !== object);
    textObjectsRef.current.delete(id);
  };

  const finishTextEdit = () => {
    if (compositionActiveRef.current) {
      finishAfterCompositionRef.current = true;
      return false;
    }
    const session = textSessionRef.current;
    if (!session) return true;
    if (session.pending) {
      session.finishAfterPending = true;
      return false;
    }
    textSessionRef.current = null;
    if (session.source === 'fabric' && session.object.isEditing) session.object.exitEditing();

    const text = normalizeTextContent(session.object.text);
    if (text !== session.object.text) {
      session.object.set('text', text);
      session.object.initDimensions();
      session.object.setCoords();
    }
    const next = text
      ? putTextOverlay(session.baseSnapshot, serializeTextObject(session.baseSnapshot, session.object, session.baseline))
      : removeTextOverlay(session.baseSnapshot, session.id);

    if (!text) {
      removePreviewObject(session.id, session.object);
      propsRef.current.onTextSelected(null);
    }
    snapshotRef.current = next;
    propsRef.current.onTextDraftChange(session.id, text);
    propsRef.current.onTextCommitted(next);
    canvasRef.current?.requestRenderAll();
    return true;
  };
  finishTextEditRef.current = finishTextEdit;

  const cancelTextEdit = () => {
    if (compositionActiveRef.current) return;
    const session = textSessionRef.current;
    if (!session) return;
    textSessionRef.current = null;
    if (session.isNew) {
      removePreviewObject(session.id, session.object);
      propsRef.current.onTextSelected(null);
    } else {
      restoreTextObject(session.baseSnapshot, session.object, session.baseline);
      propsRef.current.onTextDraftChange(session.id, session.baseline.text);
      propsRef.current.onTextSelected(session.id, session.baseline.text, false, textPropertiesFromObject(session.object), true);
    }
    if (session.source === 'fabric' && session.object.isEditing) session.object.exitEditing();
    if (session.source === 'textarea' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    canvasRef.current?.requestRenderAll();
  };

  const beginTextSession = (id: string, object: Textbox, source: 'fabric' | 'textarea') => {
    const active = textSessionRef.current;
    if (active?.id === id && active.source !== 'properties') {
      if (source === 'textarea') active.source = source;
      return;
    }
    if (active && !finishTextEdit()) return;
    const baseSnapshot = snapshotRef.current;
    const baseline = baseSnapshot.scene.find(
      (item): item is TextOverlaySnapshot => item.role === 'text' && item.id === id,
    );
    if (!baseline) return;
    textSessionRef.current = { id, object, baseline, baseSnapshot, isNew: false, source };
  };

  const beginTextPropertiesEdit = (id: string): boolean => {
    if (documentActionsDisabledRef.current || cropRef.current || panModeRef.current || spacePanRef.current) return false;
    const object = textObjectsRef.current.get(id);
    if (!object) return false;
    if (textSessionRef.current?.id === id && textSessionRef.current.source === 'properties') return true;
    if (textSessionRef.current && !finishTextEdit()) return false;
    const baseSnapshot = snapshotRef.current;
    const baseline = baseSnapshot.scene.find(
      (item): item is TextOverlaySnapshot => item.role === 'text' && item.id === id,
    );
    if (!baseline) return false;
    textSessionRef.current = { id, object, baseline, baseSnapshot, isNew: false, source: 'properties' };
    return true;
  };

  const setTextProperties = async (id: string, patch: TextPropertiesPatch): Promise<boolean> => {
    const session = textSessionRef.current;
    if (!session || session.id !== id || session.source !== 'properties') return false;
    if (session.pending) return false;
    validateTextPropertiesPatch(patch);
    const object = session.object;
    const fontFamily = patch.fontFamily ?? object.fontFamily as TextProperties['fontFamily'];
    const fontStyle = patch.fontStyle ?? object.fontStyle as TextProperties['fontStyle'];
    const fontWeight = patch.fontWeight ?? object.fontWeight as TextProperties['fontWeight'];
    const fontChanged = (patch.fontFamily !== undefined && patch.fontFamily !== object.fontFamily)
      || (patch.fontStyle !== undefined && patch.fontStyle !== object.fontStyle)
      || (patch.fontWeight !== undefined && patch.fontWeight !== object.fontWeight);
    if (fontChanged) {
      const pending = ensureTextFontReady(fontFamily, fontStyle, fontWeight);
      session.pending = pending;
      let loadError: unknown;
      try {
        await pending;
      } catch (error) {
        loadError = error;
      } finally {
        if (session.pending === pending) session.pending = undefined;
      }
      if (textSessionRef.current !== session) return false;
      if (loadError) {
        if (session.finishAfterPending) {
          session.finishAfterPending = false;
          finishTextEdit();
        }
        throw loadError;
      }
    }
    if (textSessionRef.current !== session) return false;
    applyTextPropertiesPatch(object, patch);
    propsRef.current.onTextSelected(id, normalizeTextContent(object.text), false, textPropertiesFromObject(object));
    canvasRef.current?.requestRenderAll();
    if (session.finishAfterPending) {
      session.finishAfterPending = false;
      finishTextEdit();
    }
    return true;
  };

  const addText = () => {
    if (documentActionsDisabledRef.current || cropRef.current || panModeRef.current || spacePanRef.current) {
      throw new Error('Tắt chế độ di chuyển hoặc hoàn tất công cụ đang mở trước khi thêm chữ.');
    }
    if (textSessionRef.current && !finishTextEdit()) return;
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Vùng chỉnh sửa đang khởi tạo. Hãy thử thêm chữ lại.');
    const id = crypto.randomUUID();
    const { object, overlay } = createDefaultTextObject(snapshotRef.current, id);
    registerTextObject(id, object);
    attachedOverlaysRef.current = [...attachedOverlaysRef.current, object];
    canvas.add(object);
    canvas.setActiveObject(object);
    const source = window.matchMedia('(max-width: 767px)').matches ? 'textarea' : 'fabric';
    textSessionRef.current = {
      id,
      object,
      baseline: overlay,
      baseSnapshot: snapshotRef.current,
      isNew: true,
      source,
    };
    propsRef.current.onTextSelected(id, overlay.text, true, textPropertiesFromObject(object));
    if (source === 'fabric') {
      object.enterEditing();
      object.selectAll();
    }
    canvas.requestRenderAll();
  };

  const beginTextareaEdit = (id: string) => {
    const object = textObjectsRef.current.get(id);
    if (!object) return;
    const active = textSessionRef.current;
    if (active?.id === id) {
      active.source = 'textarea';
      if (object.isEditing) object.exitEditing();
      return;
    }
    beginTextSession(id, object, 'textarea');
  };

  const setTextDraft = (id: string, rawText: string) => {
    const object = textObjectsRef.current.get(id);
    if (!object) return;
    const text = normalizeTextContent(rawText);
    if (object.text !== text) {
      object.set('text', text);
      object.initDimensions();
      object.setCoords();
      canvasRef.current?.requestRenderAll();
    }
  };

  const deleteSelectedText = () => {
    if (!finishTextEdit()) return;
    const id = selectedTextIdRef.current;
    const object = id ? textObjectsRef.current.get(id) : undefined;
    if (!id || !object) return;
    const next = removeTextOverlay(snapshotRef.current, id);
    if (next === snapshotRef.current) return;
    removePreviewObject(id, object);
    snapshotRef.current = next;
    canvasRef.current?.discardActiveObject();
    propsRef.current.onTextSelected(null);
    propsRef.current.onTextCommitted(next);
  };

  useImperativeHandle(ref, () => ({
    addText,
    beginTextareaEdit,
    cancelTextEdit,
    deleteSelectedText,
    finishTextEdit,
    beginTextPropertiesEdit,
    setTextProperties,
    setTextDraft,
  }));

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
    const selectedId = selectedTextIdRef.current;
    const current = attachedImageRef.current;
    const next = imageRef.current;
    const currentOverlays = attachedOverlaysRef.current;
    if (currentOverlays.length) canvas.remove(...currentOverlays);
    attachedOverlaysRef.current = [];
    textObjectsRef.current = new Map();
    textIdsRef.current = new WeakMap();
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
    const textSnapshots = snapshot.scene.filter((item): item is TextOverlaySnapshot => item.role === 'text');
    const overlays = createFabricOverlays(snapshot.scene, true);
    overlays.forEach((object) => applyDocumentTransform(object, snapshot.documentTransform));
    let textIndex = 0;
    overlays.forEach((object) => {
      if (!(object instanceof Textbox)) return;
      const text = textSnapshots[textIndex++];
      if (text) registerTextObject(text.id, object);
    });
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
    const canInteract = !documentActionsDisabledRef.current && !cropRef.current && !panModeRef.current && !spacePanRef.current;
    for (const object of textObjectsRef.current.values()) {
      object.set({ selectable: canInteract, evented: canInteract, hasControls: canInteract, hasBorders: canInteract });
    }
    const selected = canInteract && selectedId ? textObjectsRef.current.get(selectedId) : undefined;
    if (selected) {
      canvas.setActiveObject(selected);
      propsRef.current.onTextSelected(selectedId!, normalizeTextContent(selected.text), false, textPropertiesFromObject(selected));
    }
    else if (canvas.getActiveObject() instanceof Textbox) canvas.discardActiveObject();
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
    const removeCanvasListeners: Array<() => void> = [];

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

      removeCanvasListeners.push(
        canvas.on('selection:created', (event) => notifyTextSelection(event.selected[0])),
        canvas.on('selection:updated', (event) => notifyTextSelection(event.selected[0])),
        canvas.on('selection:cleared', () => notifyTextSelection(undefined)),
        canvas.on('text:editing:entered', ({ target }) => {
          if (target instanceof Textbox) {
            const id = textIdsRef.current.get(target);
            if (id) beginTextSession(id, target, 'fabric');
          }
        }),
        canvas.on('text:editing:exited', ({ target }) => {
          const id = textIdsRef.current.get(target);
          const session = textSessionRef.current;
          if (id && session?.id === id && session.source === 'fabric') finishTextEditRef.current();
        }),
        canvas.on('text:changed', ({ target }) => {
          if (!(target instanceof Textbox)) return;
          const id = textIdsRef.current.get(target);
          if (!id) return;
          const text = normalizeTextContent(target.text);
          if (target.text !== text) {
            target.set('text', text);
            target.initDimensions();
            target.setCoords();
            canvas?.requestRenderAll();
          }
          propsRef.current.onTextDraftChange(id, text);
        }),
        canvas.on('object:modified', ({ target }) => {
          if (!(target instanceof Textbox)) return;
          const id = textIdsRef.current.get(target);
          if (!id) return;
          const session = textSessionRef.current;
          if (session?.id === id && !finishTextEditRef.current()) return;
          const current = snapshotRef.current;
          const baseline = current.scene.find(
            (item): item is TextOverlaySnapshot => item.role === 'text' && item.id === id,
          );
          if (!baseline) return;
          const next = putTextOverlay(current, serializeTextObject(current, target, baseline));
          snapshotRef.current = next;
          propsRef.current.onTextSelected(id, normalizeTextContent(target.text), false, textPropertiesFromObject(target));
          propsRef.current.onTextCommitted(next);
        }),
      );

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
      removeCanvasListeners.forEach((removeListener) => removeListener());
      finishTextEditRef.current();
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
    const onCompositionStart = () => { compositionActiveRef.current = true; };
    const onCompositionEnd = () => {
      compositionActiveRef.current = false;
      if (finishAfterCompositionRef.current) {
        finishAfterCompositionRef.current = false;
        finishTextEditRef.current();
      }
    };
    document.addEventListener('compositionstart', onCompositionStart, true);
    document.addEventListener('compositionend', onCompositionEnd, true);
    return () => {
      document.removeEventListener('compositionstart', onCompositionStart, true);
      document.removeEventListener('compositionend', onCompositionEnd, true);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing || compositionActiveRef.current
        || event.defaultPrevented || !textSessionRef.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      cancelTextEdit();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canInteract = !documentActionsDisabled && !crop && !panMode && !spacePan;
    for (const object of textObjectsRef.current.values()) {
      object.set({ selectable: canInteract, evented: canInteract, hasControls: canInteract, hasBorders: canInteract });
    }
    if (!canInteract) {
      const fontPending = Boolean(textSessionRef.current?.pending);
      if (textSessionRef.current) finishTextEdit();
      if (!fontPending) {
        canvas.discardActiveObject();
        propsRef.current.onTextSelected(null);
      }
    }
    canvas.requestRenderAll();
  }, [crop, documentActionsDisabled, panMode, spacePan]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      syncScene(canvas);
    } catch {
      setCanvasError(true);
    }
  }, [image, snapshot.scene, snapshot.documentTransform, snapshot.document.width, snapshot.document.height]);

  useEffect(() => {
    if (!image) return;
    if (filterFrameRef.current !== null) cancelAnimationFrame(filterFrameRef.current);
    const targetImage = image;
    const appearance = snapshot.imageAppearance;
    filterFrameRef.current = requestAnimationFrame(() => {
      filterFrameRef.current = null;
      if (imageRef.current !== targetImage) return;
      try {
        applyImageAdjustments(targetImage, appearance);
        canvasRef.current?.requestRenderAll();
      } catch {
        setCanvasError(true);
      }
    });
    return () => {
      if (filterFrameRef.current !== null) cancelAnimationFrame(filterFrameRef.current);
      filterFrameRef.current = null;
    };
  }, [image, snapshot.imageAppearance.presetId, snapshot.imageAppearance.presetVersion,
    snapshot.imageAppearance.brightness, snapshot.imageAppearance.contrast, snapshot.imageAppearance.saturation]);

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
    if (event.key === 'Delete' && !event.nativeEvent.isComposing) {
      const target = event.target;
      const isTextInput = target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      const active = canvasRef.current?.getActiveObject();
      if (!isTextInput && active instanceof Textbox && !active.isEditing) {
        event.preventDefault();
        deleteSelectedText();
        return;
      }
    }
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
        <button type="button" aria-label="Xoay trái 90 độ" title="Xoay trái 90°" disabled={documentActionsDisabled} onClick={() => { if (finishTextEdit()) onTransform('rotate-left'); }}>
          Xoay trái
        </button>
        <button type="button" aria-label="Xoay phải 90 độ" title="Xoay phải 90°" disabled={documentActionsDisabled} onClick={() => { if (finishTextEdit()) onTransform('rotate-right'); }}>
          Xoay phải
        </button>
        <button type="button" aria-label="Lật ngang" title="Lật ngang" disabled={documentActionsDisabled} onClick={() => { if (finishTextEdit()) onTransform('flip-horizontal'); }}>
          Lật ngang
        </button>
        <button type="button" aria-label="Lật dọc" title="Lật dọc" disabled={documentActionsDisabled} onClick={() => { if (finishTextEdit()) onTransform('flip-vertical'); }}>
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
        ref={stageRef}
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
            <h1>Không thể cập nhật vùng chỉnh sửa</h1>
            <p>Hãy tải lại trang để thử khởi tạo lại canvas và ảnh xem trước.</p>
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
});

export default EditorCanvas;
