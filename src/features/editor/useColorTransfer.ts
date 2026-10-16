import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeColorReference, colorTransferKey, normalizeColorTransfer } from './engine/colorTransfer';
import { ImageImportError, type ImageImportCandidate } from './engine/imageImport';
import type { ColorTransferSettings, EditorSnapshot } from './engine/snapshot';

type PendingColor = {
  base: EditorSnapshot;
  settings: ColorTransferSettings;
  snapshot: EditorSnapshot;
  request: number;
  ready: boolean;
};
type ReferencePreview = { url: string; filename: string; key: string };

export function useColorTransfer(
  candidate: ImageImportCandidate,
  snapshot: EditorSnapshot,
  onCommit: (next: EditorSnapshot) => void,
  beforeChoose: () => boolean,
) {
  const props = useRef({ candidate, snapshot, onCommit, beforeChoose });
  props.current = { candidate, snapshot, onCommit, beforeChoose };
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const nextRequest = useRef(0);
  const pendingRef = useRef<PendingColor | null>(null);
  const previewRef = useRef<ReferencePreview | null>(null);
  const actionRef = useRef<(() => void) | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [pending, setPending] = useState<PendingColor | null>(null);
  const [reference, setReference] = useState<ReferencePreview | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [strengthInput, setStrengthInput] = useState(String(snapshot.imageAppearance.colorTransfer?.strength ?? 70));
  const [strengthError, setStrengthError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const releaseUnmatchedReference = useCallback((settings: ColorTransferSettings | null) => {
    if (previewRef.current && previewRef.current.key !== colorTransferKey(settings)) {
      URL.revokeObjectURL(previewRef.current.url);
      previewRef.current = null;
      setReference(null);
    }
  }, []);
  const setDraft = (next: PendingColor | null) => {
    pendingRef.current = next;
    setPending(next);
  };
  const stage = (settings: ColorTransferSettings, base = pendingRef.current?.base ?? props.current.snapshot) => {
    setDraft({
      base, settings, request: ++nextRequest.current, ready: false,
      snapshot: { ...base, imageAppearance: { ...base.imageAppearance, colorTransfer: normalizeColorTransfer(settings) } },
    });
  };
  const abort = () => {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    setAnalyzing(false);
  };
  const cancel = () => {
    abort();
    setDraft(null);
    setError('');
    setStrengthError('');
    setStrengthInput(String(props.current.snapshot.imageAppearance.colorTransfer?.strength ?? 70));
    releaseUnmatchedReference(props.current.snapshot.imageAppearance.colorTransfer);
  };
  const choose = () => {
    if (props.current.beforeChoose()) inputRef.current?.click();
  };
  const loadFiles = async (files: File[]) => {
    if (!files.length) return;
    if (files.length !== 1) { setError('Vui lòng chọn đúng một ảnh mẫu mỗi lần.'); return; }
    abort();
    const job = new AbortController();
    const token = generation.current;
    const current = props.current;
    controller.current = job;
    setAnalyzing(true);
    setError('');
    try {
      const result = await analyzeColorReference(current.candidate, current.snapshot, files[0]!, job.signal);
      if (job.signal.aborted || generation.current !== token || props.current.candidate !== current.candidate
        || props.current.snapshot !== current.snapshot) return;
      const next = { url: URL.createObjectURL(result.thumbnail), filename: result.filename, key: colorTransferKey(result.settings) };
      if (previewRef.current) URL.revokeObjectURL(previewRef.current.url);
      previewRef.current = next;
      setReference(next);
      setStrengthInput('70');
      setStrengthError('');
      stage(result.settings, pendingRef.current?.base ?? current.snapshot);
    } catch (failure) {
      if (job.signal.aborted || generation.current !== token) return;
      const messages = {
        EMPTY_FILE: 'Ảnh mẫu đang rỗng. Hãy chọn tệp khác.',
        FILE_TOO_LARGE: 'Ảnh mẫu vượt giới hạn 20 MiB.',
        UNSUPPORTED_FORMAT: 'Ảnh mẫu phải là JPG, PNG hoặc WebP tĩnh có định dạng hợp lệ.',
        ANIMATED_IMAGE: 'Ảnh mẫu động chưa được hỗ trợ. Hãy chọn ảnh tĩnh.',
        IMAGE_TOO_LARGE: 'Ảnh mẫu vượt giới hạn 12 MP hoặc cạnh 8192 px.',
        DECODE_FAILED: 'Không đọc được ảnh mẫu. Hãy chọn tệp khác hoặc chuyển định dạng.',
      };
      setError(failure instanceof ImageImportError ? messages[failure.code]
        : failure instanceof Error ? failure.message : 'Không phân tích được ảnh mẫu. Hãy chọn lại.');
    } finally {
      if (controller.current === job) { controller.current = null; setAnalyzing(false); }
    }
  };
  const changeStrength = (raw: string) => {
    setStrengthInput(raw);
    const strength = Number(raw);
    if (!raw.trim() || !Number.isInteger(strength) || strength < 0 || strength > 100) {
      setStrengthError('Nhập số nguyên từ 0 đến 100.');
      return;
    }
    setStrengthError('');
    setError('');
    const settings = pendingRef.current?.settings ?? props.current.snapshot.imageAppearance.colorTransfer;
    if (!settings) return;
    stage({ ...settings, strength });
  };
  const apply = (): boolean => {
    const draft = pendingRef.current;
    if (!draft || !draft.ready || controller.current || strengthError || props.current.snapshot !== draft.base) return false;
    props.current.onCommit(draft.snapshot);
    setDraft(null);
    setError('');
    return true;
  };
  const clear = () => {
    if (pendingRef.current || controller.current || !props.current.snapshot.imageAppearance.colorTransfer) return;
    const base = props.current.snapshot;
    props.current.onCommit({ ...base, imageAppearance: { ...base.imageAppearance, colorTransfer: null } });
  };
  const onRenderResult = useCallback((request: number, message?: string) => {
    const draft = pendingRef.current;
    if (!draft || request !== draft.request) return;
    if (message) {
      pendingRef.current = null;
      setPending(null);
      setStrengthInput(String(props.current.snapshot.imageAppearance.colorTransfer?.strength ?? 70));
      setStrengthError('');
      releaseUnmatchedReference(props.current.snapshot.imageAppearance.colorTransfer);
      setError('Không xem thử được màu mẫu trên trình duyệt này. Các chỉnh sửa trước đó được giữ. Hãy thử lại hoặc chọn mẫu khác.');
    } else if (!draft.ready) {
      const ready = { ...draft, ready: true };
      pendingRef.current = ready;
      setPending(ready);
    }
  }, [releaseUnmatchedReference]);
  const requestAction = (action: () => void) => {
    if (!pendingRef.current && !controller.current) { action(); return; }
    actionRef.current = action;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirming(true);
  };
  const resolveAction = (resolution: 'apply' | 'discard' | 'stay') => {
    if (resolution === 'apply' && !apply()) return;
    if (resolution === 'discard') cancel();
    const action = actionRef.current;
    actionRef.current = null;
    setConfirming(false);
    dialogRef.current?.close();
    returnFocus.current?.focus({ preventScroll: true });
    if (resolution !== 'stay') action?.();
  };
  useEffect(() => {
    const dialog = dialogRef.current;
    if (confirming && dialog && !dialog.open) dialog.showModal();
  }, [confirming]);
  useEffect(() => {
    if (pendingRef.current && pendingRef.current.base !== snapshot) cancel();
    if (controller.current) abort();
    releaseUnmatchedReference(snapshot.imageAppearance.colorTransfer);
    if (!pendingRef.current) setStrengthInput(String(snapshot.imageAppearance.colorTransfer?.strength ?? 70));
    // Canonical changes invalidate jobs; UI state changes do not.
  }, [snapshot]);
  useEffect(() => {
    cancel();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current.url);
    previewRef.current = null;
    setReference(null);
    setConfirming(false);
    actionRef.current = null;
  }, [candidate.assetId]);
  useEffect(() => () => {
    generation.current++;
    controller.current?.abort();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current.url);
  }, []);
  const previewSnapshot = pending?.snapshot ?? snapshot;
  const displayed = pending?.settings ?? snapshot.imageAppearance.colorTransfer;
  return {
    inputRef, dialogRef, analyzing, pending: Boolean(pending), active: analyzing || Boolean(pending),
    reference: reference && reference.key === colorTransferKey(displayed) ? reference : null,
    error, strengthInput, strengthError, displayed, previewSnapshot,
    request: pending?.request, canApply: Boolean(pending?.ready) && !analyzing && !strengthError,
    confirming, choose, loadFiles, changeStrength, apply, cancel, clear, requestAction, resolveAction, onRenderResult,
  };
}

export type ColorTransferController = ReturnType<typeof useColorTransfer>;
