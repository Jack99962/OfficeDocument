/**
 * Wiring for the local history feature. Kept in one place so the editor entry
 * has a single call, and so the pieces that must not import each other -- the
 * save channel and the autosave scheduler -- stay uncoupled.
 */
import { requestSaveDocument, setDiskWriter, setSavedToDiskListener } from '../onlyoffice/save-stream';
import { saveToDiskFile } from '../save-target';
import { cancelPendingSnapshot, getActiveDocumentId } from './autosave';
import { extensionOf, markSavedToDisk, pruneExpired, putSnapshot, readDocumentRecord } from './store';
import { getDocmentObj } from '@ranuts/shared/store';
import { rememberActiveSource } from '../active-document-source';
import { captureSavePoint, commitSavePoint } from '../onlyoffice/save-point';
import { markDocumentSaved } from '../unsaved-guard';
import { t } from '@ranuts/shared/i18n';
import { getDocumentLifetimeSignal } from '../onlyoffice/open-state';

let browserSavePending = false;

/** User Save persists in this browser; only explicit exports reach disk. */
export async function saveDocumentToBrowser(): Promise<void> {
  if (browserSavePending) return;
  browserSavePending = true;
  const id = getActiveDocumentId();
  const source = getDocmentObj();
  const editor = window.editor;
  const isCurrent = () => getActiveDocumentId() === id && getDocmentObj() === source && window.editor === editor;
  const point = captureSavePoint();
  const signal = getDocumentLifetimeSignal();
  const message = (
    window as unknown as { message?: { success?: (text: string) => void; error?: (text: string) => void } }
  ).message;
  try {
    if (!id) throw new Error(t('documentOperationFailed'));
    const ext = extensionOf(source.fileName || 'document.docx').toUpperCase();
    const file = await requestSaveDocument(
      ({ DOC: 'DOCX', XLS: 'XLSX', PPT: 'PPTX' } as Record<string, string>)[ext] ?? ext,
    );
    if (!isCurrent()) return;
    cancelPendingSnapshot();
    const record = await readDocumentRecord(id);
    if (!isCurrent()) return;
    const doc = await putSnapshot(
      { id, title: file.name, origin: record?.doc?.origin ?? 'local', bytes: file },
      signal,
    );
    if (!doc) throw new Error(t('autosaveStopped'));
    if (!isCurrent()) return;
    await rememberActiveSource(id, file, {
      savedThroughRevision: doc.nextRev,
      historyCreatedAt: doc.createdAt,
      isCurrent,
    });
    if (!isCurrent()) return;
    if (commitSavePoint(point)) markDocumentSaved();
    message?.success?.(t('editorSavedInBrowser'));
  } catch (error) {
    message?.error?.(`${t('documentOperationFailed')}${error instanceof Error ? error.message : String(error)}`);
  } finally {
    browserSavePending = false;
  }
}

export function initDocumentHistory(): void {
  (window as Window & { __saveDocumentToBrowser?: () => Promise<void> }).__saveDocumentToBrowser =
    saveDocumentToBrowser;
  // Expiry has to happen on its own, not when someone thinks to visit the
  // history page: "this browser forgets after seven days" is only a promise if
  // nothing has to be done to collect on it.
  void pruneExpired();

  // Explicit disk exports write back to the chosen file, once the user has
  // pointed at one. The document id is what links the two, which is why this
  // is wired here rather than inside the save channel.
  setDiskWriter(async (file) => {
    const docId = getActiveDocumentId();
    if (!docId) return 'unavailable';
    const sourceName = getDocmentObj()?.fileName || file.name;
    return saveToDiskFile(docId, file, 'Document', {
      rememberTarget: extensionOf(sourceName) === extensionOf(file.name),
    });
  });

  setSavedToDiskListener(async (file, ownsExport) => {
    const id = getActiveDocumentId();
    if (!id) return;
    const isCurrent = () => getActiveDocumentId() === id && ownsExport();
    // An old autosave may still be exporting or reading bytes. It must not
    // finish after this save and acquire a newer recovery revision.
    cancelPendingSnapshot();
    const record = await readDocumentRecord(id);
    if (!record || !isCurrent()) return;
    const nextRev = record.doc?.nextRev ?? 0;
    const historyCreatedAt = record.doc?.createdAt;
    const retained = await rememberActiveSource(id, file, {
      savedThroughRevision: nextRev,
      historyCreatedAt,
      isCurrent,
    });
    if (!retained || !isCurrent()) return;
    // A snapshot made while retaining the source belongs to later edits;
    // mark only the history revision actually covered by these saved bytes.
    await markSavedToDisk(id, { nextRev, createdAt: historyCreatedAt, isCurrent });
  });
}

export {
  beginAutosaveSession,
  clearDocumentSession,
  getActiveDocumentId,
  setAutosaveEnabled,
  stopAutosaveSession,
} from './autosave';
export { isAutosaveEnabled } from './preferences';
export { clearAllHistory, deleteDoc, getLatestSnapshot, listDocs } from './store';
export type { HistoryDoc } from './types';
