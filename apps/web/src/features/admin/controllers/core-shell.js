export function register(context) {
  context.setStatus = function setStatus(text) {
    const status = context.$('#admin-status');
    if (status) status.textContent = text;
    if (context.root) context.root.dataset.status = text || '';
  };
  context.notify = function notify(message, error = false) {
    const el = context.$('#admin-notice');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-visible', !!message);
    el.classList.toggle('is-error', !!error);
  };
  context.ensurePanelTabs = function ensurePanelTabs() {
    [
      { panels: context.contentPanels, labels: context.contentLabels, className: 'content-tabs' },
      { panels: context.mediaPanels, labels: context.mediaLabels, className: 'media-tabs' },
      {
        panels: context.settingsPanels,
        labels: context.settingsLabels,
        className: 'settings-tabs',
      },
    ].forEach((group) => {
      group.panels.forEach((panel) => {
        const target = context.$(`#${panel}-panel`);
        if (!target) return;
        if (group.className === 'settings-tabs') target.classList.add('admin-settings-workspace');
        if (group.className === 'media-tabs') target.classList.add('admin-media-workspace');
        if (target.querySelector(`.${group.className}`)) return;
        const tabs = document.createElement('div');
        tabs.className = `admin-subnav ${group.className}`;
        tabs.innerHTML = group.panels
          .map(
            (item) =>
              `<button type="button" data-panel-tab="${item}">${group.labels[item]}</button>`,
          )
          .join('');
        target.prepend(tabs);
      });
    });
  };
  context.syncPanelTabs = function syncPanelTabs(panel) {
    context.$$('[data-panel-tab]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.panelTab === panel);
    });
  };
  context.switchPanel = function switchPanel(panel) {
    context.ensurePanelTabs();
    context.$$('.admin-panel').forEach((el) => el.classList.add('hidden'));
    context.$(`#${panel}-panel`)?.classList.remove('hidden');
    const activeNav = context.navPanelMap[panel] || panel;
    context
      .$$('.admin-nav')
      .forEach((el) => el.classList.toggle('is-active', el.dataset.panel === activeNav));
    context.syncPanelTabs(panel);
    const pageTitle = context.$('#admin-page-title');
    if (pageTitle) pageTitle.textContent = context.panelTitles[panel] || '后台管理';
    if (panel === 'search-sources')
      window.dispatchEvent(new CustomEvent('content-search-sources-request'));
  };
  context.resolveHashPanel = function resolveHashPanel(value) {
    const panel = value === 'manga-sources' ? 'search-sources' : value;
    return context.panelTitles[panel] ? panel : 'dashboard';
  };
  context.request = async function request(path, options = {}) {
    const isFormData = options.body instanceof FormData;
    const headers = {
      ...(options.headers || {}),
    };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    if (context.state.token) headers.Authorization = `Bearer ${context.state.token}`;
    let res;
    try {
      res = await context.scope.fetch(`${context.API_BASE}${path}`, {
        ...options,
        cache: 'no-store',
        credentials: 'same-origin',
        headers,
      });
    } catch {
      if (context.scope.disposed) return;
      throw new Error(`无法连接后端 API（${context.API_BASE}），请确认 Express 服务已启动`);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      const err = new Error(json.message || `接口请求失败（HTTP ${res.status}）`);
      err.status = res.status;
      err.code = json.code || '';
      throw err;
    }
    return json;
  };
  context.friendlyLoginError = function friendlyLoginError(error) {
    const status = Number(error?.status || 0);
    const message = String(error?.message || '');
    if (/无法连接后端 API/.test(message) || /Failed to fetch|NetworkError/i.test(message)) {
      return `无法连接后端 API：${context.API_BASE}。请确认后端 3001 已启动。`;
    }
    if (status === 404) return `登录接口不存在：${context.API_BASE}/auth/login。请检查 API 地址。`;
    if (status === 401 || /用户名或密码错误|AUTH/i.test(message))
      return '用户名或密码错误，请确认当前后台账号。';
    if (status === 403) return '当前账号没有后台权限。';
    if (status >= 500) return `后端登录接口异常：${message}`;
    return message || '登录失败，请稍后重试。';
  };
  context.login = async function login(username, password) {
    const json = await context.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    context.state.token = json.data.token;
    localStorage.setItem(context.tokenKey, context.state.token);
    await context.ensurePrivateDevice();
    context.$('#logout-admin').classList.remove('hidden');
    return json.data.user;
  };
  context.loadTaxonomy = async function loadTaxonomy() {
    const [catRes, tagRes] = await Promise.all([
      context.request('/categories'),
      context.request('/tags'),
    ]);
    context.state.categories = catRes.data || [];
    context.state.tags = tagRes.data || [];
    context.renderTaxonomy();
  };
  context.loadDashboard = async function loadDashboard() {
    const [statsResult, chartsResult] = await Promise.allSettled([
      context.request('/admin/dashboard/stats'),
      context.request('/admin/dashboard/charts'),
    ]);
    if (statsResult.status === 'fulfilled') {
      context.state.stats = statsResult.value.data || {};
    }
    if (chartsResult.status === 'fulfilled') {
      context.state.charts = chartsResult.value.data || {};
    }
    context.renderDashboard();
  };
  context.loadMe = async function loadMe() {
    const json = await context.request('/auth/me');
    context.state.user = json.data;
    context.renderAccount();
  };
  context.getPrivateDeviceClientId = function getPrivateDeviceClientId() {
    const key = 'boke_private_device_client_id';
    let clientId = localStorage.getItem(key);
    if (!clientId) {
      clientId =
        globalThis.crypto?.randomUUID?.() ||
        `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, clientId);
    }
    return clientId;
  };
  context.ensurePrivateDevice = async function ensurePrivateDevice() {
    if (!context.state.token) return;
    const clientId = context.getPrivateDeviceClientId();
    const existing = localStorage.getItem('boke_private_device_token');
    const registeredClientId = localStorage.getItem('boke_private_device_registered_client_id');
    if (existing && registeredClientId === clientId) {
      try {
        const response = await context.scope.fetch(context.API_BASE + '/private/navigation', {
          headers: { 'X-Device-Token': existing },
        });
        if (response.ok) return;
      } catch {
        if (context.scope.disposed) return;
      }
      localStorage.removeItem('boke_private_device_token');
    }
    try {
      const json = await context.request('/admin/devices/register', {
        method: 'POST',
        body: JSON.stringify({
          name:
            (navigator.userAgentData?.platform || '设备') +
            ' · ' +
            (navigator.userAgent.includes('Mobile') ? '移动端' : '浏览器'),
          platform: navigator.userAgent,
          client_id: clientId,
        }),
      });
      if (json.data?.token) {
        localStorage.setItem('boke_private_device_token', json.data.token);
        localStorage.setItem('boke_private_device_registered_client_id', clientId);
      }
    } catch (error) {
      if (context.scope.disposed) return;
      console.warn('私人设备登记失败', error);
    }
  };
  context.loadAll = async function loadAll() {
    if (!context.state.token) {
      context.setStatus('请先登录后台');
      context.switchPanel('login');
      return;
    }
    try {
      context.setStatus('正在读取 Express API...');
      await context.loadMe();
      await context.ensurePrivateDevice();
      context.$('#logout-admin').classList.remove('hidden');
    } catch (error) {
      if (context.scope.disposed) return;
      localStorage.removeItem(context.tokenKey);
      context.state.token = '';
      context.$('#logout-admin').classList.add('hidden');
      context.setStatus('连接失败，请重新登录');
      context.$('#login-message').textContent = error.message;
      context.switchPanel('login');
      return;
    }
    const modules = [
      { label: '分类标签', load: context.loadTaxonomy },
      { label: '仪表盘', load: context.loadDashboard },
      { label: '文章', load: context.loadArticles },
      { label: '媒体库', load: context.loadMedia },
      { label: '设置', load: context.loadSettings },
      { label: '独立页面', load: context.loadPages },
      { label: '评论', load: context.loadComments },
      { label: '主题', load: context.loadThemes },
      { label: '插件', load: context.loadPlugins },
    ];
    const results = await Promise.allSettled(modules.map((module) => module.load()));
    const failed = results
      .map((result, index) => (result.status === 'rejected' ? modules[index].label : ''))
      .filter(Boolean);
    if (failed.length) {
      context.setStatus(`已连接后端 API，部分模块加载失败：${failed.join('、')}`);
      context.notify(`部分模块加载失败：${failed.join('、')}`, true);
    } else {
      context.setStatus('已连接后端 API');
    }
    const hashPanel = location.hash.replace(/^#/, '').split('?')[0];
    context.switchPanel(context.resolveHashPanel(hashPanel));
  };
  context.renderDashboard = function renderDashboard() {
    const stats = context.state.stats || {};
    const charts = context.state.charts || {};
    context.$$('[data-stat]').forEach((el) => {
      el.textContent = Number(stats[el.dataset.stat] || 0).toLocaleString('zh-CN');
    });
    context.$('#recent-posts').innerHTML =
      (stats.recentPosts || [])
        .map(
          (post) => `
    <div class="flex items-center justify-between rounded-xl bg-base-100/60 p-3">
      <span class="font-semibold">${context.escapeHtml(post.title)}</span>
      <span class="text-base-content/45">${post.view_count || 0} 阅读</span>
    </div>
  `,
        )
        .join('') || '<p class="text-base-content/45">暂无发布文章</p>';
    context.$('#admin-alerts').innerHTML =
      (stats.anomalies || [])
        .map(
          (item) => `
    <div class="admin-alert is-${context.escapeHtml(item.level || 'info')}">${context.escapeHtml(item.message)}</div>
  `,
        )
        .join('') || '<p class="text-base-content/45">系统运行正常</p>';
    context.$('#popular-posts').innerHTML =
      (stats.popularPosts || [])
        .map(
          (post, index) => `
    <a class="admin-rank-row" href="/article/${encodeURIComponent(post.slug || '')}" target="_blank" rel="noreferrer">
      <span class="admin-rank-index">${index + 1}</span>
      <span class="min-w-0 flex-1 truncate font-semibold">${context.escapeHtml(post.title)}</span>
      <span class="text-base-content/45">${Number(post.view_count || 0).toLocaleString('zh-CN')} 阅读</span>
    </a>
  `,
        )
        .join('') || '<p class="text-base-content/45">暂无热门文章</p>';
    context.renderBarChart('#visit-chart', charts.visitTrend || [], 'count');
    context.renderBarChart('#publish-chart', charts.publishingTrend || [], 'count');
    context.renderRankChart('#category-chart', charts.categoryDistribution || []);
  };
  context.renderBarChart = function renderBarChart(selector, rows, valueKey = 'count') {
    const el = context.$(selector);
    if (!el) return;
    const data = Array.isArray(rows) ? rows.slice(-30) : [];
    const max = Math.max(1, ...data.map((item) => Number(item[valueKey] || 0)));
    el.innerHTML = data.length
      ? data
          .map((item) => {
            const value = Number(item[valueKey] || 0);
            const height = Math.max(6, Math.round((value / max) * 100));
            return `
      <span class="admin-bar" title="${context.escapeHtml(item.date || '')}：${value}">
        <i style="height:${height}%"></i>
      </span>
    `;
          })
          .join('')
      : '<p class="text-sm text-base-content/45">暂无趋势数据</p>';
  };
  context.renderRankChart = function renderRankChart(selector, rows) {
    const el = context.$(selector);
    if (!el) return;
    const data = (Array.isArray(rows) ? rows : []).filter((item) => item.name).slice(0, 8);
    const max = Math.max(1, ...data.map((item) => Number(item.count || 0)));
    el.innerHTML = data.length
      ? data
          .map((item) => {
            const value = Number(item.count || 0);
            const width = Math.max(5, Math.round((value / max) * 100));
            return `
      <div class="admin-rank-meter">
        <div class="flex items-center justify-between gap-3 text-sm">
          <span class="truncate font-semibold">${context.escapeHtml(item.name)}</span>
          <span class="text-base-content/45">${value}</span>
        </div>
        <span><i style="width:${width}%"></i></span>
      </div>
    `;
          })
          .join('')
      : '<p class="text-sm text-base-content/45">暂无分类数据</p>';
  };
  context.renderTaxonomy = function renderTaxonomy() {
    context.$('#category-select').innerHTML =
      '<option value="">无分类</option>' +
      context.state.categories
        .map((cat) => `<option value="${cat.id}">${context.escapeHtml(cat.name)}</option>`)
        .join('');
    context.$('#tag-select').innerHTML = context.state.tags
      .map((tag) => `<option value="${tag.id}">${context.escapeHtml(tag.name)}</option>`)
      .join('');
    context.$('#category-list').innerHTML =
      context.state.categories
        .map(
          (cat) => `
    <div class="flex items-center gap-2 rounded-xl bg-base-100/65 p-2">
      <span class="font-bold">${context.escapeHtml(cat.name)}</span>
      <button class="btn btn-xs rounded-lg" data-edit-category="${cat.id}">编辑</button>
      <button class="btn btn-xs btn-error rounded-lg" data-delete-category="${cat.id}">删除</button>
    </div>
  `,
        )
        .join('') || '<p class="text-sm text-base-content/45">暂无分类</p>';
    context.$('#tag-list').innerHTML =
      context.state.tags
        .map(
          (tag) => `
    <div class="flex items-center gap-2 rounded-xl bg-base-100/65 p-2">
      <span class="font-bold">${context.escapeHtml(tag.name)}</span>
      <button class="btn btn-xs rounded-lg" data-edit-tag="${tag.id}">编辑</button>
      <button class="btn btn-xs btn-error rounded-lg" data-delete-tag="${tag.id}">删除</button>
    </div>
  `,
        )
        .join('') || '<p class="text-sm text-base-content/45">暂无标签</p>';
  };
  context.cssString = function cssString(value = '') {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
  };
  context.cssUrl = function cssUrl(value = '') {
    return String(value).replace(/"/g, '%22').replace(/\n/g, '');
  };
  context.updateCoverPreview = function updateCoverPreview(url) {
    const preview = context.$('#cover-preview');
    if (!preview) return;
    if (!url) {
      preview.classList.add('hidden');
      preview.innerHTML = '';
      return;
    }
    preview.classList.remove('hidden');
    preview.innerHTML = `<img class="h-40 w-full object-cover" src="${context.escapeHtml(url)}" alt="封面预览" />`;
  };
  context.downloadAdminFile = async function downloadAdminFile(path, filenameHint) {
    context.$('#backup-message').textContent = '正在生成导出文件...';
    const headers = {};
    if (context.state.token) headers.Authorization = `Bearer ${context.state.token}`;
    const res = await context.scope.fetch(`${context.API_BASE}${path}`, { headers });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message || `导出失败（HTTP ${res.status}）`);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const filename = match?.[1] || filenameHint;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    context.$('#backup-message').textContent = `已开始下载：${filename}`;
  };
  context.saveBannerImages = async function saveBannerImages() {
    const input = context.$('#site-settings-form').elements.namedItem('banner_images');
    await context.request('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        settings: {
          banner_images: input.value
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean),
        },
      }),
    });
  };
  context.escapeHtml = function escapeHtml(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char],
    );
  };
  context.formatDate = function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('zh-CN');
  };
  context.formatSize = function formatSize(size) {
    const value = Number(size || 0);
    if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    if (value > 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${value} B`;
  };
}
