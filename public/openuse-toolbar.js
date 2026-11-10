// OpenUse 1.0.0, self-hosted to work offline and under COEP require-corp.
(function () {
  function start() {
    var params = new URLSearchParams(location.search);
    if (
      window.parent !== window ||
      ['embed', 'embedded'].some(function (key) {
        return params.has(key) && ['', '1', 'true'].includes(params.get(key));
      })
    )
      return;
    if (!window.OpenUse) return;

    var root = document.documentElement;
    var appPage = /^\/(editor|history)(\.html)?\/?$/.test(location.pathname);
    var languages = [
      { value: 'en', label: 'English' },
      { value: 'zh-CN', label: '中文' },
      { value: 'ja', label: '日本語' },
      { value: 'ko', label: '한국어' },
      { value: 'de', label: 'Deutsch' },
      { value: 'es', label: 'Español' },
      { value: 'pt', label: 'Português' },
    ];
    function language() {
      var value = root.lang || 'en';
      var currentParams = new URLSearchParams(location.search);
      if (appPage && currentParams.get('locale')) value = currentParams.get('locale');
      if (value === 'zh') value = 'zh-CN';
      return languages.some(function (item) {
        return item.value === value;
      })
        ? value
        : 'en';
    }
    function theme() {
      try {
        var stored = localStorage.getItem('ran-theme');
        if (['system', 'light', 'dark'].includes(stored)) return stored;
      } catch {}
      return 'system';
    }
    var themeSwitch = document.querySelector('r-theme-switch');
    var ownsSwitch = !themeSwitch;
    if (ownsSwitch) {
      themeSwitch = document.createElement('r-theme-switch');
      themeSwitch.hidden = true;
      document.body.appendChild(themeSwitch);
    }
    var toolbar = window.OpenUse.mount({
      defaultPosition: 'right-center',
      languages: languages,

      commandTimeout: 240000,
      language: language(),
      theme: theme(),
      onLanguageChange: async function (value) {
        if (/^\/editor(\.html)?\/?$/.test(location.pathname)) {
          if (!window.__changeDocumentLanguage) throw new Error('Wait for the editor to finish loading');
          await window.__changeDocumentLanguage(value);
          return;
        }
        var target;
        if (appPage) {
          target = new URL(location.href);
          target.searchParams.set('locale', value);
        } else {
          var link = document.querySelector('a.lang-option[hreflang="' + value + '"]');
          target = new URL(link ? link.href : value === 'en' ? '/' : '/' + value + '/', location.href);
          target.hash = location.hash;
        }
        // Let the existing unsaved-changes guard handle editor navigation.
        // Remember the explicit choice just like the existing language links.
        var remember = function () {
          try {
            document.cookie = 'locale=' + encodeURIComponent(value) + ';path=/;max-age=31536000;samesite=lax';
            localStorage.setItem('document-lang', value === 'zh-CN' ? 'zh' : value);
          } catch {}
        };
        remember();
        location.assign(target.href);
        // If navigation is cancelled, put the picker back on the current language.
        window.setTimeout(function () {
          toolbar.updateState({ language: language() });
        }, 0);
      },
      onThemeChange: function (value) {
        if (!customElements.get('r-theme-switch')) throw new Error('Theme switch is unavailable');
        themeSwitch.value = value;
      },
      onError: function (error) {
        console.error('[OpenUse]', error);
      },
    });
    function sync() {
      toolbar.updateState({ language: language(), theme: theme() });
    }
    var observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['lang', 'data-ran-theme'] });
    window.addEventListener('languagechange', sync);
    window.addEventListener('storage', sync);
    document.addEventListener('ran-theme-switch-sync', sync);
    window.addEventListener('pagehide', function (event) {
      if (event.persisted) return;
      toolbar.destroy();
      observer.disconnect();
      window.removeEventListener('languagechange', sync);
      window.removeEventListener('storage', sync);
      document.removeEventListener('ran-theme-switch-sync', sync);
      if (ownsSwitch) themeSwitch.remove();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
