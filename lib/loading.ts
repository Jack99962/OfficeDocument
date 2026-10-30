import { isDocumentContentReady } from './onlyoffice/open-state';

const LOADING_ID = 'openuse-loading';
let activeMask: HTMLElement | null = null;
let activeUsers = 0;
let removalTimer: number | undefined;

function createLoadingMask(): HTMLElement {
  const mask = document.createElement('div');
  mask.id = LOADING_ID;
  mask.className = 'loading-mask';
  mask.setAttribute('role', 'status');
  mask.setAttribute('aria-label', '工具正在加载');
  mask.innerHTML = `
    <div class="loading-content">
      <div class="loading-logo" aria-label="OpenUse">
        <span style="--i:0">O</span><span style="--i:1">p</span><span style="--i:2">e</span><span style="--i:3">n</span><span style="--i:4">U</span><span style="--i:5">s</span><span style="--i:6">e</span>
      </div>
      <p class="loading-message">正在打开工具，请稍候…</p>
      <p class="loading-hint">首次加载可能需要约 30 秒，之后通常更快</p>
      <a class="loading-link" href="https://whogogo.com" target="_blank" rel="noopener noreferrer">探索更多在线工具 ↗</a>
    </div>`;
  return mask;
}

// The static mask in editor.html is painted before the application bundle, so
// cold Word/Excel/PowerPoint starts never show a blank page. Later document
// opens create the same mask on demand.
export const showLoading = (): { removeLoading: (force?: boolean) => void } => {
  const existing = document.getElementById(LOADING_ID);
  const mask = existing ?? createLoadingMask();
  if (!existing) document.body.appendChild(mask);
  activeMask = mask;
  activeUsers += 1;
  window.clearTimeout(removalTimer);
  mask.classList.remove('is-hidden');

  const message = mask.querySelector<HTMLElement>('.loading-message');
  const hint = mask.querySelector<HTMLElement>('.loading-hint');
  const slowTimer = window.setTimeout(() => {
    if (!mask.isConnected) return;
    if (message) message.textContent = '还在努力加载中…';
    if (hint) hint.textContent = '网络较慢时可能需要多一点时间';
  }, 30_000);

  let released = false;
  const hide = () => {
    if (activeMask !== mask || activeUsers > 0) return;
    window.removeEventListener('document:content-ready', hide);
    mask.classList.add('is-hidden');
    removalTimer = window.setTimeout(() => {
      if (activeMask === mask && activeUsers === 0) {
        mask.remove();
        activeMask = null;
      }
    }, 400);
  };

  return {
    removeLoading: (force = false) => {
      if (released) return;
      released = true;
      window.clearTimeout(slowTimer);
      activeUsers = Math.max(0, activeUsers - 1);
      if (force || isDocumentContentReady()) hide();
      else window.addEventListener('document:content-ready', hide, { once: true });
    },
  };
};
