export function register(context) {
  context.loadLogs = async function loadLogs() {
    const level = context.$('#logs-level-filter')?.value || '';
    const source = context.$('#logs-source-filter')?.value || '';
    const query = context.$('#logs-query-filter')?.value || '';
    try {
      const params = new URLSearchParams({ limit: '80' });
      if (level) params.set('level', level);
      if (source) params.set('source', source);
      if (query) params.set('q', query);
      const [logJson, statJson] = await Promise.all([
        context.request(`/admin/logs?${params.toString()}`),
        context.request('/admin/logs/stats'),
      ]);
      context.renderLogs(logJson.data || { items: [], sources: [] }, statJson.data || {});
      const retention = context.$('#logs-retention-days');
      if (retention && document.activeElement !== retention) retention.value = statJson.data?.retention_days || 30;
      const usage = context.$('#logs-storage-usage');
      if (usage) usage.textContent = '已用 ' + ((statJson.data?.used_bytes || 0) / 1048576).toFixed(1) + ' MB / 约 110 MB';
    } catch (error) {
      if (context.scope.disposed) return;
      const list = context.$('#admin-log-list');
      if (list) list.innerHTML = `<p class="text-sm text-error">${context.escapeHtml(error.message || '日志读取失败')}</p>`;
    }
  };
  context.renderLogs = function renderLogs(data, stats) {
    const errors = context.$('#logs-errors-count');
    const warnings = context.$('#logs-warnings-count');
    const latest = context.$('#logs-latest-at');
    if (errors) errors.textContent = String(stats.errors_24h ?? 0);
    if (warnings) warnings.textContent = String(stats.warnings_24h ?? 0);
    if (latest) latest.textContent = stats.latest_at ? new Date(stats.latest_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '暂无';
    const sourceSelect = context.$('#logs-source-filter');
    if (sourceSelect) {
      const selected = sourceSelect.value;
      sourceSelect.innerHTML = `<option value="">全部来源</option>${(data.sources || []).map((source) => `<option value="${context.escapeHtml(source)}">${context.escapeHtml(source)}</option>`).join('')}`;
      sourceSelect.value = selected;
    }
    const list = context.$('#admin-log-list');
    if (!list) return;
    const label = { error: '错误', warn: '告警', info: '信息' };
    list.innerHTML = (data.items || []).map((item) => {
      const detail = JSON.stringify({ context: item.context || {}, stack: item.stack || '' }, null, 2);
      return `<article class="admin-log-entry ${item.level === 'error' ? 'is-error' : ''}"><header><div><span class="admin-log-level ${context.escapeHtml(item.level)}">${label[item.level] || item.level}</span><strong>${context.escapeHtml(item.source || 'backend')}</strong><time>${context.escapeHtml(new Date(item.timestamp).toLocaleString('zh-CN'))}</time></div><small>${context.escapeHtml(item.id || '')}</small></header><p>${context.escapeHtml(item.message || item.error || '')}</p>${item.stack || item.context ? `<details><summary>查看详情</summary><pre>${context.escapeHtml(detail)}</pre></details>` : ''}</article>`;
    }).join('') || '<p class="text-sm text-base-content/45">暂无符合条件的日志。</p>';
  };
  context.renderMemorySettings = function renderMemorySettings() {
    const warn = context.$('#memory-warn-mb');
    const critical = context.$('#memory-critical-mb');
    if (warn) warn.value = Number(context.state.settings.memory_warn_mb || 512);
    if (critical) critical.value = Number(context.state.settings.memory_critical_mb || 768);
  };
  context.loadSettings = async function loadSettings() {
    const json = await context.request('/admin/settings');
    const rows = json.data || [];
    const musicRow = rows.find((item) => item.key === 'music_playlist');
    context.state.music = context.parseSetting(musicRow) || [];
    context.state.settings = Object.fromEntries(
      rows.map((item) => [item.key, context.parseSetting(item)]),
    );
    context.state.fontLibrary = Array.isArray(context.state.settings.font_library)
      ? context.state.settings.font_library
      : [];
    try {
      const [musicJson, playlistJson] = await Promise.all([
        context.request('/admin/music'),
        context.request('/admin/music/playlists'),
      ]);
      if (Array.isArray(musicJson.data) && musicJson.data.length) {
        context.state.music = musicJson.data;
      }
      context.state.musicPlaylists = playlistJson.data || [];
    } catch (error) {
      if (context.scope.disposed) return;
      console.warn(error);
    }
    context.renderMusic();
    context.renderMusicPlaylists();
    context.renderFontLibrary();
    context.renderSettings();
    context.renderMemorySettings();
    context.renderProfile();
    await context.loadLogs();
  };
  context.loadThemes = async function loadThemes() {
    const selectedId = context.$('#theme-form')?.elements.namedItem('editing_id')?.value;
    const json = await context.request('/admin/themes');
    context.state.themes = json.data || [];
    context.renderThemes();
    const selected = context.state.themes.find((theme) => theme.id === selectedId);
    const next = selected || context.state.themes.find((theme) => theme.is_active) || context.state.themes[0];
    if (next) context.editTheme(next.id, false);
  };
  context.loadPlugins = async function loadPlugins() {
    const json = await context.request('/admin/plugins');
    context.state.plugins = json.data || [];
    context.renderPlugins();
  };
  context.renderProfile = function renderProfile() {
    const form = context.$('#profile-form');
    if (!form) return;
    form.elements.namedItem('profile_name').value =
      context.state.settings.profile_name || context.state.settings.site_title || '个人博客';
    form.elements.namedItem('profile_avatar').value =
      context.state.settings.profile_avatar || '/profile.webp';
    form.elements.namedItem('profile_bio').value =
      context.state.settings.profile_bio ||
      context.state.settings.site_description ||
      '记录技术、生活和长期主义的小站。';
  };
  context.renderAccount = function renderAccount() {
    const form = context.$('#account-form');
    if (!form || !context.state.user) return;
    form.elements.namedItem('nickname').value =
      context.state.user.nickname || context.state.user.username || '';
    form.elements.namedItem('avatar').value = context.state.user.avatar || '';
    form.elements.namedItem('password').value = '';
    window.updateAdminFieldPreview?.('account-form', 'avatar');
    const accountName = context.$('#admin-account-name');
    const accountAvatar = context.$('#admin-account-avatar');
    if (accountName)
      accountName.textContent =
        context.state.user.nickname || context.state.user.username || '管理员';
    if (accountAvatar) accountAvatar.src = context.state.user.avatar || '/profile.webp';
  };
  context.renderSettings = function renderSettings() {
    const form = context.$('#site-settings-form');
    if (!form) return;
    const fields = form.elements;
    fields.namedItem('site_title').value = context.state.settings.site_title || '';
    fields.namedItem('site_description').value = context.state.settings.site_description || '';
    fields.namedItem('site_author').value =
      context.state.settings.site_author || context.state.settings.profile_name || '';
    fields.namedItem('site_keywords').value = context.state.settings.site_keywords || '';
    fields.namedItem('site_language').value = context.state.settings.site_language || 'zh-CN';
    fields.namedItem('footer_text').value =
      context.state.settings.footer_text || '记录所想，分享所见。';
    fields.namedItem('site_start_date').value = String(
      context.state.settings.site_start_date || '2026-01-01',
    ).slice(0, 10);
    fields.namedItem('copyright_year').value = Number(
      context.state.settings.copyright_year || new Date().getFullYear(),
    );
    fields.namedItem('banner_images').value = Array.isArray(context.state.settings.banner_images)
      ? context.state.settings.banner_images.join('\n')
      : String(context.state.settings.banner_images || '');
    fields.namedItem('banner_interval').value = Number(context.state.settings.banner_interval || 6);
    fields.namedItem('posts_per_page').value = context.state.settings.posts_per_page || 10;
    fields.namedItem('allow_search_indexing').checked =
      context.state.settings.allow_search_indexing !== false;
    fields.namedItem('enable_rss').checked = context.state.settings.enable_rss !== false;
    fields.namedItem('enable_json_feed').checked =
      context.state.settings.enable_json_feed !== false;
    fields.namedItem('show_visitor_stats').checked =
      context.state.settings.show_visitor_stats !== false;
    fields.namedItem('enable_comments').checked = context.state.settings.enable_comments !== false;
    fields.namedItem('comment_moderation').checked = !!context.state.settings.comment_moderation;
    context.renderSettingsPreview();
  };
  context.renderSettingsPreview = function renderSettingsPreview() {
    const form = context.$('#site-settings-form');
    if (!form) return;
    const fields = form.elements;
    const banners = String(fields.namedItem('banner_images')?.value || '')
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    const languageLabels = {
      'zh-CN': '简体中文',
      'zh-TW': '繁体中文',
      'ja-JP': '日本語',
      'en-US': 'English',
    };
    const title = String(fields.namedItem('site_title')?.value || '').trim() || 'My Blog';
    const description =
      String(fields.namedItem('site_description')?.value || '').trim() || '记录技术、生活和灵感。';
    const rssEnabled = !!fields.namedItem('enable_rss')?.checked;
    const jsonEnabled = !!fields.namedItem('enable_json_feed')?.checked;
    const feedLabels = [rssEnabled ? 'RSS' : '', jsonEnabled ? 'JSON' : ''].filter(Boolean);
    const previewImage = context.$('#settings-preview-image');
    if (previewImage) {
      previewImage.onerror = () => {
        previewImage.onerror = null;
        previewImage.src = '/home.webp';
      };
      previewImage.src = banners[0] || '/home.webp';
    }
    if (context.$('#settings-preview-title'))
      context.$('#settings-preview-title').textContent = title;
    if (context.$('#settings-preview-description'))
      context.$('#settings-preview-description').textContent = description;
    if (context.$('#settings-preview-language'))
      context.$('#settings-preview-language').textContent =
        languageLabels[fields.namedItem('site_language')?.value] ||
        fields.namedItem('site_language')?.value ||
        '简体中文';
    if (context.$('#settings-preview-banner-count'))
      context.$('#settings-preview-banner-count').textContent = banners.length
        ? `${banners.length} 张`
        : '默认';
    if (context.$('#settings-preview-comments'))
      context.$('#settings-preview-comments').textContent = fields.namedItem('enable_comments')
        ?.checked
        ? '已启用'
        : '已关闭';
    if (context.$('#settings-preview-feeds'))
      context.$('#settings-preview-feeds').textContent = feedLabels.length
        ? feedLabels.join(' · ')
        : '已关闭';
    if (context.$('#settings-preview-indexing'))
      context.$('#settings-preview-indexing').textContent = fields.namedItem(
        'allow_search_indexing',
      )?.checked
        ? '允许'
        : '禁止';
  };
  context.fontKey = function fontKey(font) {
    if (!font?.family || !font?.url) return '';
    return `${font.family}|||${font.url}`;
  };
  context.parseFontSelection = function parseFontSelection(value) {
    const [family = '', url = ''] = String(value || '').split('|||');
    return { family, url };
  };
  context.ensureAdminFontStyle = function ensureAdminFontStyle(fonts) {
    let style = context.$('#admin-font-library-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'admin-font-library-style';
      document.head.appendChild(style);
    }
    style.textContent = (Array.isArray(fonts) ? fonts : [])
      .map((font) => {
        const family = font.family || font.name || '';
        const url = font.url || '';
        return family && url
          ? `@font-face{font-family:"${context.cssString(family)}";src:url("${context.cssUrl(url)}");font-display:swap;}`
          : '';
      })
      .filter(Boolean)
      .join('\n');
  };
  context.renderFontLibrary = function renderFontLibrary() {
    const fonts = Array.isArray(context.state.fontLibrary) ? context.state.fontLibrary : [];
    context.ensureAdminFontStyle(fonts);
    const options = ['<option value="">默认字体</option>']
      .concat(
        fonts.map(
          (font) =>
            `<option value="${context.escapeHtml(context.fontKey(font))}">${context.escapeHtml(font.family || font.name || '未命名字体')}</option>`,
        ),
      )
      .join('');
    const titleSelect = context.$('#title-font-select');
    const bodySelect = context.$('#body-font-select');
    if (titleSelect) titleSelect.innerHTML = options;
    if (bodySelect) bodySelect.innerHTML = options;
    const list = context.$('#font-library-list');
    if (!list) return;
    list.innerHTML =
      fonts
        .map(
          (font, index) => `
    <article class="admin-font-card">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate text-lg font-black" style="font-family: '${context.escapeHtml(font.family || font.name)}', sans-serif">${context.escapeHtml(font.family || font.name || '未命名字体')}</p>
          <p class="mt-1 truncate text-xs text-base-content/45">${context.escapeHtml(font.url || '')}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-xs rounded-xl" type="button" data-use-title-font="${index}">标题</button>
          <button class="btn btn-xs rounded-xl" type="button" data-use-body-font="${index}">正文</button>
          <button class="btn btn-xs rounded-xl" type="button" data-edit-font="${index}">编辑</button>
          <button class="btn btn-error btn-xs rounded-xl" type="button" data-remove-font="${index}">删除</button>
        </div>
      </div>
      <p class="admin-font-preview" style="font-family: '${context.escapeHtml(font.family || font.name)}', sans-serif">清风拂过文字，Markdown 也可以有自己的声音。</p>
    </article>
  `,
        )
        .join('') ||
      '<span class="text-base-content/45">还没有导入字体，请先上传或填写字体地址。</span>';
  };
  context.saveFontLibrary = async function saveFontLibrary() {
    await context.request('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: { font_library: context.state.fontLibrary } }),
    });
    context.state.settings.font_library = context.state.fontLibrary;
    context.notify('字体库已保存');
  };
  context.addFontEntry = function addFontEntry(
    family,
    url,
    message = '字体已加入，记得保存字体库',
  ) {
    if (!family || !url) {
      context.notify('请填写字体名称和字体文件地址', 'warning');
      return false;
    }
    const fonts = Array.isArray(context.state.fontLibrary) ? context.state.fontLibrary : [];
    const next = fonts.filter((font) => font.family !== family && font.url !== url);
    next.push({ family, url });
    context.state.fontLibrary = next;
    context.renderFontLibrary();
    context.notify(message, 'info');
    return true;
  };
  context.addFontToLibrary = function addFontToLibrary() {
    const family = context.$('#font-name-input')?.value.trim();
    const url = context.$('#font-url-input')?.value.trim();
    if (context.addFontEntry(family, url)) {
      context.$('#font-name-input').value = '';
      context.$('#font-url-input').value = '';
    }
  };
  context.editFontEntry = function editFontEntry(index) {
    const font = context.state.fontLibrary[Number(index)];
    if (!font) return;
    context.$('#font-name-input').value = font.family || font.name || '';
    context.$('#font-url-input').value = font.url || '';
    context.state.fontLibrary.splice(Number(index), 1);
    context.renderFontLibrary();
    context.notify('已载入编辑表单，修改后请重新加入并保存字体库', 'info');
  };
  context.renderThemes = function renderThemes() {
    const list = context.$('#themes-list');
    if (!list) return;
    list.innerHTML =
      context.state.themes
        .map(
          (theme) => {
            const config = theme.config || {};
            return `
    <article class="admin-theme-card${theme.is_active ? ' is-active' : ''}">
      <i style="--theme-swatch:${context.escapeHtml(config.primary || '#2f6f4e')}"></i>
      <div class="admin-theme-card-copy">
        <p><strong>${context.escapeHtml(theme.name)}</strong>${theme.is_active ? '<span>前台默认</span>' : ''}</p>
        <small>${context.escapeHtml(theme.description || `${theme.id} · ${theme.author || '个人主题'}`)}</small>
        <em>${context.escapeHtml(theme.note || '')} · ${Number(config.card_radius || 18)}px 圆角 · ${Number(config.content_width || 72)}rem 内容宽度</em>
      </div>
      <div class="admin-theme-card-actions">
        <button type="button" data-edit-theme="${context.escapeHtml(theme.id)}">编辑此项</button>
        ${theme.is_active ? '' : `<button type="button" data-activate-theme="${context.escapeHtml(theme.id)}">设为默认</button>`}
      </div>
    </article>`;
          },
        )
        .join('') || '<p class="text-base-content/45">暂无主题</p>';
  };
  context.resetThemeForm = function resetThemeForm() {
    const form = context.$('#theme-form');
    if (!form) return;
    const selectedId = form.elements.namedItem('editing_id').value;
    const selected = context.state.themes.find((theme) => theme.id === selectedId);
    const next = selected || context.state.themes.find((theme) => theme.is_active) || context.state.themes[0];
    if (next) context.editTheme(next.id, false);
  };
  context.previewThemeForm = function previewThemeForm() {
    const form = context.$('#theme-form');
    const preview = context.$('#theme-live-preview');
    if (!form || !preview) return;
    const fields = form.elements;
    preview.style.setProperty('--preview-primary', fields.namedItem('primary').value || '#2f6f4e');
    preview.style.setProperty('--preview-light', fields.namedItem('primary_light').value || '#dcefe3');
    preview.style.setProperty('--preview-radius', `${Number(fields.namedItem('card_radius').value || 18)}px`);
    preview.style.setProperty('--preview-opacity', String(fields.namedItem('card_opacity').value || 0.86));
    preview.style.setProperty('--preview-body-font', fields.namedItem('body_font').value || 'system-ui');
    preview.style.setProperty('--preview-title-font', fields.namedItem('title_font').value || 'Georgia, serif');
    context.$('#theme-preview-name').textContent = fields.namedItem('name').value.trim() || '前台外观';
  };
  context.editTheme = function editTheme(id, shouldScroll = true) {
    const theme = context.state.themes.find((item) => item.id === id);
    const form = context.$('#theme-form');
    if (!theme || !form) return;
    const config = theme.config || {};
    const values = {
      editing_id: theme.id,
      id: theme.id,
      name: theme.name,
      primary: config.primary || '#2f6f4e',
      primary_hover: config.primary_hover || config.primary || '#245a3e',
      primary_light: config.primary_light || '#dcefe3',
      body_font: config.body_font || 'system-ui',
      title_font: config.title_font || 'Georgia, serif',
      card_radius: config.card_radius || 18,
      card_opacity: config.card_opacity || 0.86,
      content_width: config.content_width || 72,
      season: config.season || 'custom',
      author: theme.author || '',
      description: theme.description || '',
    };
    Object.entries(values).forEach(([name, value]) => {
      const field = form.elements.namedItem(name);
      if (field) field.value = value;
    });
    context.$('#theme-form-title').textContent = `编辑「${theme.name}」`;
    context.$('#theme-form-description').textContent = theme.is_active
      ? '这是新访客默认看到的外观；保存会同步更新前台对应选项。'
      : '保存会同步更新前台对应选项，不需要先设为默认。';
    context.$('#theme-submit').textContent = '保存到前台';
    context.previewThemeForm();
    if (shouldScroll) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  context.renderPlugins = function renderPlugins() {
    const list = context.$('#plugins-list');
    if (!list) return;
    const icons = {
      'reading-progress': '↗',
      'table-of-contents': '☷',
      'word-count': '字',
      'back-to-top': '↑',
      'article-like': '♡',
      'reading-history': '◷',
      'article-bookmark': '☆',
      'reading-mode': 'Aa',
      'code-copy': '</>',
    };
    list.innerHTML =
      context.state.plugins
        .map(
          (plugin) => `
    <article class="admin-plugin-card${plugin.is_active ? ' is-active' : ''}">
      <i>${context.escapeHtml(icons[plugin.id] || '•')}</i>
      <span><strong>${context.escapeHtml(plugin.name)}</strong><small>${context.escapeHtml(plugin.description || '')}</small></span>
      <button type="button" role="switch" aria-checked="${plugin.is_active ? 'true' : 'false'}" data-toggle-plugin="${context.escapeHtml(plugin.id)}"><b></b><em>${plugin.is_active ? '已启用' : '已停用'}</em></button>
    </article>
  `,
        )
        .join('') || '<p class="text-base-content/45">暂无插件</p>';
  };
  context.installTheme = async function installTheme(event) {
    event.preventDefault();
    const fields = event.currentTarget.elements;
    const editingId = fields.namedItem('editing_id').value;
    if (!editingId) {
      context.notify('请先选择一个前台外观', true);
      return;
    }
    const config = {
      primary: fields.namedItem('primary').value,
      primary_hover: fields.namedItem('primary_hover').value,
      primary_light: fields.namedItem('primary_light').value,
      body_font: fields.namedItem('body_font').value.trim(),
      title_font: fields.namedItem('title_font').value.trim(),
      card_radius: Number(fields.namedItem('card_radius').value),
      card_opacity: Number(fields.namedItem('card_opacity').value),
      content_width: Number(fields.namedItem('content_width').value),
      season: fields.namedItem('season').value,
    };
    context.notify('正在同步前台外观…', 'info');
    try {
      const metadata = {
        name: fields.namedItem('name').value.trim(),
        author: fields.namedItem('author').value.trim(),
        description: fields.namedItem('description').value.trim(),
      };
      await context.request(`/admin/themes/${editingId}/config`, {
        method: 'PUT',
        body: JSON.stringify({ ...metadata, config }),
      });
      await context.loadThemes();
      context.notify('已同步到前台对应外观，刷新前台即可查看');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '主题保存失败', true);
    }
  };
  context.previewTheme = async function previewTheme(id) {
    try {
      await context.request(`/admin/themes/${id}/preview`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      context.notify('主题预览已开启，刷新前台查看');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '主题预览失败', true);
    }
  };
  context.activateTheme = async function activateTheme(id) {
    try {
      await context.request(`/admin/themes/${id}/activate`, { method: 'PUT' });
      await Promise.all([context.loadThemes(), context.loadSettings()]);
      context.notify('已设为前台默认外观；访客自己的选择仍会保留');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '主题切换失败', true);
    }
  };
  context.deleteTheme = async function deleteTheme(id) {
    if (!confirm('确认删除这个主题？')) return;
    try {
      await context.request(`/admin/themes/${id}`, { method: 'DELETE' });
      await context.loadThemes();
      context.notify('主题已删除');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '主题删除失败', true);
    }
  };
  context.togglePlugin = async function togglePlugin(id) {
    try {
      await context.request(`/admin/plugins/${id}/toggle`, { method: 'PUT' });
      await context.loadPlugins();
      context.notify('插件状态已更新');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '插件状态更新失败', true);
    }
  };
  context.saveAccount = async function saveAccount(event) {
    event.preventDefault();
    const fields = event.currentTarget.elements;
    const password = fields.namedItem('password').value;
    if (password && password.length < 8) {
      context.notify('新密码不能少于 8 位', 'warning');
      return;
    }
    context.notify('正在保存后台账号…', 'info');
    try {
      const payload = {
        nickname: fields.namedItem('nickname').value.trim(),
        avatar: fields.namedItem('avatar').value.trim(),
      };
      if (password) payload.password = password;
      const json = await context.request('/auth/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      context.state.user = json.data;
      context.renderAccount();
      context.notify(password ? '后台账号已保存，密码已更新' : '后台账号已保存');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '后台账号保存失败', true);
    }
  };
  context.saveProfile = async function saveProfile(event) {
    event.preventDefault();
    const fields = event.currentTarget.elements;
    context.notify('正在保存资料卡…', 'info');
    try {
      await context.request('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          settings: {
            profile_name: fields.namedItem('profile_name').value.trim(),
            profile_avatar: fields.namedItem('profile_avatar').value.trim(),
            profile_bio: fields.namedItem('profile_bio').value.trim(),
          },
        }),
      });
      await context.loadSettings();
      context.notify('前台资料卡已保存');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '资料卡保存失败', true);
    }
  };
  context.saveSiteSettings = async function saveSiteSettings(event) {
    event.preventDefault();
    const fields = event.currentTarget.elements;
    context.notify('正在保存站点设置…', 'info');
    try {
      await context.request('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          settings: {
            site_title: fields.namedItem('site_title').value.trim(),
            site_description: fields.namedItem('site_description').value.trim(),
            site_author: fields.namedItem('site_author').value.trim(),
            site_keywords: fields.namedItem('site_keywords').value.trim(),
            site_language: fields.namedItem('site_language').value,
            footer_text: fields.namedItem('footer_text').value.trim(),
            site_start_date: fields.namedItem('site_start_date').value,
            copyright_year: Number(
              fields.namedItem('copyright_year').value || new Date().getFullYear(),
            ),
            banner_images: fields
              .namedItem('banner_images')
              .value.split(/\r?\n/)
              .map((item) => item.trim())
              .filter(Boolean),
            banner_interval: Number(fields.namedItem('banner_interval').value || 6),
            posts_per_page: Number(fields.namedItem('posts_per_page').value || 10),
            allow_search_indexing: fields.namedItem('allow_search_indexing').checked,
            enable_rss: fields.namedItem('enable_rss').checked,
            enable_json_feed: fields.namedItem('enable_json_feed').checked,
            show_visitor_stats: fields.namedItem('show_visitor_stats').checked,
            enable_comments: fields.namedItem('enable_comments').checked,
            comment_moderation: fields.namedItem('comment_moderation').checked,
          },
        }),
      });
      await context.loadSettings();
      context.notify('站点设置已保存');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '站点设置保存失败', true);
    }
  };
  context.saveMemorySettings = async function saveMemorySettings(event) {
    event.preventDefault();
    const message = context.$('#memory-settings-message');
    const warnInput = Number(context.$('#memory-warn-mb')?.value || 512);
    const criticalInput = Number(context.$('#memory-critical-mb')?.value || 768);
    const warn = Number.isFinite(warnInput) ? Math.min(32768, Math.max(128, Math.trunc(warnInput))) : 512;
    const critical = Number.isFinite(criticalInput) ? Math.min(32768, Math.max(warn + 1, Math.trunc(criticalInput))) : Math.max(warn + 1, 768);
    try {
      await context.request('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: { memory_warn_mb: warn, memory_critical_mb: critical } }),
      });
      context.state.settings.memory_warn_mb = warn;
      context.state.settings.memory_critical_mb = critical;
      context.notify(`内存告警阈值已保存：${warn} / ${critical} MB`);
    } catch (error) {
      context.notify(error.message || '阈值保存失败', true);
    }
  };
  context.parseSetting = function parseSetting(row) {
    if (!row) return null;
    if (row.type === 'json') {
      try {
        return JSON.parse(row.value || 'null');
      } catch {
        if (context.scope.disposed) return;
        return null;
      }
    }
    if (row.type === 'boolean')
      return row.value === true || row.value === 'true' || row.value === '1';
    if (row.type === 'number') {
      const value = Number(row.value);
      return Number.isFinite(value) ? value : 0;
    }
    return row.value;
  };
  context.openAdminSettingsSearch = function openAdminSettingsSearch() {
    context.switchPanel('settings');
    context.scope.query('.admin-topbar')?.classList.add('is-searching');
    context.scope.timeout(() => context.$('#admin-global-settings-search')?.focus(), 0);
  };
  context.syncGlobalSettingsSearch = function syncGlobalSettingsSearch(value) {
    const settingsSearch = context.$('#settings-search');
    if (!settingsSearch) return;
    settingsSearch.value = value;
    settingsSearch.dispatchEvent(new Event('input', { bubbles: true }));
  };
}
