const root = document.querySelector('.admin-shell');
const API_BASE = root?.dataset.apiBase || '/api';
const tokenKey = 'boke_admin_token';
const state = {
  token: localStorage.getItem(tokenKey) || '',
  articles: [],
  categories: [],
  tags: [],
  media: [],
  mediaTrashMode: false,
  mediaCurrentFolderId: null,
  mediaSmartType: '',
  mediaFolders: [],
  mediaAllFolders: [],
  mediaBreadcrumb: [],
  mediaFolderCounts: {},
  mediaSort: localStorage.getItem('boke_media_sort') || 'name',
  mediaSortOrder: localStorage.getItem('boke_media_sort_order') || 'asc',
  mediaContext: null,
  mediaLoadSequence: 0,
  music: [],
  musicPlaylists: [],
  activeMusicPlaylistName: '',
  comments: [],
  pages: [],
  pagesTrashMode: false,
  themes: [],
  plugins: [],
  settings: {},
  fontLibrary: [],
  user: null,
  stats: null,
  charts: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const apiLabel = $('#api-base-label');
if (apiLabel) apiLabel.textContent = API_BASE;

function setStatus(text) {
  const status = $('#admin-status');
  if (status) status.textContent = text;
  if (root) root.dataset.status = text || '';
}

function notify(message, error = false) {
  const el = $('#admin-notice');
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('is-visible', !!message);
  el.classList.toggle('is-error', !!error);
}
window.notifyAdmin = notify;

const contentPanels = ['content-center', 'articles', 'series', 'books', 'navigation', 'bangumi', 'manga', 'albums', 'music'];
const mediaPanels = ['media', 'fonts'];
const settingsPanels = ['settings', 'personal', 'appearance', 'taxonomy', 'comments', 'backup', 'plugins'];
const navPanelMap = {
  'content-center': 'articles',
  series: 'articles',
  books: 'articles',
  navigation: 'articles',
  bangumi: 'articles',
  manga: 'articles',
  albums: 'articles',
  music: 'articles',
  fonts: 'media',
  personal: 'settings',
  appearance: 'settings',
  backup: 'settings',
  taxonomy: 'settings',
  comments: 'settings',
  plugins: 'settings',
};
const contentLabels = {
  'content-center': '导入与关联',
  articles: '文章',
  series: '专题',
  books: '书库',
  navigation: '导航',
  bangumi: '追番',
  manga: '漫画',
  albums: '相册',
  music: '音乐',
};
const mediaLabels = { media: '文件资源', fonts: '字体库' };
const settingsLabels = {
  settings: '站点与账号',
  personal: '个人与同步',
  appearance: '主题外观',
  taxonomy: '分类标签',
  comments: '评论',
  backup: '备份与恢复',
  plugins: '插件',
};

const panelTitles = { dashboard: '概览', 'content-center': '个人内容中枢', articles: '文章管理', series: '专题管理', books: '书库管理', navigation: '导航管理', bangumi: '追番管理', manga: '漫画管理', albums: '相册管理', music: '音乐管理', media: '媒体资源', fonts: '字体库', settings: '系统设置', personal: '个人与同步', appearance: '主题外观', 'search-sources': '漫画源管理', taxonomy: '分类标签', comments: '评论管理', backup: '备份与恢复', plugins: '插件管理', login: '后台登录' };

function ensurePanelTabs() {
  [
    { panels: contentPanels, labels: contentLabels, className: 'content-tabs' },
    { panels: mediaPanels, labels: mediaLabels, className: 'media-tabs' },
    { panels: settingsPanels, labels: settingsLabels, className: 'settings-tabs' },
  ].forEach((group) => {
    group.panels.forEach((panel) => {
      const target = $(`#${panel}-panel`);
      if (!target) return;
      if (group.className === 'settings-tabs') target.classList.add('admin-settings-workspace');
      if (group.className === 'media-tabs') target.classList.add('admin-media-workspace');
      if (target.querySelector(`.${group.className}`)) return;
      const tabs = document.createElement('div');
      tabs.className = `admin-subnav ${group.className}`;
      tabs.innerHTML = group.panels.map((item) => (
        `<button type="button" data-panel-tab="${item}">${group.labels[item]}</button>`
      )).join('');
      target.prepend(tabs);
    });
  });
}

function syncPanelTabs(panel) {
  $$('[data-panel-tab]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.panelTab === panel);
  });
}

function switchPanel(panel) {
  ensurePanelTabs();
  $$('.admin-panel').forEach((el) => el.classList.add('hidden'));
  $(`#${panel}-panel`)?.classList.remove('hidden');
  const activeNav = navPanelMap[panel] || panel;
  $$('.admin-nav').forEach((el) => el.classList.toggle('is-active', el.dataset.panel === activeNav));
  syncPanelTabs(panel);
  const pageTitle = $('#admin-page-title');
  if (pageTitle) pageTitle.textContent = panelTitles[panel] || '后台管理';
  if (panel === 'search-sources') window.dispatchEvent(new CustomEvent('content-search-sources-request'));
}

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(options.headers || {}),
  };
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error(`无法连接后端 API（${API_BASE}），请确认 Express 服务已启动`);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const err = new Error(json.message || `接口请求失败（HTTP ${res.status}）`);
    err.status = res.status;
    err.code = json.code || '';
    throw err;
  }
  return json;
}

function friendlyLoginError(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || '');
  if (/无法连接后端 API/.test(message) || /Failed to fetch|NetworkError/i.test(message)) {
    return `无法连接后端 API：${API_BASE}。请确认后端 3001 已启动。`;
  }
  if (status === 404) return `登录接口不存在：${API_BASE}/auth/login。请检查 API 地址。`;
  if (status === 401 || /用户名或密码错误|AUTH/i.test(message)) return '用户名或密码错误，请确认当前后台账号。';
  if (status === 403) return '当前账号没有后台权限。';
  if (status >= 500) return `后端登录接口异常：${message}`;
  return message || '登录失败，请稍后重试。';
}

async function uploadFile(file, folderId = undefined) {
  const body = new FormData();
  body.append('file', file);
  if (folderId !== undefined && folderId !== null) body.append('folder_id', String(folderId));
  const json = await request('/admin/media/upload', { method: 'POST', body });
  return { ...json.data, url: json.data?.url || `/uploads/${json.data?.path}` };
}

async function login(username, password) {
  const json = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  state.token = json.data.token;
  localStorage.setItem(tokenKey, state.token);
  await ensurePrivateDevice();
  $('#logout-admin').classList.remove('hidden');
  return json.data.user;
}

async function loadTaxonomy() {
  const [catRes, tagRes] = await Promise.all([
    request('/categories'),
    request('/tags'),
  ]);
  state.categories = catRes.data || [];
  state.tags = tagRes.data || [];
  renderTaxonomy();
}

async function loadDashboard() {
  const [statsResult, chartsResult] = await Promise.allSettled([
    request('/admin/dashboard/stats'),
    request('/admin/dashboard/charts'),
  ]);
  if (statsResult.status === 'fulfilled') {
    state.stats = statsResult.value.data || {};
  }
  if (chartsResult.status === 'fulfilled') {
    state.charts = chartsResult.value.data || {};
  }
  renderDashboard();
}

async function loadArticles() {
  const status = $('#status-filter').value;
  const trashed = $('#trash-filter')?.checked;
  const qs = new URLSearchParams({ page: '1', pageSize: '30', summary: 'true' });
  if (status) qs.set('status', status);
  if (trashed) qs.set('trashed', 'true');
  const json = await request(`/admin/articles?${qs.toString()}`);
  state.articles = json.data || [];
  renderArticles();
}

async function loadMedia() {
  const sequence = ++state.mediaLoadSequence;
  const qs = new URLSearchParams({ sort: state.mediaSort, order: state.mediaSortOrder });
  if (state.mediaCurrentFolderId !== null) qs.set('folderId', String(state.mediaCurrentFolderId));
  if (state.mediaSmartType) qs.set('type', state.mediaSmartType);
  if (state.mediaTrashMode) qs.set('trashed', 'true');
  const search = ($('#media-search')?.value || '').trim();
  if (search) qs.set('search', search);
  const json = await request(`/admin/media/explorer?${qs.toString()}`);
  if (sequence !== state.mediaLoadSequence) return;
  const data = json.data || {};
  state.media = data.files || [];
  state.mediaFolders = data.folders || [];
  state.mediaAllFolders = data.all_folders || [];
  state.mediaBreadcrumb = data.breadcrumb || [];
  state.mediaFolderCounts = data.counts || {};
  renderMediaExplorer();
}

async function loadSettings() {
  const json = await request('/admin/settings');
  const rows = json.data || [];
  const musicRow = rows.find((item) => item.key === 'music_playlist');
  state.music = parseSetting(musicRow) || [];
  state.settings = Object.fromEntries(rows.map((item) => [item.key, parseSetting(item)]));
  state.fontLibrary = Array.isArray(state.settings.font_library) ? state.settings.font_library : [];
  try {
    const [musicJson, playlistJson] = await Promise.all([
      request('/admin/music'),
      request('/admin/music/playlists'),
    ]);
    if (Array.isArray(musicJson.data) && musicJson.data.length) {
      state.music = musicJson.data;
    }
    state.musicPlaylists = playlistJson.data || [];
  } catch (error) {
    console.warn(error);
  }
  renderMusic();
  renderMusicPlaylists();
  renderFontLibrary();
  renderSettings();
  renderProfile();
}

async function loadMe() {
  const json = await request('/auth/me');
  state.user = json.data;
  renderAccount();
}

async function loadPages() {
  const qs = new URLSearchParams();
  if (state.pagesTrashMode) qs.set('trashed', 'true');
  const json = await request(`/admin/pages${qs.toString() ? `?${qs.toString()}` : ''}`);
  state.pages = json.data || [];
  renderPages();
}

async function loadComments() {
  const status = $('#comment-status-filter')?.value || '';
  const qs = new URLSearchParams({ page: '1', pageSize: '50' });
  if (status) qs.set('status', status);
  const json = await request(`/admin/comments?${qs.toString()}`);
  state.comments = json.data || [];
  renderComments();
}

async function replyComment(id) {
  const comment = state.comments.find((item) => String(item.id) === String(id));
  const content = window.prompt(`回复 ${comment?.author_name || '这条评论'}：`);
  if (!content?.trim()) return;
  try {
    await request(`/admin/comments/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ content: content.trim() }),
    });
    await loadComments();
    notify('回复已发布');
  } catch (error) {
    notify(error.message || '回复失败', true);
  }
}

async function loadThemes() {
  const json = await request('/admin/themes');
  state.themes = json.data || [];
  renderThemes();
}

async function loadPlugins() {
  const json = await request('/admin/plugins');
  state.plugins = json.data || [];
  renderPlugins();
}

function getPrivateDeviceClientId() {
  const key = 'boke_private_device_client_id';
  let clientId = localStorage.getItem(key);
  if (!clientId) {
    clientId = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, clientId);
  }
  return clientId;
}

async function ensurePrivateDevice() {
  if (!state.token) return;
  const clientId = getPrivateDeviceClientId();
  const existing = localStorage.getItem('boke_private_device_token');
  const registeredClientId = localStorage.getItem('boke_private_device_registered_client_id');
  if (existing && registeredClientId === clientId) {
    try {
      const response = await fetch(API_BASE + '/private/navigation', { headers: { 'X-Device-Token': existing } });
      if (response.ok) return;
    } catch {}
    localStorage.removeItem('boke_private_device_token');
  }
  try {
    const json = await request('/admin/devices/register', {
      method: 'POST',
      body: JSON.stringify({
        name: (navigator.userAgentData?.platform || '设备') + ' · ' + (navigator.userAgent.includes('Mobile') ? '移动端' : '浏览器'),
        platform: navigator.userAgent,
        client_id: clientId,
      }),
    });
    if (json.data?.token) {
      localStorage.setItem('boke_private_device_token', json.data.token);
      localStorage.setItem('boke_private_device_registered_client_id', clientId);
    }
  } catch (error) {
    console.warn('私人设备登记失败', error);
  }
}
async function loadAll() {
  if (!state.token) {
    setStatus('请先登录后台');
    switchPanel('login');
    return;
  }
  try {
    setStatus('正在读取 Express API...');
    await loadMe();
    await ensurePrivateDevice();
    $('#logout-admin').classList.remove('hidden');
  } catch (error) {
    localStorage.removeItem(tokenKey);
    state.token = '';
    $('#logout-admin').classList.add('hidden');
    setStatus('连接失败，请重新登录');
    $('#login-message').textContent = error.message;
    switchPanel('login');
    return;
  }

  const modules = [
    { label: '分类标签', load: loadTaxonomy },
    { label: '仪表盘', load: loadDashboard },
    { label: '文章', load: loadArticles },
    { label: '媒体库', load: loadMedia },
    { label: '设置', load: loadSettings },
    { label: '独立页面', load: loadPages },
    { label: '评论', load: loadComments },
    { label: '主题', load: loadThemes },
    { label: '插件', load: loadPlugins },
  ];
  const results = await Promise.allSettled(modules.map((module) => module.load()));
  const failed = results
    .map((result, index) => result.status === 'rejected' ? modules[index].label : '')
    .filter(Boolean);
  if (failed.length) {
    setStatus(`已连接后端 API，部分模块加载失败：${failed.join('、')}`);
    notify(`部分模块加载失败：${failed.join('、')}`, true);
  } else {
    setStatus('已连接后端 API');
  }
  const hashPanel = location.hash.replace(/^#/, '').split('?')[0];
  switchPanel(panelTitles[hashPanel] ? hashPanel : 'dashboard');
}

function renderDashboard() {
  const stats = state.stats || {};
  const charts = state.charts || {};
  $$('[data-stat]').forEach((el) => {
    el.textContent = Number(stats[el.dataset.stat] || 0).toLocaleString('zh-CN');
  });
  $('#recent-posts').innerHTML = (stats.recentPosts || []).map((post) => `
    <div class="flex items-center justify-between rounded-xl bg-base-100/60 p-3">
      <span class="font-semibold">${escapeHtml(post.title)}</span>
      <span class="text-base-content/45">${post.view_count || 0} 阅读</span>
    </div>
  `).join('') || '<p class="text-base-content/45">暂无发布文章</p>';
  $('#admin-alerts').innerHTML = (stats.anomalies || []).map((item) => `
    <div class="admin-alert is-${escapeHtml(item.level || 'info')}">${escapeHtml(item.message)}</div>
  `).join('') || '<p class="text-base-content/45">系统运行正常</p>';
  $('#popular-posts').innerHTML = (stats.popularPosts || []).map((post, index) => `
    <a class="admin-rank-row" href="/article/${encodeURIComponent(post.slug || '')}" target="_blank" rel="noreferrer">
      <span class="admin-rank-index">${index + 1}</span>
      <span class="min-w-0 flex-1 truncate font-semibold">${escapeHtml(post.title)}</span>
      <span class="text-base-content/45">${Number(post.view_count || 0).toLocaleString('zh-CN')} 阅读</span>
    </a>
  `).join('') || '<p class="text-base-content/45">暂无热门文章</p>';
  renderBarChart('#visit-chart', charts.visitTrend || [], 'count');
  renderBarChart('#publish-chart', charts.publishingTrend || [], 'count');
  renderRankChart('#category-chart', charts.categoryDistribution || []);
}

function renderBarChart(selector, rows, valueKey = 'count') {
  const el = $(selector);
  if (!el) return;
  const data = Array.isArray(rows) ? rows.slice(-30) : [];
  const max = Math.max(1, ...data.map((item) => Number(item[valueKey] || 0)));
  el.innerHTML = data.length ? data.map((item) => {
    const value = Number(item[valueKey] || 0);
    const height = Math.max(6, Math.round((value / max) * 100));
    return `
      <span class="admin-bar" title="${escapeHtml(item.date || '')}：${value}">
        <i style="height:${height}%"></i>
      </span>
    `;
  }).join('') : '<p class="text-sm text-base-content/45">暂无趋势数据</p>';
}

function renderRankChart(selector, rows) {
  const el = $(selector);
  if (!el) return;
  const data = (Array.isArray(rows) ? rows : []).filter((item) => item.name).slice(0, 8);
  const max = Math.max(1, ...data.map((item) => Number(item.count || 0)));
  el.innerHTML = data.length ? data.map((item) => {
    const value = Number(item.count || 0);
    const width = Math.max(5, Math.round((value / max) * 100));
    return `
      <div class="admin-rank-meter">
        <div class="flex items-center justify-between gap-3 text-sm">
          <span class="truncate font-semibold">${escapeHtml(item.name)}</span>
          <span class="text-base-content/45">${value}</span>
        </div>
        <span><i style="width:${width}%"></i></span>
      </div>
    `;
  }).join('') : '<p class="text-sm text-base-content/45">暂无分类数据</p>';
}

function renderArticles() {
  const trashed = $('#trash-filter')?.checked;
  const batchButton = $('#batch-delete');
  if (batchButton) {
    batchButton.textContent = trashed ? '批量永久删除' : '批量删除';
    batchButton.classList.toggle('btn-error', !!trashed);
  }
  $('#articles-table').innerHTML = state.articles.map((post) => `
    <tr>
      <td><input class="checkbox checkbox-sm article-check" type="checkbox" value="${post.id}" /></td>
      <td>
        <div class="font-black">${escapeHtml(post.title)}</div>
        <div class="text-xs text-base-content/45">${escapeHtml(post.slug || '')}</div>
      </td>
      <td><span class="badge ${post.status === 'published' ? 'badge-primary' : 'badge-ghost'}">${post.status === 'published' ? '已发布' : '草稿'}</span></td>
      <td>${escapeHtml(post.category_name || '未分类')}</td>
      <td>${post.view_count || 0}</td>
      <td>${formatDate(post.updated_at || post.created_at)}</td>
      <td>
        <div class="flex justify-end gap-2">
          ${trashed ? `
            <button class="btn btn-xs rounded-lg" data-restore="${post.id}">恢复</button>
            <button class="btn btn-xs btn-error rounded-lg" data-force-delete="${post.id}">永久删除</button>
          ` : `
            <a class="btn btn-xs rounded-lg" href="/admin/write?id=${post.id}">编辑</a>
            <button class="btn btn-xs btn-error rounded-lg" data-delete="${post.id}">删除</button>
          `}
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="7" class="text-center text-base-content/45">暂无文章</td></tr>';
}

function renderTaxonomy() {
  $('#category-select').innerHTML = '<option value="">无分类</option>' + state.categories.map((cat) => (
    `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`
  )).join('');
  $('#tag-select').innerHTML = state.tags.map((tag) => (
    `<option value="${tag.id}">${escapeHtml(tag.name)}</option>`
  )).join('');
  $('#category-list').innerHTML = state.categories.map((cat) => `
    <div class="flex items-center gap-2 rounded-xl bg-base-100/65 p-2">
      <span class="font-bold">${escapeHtml(cat.name)}</span>
      <button class="btn btn-xs rounded-lg" data-edit-category="${cat.id}">编辑</button>
      <button class="btn btn-xs btn-error rounded-lg" data-delete-category="${cat.id}">删除</button>
    </div>
  `).join('') || '<p class="text-sm text-base-content/45">暂无分类</p>';
  $('#tag-list').innerHTML = state.tags.map((tag) => `
    <div class="flex items-center gap-2 rounded-xl bg-base-100/65 p-2">
      <span class="font-bold">${escapeHtml(tag.name)}</span>
      <button class="btn btn-xs rounded-lg" data-edit-tag="${tag.id}">编辑</button>
      <button class="btn btn-xs btn-error rounded-lg" data-delete-tag="${tag.id}">删除</button>
    </div>
  `).join('') || '<p class="text-sm text-base-content/45">暂无标签</p>';
}

function isFontMediaExplorer(file) {
  const mime = String(file?.mime_type || '').toLowerCase();
  const name = String(file?.original_name || file?.path || '').split('?')[0].toLowerCase();
  return mime.startsWith('font/') || mime === 'application/vnd.ms-fontobject' || /\.(woff2?|ttf|otf|eot)$/i.test(name);
}
function mediaExplorerEntry(kind, id) {
  const source = kind === 'folder' ? state.mediaAllFolders : state.media;
  return source.find((entry) => String(entry.id) === String(id));
}
function mediaFolderDepth(folder) {
  const byId = new Map(state.mediaAllFolders.map((item) => [Number(item.id), item]));
  let depth = 0;
  let current = folder;
  const visited = new Set();
  while (current?.parent_id && !visited.has(current.parent_id) && depth < 6) {
    visited.add(current.parent_id);
    current = byId.get(Number(current.parent_id));
    depth += 1;
  }
  return depth;
}
function orderedMediaFolders() {
  const children = new Map();
  state.mediaAllFolders.forEach((folder) => {
    const key = folder.parent_id == null ? 'root' : String(folder.parent_id);
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(folder);
  });
  const output = [];
  const walk = (parentId = null) => {
    const key = parentId == null ? 'root' : String(parentId);
    (children.get(key) || []).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')).forEach((folder) => {
      output.push(folder);
      walk(folder.id);
    });
  };
  walk();
  return output;
}
function renderMediaExplorer() {
  const grid = $('#media-grid');
  if (!grid) return;
  $('#media-normal-mode')?.classList.toggle('btn-primary', !state.mediaTrashMode);
  $('#media-trash-mode')?.classList.toggle('btn-primary', state.mediaTrashMode);
  $('#cleanup-media')?.classList.toggle('hidden', state.mediaTrashMode);
  $('#empty-media-trash')?.classList.toggle('hidden', !state.mediaTrashMode);
  const canCreate = !state.mediaTrashMode && !state.mediaSmartType;
  $('#media-upload')?.closest('label')?.classList.toggle('hidden', state.mediaTrashMode);
  $('#media-create-folder')?.classList.toggle('hidden', !canCreate);
  $('#media-create-file')?.classList.toggle('hidden', !canCreate);
  if ($('#media-sort')) $('#media-sort').value = state.mediaSort;
  if ($('#media-sort-order')) $('#media-sort-order').textContent = state.mediaSortOrder === 'desc' ? 'DESC \u2193' : 'ASC \u2191';
  const smartFolders = [
    { id: 'image', label: '&#22270;&#29255;', icon: '&#9639;' },
    { id: 'video', label: '&#35270;&#39057;', icon: '&#9654;' },
    { id: 'audio', label: '&#38899;&#39057;', icon: '&#9834;' },
    { id: 'font', label: '&#23383;&#20307;', icon: 'Aa' },
    { id: 'document', label: '&#25991;&#26723;&#19982;&#21387;&#32553;&#21253;', icon: '&#9636;' },
    { id: 'other', label: '&#20854;&#20182;&#25991;&#20214;', icon: '&#9671;' },
  ];
  const realFolders = orderedMediaFolders().map((folder) => `<button class="${!state.mediaSmartType && Number(state.mediaCurrentFolderId) === Number(folder.id) ? 'is-active' : ''}" type="button" data-media-folder-id="${folder.id}" style="--folder-depth:${mediaFolderDepth(folder)}"><i>&#128193;</i><span>${escapeHtml(folder.name)}</span></button>`).join('');
  const smart = smartFolders.map((folder) => `<button class="${state.mediaSmartType === folder.id ? 'is-active' : ''}" type="button" data-media-smart-type="${folder.id}"><i>${folder.icon}</i><span>${folder.label}</span><small>${state.mediaFolderCounts[folder.id] || 0}</small></button>`).join('');
  $('#media-folder-list').innerHTML = `
    <button class="${!state.mediaSmartType && state.mediaCurrentFolderId === null ? 'is-active' : ''}" type="button" data-media-folder-id=""><i>&#8962;</i><span>&#23186;&#20307;&#24211;</span><small>${state.mediaFolderCounts.all || 0}</small></button>
    ${realFolders || '<p class="admin-media-folder-empty">&#36824;&#27809;&#26377;&#33258;&#24314;&#25991;&#20214;&#22841;</p>'}
    <div class="admin-media-folder-label">&#25353;&#31867;&#22411;&#26597;&#30475;</div>${smart}`;
  const active = smartFolders.find((item) => item.id === state.mediaSmartType)?.label || (state.mediaTrashMode ? '&#22238;&#25910;&#31449;' : '');
  const crumbs = state.mediaSmartType || state.mediaTrashMode
    ? `<button type="button" data-media-breadcrumb-root>&#23186;&#20307;&#24211;</button><b>/</b><strong>${active}</strong>`
    : `<button type="button" data-media-breadcrumb-root>&#23186;&#20307;&#24211;</button>${state.mediaBreadcrumb.map((folder) => `<b>/</b><button type="button" data-media-breadcrumb-id="${folder.id}">${escapeHtml(folder.name)}</button>`).join('')}`;
  const header = $('.admin-media-breadcrumb');
  if (header) header.innerHTML = `<nav aria-label="Breadcrumb">${crumbs}</nav><small id="media-file-count">${state.mediaFolders.length + state.media.length} &#20010;&#39033;&#30446;</small>`;
  const categoryIcons = { image: '&#9639;', video: '&#9654;', audio: '&#9834;', font: 'Aa', document: '&#9636;', other: '&#9671;' };
  const categoryLabels = { image: '&#22270;&#29255;', video: '&#35270;&#39057;', audio: '&#38899;&#39057;', font: '&#23383;&#20307;', document: '&#25991;&#26723;', other: '&#25991;&#20214;' };
  const folderRows = state.mediaFolders.map((folder) => `<article class="admin-media-item is-folder" data-media-kind="folder" data-media-id="${folder.id}" tabindex="0">
    <div class="admin-media-file"><div class="admin-media-preview"><span>&#128193;</span></div><div class="admin-media-name"><strong>${escapeHtml(folder.name)}</strong><small>&#25991;&#20214;&#22841;</small></div></div>
    <span>&#25991;&#20214;&#22841;</span><span>-</span><span>&#21487;&#29992;</span><time>${formatDate(folder.updated_at || folder.created_at)}</time></article>`).join('');
  const fileRows = state.media.map((file) => {
    const url = file.url || `/uploads/${file.path}`;
    const category = file.category || 'other';
    const image = file.mime_type?.startsWith('image/');
    return `<article class="admin-media-item" data-media-kind="file" data-media-id="${file.id}" tabindex="0">
      <div class="admin-media-file"><div class="admin-media-preview">${image ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" />` : `<span>${categoryIcons[category] || '&#9671;'}</span>`}</div><div class="admin-media-name"><strong>${escapeHtml(file.original_name || file.filename || 'Untitled')}</strong><small>${escapeHtml(file.path || '')}</small></div></div>
      <span>${categoryLabels[category] || '&#25991;&#20214;'}</span><span>${formatSize(file.size)}</span><span>${state.mediaTrashMode ? '&#22238;&#25910;&#31449;' : '&#21487;&#29992;'}</span><time>${formatDate(file.created_at)}</time></article>`;
  }).join('');
  grid.innerHTML = folderRows + fileRows || '<p class="admin-media-empty">&#36825;&#20010;&#25991;&#20214;&#22841;&#26159;&#31354;&#30340;</p>';
}
function openMediaExplorerEntry(kind, entry) {
  if (!entry) return;
  if (kind === 'folder') {
    state.mediaCurrentFolderId = Number(entry.id);
    state.mediaSmartType = '';
    loadMedia();
  } else window.open(entry.url || `/uploads/${entry.path}`, '_blank', 'noopener,noreferrer');
}
function closeMediaExplorerContext() {
  const menu = $('#media-context-menu');
  if (menu) menu.hidden = true;
  state.mediaContext = null;
}
function showMediaExplorerContext(event, kind, id) {
  const entry = mediaExplorerEntry(kind, id);
  const menu = $('#media-context-menu');
  if (!entry || !menu) return;
  event.preventDefault();
  document.body.append(menu);
  state.mediaContext = { kind, id: Number(id) };
  menu.querySelector('[data-media-context="copy"]').hidden = kind === 'folder';
  menu.querySelector('[data-media-context="font"]').hidden = state.mediaTrashMode || kind === 'folder' || !isFontMediaExplorer(entry);
  menu.querySelector('[data-media-context="rename"]').hidden = state.mediaTrashMode;
  menu.querySelector('[data-media-context="move"]').hidden = state.mediaTrashMode;
  menu.querySelector('[data-media-context="delete"]').hidden = state.mediaTrashMode;
  menu.querySelector('[data-media-context="restore"]').hidden = !state.mediaTrashMode || kind === 'folder';
  menu.querySelector('[data-media-context="force-delete"]').hidden = !state.mediaTrashMode || kind === 'folder';
  menu.hidden = false;
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8))}px`;
}
async function createMediaExplorerEntry(kind) {
  const name = window.prompt(kind === 'folder' ? '\u65b0\u5efa\u6587\u4ef6\u5939\u540d\u79f0' : '\u65b0\u5efa\u6587\u4ef6\u540d\u79f0', kind === 'folder' ? '\u65b0\u5efa\u6587\u4ef6\u5939' : '\u65b0\u5efa\u6587\u4ef6.txt')?.trim();
  if (!name) return;
  try {
    const url = kind === 'folder' ? '/admin/media/folders' : '/admin/media/files';
    const body = kind === 'folder' ? { name, parent_id: state.mediaCurrentFolderId } : { name, folder_id: state.mediaCurrentFolderId };
    await request(url, { method: 'POST', body: JSON.stringify(body) });
    await loadMedia();
  } catch (error) { notify(error.message || 'Create failed', true); }
}
async function renameMediaExplorerEntry(kind, entry) {
  const current = kind === 'folder' ? entry.name : entry.original_name;
  const name = window.prompt('\u8f93\u5165\u65b0\u540d\u79f0', current)?.trim();
  if (!name || name === current) return;
  try {
    const url = kind === 'folder' ? `/admin/media/folders/${entry.id}` : `/admin/media/${entry.id}`;
    await request(url, { method: 'PUT', body: JSON.stringify({ name }) });
    await loadMedia();
  } catch (error) { notify(error.message || 'Rename failed', true); }
}
async function moveMediaExplorerEntry(kind, entry) {
  const folders = state.mediaAllFolders.filter((folder) => kind !== 'folder' || Number(folder.id) !== Number(entry.id));
  const choices = folders.map((folder) => `${folder.id}: ${folder.name}`).join('\n');
  const input = window.prompt(`\u8f93\u5165\u76ee\u6807\u6587\u4ef6\u5939\u7f16\u53f7\uff0c\u7559\u7a7a\u79fb\u5230\u6839\u76ee\u5f55\n\n${choices}`, '');
  if (input === null) return;
  const folderId = input.trim() ? Number(input.trim()) : null;
  if (folderId !== null && !folders.some((folder) => Number(folder.id) === folderId)) return notify('\u76ee\u6807\u6587\u4ef6\u5939\u4e0d\u5b58\u5728', true);
  try {
    const url = kind === 'folder' ? `/admin/media/folders/${entry.id}` : `/admin/media/${entry.id}`;
    await request(url, { method: 'PUT', body: JSON.stringify({ parent_id: folderId, folder_id: folderId }) });
    await loadMedia();
  } catch (error) { notify(error.message || 'Move failed', true); }
}
async function deleteMediaExplorerFolder(folder) {
  if (!confirm(`Delete empty folder "${folder.name}"?`)) return;
  try {
    await request(`/admin/media/folders/${folder.id}`, { method: 'DELETE' });
    await loadMedia();
  } catch (error) { notify(error.message || 'Delete failed', true); }
}
function renderMusicPlaylists() {
  const list = $('#music-playlist-list');
  if (!list) return;
  list.innerHTML = (state.musicPlaylists || []).map((playlist) => `
    <article class="admin-playlist-card">
      <button class="admin-playlist-open" type="button" data-open-music-playlist="${escapeHtml(playlist.name)}">
        <span class="admin-playlist-cover">
          ${playlist.cover ? `<img src="${escapeHtml(playlist.cover)}" alt="" loading="lazy" decoding="async" />` : '<span>♪</span>'}
          <b>${Number(playlist.track_count || 0)} 首</b>
        </span>
        <span class="admin-playlist-info">
          <strong>${escapeHtml(playlist.name)}</strong>
          <small>${playlist.is_active ? '前台启用' : '已停用'} · 排序 ${Number(playlist.sort_order || 0)}</small>
          <span>${escapeHtml(playlist.description || '点击管理这个歌单中的歌曲')}</span>
        </span>
      </button>
      <div class="admin-card-actions">
        <button class="btn btn-xs rounded-lg" type="button" data-edit-music-playlist="${playlist.id}">编辑</button>
        <button class="btn btn-xs btn-error rounded-lg" type="button" data-delete-music-playlist="${playlist.id}">删除</button>
      </div>
    </article>
  `).join('') || '<div class="admin-collection-empty">还没有歌单，点击“新建歌单”创建。</div>';
}

function musicPlaylistName(song) {
  return song.playlist || song.collection || '默认歌单';
}

function renderMusic() {
  const list = $('#music-list');
  const filter = $('#music-playlist-filter');
  const summary = $('#music-summary');
  if (!list) return;
  const selected = state.activeMusicPlaylistName || filter?.value || '';
  if (filter) filter.value = selected;
  const visibleSongs = state.music
    .map((song, index) => ({ ...song, index }))
    .filter((song) => !selected || musicPlaylistName(song) === selected);
  if (summary) {
    summary.textContent = `${visibleSongs.length} 首歌`;
  }
  const batchToolbar = visibleSongs.length ? `
    <div class="admin-track-batch">
      <p>勾选歌曲后可批量移除</p>
      <button class="btn btn-sm btn-error rounded-xl" type="button" data-batch-remove-music>批量移除</button>
    </div>
  ` : '';
  list.innerHTML = batchToolbar + visibleSongs.map((song) => `
    <article class="admin-track-row">
      <input class="checkbox checkbox-sm checkbox-primary shrink-0" type="checkbox" value="${song.index}" data-music-select aria-label="选择 ${escapeHtml(song.title)}" />
      <span class="admin-track-cover">
        ${song.cover ? `<img src="${escapeHtml(song.cover)}" alt="" loading="lazy" decoding="async" />` : '<span>♪</span>'}
      </span>
      <span class="admin-track-info">
        <strong>${escapeHtml(song.title)}</strong>
        <small>${escapeHtml(song.artist || '未知歌手')} · ${song.lyrics ? '有歌词' : '无歌词'}</small>
        <audio src="${escapeHtml(song.url)}" controls preload="none"></audio>
      </span>
      <div class="admin-card-actions">
        <button class="btn btn-xs rounded-lg" data-edit-song="${song.index}">编辑</button>
        <button class="btn btn-xs rounded-lg" data-move-song="${song.index}" data-direction="up">上移</button>
        <button class="btn btn-xs rounded-lg" data-move-song="${song.index}" data-direction="down">下移</button>
        <button class="btn btn-xs btn-error rounded-lg" data-remove-song="${song.index}">移除</button>
      </div>
    </article>
  `).join('') || '<div class="admin-collection-empty">这个歌单还没有歌曲，点击“新增歌曲”添加。</div>';
}

function syncMusicPlaylistOptions(selectedName = '') {
  const field = $('#music-form')?.elements.namedItem('playlist');
  if (!field) return;
  const playlists = state.musicPlaylists || [];
  field.innerHTML = playlists.map((playlist) => (
    `<option value="${escapeHtml(playlist.name)}">${escapeHtml(playlist.name)}</option>`
  )).join('');
  const fallback = state.activeMusicPlaylistName || playlists[0]?.name || '';
  field.value = playlists.some((playlist) => playlist.name === selectedName) ? selectedName : fallback;
}

function openMusicTracks(name) {
  const playlist = state.musicPlaylists.find((item) => item.name === name);
  if (!playlist) return;
  state.activeMusicPlaylistName = playlist.name;
  $('#music-tracks-dialog-title').textContent = playlist.name;
  renderMusic();
  $('#music-tracks-dialog')?.showModal();
}

function openMusicTrackDialog(index = -1) {
  const form = $('#music-form');
  const dialog = $('#music-track-dialog');
  if (!form || !dialog) return;
  form.reset();
  delete form.dataset.editingIndex;
  const song = index >= 0 ? state.music[index] : null;
  syncMusicPlaylistOptions(song ? musicPlaylistName(song) : state.activeMusicPlaylistName);
  if (song) {
    form.dataset.editingIndex = String(index);
    form.elements.namedItem('title').value = song.title || '';
    form.elements.namedItem('artist').value = song.artist || '';
    form.elements.namedItem('playlist').value = musicPlaylistName(song);
    form.elements.namedItem('url').value = song.url || '';
    form.elements.namedItem('cover').value = song.cover || '';
    form.elements.namedItem('lyrics').value = song.lyrics || '';
    form.elements.namedItem('article_id').value = song.article_id || '';
    form.elements.namedItem('photo_id').value = song.photo_id || '';
  }
  $('#music-track-dialog-title').textContent = song ? '编辑歌曲' : '新增歌曲';
  window.updateAdminFieldPreview?.('music-form', 'url');
  window.updateAdminFieldPreview?.('music-form', 'cover');
  dialog.showModal();
  window.setTimeout(() => form.elements.namedItem('title')?.focus(), 0);
}

function openMusicPlaylistDialog(playlist = null) {
  const form = $('#music-playlist-form');
  const dialog = $('#music-playlist-dialog');
  if (!form || !dialog) return;
  resetMusicPlaylistForm(false);
  if (playlist) {
    form.elements.namedItem('id').value = playlist.id;
    form.elements.namedItem('name').value = playlist.name || '';
    form.elements.namedItem('description').value = playlist.description || '';
    form.elements.namedItem('cover').value = playlist.cover || '';
    form.elements.namedItem('sort_order').value = playlist.sort_order || 0;
    form.elements.namedItem('is_active').checked = playlist.is_active !== 0;
  }
  $('#music-playlist-dialog-title').textContent = playlist ? '编辑歌单' : '新建歌单';
  window.updateAdminFieldPreview?.('music-playlist-form', 'cover');
  dialog.showModal();
  window.setTimeout(() => form.elements.namedItem('name')?.focus(), 0);
}

async function batchRemoveMusic() {
  const indexes = Array.from(document.querySelectorAll('[data-music-select]:checked'))
    .map((input) => Number(input.value))
    .filter(Number.isInteger)
    .sort((a, b) => b - a);
  if (!indexes.length) {
    notify('请先勾选要移除的歌曲', true);
    return;
  }
  if (!window.confirm(`确认从配置中移除 ${indexes.length} 首歌曲吗？保存配置后生效。`)) return;
  indexes.forEach((index) => state.music.splice(index, 1));
  renderMusic();
  await saveMusic();
}

function renderProfile() {
  const form = $('#profile-form');
  if (!form) return;
  form.elements.namedItem('profile_name').value = state.settings.profile_name || state.settings.site_title || '个人博客';
  form.elements.namedItem('profile_avatar').value = state.settings.profile_avatar || '/profile.webp';
  form.elements.namedItem('profile_bio').value = state.settings.profile_bio || state.settings.site_description || '记录技术、生活和长期主义的小站。';
}

function renderAccount() {
  const form = $('#account-form');
  if (!form || !state.user) return;
  form.elements.namedItem('nickname').value = state.user.nickname || state.user.username || '';
  form.elements.namedItem('avatar').value = state.user.avatar || '';
  form.elements.namedItem('password').value = '';
window.updateAdminFieldPreview?.('account-form', 'avatar');
  const accountName = $('#admin-account-name');
  const accountAvatar = $('#admin-account-avatar');
  if (accountName) accountName.textContent = state.user.nickname || state.user.username || '管理员';
  if (accountAvatar) accountAvatar.src = state.user.avatar || '/profile.webp';
}

function renderSettings() {
  const form = $('#site-settings-form');
  if (!form) return;
  const fields = form.elements;
  fields.namedItem('site_title').value = state.settings.site_title || '';
  fields.namedItem('site_description').value = state.settings.site_description || '';
  fields.namedItem('site_author').value = state.settings.site_author || state.settings.profile_name || '';
  fields.namedItem('site_keywords').value = state.settings.site_keywords || '';
  fields.namedItem('site_language').value = state.settings.site_language || 'zh-CN';
  fields.namedItem('footer_text').value = state.settings.footer_text || '记录所想，分享所见。';
  fields.namedItem('site_start_date').value = String(state.settings.site_start_date || '2026-01-01').slice(0, 10);
  fields.namedItem('copyright_year').value = Number(state.settings.copyright_year || new Date().getFullYear());
  fields.namedItem('banner_images').value = Array.isArray(state.settings.banner_images) ? state.settings.banner_images.join('\n') : String(state.settings.banner_images || '');
  fields.namedItem('banner_interval').value = Number(state.settings.banner_interval || 6);
  fields.namedItem('posts_per_page').value = state.settings.posts_per_page || 10;
  fields.namedItem('allow_search_indexing').checked = state.settings.allow_search_indexing !== false;
  fields.namedItem('enable_rss').checked = state.settings.enable_rss !== false;
  fields.namedItem('enable_json_feed').checked = state.settings.enable_json_feed !== false;
  fields.namedItem('show_visitor_stats').checked = state.settings.show_visitor_stats !== false;
  fields.namedItem('enable_comments').checked = state.settings.enable_comments !== false;
  fields.namedItem('comment_moderation').checked = !!state.settings.comment_moderation;
  renderSettingsPreview();
}

function renderSettingsPreview() {
  const form = $('#site-settings-form');
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
  const description = String(fields.namedItem('site_description')?.value || '').trim() || '记录技术、生活和灵感。';
  const rssEnabled = !!fields.namedItem('enable_rss')?.checked;
  const jsonEnabled = !!fields.namedItem('enable_json_feed')?.checked;
  const feedLabels = [rssEnabled ? 'RSS' : '', jsonEnabled ? 'JSON' : ''].filter(Boolean);

  const previewImage = $('#settings-preview-image');
  if (previewImage) {
    previewImage.onerror = () => {
      previewImage.onerror = null;
      previewImage.src = '/home.webp';
    };
    previewImage.src = banners[0] || '/home.webp';
  }
  if ($('#settings-preview-title')) $('#settings-preview-title').textContent = title;
  if ($('#settings-preview-description')) $('#settings-preview-description').textContent = description;
  if ($('#settings-preview-language')) $('#settings-preview-language').textContent = languageLabels[fields.namedItem('site_language')?.value] || fields.namedItem('site_language')?.value || '简体中文';
  if ($('#settings-preview-banner-count')) $('#settings-preview-banner-count').textContent = banners.length ? `${banners.length} 张` : '默认';
  if ($('#settings-preview-comments')) $('#settings-preview-comments').textContent = fields.namedItem('enable_comments')?.checked ? '已启用' : '已关闭';
  if ($('#settings-preview-feeds')) $('#settings-preview-feeds').textContent = feedLabels.length ? feedLabels.join(' · ') : '已关闭';
  if ($('#settings-preview-indexing')) $('#settings-preview-indexing').textContent = fields.namedItem('allow_search_indexing')?.checked ? '允许' : '禁止';
}
function fontKey(font) {
  if (!font?.family || !font?.url) return '';
  return `${font.family}|||${font.url}`;
}

function parseFontSelection(value) {
  const [family = '', url = ''] = String(value || '').split('|||');
  return { family, url };
}

function cssString(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function cssUrl(value = '') {
  return String(value).replace(/"/g, '%22').replace(/\n/g, '');
}

function ensureAdminFontStyle(fonts) {
  let style = $('#admin-font-library-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'admin-font-library-style';
    document.head.appendChild(style);
  }
  style.textContent = (Array.isArray(fonts) ? fonts : [])
    .map((font) => {
      const family = font.family || font.name || '';
      const url = font.url || '';
      return family && url ? `@font-face{font-family:"${cssString(family)}";src:url("${cssUrl(url)}");font-display:swap;}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function renderFontLibrary() {
  const fonts = Array.isArray(state.fontLibrary) ? state.fontLibrary : [];
  ensureAdminFontStyle(fonts);
  const options = ['<option value="">默认字体</option>']
    .concat(fonts.map((font) => `<option value="${escapeHtml(fontKey(font))}">${escapeHtml(font.family || font.name || '未命名字体')}</option>`))
    .join('');
  const titleSelect = $('#title-font-select');
  const bodySelect = $('#body-font-select');
  if (titleSelect) titleSelect.innerHTML = options;
  if (bodySelect) bodySelect.innerHTML = options;

  const list = $('#font-library-list');
  if (!list) return;
  list.innerHTML = fonts.map((font, index) => `
    <article class="admin-font-card">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate text-lg font-black" style="font-family: '${escapeHtml(font.family || font.name)}', sans-serif">${escapeHtml(font.family || font.name || '未命名字体')}</p>
          <p class="mt-1 truncate text-xs text-base-content/45">${escapeHtml(font.url || '')}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-xs rounded-xl" type="button" data-use-title-font="${index}">标题</button>
          <button class="btn btn-xs rounded-xl" type="button" data-use-body-font="${index}">正文</button>
          <button class="btn btn-xs rounded-xl" type="button" data-edit-font="${index}">编辑</button>
          <button class="btn btn-error btn-xs rounded-xl" type="button" data-remove-font="${index}">删除</button>
        </div>
      </div>
      <p class="admin-font-preview" style="font-family: '${escapeHtml(font.family || font.name)}', sans-serif">清风拂过文字，Markdown 也可以有自己的声音。</p>
    </article>
  `).join('') || '<span class="text-base-content/45">还没有导入字体，请先上传或填写字体地址。</span>';
}

async function saveFontLibrary() {
  await request('/admin/settings', {
    method: 'PUT',
    body: JSON.stringify({ settings: { font_library: state.fontLibrary } }),
  });
  state.settings.font_library = state.fontLibrary;
  $('#font-library-message').textContent = '字体库已保存';
}

function addFontEntry(family, url, message = '字体已加入，记得保存字体库') {
  if (!family || !url) {
    $('#font-library-message').textContent = '请填写字体名称和字体文件地址';
    return false;
  }
  const fonts = Array.isArray(state.fontLibrary) ? state.fontLibrary : [];
  const next = fonts.filter((font) => font.family !== family && font.url !== url);
  next.push({ family, url });
  state.fontLibrary = next;
  renderFontLibrary();
  $('#font-library-message').textContent = message;
  return true;
}

function addFontToLibrary() {
  const family = $('#font-name-input')?.value.trim();
  const url = $('#font-url-input')?.value.trim();
  if (addFontEntry(family, url)) {
    $('#font-name-input').value = '';
    $('#font-url-input').value = '';
  }
}

function addFontFromMedia(id) {
  const file = state.media.find((item) => String(item.id) === String(id));
  if (!file) return;
  const url = file.url || `/uploads/${file.path}`;
  const family = String(file.original_name || file.filename || '未命名字体').replace(/\.[^.]+$/, '');
  addFontEntry(family, url, '已从媒体库加入字体库，记得保存字体库');
}

function editFontEntry(index) {
  const font = state.fontLibrary[Number(index)];
  if (!font) return;
  $('#font-name-input').value = font.family || font.name || '';
  $('#font-url-input').value = font.url || '';
  state.fontLibrary.splice(Number(index), 1);
  renderFontLibrary();
  $('#font-library-message').textContent = '已载入到左侧表单，修改后点击“加入字体库”，最后保存字体库';
}

function useFontInArticleForm(index, target) {
  const font = state.fontLibrary[Number(index)];
  if (!font) return;
  const select = target === 'title' ? $('#title-font-select') : $('#body-font-select');
  if (!select) return;
  select.value = fontKey(font);
  $('#font-library-message').textContent = `已设为${target === 'title' ? '标题' : '正文'}字体，保存文章后生效`;
  switchPanel('articles');
}

function renderPages() {
  const list = $('#pages-list');
  if (!list) return;
  $('#pages-normal-mode')?.classList.toggle('btn-primary', !state.pagesTrashMode);
  $('#pages-trash-mode')?.classList.toggle('btn-primary', state.pagesTrashMode);
  list.innerHTML = state.pages.map((page) => `
    <div class="rounded-2xl bg-base-100/65 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="font-black">${escapeHtml(page.title)}</p>
          <p class="text-xs text-base-content/45">/page/${escapeHtml(page.slug)} · ${escapeHtml(page.template || 'default')} · ${escapeHtml(page.status || 'published')}${page.deleted_at ? ` · 删除于 ${escapeHtml(formatDate(page.deleted_at))}` : ''}</p>
        </div>
        <div class="flex gap-2">
          ${state.pagesTrashMode ? `
            <button class="btn btn-xs rounded-lg" data-restore-page="${page.id}">恢复</button>
            <button class="btn btn-xs btn-error rounded-lg" data-force-delete-page="${page.id}">永久删除</button>
          ` : `
            <a class="btn btn-xs rounded-lg" href="/page/${escapeHtml(page.slug)}" target="_blank">查看</a>
            <button class="btn btn-xs rounded-lg" data-edit-page="${page.id}">编辑</button>
            <button class="btn btn-xs btn-error rounded-lg" data-delete-page="${page.id}">删除</button>
          `}
        </div>
      </div>
    </div>
  `).join('') || `<p class="text-base-content/45">${state.pagesTrashMode ? '页面回收站为空' : '暂无自定义页面'}</p>`;
}

function renderComments() {
  const list = $('#comments-list');
  if (!list) return;
  list.innerHTML = state.comments.map((comment) => `
    <div class="rounded-2xl bg-base-100/65 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <label class="mt-1 inline-flex items-center">
          <input class="checkbox checkbox-sm" type="checkbox" data-comment-check="${comment.id}" aria-label="选择评论" />
        </label>
        <div class="min-w-0 flex-1">
          <p class="font-black">${escapeHtml(comment.author_name)} <span class="badge badge-ghost">${escapeHtml(comment.status)}</span></p>
          <p class="text-xs text-base-content/45">${escapeHtml(comment.article_title || '未知文章')} · ${formatDate(comment.created_at)}</p>
          <p class="mt-2 text-sm">${escapeHtml(comment.content)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-xs rounded-lg" data-reply-comment="${comment.id}">回复</button>
          <button class="btn btn-xs rounded-lg" data-comment-status="${comment.id}" data-status="approved">通过</button>
          <button class="btn btn-xs rounded-lg" data-comment-status="${comment.id}" data-status="spam">垃圾</button>
          <button class="btn btn-xs btn-error rounded-lg" data-delete-comment="${comment.id}">删除</button>
        </div>
      </div>
    </div>
  `).join('') || '<p class="text-base-content/45">暂无评论</p>';
}

function renderThemes() {
  const list = $('#themes-list');
  if (!list) return;
  list.innerHTML = state.themes.map((theme) => `
    <div class="rounded-2xl bg-base-100/65 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="font-black">${escapeHtml(theme.name)} ${theme.is_active ? '<span class="badge badge-primary">当前</span>' : ''}</p>
          <p class="text-xs text-base-content/45">${escapeHtml(theme.id)} · ${escapeHtml(theme.author || '')}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-xs rounded-lg" data-preview-theme="${theme.id}">预览</button>
          <button class="btn btn-xs rounded-lg" data-activate-theme="${theme.id}">启用</button>
          ${theme.is_active ? '' : `<button class="btn btn-xs btn-error rounded-lg" data-delete-theme="${theme.id}">删除</button>`}
        </div>
      </div>
    </div>
  `).join('') || '<p class="text-base-content/45">暂无主题</p>';
}

function renderPlugins() {
  const list = $('#plugins-list');
  if (!list) return;
  list.innerHTML = state.plugins.map((plugin) => `
    <div class="rounded-2xl bg-base-100/65 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="font-black">${escapeHtml(plugin.name)} <span class="badge ${plugin.is_active ? 'badge-primary' : 'badge-ghost'}">${plugin.is_active ? '已启用' : '已停用'}</span></p>
          <p class="text-xs text-base-content/45">${escapeHtml(plugin.id)} · ${escapeHtml(plugin.description || '')}</p>
        </div>
        <button class="btn btn-xs rounded-lg" data-toggle-plugin="${plugin.id}">${plugin.is_active ? '停用' : '启用'}</button>
      </div>
    </div>
  `).join('') || '<p class="text-base-content/45">暂无插件</p>';
}

async function editArticle(id) {
  const json = await request(`/admin/articles/${id}`);
  const post = json.data;
  const form = $('#article-form');
  const fields = form.elements;
  fields.namedItem('id').value = post.id;
  fields.namedItem('title').value = post.title || '';
  fields.namedItem('status').value = post.status || 'draft';
  fields.namedItem('visibility').value = post.visibility || 'public';
  fields.namedItem('category_id').value = post.category_id || '';
  fields.namedItem('excerpt').value = post.excerpt || '';
  fields.namedItem('cover_image').value = post.cover_image || '';
  updateCoverPreview(post.cover_image || '');
  fields.namedItem('content').value = post.content || '';
  fields.namedItem('title_font_key').value = fontKey({ family: post.title_font_family, url: post.title_font_url });
  fields.namedItem('body_font_key').value = fontKey({ family: post.body_font_family, url: post.body_font_url });
  fields.namedItem('is_pinned').checked = !!post.is_pinned;
  fields.namedItem('is_recommended').checked = !!post.is_recommended;
  const tagIds = new Set((post.tags || []).map((tag) => String(tag.id)));
  Array.from(fields.namedItem('tag_ids').options).forEach((option) => {
    option.selected = tagIds.has(option.value);
  });
  $('#editor-title').textContent = '编辑文章';
  $('#editor-message').textContent = '';
  switchPanel('editor');
}

function resetEditor() {
  $('#article-form').reset();
  $('#article-form').elements.namedItem('id').value = '';
  $('#editor-title').textContent = '新建文章';
  $('#editor-message').textContent = '';
  updateCoverPreview('');
  $('#title-font-select').value = '';
  $('#body-font-select').value = '';
  Array.from($('#tag-select').options).forEach((option) => {
    option.selected = false;
  });
}

async function saveArticle(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = form.elements;
  const id = fields.namedItem('id').value;
  const titleFont = parseFontSelection(fields.namedItem('title_font_key').value);
  const bodyFont = parseFontSelection(fields.namedItem('body_font_key').value);
  const payload = {
    title: fields.namedItem('title').value.trim(),
    content: fields.namedItem('content').value.trim(),
    excerpt: fields.namedItem('excerpt').value.trim(),
    cover_image: fields.namedItem('cover_image').value.trim(),
    title_font_family: titleFont.family,
    title_font_url: titleFont.url,
    body_font_family: bodyFont.family,
    body_font_url: bodyFont.url,
    status: fields.namedItem('status').value,
    visibility: fields.namedItem('visibility').value,
    category_id: fields.namedItem('category_id').value ? Number(fields.namedItem('category_id').value) : null,
    tag_ids: Array.from(fields.namedItem('tag_ids').selectedOptions).map((option) => Number(option.value)),
    is_pinned: fields.namedItem('is_pinned').checked,
    is_recommended: fields.namedItem('is_recommended').checked,
  };
  $('#editor-message').textContent = '正在保存...';
  try {
    await request(id ? `/admin/articles/${id}` : '/admin/articles', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    $('#editor-message').textContent = '保存成功';
    await Promise.all([loadDashboard(), loadArticles()]);
    switchPanel('articles');
  } catch (error) {
    $('#editor-message').textContent = error.message;
  }
}

async function deleteArticle(id) {
  if (!confirm('确认把这篇文章移入回收站？')) return;
  try {
    await request(`/admin/articles/${id}`, { method: 'DELETE' });
    await Promise.all([loadDashboard(), loadArticles()]);
    notify('文章已移入回收站');
  } catch (error) {
    notify(error.message || '删除文章失败', true);
  }
}

async function batchDeleteArticles() {
  const ids = $$('.article-check:checked').map((input) => Number(input.value));
  const trashed = $('#trash-filter')?.checked;
  if (!ids.length) {
    notify(trashed ? '请先勾选要永久删除的文章' : '请先勾选要移动到回收站的文章', true);
    return;
  }
  if (!confirm(trashed ? `确认永久删除 ${ids.length} 篇文章？此操作不可恢复。` : `确认把 ${ids.length} 篇文章移入回收站？`)) return;
  try {
    if (trashed) {
      for (const id of ids) {
        await request(`/admin/articles/${id}/force`, { method: 'DELETE' });
      }
    } else {
      await request('/admin/articles/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
    }
    $('#select-all-articles').checked = false;
    await Promise.all([loadDashboard(), loadArticles()]);
    notify(trashed ? `已永久删除 ${ids.length} 篇文章` : `已将 ${ids.length} 篇文章移入回收站`);
  } catch (error) {
    notify(error.message || (trashed ? '批量永久删除失败' : '批量删除失败'), true);
  }
}

async function restoreArticle(id) {
  try {
    await request(`/admin/articles/${id}/restore`, { method: 'PUT' });
    await Promise.all([loadDashboard(), loadArticles()]);
    notify('文章已恢复');
  } catch (error) {
    notify(error.message || '恢复文章失败', true);
  }
}

async function forceDeleteArticle(id) {
  if (!confirm('确认永久删除这篇文章？此操作不可恢复。')) return;
  try {
    await request(`/admin/articles/${id}/force`, { method: 'DELETE' });
    await Promise.all([loadDashboard(), loadArticles()]);
    notify('文章已永久删除');
  } catch (error) {
    notify(error.message || '永久删除文章失败', true);
  }
}

async function createCategory(event) {
  event.preventDefault();
  const input = event.currentTarget.elements.namedItem('name');
  const message = $('#category-message');
  message.textContent = '';
  try {
    await request('/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name: input.value.trim() }),
    });
    input.value = '';
    await loadTaxonomy();
    message.textContent = '分类已添加';
    notify('分类已添加');
  } catch (error) {
    message.textContent = error.message || '分类添加失败';
    notify(error.message || '分类添加失败', true);
  }
}

async function createTag(event) {
  event.preventDefault();
  const input = event.currentTarget.elements.namedItem('name');
  const message = $('#tag-message');
  message.textContent = '';
  try {
    await request('/admin/tags', {
      method: 'POST',
      body: JSON.stringify({ name: input.value.trim() }),
    });
    input.value = '';
    await loadTaxonomy();
    message.textContent = '标签已添加';
    notify('标签已添加');
  } catch (error) {
    message.textContent = error.message || '标签添加失败';
    notify(error.message || '标签添加失败', true);
  }
}

async function uploadCover(file) {
  $('#editor-message').textContent = '正在上传封面...';
  try {
    const media = await uploadFile(file);
    $('#article-form').elements.namedItem('cover_image').value = media.url;
    window.updateAdminFieldPreview?.('article-form', 'cover_image');
    updateCoverPreview(media.url);
    $('#editor-message').textContent = '封面上传成功';
    await loadMedia();
  } catch (error) {
    $('#editor-message').textContent = error.message;
  }
}

function updateCoverPreview(url) {
  const preview = $('#cover-preview');
  if (!preview) return;
  if (!url) {
    preview.classList.add('hidden');
    preview.innerHTML = '';
    return;
  }
  preview.classList.remove('hidden');
  preview.innerHTML = `<img class="h-40 w-full object-cover" src="${escapeHtml(url)}" alt="封面预览" />`;
}

function insertMarkdown(kind) {
  const textarea = $('#article-form')?.elements.namedItem('content');
  if (!textarea) return;
  const snippets = {
    heading: { before: '\n## ', text: '小标题', after: '\n' },
    bold: { before: '**', text: '重点文字', after: '**' },
    quote: { before: '\n> ', text: '引用内容', after: '\n' },
    code: { before: '\n```js\n', text: 'console.log(\"Hello\")', after: '\n```\n' },
    table: { before: '\n| 列一 | 列二 |\n| --- | --- |\n| ', text: '内容', after: ' | 内容 |\n' },
    image: { before: '\n![', text: '图片描述', after: '](/uploads/image.png)\n' },
    math: { before: '\n$$\n', text: 'E = mc^2', after: '\n$$\n' },
    footnote: { before: '', text: '需要说明的文字[^1]\n\n[^1]: 脚注内容', after: '' },
  };
  const item = snippets[kind];
  if (!item) return;
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || start;
  const selected = textarea.value.slice(start, end) || item.text;
  textarea.setRangeText(`${item.before}${selected}${item.after}`, start, end, 'end');
  textarea.focus();
  $('#editor-message').textContent = '已插入 Markdown 片段';
}

async function uploadMediaFiles(files) {
  if (!files.length) return;
  $('#media-message').textContent = `正在上传 ${files.length} 个文件...`;
  try {
    const uploaded = [];
    for (const file of files) {
      uploaded.push(await uploadFile(file, state.mediaSmartType ? null : state.mediaCurrentFolderId));
    }
    const categoryLabels = { image: '图片', video: '视频', audio: '音频', font: '字体', document: '文档', other: '其他文件' };
    const categories = Array.from(new Set(uploaded.map((item) => categoryLabels[item.category] || '其他文件')));
    $('#media-message').textContent = `上传完成，已自动归入：${categories.join('、')}`;
    notify(`已上传 ${files.length} 个媒体文件`);
    await loadMedia();
    await loadDashboard();
  } catch (error) {
    $('#media-message').textContent = error.message;
    notify(error.message || '上传媒体失败', true);
  }
  if ($('#media-upload')) $('#media-upload').value = '';
}

async function deleteMedia(id) {
  if (!confirm('确认把这个媒体文件移入回收站？')) return;
  try {
    await request(`/admin/media/${id}`, { method: 'DELETE' });
    await loadMedia();
    await loadDashboard();
    notify('媒体文件已移入回收站');
  } catch (error) {
    notify(error.message || '删除媒体失败', true);
  }
}

async function restoreMedia(id) {
  try {
    await request(`/admin/media/${id}/restore`, { method: 'PUT' });
    $('#media-message').textContent = '媒体文件已恢复';
    await loadMedia();
    await loadDashboard();
    notify('媒体文件已恢复');
  } catch (error) {
    notify(error.message || '恢复媒体失败', true);
  }
}

async function forceDeleteMedia(id) {
  if (!confirm('确认永久删除这个媒体文件？删除后磁盘文件也会被移除，不能恢复。')) return;
  try {
    await request(`/admin/media/${id}/force`, { method: 'DELETE' });
    $('#media-message').textContent = '媒体文件已永久删除';
    await loadMedia();
    await loadDashboard();
    notify('媒体文件已永久删除');
  } catch (error) {
    notify(error.message || '永久删除媒体失败', true);
  }
}

async function cleanupMedia() {
  if (!confirm('确认清理冗余媒体文件？系统会保留正在引用的文件和 1 小时内新上传的文件，其余文件会先移入媒体回收站。')) return;
  try {
    const json = await request('/admin/media/cleanup', { method: 'POST', body: JSON.stringify({}) });
    const data = json.data || {};
    const moved = (data.movedFiles || []).slice(0, 5).join('、');
    const kept = (data.keptFiles || []).slice(0, 3).map((item) => `${item.name}（${(item.references || []).join('、')}）`).join('、');
    $('#media-message').innerHTML = `
      <span>${escapeHtml(json.message || '清理完成')}</span>
      ${moved ? `<br><span class="text-base-content/50">移入回收站：${escapeHtml(moved)}</span>` : ''}
      ${kept ? `<br><span class="text-base-content/50">已保留：${escapeHtml(kept)}</span>` : ''}
    `;
    await loadMedia();
    await loadDashboard();
    notify(json.message || '冗余媒体已移入回收站');
  } catch (error) {
    notify(error.message || '清理媒体失败', true);
  }
}

async function emptyMediaTrash() {
  if (!state.mediaTrashMode) return;
  const removable = state.media.filter((file) => !file.in_use);
  const locked = state.media.length - removable.length;
  if (!removable.length) {
    $('#media-message').textContent = locked ? '回收站里的文件仍被引用，不能清空' : '媒体回收站为空';
    return;
  }
  if (!confirm(`确认永久删除 ${removable.length} 个未引用的回收站文件？${locked ? `\n另有 ${locked} 个仍被引用的文件会保留。` : ''}`)) return;
  let successCount = 0;
  let failedCount = 0;
  for (const file of removable) {
    try {
      await request(`/admin/media/${file.id}/force`, { method: 'DELETE' });
      successCount++;
    } catch {
      failedCount++;
    }
  }
  $('#media-message').textContent = `已永久删除 ${successCount} 个文件${failedCount ? `，${failedCount} 个删除失败或仍被引用` : ''}${locked ? `，保留 ${locked} 个使用中文件` : ''}`;
  await loadMedia();
  await loadDashboard();
  notify('媒体回收站清理完成');
}

async function downloadAdminFile(path, filenameHint) {
  $('#backup-message').textContent = '正在生成导出文件...';
  const headers = {};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
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
  $('#backup-message').textContent = `已开始下载：${filename}`;
}

async function loadBackupManifest() {
  const json = await request('/admin/backup/manifest');
  $('#backup-manifest').textContent = JSON.stringify(json.data || {}, null, 2);
  $('#backup-message').textContent = '备份清单已刷新';
}

async function handleBackupDownload(type) {
  try {
    if (type === 'full') {
      await downloadAdminFile('/admin/backup/full', 'boke-full.zip');
    } else if (type === 'database') {
      await downloadAdminFile('/admin/backup/database', 'blog.db');
    } else if (type === 'articles') {
      await downloadAdminFile('/admin/backup/articles', 'articles.json');
    } else if (type === 'manifest') {
      await downloadAdminFile('/admin/backup/manifest', 'backup-manifest.json');
      await loadBackupManifest();
    }
  } catch (error) {
    $('#backup-message').textContent = error.message || '导出失败';
    notify(error.message || '导出失败', true);
  }
}

async function handleBackupImport(type, file) {
  if (!file) return;
  const isDatabase = type === 'database';
  const warning = isDatabase
    ? `确认使用“${file.name}”恢复数据库？\n\n当前业务数据会被备份文件替换，系统会先自动保存一份恢复前快照。媒体实体文件不会随数据库导入。`
    : `确认导入“${file.name}”中的文章？\n\n相同 slug 的文章会更新，不存在的文章会新建。`;
  if (!window.confirm(warning)) return;

  const input = isDatabase ? $('#database-import-input') : $('#articles-import-input');
  const endpoint = isDatabase ? '/admin/backup/database/import' : '/admin/backup/articles/import';
  const formData = new FormData();
  formData.append('file', file);
  $('#backup-message').textContent = isDatabase ? '正在校验并恢复数据库，请勿关闭页面...' : '正在导入文章...';

  try {
    const headers = {};
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) {
      throw new Error(json.message || `导入失败（HTTP ${response.status}）`);
    }
    $('#backup-message').textContent = json.message || '导入完成';
    notify(json.message || '导入完成');
    await loadAll();
    await loadBackupManifest();
  } catch (error) {
    $('#backup-message').textContent = error.message || '导入失败';
    notify(error.message || '导入失败', true);
  } finally {
    if (input) input.value = '';
  }
}

async function addMusic(event) {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  const song = {
    title: fields.namedItem('title').value.trim(),
    artist: fields.namedItem('artist').value.trim(),
    playlist: fields.namedItem('playlist')?.value.trim() || '默认歌单',
    url: fields.namedItem('url').value.trim(),
    cover: fields.namedItem('cover').value.trim(),
    lyrics: fields.namedItem('lyrics').value.trim(),
    article_id: Number(fields.namedItem('article_id').value) || null,
    photo_id: Number(fields.namedItem('photo_id').value) || null,
  };
  if (!song.title || !song.url) return;
  const editingIndex = Number(event.currentTarget.dataset.editingIndex ?? -1);
  const isEditing = Number.isInteger(editingIndex) && editingIndex >= 0;
  if (isEditing) {
    state.music[editingIndex] = { ...state.music[editingIndex], ...song };
  } else {
    state.music.push(song);
    event.currentTarget.dataset.editingIndex = String(state.music.length - 1);
  }
  renderMusic();
  const saved = await saveMusic();
  if (!saved) return;
  delete event.currentTarget.dataset.editingIndex;
  event.currentTarget.reset();
  window.updateAdminFieldPreview?.('music-form', 'url');
  window.updateAdminFieldPreview?.('music-form', 'cover');
  $('#music-track-dialog')?.close();
}

async function saveMusic() {
  $('#music-message').textContent = '正在保存音乐...';
  try {
    await request('/admin/music', {
      method: 'PUT',
      body: JSON.stringify({ tracks: state.music }),
    });
    const playlistJson = await request('/admin/music/playlists');
    state.musicPlaylists = playlistJson.data || [];
    renderMusicPlaylists();
    renderMusic();
    $('#music-message').textContent = '音乐已保存';
    notify('音乐已保存');
    return true;
  } catch (error) {
    $('#music-message').textContent = error.message || '音乐保存失败';
    notify(error.message || '音乐保存失败', true);
    return false;
  }
}

async function saveMusicPlaylist(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = form.elements;
  const id = fields.namedItem('id').value;
  const previousName = id
    ? state.musicPlaylists.find((playlist) => String(playlist.id) === String(id))?.name || ''
    : '';
  const payload = {
    name: fields.namedItem('name').value.trim(),
    description: fields.namedItem('description').value.trim(),
    cover: fields.namedItem('cover').value.trim(),
    sort_order: Number(fields.namedItem('sort_order').value || 0),
    is_active: fields.namedItem('is_active').checked,
  };
  if (!payload.name) {
    $('#music-playlist-message').textContent = '请填写歌单名称';
    return;
  }
  try {
    await request(id ? `/admin/music/playlists/${id}` : '/admin/music/playlists', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    $('#music-playlist-message').textContent = id ? '歌单已更新' : '歌单已创建';
    notify(id ? '歌单已更新' : '歌单已创建');
    resetMusicPlaylistForm(false);
    const [musicJson, playlistJson] = await Promise.all([
      request('/admin/music'),
      request('/admin/music/playlists'),
    ]);
    state.music = musicJson.data || [];
    state.musicPlaylists = playlistJson.data || [];
    if (previousName && state.activeMusicPlaylistName === previousName) {
      state.activeMusicPlaylistName = payload.name;
      $('#music-tracks-dialog-title').textContent = payload.name;
    }
    renderMusicPlaylists();
    renderMusic();
    $('#music-playlist-dialog')?.close();
  } catch (error) {
    $('#music-playlist-message').textContent = error.message || '歌单保存失败';
    notify(error.message || '歌单保存失败', true);
  }
}

function resetMusicPlaylistForm(openDialog = true) {
  const form = $('#music-playlist-form');
  if (!form) return;
  form.reset();
  form.elements.namedItem('id').value = '';
  form.elements.namedItem('is_active').checked = true;
  $('#music-playlist-dialog-title').textContent = '新建歌单';
  $('#music-playlist-message').textContent = '';
  window.updateAdminFieldPreview?.('music-playlist-form', 'cover');
  if (openDialog) {
    $('#music-playlist-dialog')?.showModal();
    window.setTimeout(() => form.elements.namedItem('name')?.focus(), 0);
  }
}

function editMusicPlaylist(id) {
  const playlist = state.musicPlaylists.find((item) => String(item.id) === String(id));
  if (playlist) openMusicPlaylistDialog(playlist);
}

async function deleteMusicPlaylist(id) {
  if (!confirm('确认删除这个歌单吗？歌曲会保留。')) return;
  try {
    await request(`/admin/music/playlists/${id}`, { method: 'DELETE' });
    const [musicJson, playlistJson] = await Promise.all([
      request('/admin/music'),
      request('/admin/music/playlists'),
    ]);
    state.music = musicJson.data || [];
    state.musicPlaylists = playlistJson.data || [];
    if (state.activeMusicPlaylistName && !state.musicPlaylists.some((playlist) => playlist.name === state.activeMusicPlaylistName)) {
      state.activeMusicPlaylistName = '';
      $('#music-tracks-dialog')?.close();
    }
    renderMusic();
    renderMusicPlaylists();
    $('#music-playlist-message').textContent = '歌单已删除，歌曲已保留';
    notify('歌单已删除，歌曲已保留');
  } catch (error) {
    $('#music-playlist-message').textContent = error.message || '歌单删除失败';
    notify(error.message || '歌单删除失败', true);
  }
}

async function uploadMusicField(file, fieldName) {
  $('#music-message').textContent = '正在上传文件...';
  try {
    const media = await uploadFile(file);
    $('#music-form').elements.namedItem(fieldName).value = media.url;
    window.updateAdminFieldPreview?.('music-form', fieldName);
    $('#music-message').textContent = '上传成功';
    await loadMedia();
  } catch (error) {
    $('#music-message').textContent = error.message;
  }
}

async function editCategory(id) {
  const item = state.categories.find((cat) => String(cat.id) === String(id));
  const name = prompt('分类名称', item?.name || '');
  if (!name) return;
  try {
    await request(`/admin/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    await loadTaxonomy();
    $('#category-message').textContent = '分类已更新';
    notify('分类已更新');
  } catch (error) {
    $('#category-message').textContent = error.message || '分类更新失败';
    notify(error.message || '分类更新失败', true);
  }
}

async function deleteCategory(id) {
  if (!confirm('确认删除这个分类？相关文章会变为未分类。')) return;
  try {
    await request(`/admin/categories/${id}`, { method: 'DELETE' });
    await Promise.all([loadTaxonomy(), loadArticles()]);
    $('#category-message').textContent = '分类已删除，相关文章已变为未分类';
    notify('分类已删除');
  } catch (error) {
    $('#category-message').textContent = error.message || '分类删除失败';
    notify(error.message || '分类删除失败', true);
  }
}

async function editTag(id) {
  const item = state.tags.find((tag) => String(tag.id) === String(id));
  const name = prompt('标签名称', item?.name || '');
  if (!name) return;
  try {
    await request(`/admin/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    await loadTaxonomy();
    $('#tag-message').textContent = '标签已更新';
    notify('标签已更新');
  } catch (error) {
    $('#tag-message').textContent = error.message || '标签更新失败';
    notify(error.message || '标签更新失败', true);
  }
}

async function deleteTag(id) {
  if (!confirm('确认删除这个标签？文章上的关联会一起移除。')) return;
  try {
    await request(`/admin/tags/${id}`, { method: 'DELETE' });
    await Promise.all([loadTaxonomy(), loadArticles()]);
    $('#tag-message').textContent = '标签已删除，文章关联已移除';
    notify('标签已删除');
  } catch (error) {
    $('#tag-message').textContent = error.message || '标签删除失败';
    notify(error.message || '标签删除失败', true);
  }
}

function resetPageForm() {
  $('#page-form').reset();
  $('#page-form').elements.namedItem('id').value = '';
  $('#page-editor-title').textContent = '新建独立页面';
  $('#page-message').textContent = '';
}

function editPage(id) {
  const page = state.pages.find((item) => String(item.id) === String(id));
  if (!page) return;
  const fields = $('#page-form').elements;
  fields.namedItem('id').value = page.id;
  fields.namedItem('title').value = page.title || '';
  fields.namedItem('template').value = page.template || 'default';
  fields.namedItem('status').value = page.status || 'published';
  fields.namedItem('content').value = page.content || '';
  $('#page-editor-title').textContent = '编辑独立页面';
  switchPanel('pages');
}

async function savePage(event) {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  const id = fields.namedItem('id').value;
  const payload = {
    title: fields.namedItem('title').value.trim(),
    template: fields.namedItem('template').value,
    status: fields.namedItem('status').value,
    content: fields.namedItem('content').value,
  };
  try {
    await request(id ? `/admin/pages/${id}` : '/admin/pages', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    $('#page-message').textContent = '页面已保存';
    notify('页面已保存');
    resetPageForm();
    state.pagesTrashMode = false;
    await loadPages();
  } catch (error) {
    $('#page-message').textContent = error.message || '页面保存失败';
    notify(error.message || '页面保存失败', true);
  }
}

async function deletePage(id) {
  if (!confirm('确认把这个独立页面移入回收站？')) return;
  try {
    await request(`/admin/pages/${id}`, { method: 'DELETE' });
    notify('页面已移入回收站');
    await loadPages();
  } catch (error) {
    notify(error.message || '删除页面失败', true);
  }
}

async function restorePage(id) {
  try {
    await request(`/admin/pages/${id}/restore`, { method: 'PUT' });
    notify('页面已恢复');
    await loadPages();
  } catch (error) {
    notify(error.message || '恢复页面失败', true);
  }
}

async function forceDeletePage(id) {
  if (!confirm('确认永久删除这个独立页面？此操作不可恢复。')) return;
  try {
    await request(`/admin/pages/${id}/force`, { method: 'DELETE' });
    notify('页面已永久删除');
    await loadPages();
  } catch (error) {
    notify(error.message || '永久删除页面失败', true);
  }
}

async function updateCommentStatus(id, status) {
  try {
    await request(`/admin/comments/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    notify(status === 'approved' ? '评论已通过' : '评论已标记为垃圾');
    await Promise.all([loadComments(), loadDashboard()]);
  } catch (error) {
    notify(error.message || '评论状态更新失败', true);
  }
}

async function deleteComment(id) {
  if (!confirm('确认删除这条评论？')) return;
  try {
    await request(`/admin/comments/${id}`, { method: 'DELETE' });
    notify('评论已删除');
    await Promise.all([loadComments(), loadDashboard()]);
  } catch (error) {
    notify(error.message || '评论删除失败', true);
  }
}

function selectedCommentIds() {
  return $$('[data-comment-check]:checked').map((input) => input.dataset.commentCheck).filter(Boolean);
}

async function batchUpdateComments(status) {
  const ids = selectedCommentIds();
  if (!ids.length) {
    notify('请先选择评论', true);
    return;
  }
  const label = status === 'approved' ? '通过' : '标记为垃圾';
  if (!confirm(`确认将 ${ids.length} 条评论批量${label}？`)) return;
  try {
    for (const id of ids) {
      await request(`/admin/comments/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
    }
    notify(`已批量处理 ${ids.length} 条评论`);
    await Promise.all([loadComments(), loadDashboard()]);
  } catch (error) {
    notify(error.message || '批量处理评论失败', true);
  }
}

async function batchDeleteComments() {
  const ids = selectedCommentIds();
  if (!ids.length) {
    notify('请先选择评论', true);
    return;
  }
  if (!confirm(`确认删除 ${ids.length} 条评论？此操作不可恢复。`)) return;
  try {
    for (const id of ids) {
      await request(`/admin/comments/${id}`, { method: 'DELETE' });
    }
    notify(`已删除 ${ids.length} 条评论`);
    await Promise.all([loadComments(), loadDashboard()]);
  } catch (error) {
    notify(error.message || '批量删除评论失败', true);
  }
}

async function installTheme(event) {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  $('#theme-message').textContent = '正在安装主题...';
  try {
    await request('/admin/themes/install', {
      method: 'POST',
      body: JSON.stringify({
        id: fields.namedItem('id').value.trim(),
        name: fields.namedItem('name').value.trim(),
        primary: fields.namedItem('primary').value,
        author: fields.namedItem('author').value.trim(),
        description: fields.namedItem('description').value.trim(),
      }),
    });
    event.currentTarget.reset();
    $('#theme-message').textContent = '主题已安装';
    await loadThemes();
    notify('主题已安装');
  } catch (error) {
    $('#theme-message').textContent = error.message || '主题安装失败';
    notify(error.message || '主题安装失败', true);
  }
}

async function previewTheme(id) {
  try {
    await request(`/admin/themes/${id}/preview`, { method: 'POST', body: JSON.stringify({}) });
    $('#theme-message').textContent = '主题预览已开启，刷新前台查看';
    notify('主题预览已开启');
  } catch (error) {
    $('#theme-message').textContent = error.message || '主题预览失败';
    notify(error.message || '主题预览失败', true);
  }
}

async function activateTheme(id) {
  try {
    await request(`/admin/themes/${id}/activate`, { method: 'PUT' });
    await Promise.all([loadThemes(), loadSettings()]);
    $('#theme-message').textContent = '主题已切换';
    notify('主题已切换');
  } catch (error) {
    $('#theme-message').textContent = error.message || '主题切换失败';
    notify(error.message || '主题切换失败', true);
  }
}

async function deleteTheme(id) {
  if (!confirm('确认删除这个主题？')) return;
  try {
    await request(`/admin/themes/${id}`, { method: 'DELETE' });
    await loadThemes();
    $('#theme-message').textContent = '主题已删除';
    notify('主题已删除');
  } catch (error) {
    $('#theme-message').textContent = error.message || '主题删除失败';
    notify(error.message || '主题删除失败', true);
  }
}

async function installPlugin(event) {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  $('#plugin-message').textContent = '正在安装插件...';
  try {
    await request('/admin/plugins/install', {
      method: 'POST',
      body: JSON.stringify({
        id: fields.namedItem('id').value.trim(),
        name: fields.namedItem('name').value.trim(),
        description: fields.namedItem('description').value.trim(),
      }),
    });
    event.currentTarget.reset();
    $('#plugin-message').textContent = '插件已安装';
    await loadPlugins();
    notify('插件已安装');
  } catch (error) {
    $('#plugin-message').textContent = error.message || '插件安装失败';
    notify(error.message || '插件安装失败', true);
  }
}

async function togglePlugin(id) {
  try {
    await request(`/admin/plugins/${id}/toggle`, { method: 'PUT' });
    await loadPlugins();
    $('#plugin-message').textContent = '插件状态已更新';
    notify('插件状态已更新');
  } catch (error) {
    $('#plugin-message').textContent = error.message || '插件状态更新失败';
    notify(error.message || '插件状态更新失败', true);
  }
}

async function saveAccount(event) {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  const password = fields.namedItem('password').value;
  if (password && password.length < 8) {
    $('#account-message').textContent = '新密码不能少于 8 位';
    notify('新密码不能少于 8 位', true);
    return;
  }
  $('#account-message').textContent = '正在保存后台账号...';
  try {
    const payload = {
      nickname: fields.namedItem('nickname').value.trim(),
      avatar: fields.namedItem('avatar').value.trim(),
    };
    if (password) payload.password = password;
    const json = await request('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    state.user = json.data;
    renderAccount();
    $('#account-message').textContent = password ? '后台账号已保存，密码已更新' : '后台账号已保存';
    notify('后台账号已保存');
  } catch (error) {
    $('#account-message').textContent = error.message || '后台账号保存失败';
    notify(error.message || '后台账号保存失败', true);
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  $('#profile-message').textContent = '正在保存资料卡...';
  try {
    await request('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        settings: {
          profile_name: fields.namedItem('profile_name').value.trim(),
          profile_avatar: fields.namedItem('profile_avatar').value.trim(),
          profile_bio: fields.namedItem('profile_bio').value.trim(),
        },
      }),
    });
    $('#profile-message').textContent = '前台资料卡已保存';
    await loadSettings();
    notify('前台资料卡已保存');
  } catch (error) {
    $('#profile-message').textContent = error.message || '资料卡保存失败';
    notify(error.message || '资料卡保存失败', true);
  }
}

async function uploadAvatar(file) {
  $('#profile-message').textContent = '正在上传头像...';
  try {
    const media = await uploadFile(file);
    $('#profile-form').elements.namedItem('profile_avatar').value = media.url;
    window.updateAdminFieldPreview?.('profile-form', 'profile_avatar');
    $('#profile-message').textContent = '头像上传成功，记得保存';
    await loadMedia();
  } catch (error) {
    $('#profile-message').textContent = error.message || '头像上传失败';
    notify(error.message || '头像上传失败', true);
  }
}

async function uploadBannerImages(files) {
  if (!files.length) return;
  $('#settings-message').textContent = `正在上传 ${files.length} 张 Banner 图...`;
  const input = $('#site-settings-form').elements.namedItem('banner_images');
  const current = input.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  try {
    for (const file of files) {
      const media = await uploadFile(file);
      current.push(media.url);
    }
    input.value = Array.from(new Set(current)).join('\n');
    await saveBannerImages();
    $('#settings-message').textContent = 'Banner 图已上传并保存';
    await loadMedia();
  } catch (error) {
    $('#settings-message').textContent = error.message;
    notify(error.message || 'Banner 图上传失败', true);
  }
}

async function saveBannerImages() {
  const input = $('#site-settings-form').elements.namedItem('banner_images');
  await request('/admin/settings', {
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
}

async function saveSiteSettings(event) {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  $('#settings-message').textContent = '正在保存站点设置...';
  try {
    await request('/admin/settings', { method: 'PUT', body: JSON.stringify({ settings: {
      site_title: fields.namedItem('site_title').value.trim(),
      site_description: fields.namedItem('site_description').value.trim(),
      site_author: fields.namedItem('site_author').value.trim(),
      site_keywords: fields.namedItem('site_keywords').value.trim(),
      site_language: fields.namedItem('site_language').value,
      footer_text: fields.namedItem('footer_text').value.trim(),
      site_start_date: fields.namedItem('site_start_date').value,
      copyright_year: Number(fields.namedItem('copyright_year').value || new Date().getFullYear()),
      banner_images: fields.namedItem('banner_images').value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
      banner_interval: Number(fields.namedItem('banner_interval').value || 6),
      posts_per_page: Number(fields.namedItem('posts_per_page').value || 10),
      allow_search_indexing: fields.namedItem('allow_search_indexing').checked,
      enable_rss: fields.namedItem('enable_rss').checked,
      enable_json_feed: fields.namedItem('enable_json_feed').checked,
      show_visitor_stats: fields.namedItem('show_visitor_stats').checked,
      enable_comments: fields.namedItem('enable_comments').checked,
      comment_moderation: fields.namedItem('comment_moderation').checked,
    } }) });
    $('#settings-message').textContent = '站点设置已保存';
    await loadSettings();
    notify('站点设置已保存');
  } catch (error) {
    $('#settings-message').textContent = error.message || '站点设置保存失败';
    notify(error.message || '站点设置保存失败', true);
  }
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('zh-CN');
}

function formatSize(size) {
  const value = Number(size || 0);
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value > 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function parseSetting(row) {
  if (!row) return null;
  if (row.type === 'json') {
    try { return JSON.parse(row.value || 'null'); } catch { return null; }
  }
  if (row.type === 'boolean') return row.value === true || row.value === 'true' || row.value === '1';
  if (row.type === 'number') {
    const value = Number(row.value);
    return Number.isFinite(value) ? value : 0;
  }
  return row.value;
}
$$('.admin-nav').forEach((button) => {
  button.addEventListener('click', () => { notify(''); switchPanel(button.dataset.panel); });
});
document.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-panel-tab]');
  if (tab) { notify(''); switchPanel(tab.dataset.panelTab); }
});
$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#login-message').textContent = '正在登录...';
  try {
    const data = new FormData(event.currentTarget);
    const user = await login(data.get('username'), data.get('password'));
    $('#login-message').textContent = '';
    setStatus(`已登录：${user.nickname || user.username}`);
    await Promise.all([loadTaxonomy(), loadDashboard(), loadArticles(), loadMedia(), loadSettings()]);
    const hashPanel = location.hash.replace(/^#/, '').split('?')[0];
    switchPanel(panelTitles[hashPanel] ? hashPanel : 'dashboard');
  } catch (error) {
    $('#login-message').textContent = friendlyLoginError(error);
  }
});
$('#logout-admin').addEventListener('click', () => {
  localStorage.removeItem(tokenKey);
  state.token = '';
  $('#logout-admin').classList.add('hidden');
  setStatus('已退出登录');
  switchPanel('login');
});
$('#refresh-admin').addEventListener('click', loadAll);
$('#status-filter').addEventListener('change', loadArticles);
$('#trash-filter').addEventListener('change', loadArticles);
$('#batch-delete').addEventListener('click', batchDeleteArticles);
$('#select-all-articles').addEventListener('change', (event) => {
  $$('.article-check').forEach((input) => {
    input.checked = event.currentTarget.checked;
  });
});
let mediaSearchTimer = 0;
$('#media-search')?.addEventListener('input', () => {
  window.clearTimeout(mediaSearchTimer);
  mediaSearchTimer = window.setTimeout(loadMedia, 180);
});
$('#media-folder-list')?.addEventListener('click', (event) => {
  const folder = event.target.closest('[data-media-folder-id]');
  const smart = event.target.closest('[data-media-smart-type]');
  if (folder) {
    state.mediaCurrentFolderId = folder.dataset.mediaFolderId ? Number(folder.dataset.mediaFolderId) : null;
    state.mediaSmartType = '';
    state.mediaTrashMode = false;
    loadMedia();
  }
  if (smart) {
    state.mediaSmartType = smart.dataset.mediaSmartType || '';
    state.mediaCurrentFolderId = null;
    state.mediaTrashMode = false;
    loadMedia();
  }
});
$('.admin-media-breadcrumb')?.addEventListener('click', (event) => {
  const rootButton = event.target.closest('[data-media-breadcrumb-root]');
  const folder = event.target.closest('[data-media-breadcrumb-id]');
  if (!rootButton && !folder) return;
  state.mediaCurrentFolderId = folder ? Number(folder.dataset.mediaBreadcrumbId) : null;
  state.mediaSmartType = '';
  state.mediaTrashMode = false;
  loadMedia();
});
$('#media-create-folder')?.addEventListener('click', () => createMediaExplorerEntry('folder'));
$('#media-create-file')?.addEventListener('click', () => createMediaExplorerEntry('file'));
$('#media-sort')?.addEventListener('change', (event) => {
  state.mediaSort = event.currentTarget.value;
  localStorage.setItem('boke_media_sort', state.mediaSort);
  loadMedia();
});
$('#media-sort-order')?.addEventListener('click', () => {
  state.mediaSortOrder = state.mediaSortOrder === 'desc' ? 'asc' : 'desc';
  localStorage.setItem('boke_media_sort_order', state.mediaSortOrder);
  loadMedia();
});
$('#media-upload').addEventListener('change', (event) => uploadMediaFiles(Array.from(event.currentTarget.files || [])));
$('#cover-upload').addEventListener('change', (event) => {
  const file = event.currentTarget.files?.[0];
  if (file) uploadCover(file);
});
$('#reset-editor').addEventListener('click', resetEditor);
$('#article-form').addEventListener('submit', saveArticle);
$('#markdown-toolbar')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-md-insert]');
  if (button) insertMarkdown(button.dataset.mdInsert);
});
$('#add-font-library')?.addEventListener('click', addFontToLibrary);
$('#save-font-library')?.addEventListener('click', saveFontLibrary);
$('#font-file-upload')?.addEventListener('change', async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  $('#font-library-message').textContent = '正在上传字体...';
  try {
    const media = await uploadFile(file);
    $('#font-url-input').value = media.url;
    $('#font-name-input').value = $('#font-name-input').value.trim() || file.name.replace(/\.[^.]+$/, '');
    $('#font-library-message').textContent = '字体已上传，可点击加入字体库';
  } catch (error) {
    $('#font-library-message').textContent = error.message;
  }
});
$('#font-library-list')?.addEventListener('click', (event) => {
  const remove = event.target.closest('[data-remove-font]');
  const edit = event.target.closest('[data-edit-font]');
  const title = event.target.closest('[data-use-title-font]');
  const body = event.target.closest('[data-use-body-font]');
  if (edit) editFontEntry(edit.dataset.editFont);
  if (title) useFontInArticleForm(title.dataset.useTitleFont, 'title');
  if (body) useFontInArticleForm(body.dataset.useBodyFont, 'body');
  if (remove) {
    state.fontLibrary.splice(Number(remove.dataset.removeFont), 1);
    renderFontLibrary();
    $('#font-library-message').textContent = '字体已移除，记得保存字体库';
  }
});
$('#category-form').addEventListener('submit', createCategory);
$('#tag-form').addEventListener('submit', createTag);
$('#page-form').addEventListener('submit', savePage);
$('#reset-page').addEventListener('click', resetPageForm);
$('#pages-normal-mode')?.addEventListener('click', () => {
  state.pagesTrashMode = false;
  loadPages();
});
$('#pages-trash-mode')?.addEventListener('click', () => {
  state.pagesTrashMode = true;
  resetPageForm();
  loadPages();
});
$('#comment-status-filter').addEventListener('change', loadComments);
$('#theme-form').addEventListener('submit', installTheme);
$('#plugin-form').addEventListener('submit', installPlugin);
$('#account-form').addEventListener('submit', saveAccount);
$('#profile-form').addEventListener('submit', saveProfile);
$('#site-settings-form').addEventListener('submit', saveSiteSettings);
$('#site-settings-form').addEventListener('input', renderSettingsPreview);
$('#site-settings-form').addEventListener('change', renderSettingsPreview);
function openAdminSettingsSearch() {
  switchPanel('settings');
  document.querySelector('.admin-topbar')?.classList.add('is-searching');
  window.setTimeout(() => $('#admin-global-settings-search')?.focus(), 0);
}
function syncGlobalSettingsSearch(value) {
  const settingsSearch = $('#settings-search');
  if (!settingsSearch) return;
  settingsSearch.value = value;
  settingsSearch.dispatchEvent(new Event('input', { bubbles: true }));
}
$('#admin-sidebar-toggle')?.addEventListener('click', (event) => {
  const collapsed = root?.classList.toggle('is-sidebar-collapsed') || false;
  event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
  event.currentTarget.setAttribute('aria-label', collapsed ? '展开侧栏' : '收起侧栏');
});
$('#admin-search-toggle')?.addEventListener('click', openAdminSettingsSearch);
$('#admin-global-settings-search')?.addEventListener('input', (event) => { switchPanel('settings'); syncGlobalSettingsSearch(event.currentTarget.value || ''); });
$('#admin-global-settings-search')?.addEventListener('keydown', (event) => { if (event.key === 'Escape') { document.querySelector('.admin-topbar')?.classList.remove('is-searching'); event.currentTarget.blur(); } });
$('#admin-notification-toggle')?.addEventListener('click', () => { const notice = $('#admin-notice'); if (notice?.textContent) notice.classList.toggle('is-visible'); $('#admin-notification-dot')?.classList.add('hidden'); });
document.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openAdminSettingsSearch(); } });
$('#settings-search')?.addEventListener('input', (event) => {
  const term = String(event.currentTarget.value || '').trim().toLocaleLowerCase();
  const sections = Array.from(document.querySelectorAll('#settings-panel .admin-settings-section'));
  let visible = 0;
  sections.forEach((section) => {
    const headerText = section.querySelector(':scope > header')?.textContent || '';
    const sectionMatch = !term || `${section.dataset.settingsSearch || ''} ${headerText}`.toLocaleLowerCase().includes(term);
    const rows = Array.from(section.querySelectorAll('.admin-setting-row'));
    let rowMatches = 0;
    rows.forEach((row) => {
      const match = sectionMatch || row.textContent.toLocaleLowerCase().includes(term);
      row.classList.toggle('hidden', !match);
      if (match) rowMatches += 1;
    });
    section.querySelectorAll('.admin-settings-group').forEach((heading) => heading.classList.toggle('hidden', Boolean(term) && !sectionMatch));
    const show = !term || sectionMatch || rowMatches > 0;
    section.classList.toggle('hidden', !show);
    if (show) visible += 1;
  });
  $('#settings-search-empty')?.classList.toggle('hidden', visible > 0);
});
$('#avatar-upload').addEventListener('change', (event) => {
  const file = event.currentTarget.files?.[0];
  if (file) uploadAvatar(file);
});
$('#banner-upload').addEventListener('change', (event) => {
  uploadBannerImages(Array.from(event.currentTarget.files || []));
});
$('#media-normal-mode')?.addEventListener('click', () => {
  state.mediaTrashMode = false;
  state.mediaSmartType = '';
  state.mediaCurrentFolderId = null;
  loadMedia();
});
$('#media-trash-mode')?.addEventListener('click', () => {
  state.mediaTrashMode = true;
  state.mediaSmartType = '';
  state.mediaCurrentFolderId = null;
  loadMedia();
});
$('#cleanup-media').addEventListener('click', cleanupMedia);
$('#empty-media-trash')?.addEventListener('click', emptyMediaTrash);
$('#refresh-backup-manifest')?.addEventListener('click', loadBackupManifest);
$('#database-import-input')?.addEventListener('change', (event) => {
  handleBackupImport('database', event.currentTarget.files?.[0]);
});
$('#articles-import-input')?.addEventListener('change', (event) => {
  handleBackupImport('articles', event.currentTarget.files?.[0]);
});
$('#backup-panel')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-download-backup]');
  if (button) handleBackupDownload(button.dataset.downloadBackup);
});
$('#music-form').addEventListener('submit', addMusic);
$('#save-music').addEventListener('click', saveMusic);
$('#music-playlist-filter')?.addEventListener('change', renderMusic);
$('#music-playlist-form')?.addEventListener('submit', saveMusicPlaylist);
$('#reset-music-playlist')?.addEventListener('click', () => resetMusicPlaylistForm(true));
$('#music-playlist-dialog-close')?.addEventListener('click', () => $('#music-playlist-dialog')?.close());
$('#cancel-music-playlist')?.addEventListener('click', () => $('#music-playlist-dialog')?.close());
$('#music-tracks-dialog-close')?.addEventListener('click', () => $('#music-tracks-dialog')?.close());
$('#create-music-track')?.addEventListener('click', () => openMusicTrackDialog());
$('#music-track-dialog-close')?.addEventListener('click', () => $('#music-track-dialog')?.close());
$('#cancel-music-track')?.addEventListener('click', () => $('#music-track-dialog')?.close());
$('#music-audio-upload').addEventListener('change', (event) => {
  const file = event.currentTarget.files?.[0];
  if (file) uploadMusicField(file, 'url');
});
$('#music-cover-upload').addEventListener('change', (event) => {
  const file = event.currentTarget.files?.[0];
  if (file) uploadMusicField(file, 'cover');
});
$('#music-playlist-cover-upload')?.addEventListener('change', async (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  try {
    const media = await uploadFile(file);
    $('#music-playlist-form').elements.namedItem('cover').value = media.url;
    window.updateAdminFieldPreview?.('music-playlist-form', 'cover');
    $('#music-playlist-message').textContent = '封面上传成功';
    await loadMedia();
  } catch (error) {
    $('#music-playlist-message').textContent = error.message || '封面上传失败';
  }
});
$('#articles-table').addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit]');
  const del = event.target.closest('[data-delete]');
  const restore = event.target.closest('[data-restore]');
  const forceDelete = event.target.closest('[data-force-delete]');
  if (edit) editArticle(edit.dataset.edit);
  if (del) deleteArticle(del.dataset.delete);
  if (restore) restoreArticle(restore.dataset.restore);
  if (forceDelete) forceDeleteArticle(forceDelete.dataset.forceDelete);
});
$('#media-grid').addEventListener('click', (event) => {
  const item = event.target.closest('[data-media-id]');
  if (item) $$('#media-grid [data-media-id]').forEach((row) => row.classList.toggle('is-selected', row === item));
});
$('#media-grid')?.addEventListener('dblclick', (event) => {
  const item = event.target.closest('[data-media-id]');
  if (item) openMediaExplorerEntry(item.dataset.mediaKind || 'file', mediaExplorerEntry(item.dataset.mediaKind || 'file', item.dataset.mediaId));
});
$('#media-grid')?.addEventListener('contextmenu', (event) => {
  const item = event.target.closest('[data-media-id]');
  if (item) showMediaExplorerContext(event, item.dataset.mediaKind || 'file', item.dataset.mediaId);
});
$('#media-context-menu')?.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-media-context]')?.dataset.mediaContext;
  const context = state.mediaContext;
  if (!action || !context) return;
  const entry = mediaExplorerEntry(context.kind, context.id);
  closeMediaExplorerContext();
  if (!entry) return;
  if (action === 'open') openMediaExplorerEntry(context.kind, entry);
  if (action === 'rename') renameMediaExplorerEntry(context.kind, entry);
  if (action === 'move') moveMediaExplorerEntry(context.kind, entry);
  if (action === 'copy' && context.kind === 'file') { await navigator.clipboard?.writeText(entry.url || `/uploads/${entry.path}`); notify('\u5a92\u4f53\u94fe\u63a5\u5df2\u590d\u5236'); }
  if (action === 'font' && context.kind === 'file') addFontFromMedia(entry.id);
  if (action === 'delete') context.kind === 'folder' ? deleteMediaExplorerFolder(entry) : deleteMedia(entry.id);
  if (action === 'restore' && context.kind === 'file') restoreMedia(entry.id);
  if (action === 'force-delete' && context.kind === 'file') forceDeleteMedia(entry.id);
});
document.addEventListener('click', (event) => { if (!event.target.closest('#media-context-menu')) closeMediaExplorerContext(); });
window.addEventListener('blur', closeMediaExplorerContext);
$('#music-list').addEventListener('click', async (event) => {
  const batchRemove = event.target.closest('[data-batch-remove-music]');
  const edit = event.target.closest('[data-edit-song]');
  const move = event.target.closest('[data-move-song]');
  const remove = event.target.closest('[data-remove-song]');
  if (batchRemove) {
    await batchRemoveMusic();
    return;
  }
  if (edit) {
    const index = Number(edit.dataset.editSong);
    if (!state.music[index]) return;
    openMusicTrackDialog(index);
    return;
  }
  if (move) {
    const index = Number(move.dataset.moveSong);
    const playlistName = musicPlaylistName(state.music[index] || {});
    const playlistIndexes = state.music
      .map((song, songIndex) => ({ song, songIndex }))
      .filter((entry) => musicPlaylistName(entry.song) === playlistName)
      .map((entry) => entry.songIndex);
    const position = playlistIndexes.indexOf(index);
    const nextPosition = move.dataset.direction === 'up' ? position - 1 : position + 1;
    if (position < 0 || nextPosition < 0 || nextPosition >= playlistIndexes.length) return;
    const nextIndex = playlistIndexes[nextPosition];
    const current = state.music[index];
    state.music[index] = state.music[nextIndex];
    state.music[nextIndex] = current;
    renderMusic();
    $('#music-message').textContent = '顺序已调整，请保存排序';
    return;
  }
  if (remove) {
    state.music.splice(Number(remove.dataset.removeSong), 1);
    renderMusic();
    await saveMusic();
  }
});
$('#music-playlist-list')?.addEventListener('click', (event) => {
  const open = event.target.closest('[data-open-music-playlist]');
  const edit = event.target.closest('[data-edit-music-playlist]');
  const del = event.target.closest('[data-delete-music-playlist]');
  if (open) openMusicTracks(open.dataset.openMusicPlaylist);
  if (edit) editMusicPlaylist(edit.dataset.editMusicPlaylist);
  if (del) deleteMusicPlaylist(del.dataset.deleteMusicPlaylist);
});
$('#category-list').addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit-category]');
  const del = event.target.closest('[data-delete-category]');
  if (edit) editCategory(edit.dataset.editCategory);
  if (del) deleteCategory(del.dataset.deleteCategory);
});
$('#tag-list').addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit-tag]');
  const del = event.target.closest('[data-delete-tag]');
  if (edit) editTag(edit.dataset.editTag);
  if (del) deleteTag(del.dataset.deleteTag);
});
$('#pages-list').addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit-page]');
  const del = event.target.closest('[data-delete-page]');
  const restore = event.target.closest('[data-restore-page]');
  const forceDelete = event.target.closest('[data-force-delete-page]');
  if (edit) editPage(edit.dataset.editPage);
  if (del) deletePage(del.dataset.deletePage);
  if (restore) restorePage(restore.dataset.restorePage);
  if (forceDelete) forceDeletePage(forceDelete.dataset.forceDeletePage);
});
$('#comments-list').addEventListener('click', (event) => {
  const reply = event.target.closest('[data-reply-comment]');
  const status = event.target.closest('[data-comment-status]');
  const del = event.target.closest('[data-delete-comment]');
  if (reply) replyComment(reply.dataset.replyComment);
  if (status) updateCommentStatus(status.dataset.commentStatus, status.dataset.status);
  if (del) deleteComment(del.dataset.deleteComment);
});
$('#comment-select-all')?.addEventListener('click', () => {
  const checks = $$('[data-comment-check]');
  const shouldCheck = checks.some((input) => !input.checked);
  checks.forEach((input) => {
    input.checked = shouldCheck;
  });
});
$$('[data-comment-batch-status]').forEach((button) => {
  button.addEventListener('click', () => batchUpdateComments(button.dataset.commentBatchStatus));
});
$('#comment-batch-delete')?.addEventListener('click', batchDeleteComments);
$('#themes-list').addEventListener('click', (event) => {
  const preview = event.target.closest('[data-preview-theme]');
  const activate = event.target.closest('[data-activate-theme]');
  const del = event.target.closest('[data-delete-theme]');
  if (preview) previewTheme(preview.dataset.previewTheme);
  if (activate) activateTheme(activate.dataset.activateTheme);
  if (del) deleteTheme(del.dataset.deleteTheme);
});
$('#plugins-list').addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-toggle-plugin]');
  if (toggle) togglePlugin(toggle.dataset.togglePlugin);
});

loadAll();
