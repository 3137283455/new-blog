export function register(context) {
  let timer,
    sequence = 0;
  context.openAdminSettingsSearch = () => {
    context.scope.query('.admin-topbar')?.classList.add('is-searching');
    const input = context.$('#admin-global-settings-search');
    input?.focus();
    context.searchAdmin(input?.value || '');
  };
  context.searchAdmin = (value) => {
    clearTimeout(timer);
    const requestId = ++sequence;
    const output = context.$('#admin-search-results');
    if (!output) return;
    const term = value.trim().toLowerCase();
    output.classList.remove('hidden');
    if (!term) {
      output.innerHTML = '<p>搜索文章、专题、媒体名称，或输入设置关键词。</p>';
      return;
    }
    output.innerHTML = '<p>正在搜索…</p>';
    timer = context.scope.timeout(async () => {
      const settings = [];
      context.$$('.admin-settings-section').forEach((section, index) => {
        const title = section.querySelector('h3')?.textContent || '';
        if (
          (section.textContent + ' ' + (section.dataset.settingsSearch || ''))
            .toLowerCase()
            .includes(term)
        ) {
          if (!section.id) section.id = 'settings-section-' + index;
          settings.push({
            type: '设置',
            title,
            panel: section.closest('.admin-panel')?.id.replace(/-panel$/, ''),
            target: section.id,
          });
        }
      });
      Object.entries(context.panelTitles).forEach(([panel, title]) => {
        if (title.toLowerCase().includes(term)) settings.push({ type: '页面', title, panel });
      });
      let items = settings,
        failed = false;
      try {
        const result = await context.request('/admin/search?q=' + encodeURIComponent(term));
        items = [...(result.data || []), ...settings];
      } catch {
        failed = true;
      }
      if (requestId !== sequence || context.scope.disposed) return;
      const escape = context.escapeHtml;
      output.innerHTML =
        (failed ? '<p>内容搜索暂时不可用，以下为设置结果。</p>' : '') +
        (items.length
          ? items
              .slice(0, 35)
              .map((item) => {
                const title = escape(item.title),
                  type = escape(item.type);
                return item.url
                  ? '<a href="' +
                      escape(item.url) +
                      '"><small>' +
                      type +
                      '</small><strong>' +
                      title +
                      '</strong><span>↗</span></a>'
                  : '<button type="button" data-search-panel="' +
                      escape(item.panel || 'settings') +
                      '" data-search-target="' +
                      escape(item.target || '') +
                      '"><small>' +
                      type +
                      '</small><strong>' +
                      title +
                      '</strong><span>→</span></button>';
              })
              .join('')
          : '<p>没有找到匹配内容。</p>');
    }, 240);
  };
  // Register after context selectors have been initialized by the core controller.
  context.scope.timeout(() => {
    context.scope.listen(context.$('#content-center-panel'), 'click', (event) => {
      const button = event.target.closest('[data-content-section]');
      if (!button) return;
      context.$$('[data-content-view]').forEach((view) => {
        view.hidden = view.dataset.contentView !== button.dataset.contentSection;
      });
      context
        .$$('[data-content-section]')
        .forEach((tab) => tab.setAttribute('aria-pressed', String(tab === button)));
    });
    context.scope.listen(context.$('#logs-policy-form'), 'submit', async (event) => {
      event.preventDefault();
      const message = context.$('#logs-policy-message');
      try {
        await context.request('/admin/logs/policy', {
          method: 'PUT',
          body: JSON.stringify({ retention_days: Number(context.$('#logs-retention-days').value) }),
        });
        message.textContent = '已保存，下次自动清理生效';
      } catch (error) {
        message.textContent = error.message || '保存失败';
      }
    });
    context.scope.listen(context.$('#logs-panel'), 'click', async (event) => {
      const button = event.target.closest('[data-log-clear]');
      if (!button) return;
      const mode = button.dataset.logClear;
      if (
        !confirm(
          mode === 'all'
            ? '清空全部历史日志？操作不可恢复，将保留本次清理记录。'
            : '立即删除超过保留周期的日志？',
        )
      )
        return;
      button.disabled = true;
      try {
        const result = await context.request('/admin/logs/clear', {
          method: 'POST',
          body: JSON.stringify({ mode }),
        });
        context.$('#logs-policy-message').textContent = '已清理 ' + result.data.removed + ' 条记录';
        await context.loadLogs();
      } catch (error) {
        context.$('#logs-policy-message').textContent = error.message || '清理失败';
      } finally {
        button.disabled = false;
      }
    });
    context.scope.listen(context.$('#admin-search-results'), 'click', (event) => {
      const button = event.target.closest('[data-search-panel]');
      if (!button) return;
      context.switchPanel(button.dataset.searchPanel);
      context.$('#admin-search-results').classList.add('hidden');
      const target = button.dataset.searchTarget && context.$('#' + button.dataset.searchTarget);
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target?.querySelector('input,select,button')?.focus({ preventScroll: true });
    });
    context.scope.listen(document, 'click', (event) => {
      if (!event.target.closest('.admin-global-search,#admin-search-results,#admin-search-toggle'))
        context.$('#admin-search-results')?.classList.add('hidden');
    });
  }, 0);
}
