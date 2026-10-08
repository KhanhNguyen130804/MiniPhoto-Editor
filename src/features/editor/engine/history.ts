const MAX_UNDO_STEPS = 50;
const MAX_HISTORY_BYTES = 10 * 1024 * 1024;

type HistoryEntry = { readonly json: string; readonly bytes: number };

export type HistoryState<T> = {
  readonly entries: readonly HistoryEntry[];
  readonly index: number;
  readonly revision: number;
  readonly totalBytes: number;
  readonly snapshotType?: T;
};

function assertJsonValue(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    throw new TypeError('History snapshots must contain finite numbers.');
  }
  if (typeof value !== 'object' || ancestors.has(value)) {
    throw new TypeError('History snapshots must be acyclic JSON data.');
  }
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype
    && Object.getPrototypeOf(value) !== null) {
    throw new TypeError('History snapshots must use plain objects.');
  }
  if (Object.getOwnPropertySymbols(value).length) throw new TypeError('History snapshots cannot contain symbol keys.');

  ancestors.add(value);
  for (const child of Array.isArray(value) ? value : Object.values(value)) assertJsonValue(child, ancestors);
  ancestors.delete(value);
}

function encode<T>(snapshot: T): HistoryEntry {
  let json: string | undefined;
  try {
    assertJsonValue(snapshot);
    json = JSON.stringify(snapshot);
  } catch {
    throw new TypeError('History snapshots must be JSON-serializable.');
  }
  if (json === undefined) throw new TypeError('History snapshots must be JSON-serializable.');

  const entry = { json, bytes: new TextEncoder().encode(json).byteLength };
  if (entry.bytes > MAX_HISTORY_BYTES) throw new RangeError('History snapshot exceeds 10 MiB.');
  return entry;
}

function createState<T>(entries: HistoryEntry[], index: number, revision: number, totalBytes: number): HistoryState<T> {
  return Object.freeze({
    entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
    index,
    revision,
    totalBytes,
  });
}

export function createHistory<T>(baseline: T, initialRevision = 0): HistoryState<T> {
  if (!Number.isSafeInteger(initialRevision) || initialRevision < 0) throw new RangeError('History revision must be a non-negative safe integer.');
  const entry = encode(baseline);
  return createState([entry], 0, initialRevision, entry.bytes);
}

export function currentSnapshot<T>(history: HistoryState<T>): T {
  const entry = history.entries[history.index];
  if (!entry) throw new Error('History has no current snapshot.');
  return JSON.parse(entry.json) as T;
}

export function canUndo<T>(history: HistoryState<T>): boolean {
  return history.index > 0;
}

export function canRedo<T>(history: HistoryState<T>): boolean {
  return history.index < history.entries.length - 1;
}

export function commitHistory<T>(history: HistoryState<T>, snapshot: T): HistoryState<T> {
  const next = encode(snapshot);
  if (history.entries[history.index]?.json === next.json) return history;

  const entries = [...history.entries.slice(0, history.index + 1), next];
  let totalBytes = entries.reduce((total, entry) => total + entry.bytes, 0);
  while (entries.length > MAX_UNDO_STEPS + 1 || totalBytes > MAX_HISTORY_BYTES) {
    totalBytes -= entries.shift()!.bytes;
  }
  return createState(entries, entries.length - 1, history.revision + 1, totalBytes);
}

export function undoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  return canUndo(history)
    ? createState([...history.entries], history.index - 1, history.revision + 1, history.totalBytes)
    : history;
}

export function redoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  return canRedo(history)
    ? createState([...history.entries], history.index + 1, history.revision + 1, history.totalBytes)
    : history;
}

export { MAX_HISTORY_BYTES, MAX_UNDO_STEPS };
