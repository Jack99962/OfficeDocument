interface DeferredFeatureHost extends Window {
  __notifyDeferredFeature?: () => void;
}

const MARKER = 'data-deferred-feature-feedback';
const DEFERRED_ACTION = [
  '[id*="print"]',
  '[id*="download"]',
  '[id*="save-as"]',
  '[class*="print"]',
  '[class*="download"]',
].join(',');

/**
 * Export and print are intentionally outside the cold-open critical path.
 * Let the vendor handle the click normally, but explain the first-use wait
 * while its x2t conversion runtime is still arriving.
 */
export function installDeferredFeatureFeedback(win: Window): boolean {
  const doc = win.document;
  const root = doc.documentElement;
  if (!root) return false;
  if (root.hasAttribute(MARKER)) return true;

  doc.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element | null;
      if (!target?.closest(DEFERRED_ACTION)) return;
      const x2t = (win as Window & { AscCommon?: { x2t?: unknown } }).AscCommon?.x2t;
      if (!x2t) (win.parent as DeferredFeatureHost).__notifyDeferredFeature?.();
    },
    true,
  );
  root.setAttribute(MARKER, '');
  return true;
}
