import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
const script = readFileSync('public/loading-i18n.js', 'utf8');
afterEach(() => { document.body.innerHTML = ''; localStorage.clear(); document.cookie = 'locale=;max-age=0;path=/'; });
it('localizes the initial mask before the application bundle loads, including all supported locales', () => {
  document.body.innerHTML = '<div id="openuse-loading"><p class="loading-message"></p><p class="loading-hint"></p><a class="loading-link"></a></div>';
  history.replaceState(null, '', '/editor?locale=de');
  new Function(script)();
  const mask = document.getElementById('openuse-loading')!;
  expect(mask.textContent).toContain('Das Tool wird geöffnet');
  expect(mask.getAttribute('aria-label')).toBe('Tool wird geladen');
  const expected = { 'zh-CN': '正在打开工具', en: 'Opening the tool', ja: 'ツールを開いています', ko: '도구를 여는 중', de: 'Das Tool wird geöffnet', es: 'Abriendo la herramienta', 'pt-BR': 'Abrindo a ferramenta' };
  for (const [language, text] of Object.entries(expected)) {
    window.OpenUseLoadingI18n!.apply(mask, language);
    expect(mask.querySelector('.loading-message')!.textContent).toContain(text);
  }
  window.OpenUseLoadingI18n!.apply(mask, 'de', true);
  expect(mask.querySelector('.loading-message')!.textContent).toBe('Wird noch geladen…');
  window.dispatchEvent(new CustomEvent('languagechange', { detail: { language: 'ja' } }));
  expect(mask.querySelector('.loading-message')!.textContent).toBe('引き続き読み込んでいます…');
  expect(mask.querySelector('.loading-link')!.textContent).toContain('ほかのオンラインツール');
});
