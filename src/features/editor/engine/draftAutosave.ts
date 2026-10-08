export type DraftSaveStatus = 'NOT_SAVED' | 'DIRTY' | 'SAVING' | 'SAVED' | 'SAVE_ERROR';

export type DraftAutosaveController<T> = {
  schedule(request: T): void;
  flush(): Promise<void>;
  cancel(): void;
  dispose(): void;
};

export function createDraftAutosave<T>(
  save: (request: T) => Promise<void>,
  onStatus: (status: DraftSaveStatus) => void,
  delayMs = 800,
): DraftAutosaveController<T> {
  let latest: T | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active: Promise<void> | null = null;
  let flushRequested = false;
  let disposed = false;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const drain = async (): Promise<void> => {
    while (!disposed && latest !== null && flushRequested) {
      if (active) {
        await active;
        continue;
      }
      const request = latest;
      flushRequested = false;
      onStatus('SAVING');
      const saving = (async () => {
        try {
          await save(request);
          if (!disposed && latest === request) {
            onStatus('SAVED');
            latest = null;
          } else if (!disposed && latest !== null) onStatus('DIRTY');
        } catch {
          if (!disposed && latest === request) onStatus('SAVE_ERROR');
          else if (!disposed && latest !== null) onStatus('DIRTY');
        }
      })();
      active = saving;
      await saving;
      if (active === saving) active = null;
    }
  };

  return {
    schedule(request) {
      if (disposed) return;
      latest = request;
      flushRequested = false;
      clearTimer();
      onStatus('DIRTY');
      timer = setTimeout(() => {
        timer = null;
        flushRequested = true;
        void drain();
      }, delayMs);
    },
    flush() {
      if (disposed || latest === null) return Promise.resolve();
      clearTimer();
      flushRequested = true;
      return drain();
    },
    cancel() {
      clearTimer();
      latest = null;
      flushRequested = false;
    },
    dispose() {
      disposed = true;
      clearTimer();
      latest = null;
      flushRequested = false;
    },
  };
}
