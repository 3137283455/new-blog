import { createEffectScope } from '../browser/effect-scope';
export function mountController() {
  const scope = createEffectScope();
  function initPublicNavigation() {
    const adaptiveNav = document.querySelector('[data-adaptive-nav]');
    if (adaptiveNav && !adaptiveNav.dataset.boundAdaptiveNav) {
      adaptiveNav.dataset.boundAdaptiveNav = 'true';
      let navFrame = 0;
      const updateNavigationMode = () => {
        navFrame = 0;
        adaptiveNav.classList.toggle('is-condensed', window.scrollY > 56);
      };
      const requestNavigationUpdate = () => {
        if (!navFrame) navFrame = scope.frame(updateNavigationMode);
      };
      updateNavigationMode();
      scope.listen(window, 'scroll', requestNavigationUpdate, { passive: true });
    }
    document.querySelectorAll('img[data-fallback-src]').forEach((image) => {
      if (image.dataset.boundFallback) return;
      image.dataset.boundFallback = 'true';
      scope.listen(image, 'error', () => {
        const fallback = image.dataset.fallbackSrc;
        if (fallback && !image.src.endsWith(fallback)) image.src = fallback;
      });
    });
    const themeTypes = { 'boke-night': 'dark', 'boke-punk': 'dark', 'boke-green': 'light' };
    const options = document.querySelectorAll('[data-theme-option]');
    const applyTheme = (theme) => {
      const next = themeTypes[theme] ? theme : 'boke-green';
      document.documentElement.setAttribute('data-theme', next);
      document.documentElement.setAttribute('data-theme-type', themeTypes[next]);
      localStorage.setItem('theme', next);
      options.forEach((option) =>
        option.classList.toggle('is-active', option.dataset.themeOption === next),
      );
    };
    applyTheme(
      localStorage.getItem('theme') || document.documentElement.dataset.theme || 'boke-green',
    );
    options.forEach((option) => {
      if (option.dataset.boundThemeOption) return;
      option.dataset.boundThemeOption = 'true';
      scope.listen(option, 'click', () => {
        applyTheme(option.dataset.themeOption);
        option.closest('details')?.removeAttribute('open');
      });
    });
    const backdrop = document.getElementById('command-backdrop');
    const trigger = document.getElementById('command-trigger');
    const input = document.getElementById('command-input');
    const staticResults = document.getElementById('command-results');
    const commonSearches = document.getElementById('command-common-searches');
    const searchHistory = document.getElementById('command-search-history');
    const clearHistory = document.getElementById('command-clear-history');
    if (!backdrop || !input || !staticResults || backdrop.dataset.ready) return;
    backdrop.dataset.ready = 'true';
    const memoryKey = 'boke-nav-search-memory-v1';
    const engineKey = 'boke-search-engine';
    const engineButtons = Array.from(backdrop.querySelectorAll('[data-command-engine]'));
    let timer;
    let controller;
    scope.defer(() => {
      window.clearTimeout(timer);
      controller?.abort();
    });
    let activeIndex = -1;
    let searchUrl = 'site:';
    let activeEngine = '';
    const defaultMarkup = staticResults.innerHTML;
    const escape = (value) =>
      String(value || '').replace(
        /[&<>"']/g,
        (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
      );
    const normalize = (value) =>
      /^(https?:|mailto:|tel:|#|\/)/i.test(String(value || ''))
        ? String(value || '#')
        : `https://${value}`;
    const isSiteSearch = () => searchUrl === 'site:';
    const readMemory = () => {
      try {
        return JSON.parse(localStorage.getItem(memoryKey) || '[]').filter((item) => item?.query);
      } catch {
        return [];
      }
    };
    const renderMemory = () => {
      const items = readMemory().sort(
        (left, right) => Number(right.lastUsed || 0) - Number(left.lastUsed || 0),
      );
      const common = [...items]
        .filter((item) => Number(item.count || 0) > 1)
        .sort(
          (left, right) =>
            Number(right.count || 0) - Number(left.count || 0) ||
            Number(right.lastUsed || 0) - Number(left.lastUsed || 0),
        )
        .slice(0, 6);
      if (commonSearches)
        commonSearches.innerHTML = common.length
          ? common
              .map(
                (item) =>
                  `<button type="button" data-command-memory="${escape(item.query)}"><span>${escape(item.query)}</span><small>${Number(item.count || 0)} 次</small></button>`,
              )
              .join('')
          : '<small>重复搜索后会出现在这里</small>';
      if (searchHistory)
        searchHistory.innerHTML = items.length
          ? items
              .slice(0, 8)
              .map(
                (item) =>
                  `<button type="button" data-command-memory="${escape(item.query)}"><span>${escape(item.query)}</span></button>`,
              )
              .join('')
          : '<small>还没有搜索记录</small>';
    };
    const recordSearch = (value) => {
      const query = String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 100);
      if (!query) return;
      const items = readMemory();
      const existing = items.find(
        (item) => String(item.query).toLowerCase() === query.toLowerCase(),
      );
      if (existing) {
        existing.query = query;
        existing.count = Number(existing.count || 0) + 1;
        existing.lastUsed = Date.now();
      } else items.push({ query, count: 1, lastUsed: Date.now() });
      localStorage.setItem(
        memoryKey,
        JSON.stringify(items.sort((left, right) => right.lastUsed - left.lastUsed).slice(0, 30)),
      );
      renderMemory();
    };
    const renderExternalPrompt = (query) => {
      const engine = engineButtons.find((button) => button.dataset.commandEngine === activeEngine);
      const engineName = engine?.dataset.commandName || '当前搜索引擎';
      staticResults.innerHTML = query
        ? `<p>网页搜索</p><button class="command-web-submit" type="button" data-command-submit><span>使用 ${escape(engineName)} 搜索“${escape(query)}”</span><small>↗</small></button>`
        : defaultMarkup;
    };
    const renderSiteResults = (items, query) => {
      staticResults.innerHTML = items.length
        ? `<p>博客内容</p>${items
            .map((item) => {
              const href = normalize(item.href);
              const external = href.startsWith('http')
                ? ' target="_blank" rel="noopener noreferrer"'
                : '';
              return `<a href="${escape(href)}"${external}><span>${escape(item.title)}</span><small>${escape(item.kind_label || '打开')}</small></a>`;
            })
            .join('')}`
        : `<p>没有找到“${escape(query)}”</p><a href="/search?q=${encodeURIComponent(query)}"><span>打开完整站内搜索</span><small>↗</small></a>`;
    };
    const searchSite = (query) => {
      window.clearTimeout(timer);
      controller?.abort();
      activeIndex = -1;
      if (!query) {
        staticResults.innerHTML = defaultMarkup;
        return;
      }
      timer = scope.timeout(async () => {
        controller = new AbortController();
        staticResults.innerHTML = '<p>正在搜索博客内容…</p>';
        try {
          const response = await fetch(
            `${window.__PUBLIC_API_BASE__ || '/api'}/search/all?q=${encodeURIComponent(query)}&limit=6`,
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error('search failed');
          const json = await response.json();
          renderSiteResults(json.data?.results || [], query);
        } catch (error) {
          if (error?.name !== 'AbortError')
            staticResults.innerHTML = '<p>搜索暂时不可用，请稍后再试</p>';
        }
      }, 180);
    };
    const buildSearchUrl = (query) =>
      searchUrl.includes('{query}')
        ? searchUrl.replace('{query}', encodeURIComponent(query))
        : `${searchUrl}${searchUrl.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}`;
    const runSearch = (value) => {
      const query = String(value || '').trim();
      if (!query) return;
      recordSearch(query);
      input.value = query;
      if (isSiteSearch()) searchSite(query);
      else window.location.assign(buildSearchUrl(query));
    };
    const chooseEngine = (button, focusInput = true) => {
      activeEngine = button.dataset.commandEngine || '';
      searchUrl = button.dataset.commandUrl || 'site:';
      engineButtons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-selected', String(selected));
      });
      localStorage.setItem(engineKey, activeEngine);
      input.placeholder = isSiteSearch()
        ? '搜索博客内容'
        : `使用 ${button.dataset.commandName || '搜索引擎'} 搜索`;
      const query = input.value.trim();
      if (isSiteSearch()) searchSite(query);
      else renderExternalPrompt(query);
      if (focusInput) input.focus();
    };
    const close = () => {
      window.clearTimeout(timer);
      controller?.abort();
      backdrop.hidden = true;
      document.body.classList.remove('command-open');
      input.value = '';
      staticResults.innerHTML = defaultMarkup;
      activeIndex = -1;
    };
    const open = () => {
      backdrop.hidden = false;
      document.body.classList.add('command-open');
      activeIndex = -1;
      renderMemory();
      scope.frame(() => input.focus());
    };
    const selectableItems = () =>
      Array.from(staticResults.querySelectorAll('a, button[data-command-submit]'));
    const moveSelection = (direction) => {
      const items = selectableItems();
      if (!items.length) return;
      activeIndex = (activeIndex + direction + items.length) % items.length;
      items.forEach((item, index) => item.classList.toggle('is-selected', index === activeIndex));
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    };
    const storedEngine = localStorage.getItem(engineKey);
    chooseEngine(
      engineButtons.find((button) => button.dataset.commandEngine === storedEngine) ||
        engineButtons[0],
      false,
    );
    engineButtons.forEach((button) => scope.listen(button, 'click', () => chooseEngine(button)));
    scope.listen(trigger, 'click', open);
    scope.listen(backdrop, 'click', (event) => {
      if (event.target === backdrop) close();
    });
    scope.listen(staticResults, 'click', (event) => {
      const submit = event.target.closest('[data-command-submit]');
      if (submit) {
        event.preventDefault();
        runSearch(input.value);
        return;
      }
      if (event.target.closest('a') && input.value.trim()) recordSearch(input.value);
    });
    scope.listen(document.getElementById('command-memory'), 'click', (event) => {
      const button = event.target.closest('[data-command-memory]');
      if (button?.dataset.commandMemory) runSearch(button.dataset.commandMemory);
    });
    scope.listen(clearHistory, 'click', () => {
      localStorage.removeItem(memoryKey);
      renderMemory();
    });
    scope.listen(document, 'keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        backdrop.hidden ? open() : close();
      }
      if (event.key === 'Escape' && !backdrop.hidden) close();
    });
    scope.listen(input, 'keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(event.key === 'ArrowDown' ? 1 : -1);
      }
      if (event.key === 'Enter') {
        const items = selectableItems();
        const target = activeIndex >= 0 ? items[activeIndex] : items[0];
        if (target) {
          event.preventDefault();
          target.click();
        } else if (input.value.trim()) {
          event.preventDefault();
          runSearch(input.value);
        }
      }
    });
    scope.listen(input, 'input', () => {
      const query = input.value.trim();
      activeIndex = -1;
      if (isSiteSearch()) searchSite(query);
      else renderExternalPrompt(query);
    });
    const installButton = document.getElementById('install-app');
    if (installButton && !installButton.dataset.boundInstall) {
      installButton.dataset.boundInstall = 'true';
      let installPrompt = null;
      scope.listen(window, 'beforeinstallprompt', (event) => {
        event.preventDefault();
        installPrompt = event;
        installButton.hidden = false;
      });
      scope.listen(installButton, 'click', async () => {
        if (!installPrompt) return;
        await installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        installButton.hidden = true;
        installButton.closest('details')?.removeAttribute('open');
      });
      scope.listen(window, 'appinstalled', () => {
        installButton.hidden = true;
      });
    }
  }

  initPublicNavigation();
  return () => {
    scope.dispose();
    document
      .querySelectorAll(
        '[data-adaptive-nav],img[data-fallback-src],[data-theme-option],#command-backdrop,#install-app',
      )
      .forEach((node) => {
        for (const key of [
          'boundAdaptiveNav',
          'boundFallback',
          'boundThemeOption',
          'ready',
          'boundInstall',
        ])
          delete node.dataset[key];
      });
    document.body.classList.remove('command-open');
  };
}
