import { StrictMode, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import { armNextDraftSaveAbortForManualCheck, readCurrentDraft } from '../../src/features/editor/engine/draftStore';

const result = document.querySelector<HTMLOutputElement>('#harness-result')!;
if (!import.meta.env.DEV || window.location.hostname !== '127.0.0.1' || window.location.port !== '5175') {
  result.textContent = 'Harness chỉ chạy ở chế độ dev trên http://127.0.0.1:5175.';
  throw new Error('Day 21 save-error harness requires the isolated development origin.');
}
const observedSaveStatuses: string[] = [];
const appRoot = document.querySelector<HTMLDivElement>('#root')!;
const saveStatusObserver = new MutationObserver(() => {
  const status = appRoot.querySelector('.editor-statusbar__save')?.textContent?.trim();
  if (status && observedSaveStatuses.at(-1) !== status) observedSaveStatuses.push(status);
});
saveStatusObserver.observe(appRoot, { childList: true, characterData: true, subtree: true });

window.history.replaceState({}, '', '/');
createRoot(appRoot).render(
  createElement(StrictMode, null, createElement(App)),
);

document.querySelector<HTMLButtonElement>('#arm-save-error')!.addEventListener('click', () => {
  try {
    armNextDraftSaveAbortForManualCheck();
    result.textContent = 'Đã bật: transaction ghi draft kế tiếp sẽ abort.';
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : String(error);
  }
});

document.querySelector<HTMLButtonElement>('#read-stored-draft')!.addEventListener('click', async () => {
  try {
    const saved = await readCurrentDraft();
    result.textContent = saved
      ? `Draft đã lưu: ${saved.asset.originalFileName}; revision ${saved.draft.revision}; updatedAt ${saved.draft.updatedAt}.`
      : 'Chưa có draft trong IndexedDB.';
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : String(error);
  }
});

document.querySelector<HTMLButtonElement>('#read-save-status-history')!.addEventListener('click', () => {
  result.textContent = `Statusbar: ${observedSaveStatuses.join(' → ') || 'chưa có trạng thái'}.`;
});
