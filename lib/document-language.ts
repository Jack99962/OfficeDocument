import { applyDocumentLanguage, getLanguage, loadLocale, setLanguage, SHELL_LOCALES, type Language } from '@ranuts/shared/i18n';
import { getDocmentObj } from '@ranuts/shared/store';
import { openLocalFile } from './document';
import { getActiveDocumentId } from './history/autosave';
import { readDocumentRecord } from './history/store';
import { rememberActiveSource } from './active-document-source';
import { requestSaveDocument } from './onlyoffice/save-stream';
import { getReadonlyMode } from './onlyoffice/readonly';
import { getLastEditAt, hasUnsavedChanges, markDocumentDirty } from './unsaved-guard';

let changing = false;

/** Recreate only the editor frame, using its current bytes and existing identity. */
export async function changeDocumentLanguage(value: string): Promise<void> {
  const language = (value === 'zh-CN' ? 'zh' : value) as Language;
  if (!SHELL_LOCALES.includes(language)) throw new Error('Unsupported language');
  if (changing) throw new Error('A language change is already in progress');
  if (language === getLanguage()) return;
  const id = getActiveDocumentId();
  if (!id) throw new Error('Wait for the document to finish opening');
  const source = getDocmentObj();
  const editor = window.editor;
  const dirty = hasUnsavedChanges();
  const editedAt = getLastEditAt();
  const readonly = getReadonlyMode();
  const previous = getLanguage();
  changing = true;
  // Prevent edits while exporting the bytes that will populate the new frame.
  const frames = [...document.querySelectorAll('iframe')];
  const inert = frames.map(frame => frame.inert);
  frames.forEach(frame => { frame.inert = true; });
  try {
    await loadLocale(language);
    const ext = source.fileName.split('.').pop()!.toUpperCase();
    const file = readonly && source.file ? source.file : await requestSaveDocument(
      ({ DOC: 'DOCX', XLS: 'XLSX', PPT: 'PPTX' } as Record<string, string>)[ext] ?? ext,
    );
    if (getActiveDocumentId() !== id || getDocmentObj() !== source || window.editor !== editor || getLastEditAt() !== editedAt) {
      throw new Error('The document changed; please try switching language again');
    }
    setLanguage(language);
    applyDocumentLanguage();
    try {
      await openLocalFile(file, { historyId: id, readonly });
    } catch (error) {
      setLanguage(previous);
      applyDocumentLanguage();
      throw error;
    }
    // These exact bytes supersede earlier recovery points. Otherwise a later
    // reload could restore a snapshot older than the text we just reopened.
    const reopened = getDocmentObj();
    const isCurrent = () => getActiveDocumentId() === id && getDocmentObj() === reopened;
    const record = await readDocumentRecord(id);
    if (isCurrent()) await rememberActiveSource(id, file, {
      savedThroughRevision: record?.doc?.nextRev ?? 0,
      historyCreatedAt: record?.doc?.createdAt,
      isCurrent,
    });
    // Reopening is not a user save: keep the unsaved-changes protection.
    if (dirty) markDocumentDirty();
    const url = new URL(location.href);
    url.searchParams.set('locale', value);
    window.history.replaceState(null, '', url);
    document.cookie = `locale=${encodeURIComponent(value)};path=/;max-age=31536000;samesite=lax`;
  } finally {
    frames.forEach((frame, index) => { frame.inert = inert[index]; });
    changing = false;
  }
}
