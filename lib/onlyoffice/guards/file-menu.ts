import { t } from '@ranuts/shared/i18n';

interface RecentDocumentItem {
  id: string;
  title: string;
  ext: string;
  updatedAt: number;
  size: number;
}

interface FileMenuHost extends Window {
  __openLocalDocument?: () => void;
  __listRecentDocuments?: () => Promise<RecentDocumentItem[]>;
  __openRecentDocument?: (id: string) => Promise<boolean>;
}

const MARKER = 'data-local-file-menu';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function relativeTime(timestamp: number, locale: string): string {
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 5],
  ];
  let value = seconds;
  let unit: Intl.RelativeTimeFormatUnit = 'second';
  for (const [next, size] of units) {
    unit = next;
    if (Math.abs(value) < size) break;
    value = Math.round(value / size);
  }
  try {
    return new Intl.RelativeTimeFormat(locale || undefined, { numeric: 'auto' }).format(value, unit);
  } catch {
    return new Date(timestamp).toLocaleString(locale || undefined);
  }
}

function menuItem(doc: Document, id: string, label: string, icon: 'open' | 'recent'): HTMLLIElement {
  const item = doc.createElement('li');
  item.id = id;
  item.className = 'fm-btn local-file-menu-item';
  item.setAttribute('role', 'menuitem');
  const link = doc.createElement('a');
  link.href = '#';
  const mark = doc.createElement('span');
  mark.className = `menu-item-icon local-file-menu-icon local-file-menu-icon-${icon}`;
  mark.setAttribute('aria-hidden', 'true');
  const text = doc.createElement('span');
  text.textContent = label;
  link.append(mark, text);
  item.append(link);
  return item;
}

function installStyles(doc: Document): void {
  if (doc.querySelector('style[data-local-file-menu-style]')) return;
  const style = doc.createElement('style');
  style.setAttribute('data-local-file-menu-style', '');
  style.textContent = `
    #file-menu-panel .local-file-menu-icon { background-color: currentColor; background-image: none; mask: center / 18px 18px no-repeat; -webkit-mask: center / 18px 18px no-repeat; }
    #file-menu-panel .local-file-menu-icon-open { mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M3 5h7l2 2h9v12H3V5Zm2 4v8h14V9H5Z'/%3E%3C/svg%3E"); -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M3 5h7l2 2h9v12H3V5Zm2 4v8h14V9H5Z'/%3E%3C/svg%3E"); }
    #file-menu-panel .local-file-menu-icon-recent { mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 3a9 9 0 1 1-8.2 5.3L2 7V3h4l-1 1a11 11 0 1 0 2-1.2L8 4.6A9 9 0 0 1 12 3Zm-1 4h2v5.2l3.5 2.1-1 1.7-4.5-2.7V7Z'/%3E%3C/svg%3E"); -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='black' d='M12 3a9 9 0 1 1-8.2 5.3L2 7V3h4l-1 1a11 11 0 1 0 2-1.2L8 4.6A9 9 0 0 1 12 3Zm-1 4h2v5.2l3.5 2.1-1 1.7-4.5-2.7V7Z'/%3E%3C/svg%3E"); }
    #file-menu-panel #panel-local-recent { padding: 28px 30px; overflow: auto; }
    #panel-local-recent .local-recent-title { display:block; font-size:16px; margin-bottom:20px; color:var(--text-normal); }
    #panel-local-recent .local-recent-list { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:12px; max-width:1100px; }
    #panel-local-recent .local-recent-row { appearance:none; text-align:left; min-width:0; padding:13px 14px; border:var(--scaled-one-pixel,1px) solid var(--border-regular-control); border-radius:3px; background:var(--background-normal); color:var(--text-normal); cursor:pointer; }
    #panel-local-recent .local-recent-row:hover,#panel-local-recent .local-recent-row:focus { background:var(--highlight-button-hover); outline:none; }
    #panel-local-recent .local-recent-name { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; }
    #panel-local-recent .local-recent-meta { display:block; margin-top:7px; color:var(--text-secondary); font-size:11px; }
    #panel-local-recent .local-recent-empty { color:var(--text-secondary); }
  `;
  doc.head.append(style);
}

/**
 * Adds host-owned Open and Recent entries to the vendor File menu.
 * The guard only depends on the common File-menu DOM shared by Word, Sheet and
 * Slide, and is idempotent because the iframe preparation loop calls it often.
 */
export function installLocalFileMenu(win: Window): boolean {
  const doc = win.document;
  const root = doc.querySelector<HTMLElement>('#file-menu-panel');
  const menu = root?.querySelector<HTMLElement>('.panel-menu');
  const context = root?.querySelector<HTMLElement>('.panel-context');
  if (!root || !menu || !context) return false;
  if (root.hasAttribute(MARKER)) return true;

  installStyles(doc);
  const open = menuItem(doc, 'file-menu-local-open', t('historyOpenFile'), 'open');
  const recent = menuItem(doc, 'file-menu-local-recent', t('editorRecentFiles'), 'recent');
  const divider = doc.createElement('li');
  divider.className = 'devider devider-small local-file-menu-divider';
  divider.setAttribute('aria-hidden', 'true');

  const firstDivider = menu.querySelector('li.devider');
  if (firstDivider) firstDivider.after(open, recent, divider);
  else menu.prepend(open, recent, divider);

  const panel = doc.createElement('div');
  panel.id = 'panel-local-recent';
  panel.className = 'content-box';
  panel.style.display = 'none';
  const title = doc.createElement('label');
  title.className = 'local-recent-title';
  title.textContent = t('editorRecentFiles');
  const list = doc.createElement('div');
  list.className = 'local-recent-list';
  panel.append(title, list);
  context.append(panel);

  const host = win.parent as FileMenuHost;
  const hideCustomPanel = (): void => {
    panel.style.display = 'none';
    recent.classList.remove('active');
  };
  const showRecent = async (): Promise<void> => {
    menu.querySelectorAll('.fm-btn.active').forEach((item) => item.classList.remove('active'));
    context.querySelectorAll<HTMLElement>(':scope > .content-box').forEach((item) => (item.style.display = 'none'));
    recent.classList.add('active');
    panel.style.display = 'block';
    list.replaceChildren();

    let documents: RecentDocumentItem[] = [];
    try {
      documents = (await host.__listRecentDocuments?.()) ?? [];
    } catch {
      documents = [];
    }
    if (!documents.length) {
      const empty = doc.createElement('div');
      empty.className = 'local-recent-empty';
      empty.textContent = t('editorRecentFilesEmpty');
      list.append(empty);
      return;
    }
    for (const item of documents) {
      const row = doc.createElement('button');
      row.type = 'button';
      row.className = 'local-recent-row';
      row.title = item.title;
      row.dataset.documentId = item.id;
      const name = doc.createElement('span');
      name.className = 'local-recent-name';
      name.textContent = item.title;
      const meta = doc.createElement('span');
      meta.className = 'local-recent-meta';
      meta.textContent = `${item.ext.toUpperCase() || 'FILE'} · ${formatSize(item.size)} · ${relativeTime(item.updatedAt, doc.documentElement.lang)}`;
      row.append(name, meta);
      row.addEventListener('click', () => void host.__openRecentDocument?.(item.id));
      list.append(row);
    }
  };

  open.addEventListener('click', (event) => {
    event.preventDefault();
    host.__openLocalDocument?.();
  });
  recent.addEventListener('click', (event) => {
    event.preventDefault();
    void showRecent();
  });
  menu.addEventListener(
    'click',
    (event) => {
      const item = (event.target as Element | null)?.closest('li.fm-btn');
      if (item && item !== recent && item !== open) hideCustomPanel();
    },
    true,
  );

  root.setAttribute(MARKER, '');
  return true;
}
