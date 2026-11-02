/**
 * Intent-triggered prefetch of the editor's heavy assets.
 *
 * Opening a document cold downloads ~3 MB (brotli) of engine before anything
 * renders: the DocsAPI loader, the app shell (app.js ~2 MB raw) and the SDK
 * (sdk-all-min.js + sdk-all.js, ~16 MB raw / ~3 MB compressed) of the app
 * matching the file type. On the production baseline that is ~9 s of a ~16 s
 * cold open. Prefetching it unconditionally on the landing page would waste
 * that on visitors who only read, so it is triggered by intent instead: the
 * moment a pointer hovers (or focus lands on) an Open / New button, the files
 * are requested with `<link rel="prefetch">` -- lowest priority, cached by
 * the browser (and by the service worker's stale-while-revalidate cache), so
 * the real load a moment later is a cache hit. Idempotent per URL.
 *
 * Skipped when the visitor asked for data saving or is on a 2G-class link.
 */

export type EditorKind = 'docx' | 'xlsx' | 'pptx';

const APP_DIR: Record<EditorKind, string> = {
  docx: 'documenteditor',
  xlsx: 'spreadsheeteditor',
  pptx: 'presentationeditor',
};
const SDK_DIR: Record<EditorKind, string> = { docx: 'word', xlsx: 'cell', pptx: 'slide' };

const API_LOADER = 'web-apps/apps/api/documents/api.js';
const WORD_FIRST_PAINT = ['sdkjs/common/libfont/engine/fonts.wasm'];

const requested = new Set<string>();

function connectionAllowsPrefetch(): boolean {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!conn) return true;
  if (conn.saveData) return false;
  return !(conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g');
}

/**
 * URLs (relative to the app root) that a given kind of open will need first.
 * Kept in step with the intent layer of public/landing-prefetch.js, which does
 * the same job for the landing page; test/unit/prefetch.test.ts pins them
 * together so the two cannot drift.
 */
export function editorAssetUrls(kind?: EditorKind): string[] {
  const urls = [API_LOADER];
  if (kind) {
    urls.push(
      `web-apps/apps/${APP_DIR[kind]}/main/app.js`,
      // code.js is 1.15 MB and loads on every open of this app; it was missing
      // here while app.js next to it was listed.
      `web-apps/apps/${APP_DIR[kind]}/main/code.js`,
      `sdkjs/${SDK_DIR[kind]}/sdk-all-min.js`,
      `sdkjs/${SDK_DIR[kind]}/sdk-all.js`,
    );
    // Word cannot paint common Chinese documents until the font engine and
    // Noto Sans SC regular/bold faces arrive. Starting these beside the SDK
    // removes the otherwise serial SDK -> WASM -> two large-font waterfall.
    if (kind === 'docx' && document.documentElement.lang.toLowerCase().startsWith('zh')) urls.push(...WORD_FIRST_PAINT);
  }
  return urls;
}

/** Kind for a file name / extension, or undefined when the editor cannot be predicted (csv, pdf, unknown). */
export function editorKindForFile(nameOrExt: string): EditorKind | undefined {
  const ext = nameOrExt.toLowerCase().split('.').pop() || '';
  if (ext === 'docx' || ext === 'doc') return 'docx';
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'xlsx';
  if (ext === 'pptx' || ext === 'ppt') return 'pptx';
  return undefined;
}

/**
 * Prefetch the loader and, when the kind is known, that app's shell + SDK.
 * Returns the URLs newly requested (empty when everything was already
 * requested or the connection vetoed it).
 */
export function prefetchEditorAssets(kind?: EditorKind): string[] {
  if (typeof document === 'undefined' || !connectionAllowsPrefetch()) return [];
  const added: string[] = [];
  for (const url of editorAssetUrls(kind)) {
    if (requested.has(url)) continue;
    requested.add(url);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    const isScript = url.endsWith('.js');
    link.setAttribute('as', isScript ? 'script' : 'fetch');
    if (!isScript) link.crossOrigin = 'anonymous';
    link.href = url;
    document.head.appendChild(link);
    added.push(url);
  }
  return added;
}

/**
 * Attach the intent triggers to an element: first hover / focus / touch fires
 * the prefetch once. `kind` may be a function when it depends on state.
 */
export function prefetchOnIntent(el: Element | null, kind?: EditorKind | (() => EditorKind | undefined)): void {
  if (!el) return;
  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    prefetchEditorAssets(typeof kind === 'function' ? kind() : kind);
  };
  for (const evt of ['pointerenter', 'focus', 'touchstart']) {
    el.addEventListener(evt, fire, { passive: true, once: true });
  }
}

/** Test hook. */
export function resetPrefetchState(): void {
  requested.clear();
}
