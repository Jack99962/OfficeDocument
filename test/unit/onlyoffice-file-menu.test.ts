import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installLocalFileMenu } from '../../lib/onlyoffice/guards/file-menu';

function mountFileMenu(): void {
  document.documentElement.lang = 'en';
  document.body.innerHTML = `
    <div id="file-menu-panel">
      <ul class="panel-menu">
        <li class="fm-btn" id="existing"><a href="#">Existing</a></li>
        <li class="devider"></li>
        <li class="fm-btn active" id="print"><a href="#">Print</a></li>
      </ul>
      <div class="panel-context"><div id="panel-print" class="content-box"></div></div>
    </div>`;
}

describe('local editor File menu', () => {
  beforeEach(() => {
    document.head.querySelectorAll('[data-local-file-menu-style]').forEach((node) => node.remove());
    mountFileMenu();
    delete (window as Window & { __openLocalDocument?: () => void }).__openLocalDocument;
    delete (window as Window & { __listRecentDocuments?: () => Promise<unknown> }).__listRecentDocuments;
    delete (window as Window & { __openRecentDocument?: (id: string) => Promise<boolean> }).__openRecentDocument;
  });

  it('adds Open and Recent once and delegates opening to the host', () => {
    const open = vi.fn();
    (window as Window & { __openLocalDocument?: () => void }).__openLocalDocument = open;

    expect(installLocalFileMenu(window)).toBe(true);
    expect(installLocalFileMenu(window)).toBe(true);
    expect(document.querySelectorAll('#file-menu-local-open')).toHaveLength(1);
    expect(document.querySelectorAll('#file-menu-local-recent')).toHaveLength(1);

    (document.querySelector('#file-menu-local-open a') as HTMLAnchorElement).click();
    expect(open).toHaveBeenCalledOnce();
  });

  it('renders recent browser history and reopens the chosen document', async () => {
    const reopen = vi.fn(async () => true);
    (window as Window & { __listRecentDocuments?: () => Promise<unknown> }).__listRecentDocuments = async () => [
      { id: 'doc-1', title: 'Budget.xlsx', ext: 'xlsx', updatedAt: Date.now(), size: 2048 },
    ];
    (window as Window & { __openRecentDocument?: (id: string) => Promise<boolean> }).__openRecentDocument = reopen;
    installLocalFileMenu(window);

    (document.querySelector('#file-menu-local-recent a') as HTMLAnchorElement).click();
    await vi.waitFor(() => expect(document.querySelector('.local-recent-row')).not.toBeNull());
    expect(document.querySelector('.local-recent-name')?.textContent).toBe('Budget.xlsx');
    expect(document.querySelector('.local-recent-meta')?.textContent).toContain('XLSX · 2 KB');

    (document.querySelector('.local-recent-row') as HTMLButtonElement).click();
    expect(reopen).toHaveBeenCalledWith('doc-1');
  });

  it('restores vendor panels when another File-menu category is chosen', async () => {
    (window as Window & { __listRecentDocuments?: () => Promise<unknown> }).__listRecentDocuments = async () => [];
    installLocalFileMenu(window);
    (document.querySelector('#file-menu-local-recent a') as HTMLAnchorElement).click();
    await vi.waitFor(() =>
      expect((document.querySelector('#panel-local-recent') as HTMLElement).style.display).toBe('block'),
    );

    (document.querySelector('#print a') as HTMLAnchorElement).click();
    expect((document.querySelector('#panel-local-recent') as HTMLElement).style.display).toBe('none');
    expect(document.querySelector('#file-menu-local-recent')?.classList.contains('active')).toBe(false);
  });
});
