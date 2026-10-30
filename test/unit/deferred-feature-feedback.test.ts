import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDeferredFeatureFeedback } from '../../lib/onlyoffice/guards/deferred-feature-feedback';

describe('deferred editor feature feedback', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-deferred-feature-feedback');
    document.body.innerHTML = '<button id="print-document">Print</button><button id="bold">Bold</button>';
    delete (window as Window & { AscCommon?: unknown }).AscCommon;
    delete (window as Window & { __notifyDeferredFeature?: () => void }).__notifyDeferredFeature;
  });

  it('notifies for an optional action while the export runtime is absent', () => {
    const notify = vi.fn();
    (window as Window & { __notifyDeferredFeature?: () => void }).__notifyDeferredFeature = notify;
    expect(installDeferredFeatureFeedback(window)).toBe(true);
    document.querySelector<HTMLButtonElement>('#print-document')!.click();
    expect(notify).toHaveBeenCalledOnce();
  });

  it('does not notify for core editing or after the runtime is ready', () => {
    const notify = vi.fn();
    (window as Window & { __notifyDeferredFeature?: () => void }).__notifyDeferredFeature = notify;
    (window as Window & { AscCommon?: { x2t: object } }).AscCommon = { x2t: {} };
    installDeferredFeatureFeedback(window);
    document.querySelector<HTMLButtonElement>('#bold')!.click();
    document.querySelector<HTMLButtonElement>('#print-document')!.click();
    expect(notify).not.toHaveBeenCalled();
  });
});
