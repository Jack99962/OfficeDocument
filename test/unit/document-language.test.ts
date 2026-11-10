import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  getLanguage: vi.fn(() => 'en'), loadLocale: vi.fn(), setLanguage: vi.fn(), applyDocumentLanguage: vi.fn(),
  openLocalFile: vi.fn(), getActiveDocumentId: vi.fn(() => 'same-document'),
  requestSaveDocument: vi.fn(), getReadonlyMode: vi.fn(() => false),
  getLastEditAt: vi.fn(() => 1), hasUnsavedChanges: vi.fn(() => true), markDocumentDirty: vi.fn(),
  source: { fileName: 'Untitled.docx' },
}));
vi.mock('@ranuts/shared/i18n', () => ({ ...mocks, SHELL_LOCALES: ['en', 'zh', 'ja'] }));
vi.mock('@ranuts/shared/store', () => ({ getDocmentObj: () => mocks.source }));
vi.mock('../../lib/history/store', () => ({ readDocumentRecord: vi.fn(async () => null) }));
vi.mock('../../lib/active-document-source', () => ({ rememberActiveSource: vi.fn(async () => true) }));
vi.mock('../../lib/document', () => ({ openLocalFile: mocks.openLocalFile }));
vi.mock('../../lib/history/autosave', () => ({ getActiveDocumentId: mocks.getActiveDocumentId }));
vi.mock('../../lib/onlyoffice/save-stream', () => ({ requestSaveDocument: mocks.requestSaveDocument }));
vi.mock('../../lib/onlyoffice/readonly', () => ({ getReadonlyMode: mocks.getReadonlyMode }));
vi.mock('../../lib/unsaved-guard', () => mocks);
import { changeDocumentLanguage } from '../../lib/document-language';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLastEditAt.mockReturnValue(1);
  mocks.requestSaveDocument.mockResolvedValue(new File(['latest content'], 'Untitled.docx'));
  window.history.replaceState(null, '', '/editor?locale=en&saved=same-document&readonly=0#section');
});
it('switches in place with current bytes, document identity, dirty state and URL intact', async () => {
  await changeDocumentLanguage('zh-CN');
  expect(mocks.requestSaveDocument).toHaveBeenCalledWith('DOCX');
  expect(mocks.openLocalFile).toHaveBeenCalledWith(await mocks.requestSaveDocument.mock.results[0].value, { historyId: 'same-document', readonly: false });
  expect(mocks.setLanguage).toHaveBeenCalledWith('zh');
  expect(mocks.markDocumentDirty).toHaveBeenCalledOnce();
  expect(location.pathname).toBe('/editor');
  expect(new URL(location.href).searchParams.get('saved')).toBe('same-document');
  expect(new URL(location.href).searchParams.get('locale')).toBe('zh-CN');
  expect(location.hash).toBe('#section');
});
it('keeps the existing editor and language if exporting fails', async () => {
  mocks.requestSaveDocument.mockRejectedValueOnce(new Error('export failed'));
  await expect(changeDocumentLanguage('zh-CN')).rejects.toThrow('export failed');
  expect(mocks.openLocalFile).not.toHaveBeenCalled();
  expect(mocks.setLanguage).not.toHaveBeenCalled();
  expect(new URL(location.href).searchParams.get('locale')).toBe('en');
});
it('does not replace a document edited during the export', async () => {
  mocks.getLastEditAt.mockReturnValueOnce(1).mockReturnValueOnce(2);
  await expect(changeDocumentLanguage('zh-CN')).rejects.toThrow('document changed');
  expect(mocks.openLocalFile).not.toHaveBeenCalled();
});
