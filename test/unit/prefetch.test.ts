import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  editorAssetUrls,
  editorKindForFile,
  prefetchEditorAssets,
  prefetchOnIntent,
  resetPrefetchState,
} from '../../lib/prefetch';

const links = () => [...document.head.querySelectorAll('link[rel="prefetch"]')].map((l) => l.getAttribute('href'));

afterEach(() => {
  resetPrefetchState();
  document.head.querySelectorAll('link[rel="prefetch"]').forEach((l) => l.remove());
  Object.defineProperty(navigator, 'connection', { configurable: true, value: undefined });
  document.documentElement.lang = 'en';
  vi.restoreAllMocks();
});

describe('editor asset prefetch', () => {
  it('maps a kind to its loader + app shell + SDK bundles', () => {
    expect(editorAssetUrls()).toEqual(['web-apps/apps/api/documents/api.js']);
    expect(editorAssetUrls('xlsx')).toEqual([
      'web-apps/apps/api/documents/api.js',
      'web-apps/apps/spreadsheeteditor/main/app.js',
      'web-apps/apps/spreadsheeteditor/main/code.js',
      'sdkjs/cell/sdk-all-min.js',
      'sdkjs/cell/sdk-all.js',
    ]);
    expect(editorAssetUrls('docx')).not.toContain('sdkjs/common/libfont/engine/fonts.wasm');
    document.documentElement.lang = 'zh-CN';
    expect(editorAssetUrls('docx').at(-1)).toBe('sdkjs/common/libfont/engine/fonts.wasm');
  });

  it('predicts the editor from a file name (csv -> spreadsheet, pdf -> unknown)', () => {
    expect(editorKindForFile('a.DOC')).toBe('docx');
    expect(editorKindForFile('report.csv')).toBe('xlsx');
    expect(editorKindForFile('deck.ppt')).toBe('pptx');
    expect(editorKindForFile('scan.pdf')).toBeUndefined();
  });

  it('adds typed prefetch links per URL and never repeats a URL', () => {
    document.documentElement.lang = 'zh-CN';
    expect(prefetchEditorAssets('docx')).toHaveLength(editorAssetUrls('docx').length);
    expect(links()).toEqual(editorAssetUrls('docx'));
    expect(prefetchEditorAssets('docx')).toEqual([]);
    // Another kind only adds what is new (the loader is shared).
    // Derived, not a literal: the list has grown twice and each time a hard-coded
    // count here had to be chased down separately.
    expect(prefetchEditorAssets('pptx')).toHaveLength(editorAssetUrls('pptx').length - 1);
    expect(document.head.querySelector('link[rel="prefetch"]')?.getAttribute('as')).toBe('script');
    expect(document.head.querySelector('link[href="sdkjs/common/libfont/engine/fonts.wasm"]')?.getAttribute('as')).toBe(
      'fetch',
    );
  });

  it('respects Save-Data and 2G-class connections', () => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
    expect(prefetchEditorAssets('docx')).toEqual([]);
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { effectiveType: '2g' } });
    expect(prefetchEditorAssets('docx')).toEqual([]);
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { effectiveType: '4g' } });
    expect(prefetchEditorAssets('docx')).toHaveLength(editorAssetUrls('docx').length);
  });

  it('prefetchOnIntent fires once on the first hover/focus/touch', () => {
    const btn = document.createElement('button');
    prefetchOnIntent(btn, 'xlsx');
    btn.dispatchEvent(new Event('focus'));
    btn.dispatchEvent(new Event('pointerenter'));
    expect(links()).toEqual(editorAssetUrls('xlsx'));
    expect(links()).toHaveLength(editorAssetUrls('xlsx').length);
    prefetchOnIntent(null); // tolerated
  });
});
