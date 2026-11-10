// Kept independent of the app bundle so the very first loading frame is localized.
(function () {
  var messages = {
    en: ['Loading tool', 'Opening the tool, please wait…', 'The first load may take about 30 seconds. Subsequent loads are usually faster.', 'Explore more online tools ↗', 'Still loading…', 'A slow connection may take a little longer.'],
    zh: ['工具正在加载', '正在打开工具，请稍候…', '首次加载可能需要约 30 秒，之后通常更快', '探索更多在线工具 ↗', '还在努力加载中…', '网络较慢时可能需要多一点时间'],
    ja: ['ツールを読み込み中', 'ツールを開いています。しばらくお待ちください…', '初回の読み込みには約30秒かかる場合があります。次回からは通常より速くなります。', 'ほかのオンラインツールを探す ↗', '引き続き読み込んでいます…', '接続が遅い場合、もう少し時間がかかることがあります。'],
    ko: ['도구 로딩 중', '도구를 여는 중입니다. 잠시 기다려 주세요…', '처음에는 약 30초가 걸릴 수 있습니다. 이후에는 보통 더 빨라집니다.', '더 많은 온라인 도구 살펴보기 ↗', '아직 불러오는 중입니다…', '연결이 느리면 시간이 조금 더 걸릴 수 있습니다.'],
    de: ['Tool wird geladen', 'Das Tool wird geöffnet. Bitte warten…', 'Das erste Laden kann etwa 30 Sekunden dauern. Danach geht es meist schneller.', 'Weitere Online-Tools entdecken ↗', 'Wird noch geladen…', 'Bei langsamer Verbindung kann es etwas länger dauern.'],
    es: ['Cargando herramienta', 'Abriendo la herramienta. Espera un momento…', 'La primera carga puede tardar unos 30 segundos. Las siguientes suelen ser más rápidas.', 'Explorar más herramientas en línea ↗', 'Todavía cargando…', 'Con una conexión lenta puede tardar un poco más.'],
    pt: ['Carregando ferramenta', 'Abrindo a ferramenta. Aguarde…', 'O primeiro carregamento pode levar cerca de 30 segundos. Os próximos costumam ser mais rápidos.', 'Explorar mais ferramentas online ↗', 'Ainda carregando…', 'Uma conexão lenta pode exigir um pouco mais de tempo.']
  };
  function resolveLanguage() {
    var value = new URLSearchParams(location.search).get('locale');
    try {
      var cookie = document.cookie.split(';').map(function (item) { return item.trim(); }).find(function (item) { return item.startsWith('locale='); });
      value = value || (cookie && decodeURIComponent(cookie.slice(7))) || localStorage.getItem('document-lang');
    } catch (_) {}
    return value || navigator.languages && navigator.languages[0] || navigator.language || 'en';
  }
  function apply(mask, language, slow) {
    if (!mask) return;
    var locale = (language || resolveLanguage()).toLowerCase().split(/[-_]/)[0];
    var copy = messages[locale] || messages.en;
    mask.setAttribute('aria-label', copy[0]);
    mask.setAttribute('lang', locale in messages ? (locale === 'zh' ? 'zh-CN' : locale) : 'en');
    mask.dataset.loadingSlow = slow ? 'true' : 'false';
    var message = mask.querySelector('.loading-message, #openuse-message');
    var hint = mask.querySelector('.loading-hint, #openuse-hint');
    var link = mask.querySelector('.loading-link, a.link');
    if (message) message.textContent = copy[slow ? 4 : 1];
    if (hint) hint.textContent = copy[slow ? 5 : 2];
    if (link) link.textContent = copy[3];
  }
  window.OpenUseLoadingI18n = { apply: apply };
  apply(document.getElementById('openuse-loading'));
  window.addEventListener('languagechange', function (event) {
    var mask = document.getElementById('openuse-loading');
    apply(mask, event.detail && event.detail.language, mask && mask.dataset.loadingSlow === 'true');
  });
})();
